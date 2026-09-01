import {
  AfterViewInit,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  animate,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { SharedModule } from '../../../../shared/shared.module';
import { DynamicFormComponent } from '../../../../shared/dynamic-form/dynamic-form.component';
import { DynamicField } from '../../../../interfaces/dynamic-field';
import { VoiceInputService } from '../../../../shared/voice/voice-input.service';
import { getVoiceFieldSupport } from '../../../../shared/voice/voice-field.adapter';
import {
  buildTypeformReviewItems,
  TypeformReviewItemView,
} from './format-typeform-review.utils';
import {
  TypeformNavigationState,
  advanceNavigationState,
  buildVisibleQuestionIds,
  createInitialNavigationState,
  rebuildNavigationState,
  retreatNavigationState,
} from './typeform-question-navigator';

interface TypeformReviewItem extends TypeformReviewItemView {}

@Component({
  selector: 'app-typeform-fill-shell',
  standalone: true,
  imports: [CommonModule, SharedModule],
  providers: [VoiceInputService],
  templateUrl: './typeform-fill-shell.component.html',
  styleUrls: ['./typeform-fill-shell.component.scss'],
  animations: [
    trigger('questionSlide', [
      transition(':increment', [
        style({ opacity: 0, transform: 'translateX(24px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
      transition(':decrement', [
        style({ opacity: 0, transform: 'translateX(-24px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
    ]),
  ],
})
export class TypeformFillShellComponent implements AfterViewInit {
  readonly fields = input.required<DynamicField[]>();
  readonly formTitle = input('');
  readonly dueDateLabel = input('');
  readonly statusLabel = input('');
  readonly statusClass = input('');
  readonly canFill = input(true);
  readonly submitting = input(false);

  readonly submitRequested = output<void>();

  readonly voice = inject(VoiceInputService);

  private readonly formComponent = viewChild(DynamicFormComponent);
  private readonly shellRoot = viewChild<ElementRef<HTMLElement>>('shellRoot');

  readonly navState = signal<TypeformNavigationState>({
    phase: 'questions',
    activeQuestionIndex: 0,
    visibleQuestionIds: [],
    activeFieldId: null,
  });
  readonly animationStep = signal(0);
  readonly voiceHint = signal('');
  /** Bumped on every FormGroup change so Review reads fresh values. */
  readonly formValuesRevision = signal(0);
  readonly editingFromReviewFieldId = signal<string | null>(null);
  readonly reviewLightboxUrl = signal<string | null>(null);
  readonly brokenReviewImageUrls = signal<Set<string>>(new Set());

  private initialized = false;
  private wasListening = false;

  readonly isReviewPhase = computed(() => this.navState().phase === 'review');
  readonly isEditingFromReview = computed(() => !!this.editingFromReviewFieldId());

  readonly activeField = computed(() => {
    const activeId = this.navState().activeFieldId;
    if (!activeId) {
      return null;
    }

    return this.fields().find((field) => field.id === activeId) ?? null;
  });

  readonly activeFieldRequired = computed(() => {
    const field = this.activeField();
    const form = this.formComponent();
    if (!field) {
      return false;
    }

    if (!form) {
      return !!field.required;
    }

    const effects = form.getConditionalEffects();
    return effects[field.id]?.required ?? !!field.required;
  });

  readonly showVoiceButton = computed(() => {
    const field = this.activeField();
    if (!field || !this.canFill() || this.isReviewPhase()) {
      return false;
    }

    return getVoiceFieldSupport(field) !== 'none' && this.voice.isSupported();
  });

  readonly voiceStatusLabel = computed(() => {
    if (this.voice.listening()) {
      return 'Listening...';
    }

    if (this.voice.errorMessage()) {
      return this.voice.errorMessage();
    }

    if (this.voiceHint()) {
      return this.voiceHint();
    }

    return '';
  });

  readonly progressCurrent = computed(() => {
    const state = this.navState();
    if (!state.visibleQuestionIds.length) {
      return 0;
    }

    return Math.min(state.activeQuestionIndex + 1, state.visibleQuestionIds.length);
  });

  readonly progressTotal = computed(() => this.navState().visibleQuestionIds.length);

  readonly progressLabel = computed(() => {
    const total = this.progressTotal();
    if (!total || this.isReviewPhase()) {
      return '';
    }

    const current = String(this.progressCurrent()).padStart(2, '0');
    const totalLabel = String(total).padStart(2, '0');
    return `${current} / ${totalLabel}`;
  });

  readonly progressPercent = computed(() => {
    const total = this.progressTotal();
    if (!total || this.isReviewPhase()) {
      return 0;
    }

    return Math.round((this.progressCurrent() / total) * 100);
  });

  readonly activeFieldError = computed(() => {
    const field = this.activeField();
    const form = this.formComponent();
    if (!field || !form) {
      return null;
    }

    return form.getErrorMessage(field);
  });

  readonly voiceTranscriptPreview = computed(() => {
    if (!this.voice.listening()) {
      return '';
    }

    return this.voice.interimTranscript() || this.voice.finalTranscript();
  });

  readonly canGoBack = computed(() => {
    if (this.isEditingFromReview()) {
      return true;
    }

    const state = this.navState();
    if (this.isReviewPhase()) {
      return state.visibleQuestionIds.length > 0;
    }

    return state.activeQuestionIndex > 0;
  });

  readonly continueLabel = computed(() => {
    if (this.isEditingFromReview()) {
      return 'Save';
    }

    return this.isLastVisibleQuestion() ? 'Review' : 'Continue';
  });

  readonly reviewItems = computed((): TypeformReviewItem[] => {
    this.formValuesRevision();

    const form = this.formComponent();
    if (!form?.formReady()) {
      return [];
    }

    const effects = form.getConditionalEffects();
    const visibleIds = buildVisibleQuestionIds(this.fields(), effects);
    const values = form.value ?? {};

    return buildTypeformReviewItems(this.fields(), visibleIds, values);
  });

  constructor() {
    effect(() => {
      this.fields();
      this.initialized = false;
    });

    effect(() => {
      const listening = this.voice.listening();
      if (this.wasListening && !listening) {
        queueMicrotask(() => this.applyPendingVoiceTranscript());
      }
      this.wasListening = listening;
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.initializeIfNeeded());
  }

  getFormComponent(): DynamicFormComponent | undefined {
    return this.formComponent();
  }

  onFormValueChange(): void {
    this.formValuesRevision.update((value) => value + 1);
    this.initializeIfNeeded();
    this.syncNavigationFromForm();
  }

  continue(): void {
    if (this.isReviewPhase()) {
      return;
    }

    this.stopVoice();

    const form = this.formComponent();
    const state = this.navState();
    const fieldId = state.activeFieldId;

    if (!form || !fieldId) {
      return;
    }

    if (this.canFill() && !form.validateField(fieldId)) {
      this.focusActiveField();
      return;
    }

    if (this.isEditingFromReview()) {
      this.returnToReview();
      return;
    }

    this.animationStep.update((value) => value + 1);
    const effects = form.getConditionalEffects();
    this.navState.set(advanceNavigationState(state, this.fields(), effects));
    this.formValuesRevision.update((value) => value + 1);
    this.focusActiveField();
  }

  back(): void {
    if (this.isEditingFromReview()) {
      this.stopVoice();
      this.returnToReview();
      return;
    }

    if (!this.canGoBack()) {
      return;
    }

    this.stopVoice();
    this.animationStep.update((value) => value - 1);
    this.navState.update((state) => retreatNavigationState(state));
    this.focusActiveField();
  }

  jumpToQuestion(fieldId: string): void {
    this.stopVoice();

    const fromReview = this.isReviewPhase();
    if (fromReview) {
      this.editingFromReviewFieldId.set(fieldId);
    }

    const form = this.formComponent();
    const effects = form?.getConditionalEffects() ?? {};
    const visibleIds = buildVisibleQuestionIds(this.fields(), effects);
    const index = visibleIds.indexOf(fieldId);
    if (index === -1) {
      return;
    }

    this.animationStep.update((value) => (fromReview ? value - 1 : index >= this.navState().activeQuestionIndex ? value + 1 : value - 1));
    this.navState.set({
      phase: 'questions',
      activeQuestionIndex: index,
      visibleQuestionIds: visibleIds,
      activeFieldId: fieldId,
    });
    this.focusActiveField();
  }

  openReviewImageLightbox(url: string): void {
    if (!url) {
      return;
    }

    this.reviewLightboxUrl.set(url);
  }

  closeReviewImageLightbox(): void {
    this.reviewLightboxUrl.set(null);
  }

  onReviewImageError(url: string): void {
    this.brokenReviewImageUrls.update((current) => {
      const next = new Set(current);
      next.add(url);
      return next;
    });
  }

  isReviewImageBroken(url: string): boolean {
    return this.brokenReviewImageUrls().has(url);
  }

  submit(): void {
    this.stopVoice();

    const form = this.formComponent();
    if (!form) {
      return;
    }

    if (this.canFill() && !form.validate()) {
      this.navigateToFirstInvalidQuestion();
      return;
    }

    this.submitRequested.emit();
  }

  toggleVoice(): void {
    if (!this.showVoiceButton()) {
      return;
    }

    if (this.voice.listening()) {
      this.voice.stopListening();
      this.applyPendingVoiceTranscript();
      return;
    }

    this.voiceHint.set('');
    this.voice.startListening();
  }

  onShellKeydown(event: KeyboardEvent): void {
    if (this.isReviewPhase() || !this.canFill()) {
      return;
    }

    const field = this.activeField();
    if (!field) {
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (!this.shouldContinueOnEnter(field)) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    event.preventDefault();
    this.continue();
  }

  private shouldContinueOnEnter(field: DynamicField): boolean {
    return ['text', 'email', 'number', 'date', 'time', 'price', 'length', 'mass', 'volume'].includes(
      field.type,
    );
  }

  private isLastVisibleQuestion(): boolean {
    const state = this.navState();
    if (!state.visibleQuestionIds.length) {
      return true;
    }

    return state.activeQuestionIndex >= state.visibleQuestionIds.length - 1;
  }

  private initializeIfNeeded(): void {
    if (this.initialized) {
      return;
    }

    const form = this.formComponent();
    if (!form?.formReady()) {
      return;
    }

    this.initialized = true;
    const effects = form.getConditionalEffects();
    this.navState.set(createInitialNavigationState(this.fields(), effects));
    this.focusActiveField();
  }

  private syncNavigationFromForm(): void {
    const form = this.formComponent();
    if (!form?.formReady() || !this.initialized) {
      return;
    }

    if (this.isEditingFromReview()) {
      return;
    }

    const effects = form.getConditionalEffects();
    this.navState.update((state) => rebuildNavigationState(state, this.fields(), effects));
  }

  private returnToReview(): void {
    const form = this.formComponent();
    if (!form) {
      return;
    }

    this.editingFromReviewFieldId.set(null);
    this.formValuesRevision.update((value) => value + 1);
    this.brokenReviewImageUrls.set(new Set());

    const effects = form.getConditionalEffects();
    const visibleIds = buildVisibleQuestionIds(this.fields(), effects);

    this.navState.set({
      phase: 'review',
      activeQuestionIndex: Math.max(visibleIds.length - 1, 0),
      visibleQuestionIds: visibleIds,
      activeFieldId: visibleIds[visibleIds.length - 1] ?? null,
    });

    queueMicrotask(() => this.shellRoot()?.nativeElement.focus());
  }

  private navigateToFirstInvalidQuestion(): void {
    const form = this.formComponent();
    if (!form) {
      return;
    }

    form.markAllAsTouched();
    const effects = form.getConditionalEffects();
    const visibleIds = buildVisibleQuestionIds(this.fields(), effects);
    const fieldMap = new Map(this.fields().map((field) => [field.id, field]));

    for (let index = 0; index < visibleIds.length; index += 1) {
      const fieldId = visibleIds[index];
      const field = fieldMap.get(fieldId);
      if (!field) {
        continue;
      }

      const control = form.getControl(field.name);
      if (control && control.invalid && control.enabled) {
        this.animationStep.update((value) =>
          index >= this.navState().activeQuestionIndex ? value + 1 : value - 1,
        );
        this.navState.set({
          phase: 'questions',
          activeQuestionIndex: index,
          visibleQuestionIds: visibleIds,
          activeFieldId: fieldId,
        });
        this.focusActiveField();
        return;
      }
    }
  }

  private applyPendingVoiceTranscript(): void {
    const field = this.activeField();
    const form = this.formComponent();
    const transcript = this.voice.consumeFinalTranscript();

    if (!field || !form || !transcript) {
      return;
    }

    const result = form.applyVoiceTranscript(field, transcript);
    if (result.success) {
      this.voiceHint.set('');
      this.onFormValueChange();
      this.focusActiveField();
      return;
    }

    if (result.ambiguous) {
      this.voiceHint.set('Multiple options matched. Please choose manually or try again.');
      return;
    }

    if (result.unsupported) {
      this.voiceHint.set('Voice input is not available for this question. Please type your answer.');
      return;
    }

    this.voiceHint.set('Could not understand that answer. Please try again or type your answer.');
  }

  private stopVoice(): void {
    if (this.voice.listening()) {
      this.voice.stopListening();
      this.applyPendingVoiceTranscript();
    }

    this.voiceHint.set('');
  }

  private focusActiveField(): void {
    queueMicrotask(() => {
      const field = this.activeField();
      if (!field) {
        this.shellRoot()?.nativeElement.focus();
        return;
      }

      const element = document.getElementById(field.id);
      if (element instanceof HTMLElement) {
        element.focus();
        return;
      }

      this.shellRoot()?.nativeElement.focus();
    });
  }
}

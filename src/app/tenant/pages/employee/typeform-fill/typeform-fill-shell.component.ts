import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
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
import { VoiceOutputService } from '../../../../shared/voice/voice-output.service';
import { VoiceCommandService, VoiceCommandType } from '../../../../shared/voice/voice-command.service';
import {
  getVoiceFieldSupport,
  isVoiceInputSupported,
} from '../../../../shared/voice/voice-field.adapter';
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

export type TypeformInteractionMode = 'manual' | 'voice';

export type IntelligentVoiceUiState =
  | 'idle'
  | 'reading'
  | 'listening'
  | 'processing'
  | 'retrying'
  | 'navigating'
  | 'recognized'
  | 'unsupported'
  | 'error';

const MAX_VOICE_ANSWER_RETRIES = 3;
const MAX_EMPTY_TRANSCRIPT_SPEAKS = 2;

interface TypeformReviewItem extends TypeformReviewItemView {}

@Component({
  selector: 'app-typeform-fill-shell',
  standalone: true,
  imports: [CommonModule, SharedModule],
  providers: [VoiceInputService, VoiceOutputService],
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
export class TypeformFillShellComponent implements AfterViewInit, OnDestroy {
  readonly fields = input.required<DynamicField[]>();
  readonly formTitle = input('');
  readonly dueDateLabel = input('');
  readonly statusLabel = input('');
  readonly statusClass = input('');
  readonly canFill = input(true);
  readonly submitting = input(false);
  /** Chosen at EmployeeAssignment — presentation only. */
  readonly interactionMode = input.required<TypeformInteractionMode>();

  readonly submitRequested = output<void>();
  /** Emit when the top-right Regular Form / Voice Reply control changes. */
  readonly interactionModeChange = output<TypeformInteractionMode>();

  readonly voice = inject(VoiceInputService);
  readonly voiceOut = inject(VoiceOutputService);
  private readonly voiceCommands = inject(VoiceCommandService);

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
  readonly formValuesRevision = signal(0);
  readonly editingFromReviewFieldId = signal<string | null>(null);
  readonly reviewLightboxUrl = signal<string | null>(null);
  readonly brokenReviewImageUrls = signal<Set<string>>(new Set());

  /** When set, intelligent voice pauses STT for this field and uses keyboard. */
  readonly manualFallbackFieldId = signal<string | null>(null);
  readonly voiceUiState = signal<IntelligentVoiceUiState>('idle');
  readonly lastRecognizedAnswer = signal('');
  readonly processingVoice = signal(false);

  private initialized = false;
  private wasListening = false;
  private lastSpokenFieldId: string | null = null;
  private voiceSessionToken = 0;
  private suppressTranscriptApply = false;
  /** Failed answer / empty transcript retries for the current question. */
  private voiceRetryCount = 0;
  /** Consecutive empty STT results — avoids endless spoken retry loops. */
  private consecutiveEmptyResults = 0;

  readonly isManualMode = computed(() => this.interactionMode() === 'manual');
  readonly isVoiceMode = computed(() => this.interactionMode() === 'voice');

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

  readonly activeFieldVoiceSupported = computed(() => {
    const field = this.activeField();
    return !!field && isVoiceInputSupported(field);
  });

  readonly isManualFallbackActive = computed(() => {
    const field = this.activeField();
    if (!field) {
      return false;
    }

    if (!this.activeFieldVoiceSupported()) {
      return true;
    }

    return this.manualFallbackFieldId() === field.id;
  });

  readonly showManualVoiceButton = computed(() => {
    const field = this.activeField();
    if (!field || !this.canFill() || this.isReviewPhase() || !this.isManualMode()) {
      return false;
    }

    return getVoiceFieldSupport(field) !== 'none' && this.voice.isSupported();
  });

  readonly voiceStatusLabel = computed(() => {
    if (this.isVoiceMode()) {
      return '';
    }

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

  readonly intelligentVoiceStatusLabel = computed(() => {
    if (!this.isVoiceMode() || this.isReviewPhase()) {
      return '';
    }

    switch (this.voiceUiState()) {
      case 'reading':
        return 'Reading question...';
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing your answer...';
      case 'retrying':
        return this.voiceHint() || "I didn't catch that. Please try again.";
      case 'navigating':
        return this.voiceHint() || 'Okay, next question.';
      case 'recognized':
        return this.lastRecognizedAnswer()
          ? `Got it: ${this.lastRecognizedAnswer()}`
          : 'Answer captured.';
      case 'unsupported':
        return "Voice isn't available for this question. Please answer manually.";
      case 'error':
        return this.voiceHint() || this.voice.errorMessage() || "I didn't catch that. Please try again.";
      default:
        return this.voiceHint();
    }
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
        queueMicrotask(() => this.onListeningEnded());
      }
      this.wasListening = listening;
    });

    effect(() => {
      if (!this.isVoiceMode() || this.isReviewPhase()) {
        return;
      }

      const field = this.activeField();
      const formReady = this.formComponent()?.formReady();
      if (!field || !formReady || !this.initialized) {
        return;
      }

      // Re-run when question changes.
      field.id;
      queueMicrotask(() => this.beginIntelligentQuestionSession(field));
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.initializeIfNeeded());
  }

  ngOnDestroy(): void {
    this.voiceSessionToken += 1;
    this.voiceOut.stop();
    this.suppressTranscriptApply = true;
    this.voice.stopListening();
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

    this.stopVoiceActivity({ applyTranscript: this.isManualMode() });

    const form = this.formComponent();
    const state = this.navState();
    const fieldId = state.activeFieldId;

    if (!form || !fieldId) {
      return;
    }

    if (this.canFill() && !form.validateField(fieldId)) {
      this.focusActiveField();
      if (this.isVoiceMode()) {
        void this.retryAfterInvalidAnswer(
          'Please provide a valid answer before continuing.',
        );
      }
      return;
    }

    if (this.isEditingFromReview()) {
      this.returnToReview();
      return;
    }

    this.manualFallbackFieldId.set(null);
    this.lastRecognizedAnswer.set('');
    this.animationStep.update((value) => value + 1);
    const effects = form.getConditionalEffects();
    this.navState.set(advanceNavigationState(state, this.fields(), effects));
    this.formValuesRevision.update((value) => value + 1);
    this.focusActiveField();
  }

  back(): void {
    if (this.isEditingFromReview()) {
      this.stopVoiceActivity({ applyTranscript: false });
      this.returnToReview();
      return;
    }

    if (!this.canGoBack()) {
      return;
    }

    this.stopVoiceActivity({ applyTranscript: false });
    this.manualFallbackFieldId.set(null);
    this.lastRecognizedAnswer.set('');
    this.animationStep.update((value) => value - 1);
    this.navState.update((state) => retreatNavigationState(state));
    this.focusActiveField();
  }

  jumpToQuestion(fieldId: string): void {
    this.stopVoiceActivity({ applyTranscript: false });

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

    this.manualFallbackFieldId.set(null);
    this.lastRecognizedAnswer.set('');
    this.animationStep.update((value) =>
      fromReview
        ? value - 1
        : index >= this.navState().activeQuestionIndex
          ? value + 1
          : value - 1,
    );
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
    this.stopVoiceActivity({ applyTranscript: false });

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

  /**
   * Top-right Regular Form / Voice Reply switch.
   * Presentation only — does not reset FormGroup / answers / progress.
   */
  setInteractionMode(mode: TypeformInteractionMode): void {
    if (mode === this.interactionMode()) {
      return;
    }

    this.stopVoiceActivity({ applyTranscript: false });
    this.manualFallbackFieldId.set(null);
    this.lastRecognizedAnswer.set('');
    this.voiceHint.set('');
    this.voiceUiState.set('idle');
    this.interactionModeChange.emit(mode);
  }

  toggleVoice(): void {
    if (!this.showManualVoiceButton()) {
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

  enableManualFallback(): void {
    const field = this.activeField();
    if (!field) {
      return;
    }

    this.stopVoiceActivity({ applyTranscript: false });
    this.manualFallbackFieldId.set(field.id);
    this.voiceUiState.set('unsupported');
    this.voiceHint.set('');
    this.focusActiveField();
  }

  resumeVoiceForCurrentQuestion(): void {
    const field = this.activeField();
    if (!field || !this.isVoiceMode()) {
      return;
    }

    this.manualFallbackFieldId.set(null);
    this.voiceHint.set('');
    this.lastRecognizedAnswer.set('');
    this.resetVoiceRetryCounters();
    this.beginIntelligentQuestionSession(field, true);
  }

  retryVoiceListen(): void {
    const field = this.activeField();
    if (!field || !this.isVoiceMode() || this.isManualFallbackActive()) {
      return;
    }

    this.voiceHint.set('');
    this.lastRecognizedAnswer.set('');
    this.resetVoiceRetryCounters();
    this.startListeningForAnswer();
  }

  repeatCurrentQuestion(): void {
    const field = this.activeField();
    if (!field || !this.isVoiceMode()) {
      return;
    }

    this.beginIntelligentQuestionSession(field, true);
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

    this.stopVoiceActivity({ applyTranscript: false });
    this.editingFromReviewFieldId.set(null);
    this.manualFallbackFieldId.set(null);
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

  private onListeningEnded(): void {
    if (this.suppressTranscriptApply) {
      this.suppressTranscriptApply = false;
      this.voice.consumeFinalTranscript();
      return;
    }

    if (this.isVoiceMode()) {
      this.handleIntelligentVoiceTranscript();
      return;
    }

    this.applyPendingVoiceTranscript();
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

  private handleIntelligentVoiceTranscript(): void {
    void this.processIntelligentVoiceTranscript();
  }

  private async processIntelligentVoiceTranscript(): Promise<void> {
    const session = this.voiceSessionToken;
    this.processingVoice.set(true);
    this.voiceUiState.set('processing');

    const transcript = this.voice.consumeFinalTranscript();
    if (!transcript) {
      this.processingVoice.set(false);
      if (this.voice.errorMessage()) {
        this.voiceHint.set(this.voice.errorMessage());
        this.voiceUiState.set('error');
        return;
      }

      await this.retryUnunderstoodAnswer(session, {
        message: "I didn't catch that. Please try again.",
        emptyTranscript: true,
      });
      return;
    }

    this.consecutiveEmptyResults = 0;

    const field = this.activeField();
    const form = this.formComponent();
    const command = this.voiceCommands.detect(transcript, { fieldType: field?.type });

    if (command.isCommand && command.command) {
      this.processingVoice.set(false);
      this.resetVoiceRetryCounters();
      this.executeVoiceCommand(command.command);
      return;
    }

    if (!field || !form) {
      this.processingVoice.set(false);
      this.voiceUiState.set('idle');
      return;
    }

    if (this.isManualFallbackActive() || !isVoiceInputSupported(field)) {
      this.processingVoice.set(false);
      this.voiceHint.set("Voice isn't available for this question. Please answer manually.");
      this.voiceUiState.set('unsupported');
      return;
    }

    const result = form.applyVoiceTranscript(field, transcript);
    this.processingVoice.set(false);

    if (result.success) {
      this.lastRecognizedAnswer.set(transcript);
      this.voiceHint.set('');
      this.voiceUiState.set('recognized');
      this.onFormValueChange();

      const fieldId = field.id;
      if (this.canFill() && !form.validateField(fieldId)) {
        await this.retryUnunderstoodAnswer(session, {
          message: this.buildInvalidAnswerSpeech(field),
        });
        return;
      }

      await this.confirmAndAdvanceAfterAnswer(session);
      return;
    }

    if (result.ambiguous) {
      await this.retryUnunderstoodAnswer(session, {
        message: 'Multiple options matched. Please try again.',
      });
      return;
    }

    if (result.unsupported) {
      this.manualFallbackFieldId.set(field.id);
      this.voiceHint.set("Voice isn't available for this question. Please answer manually.");
      this.voiceUiState.set('unsupported');
      return;
    }

    await this.retryUnunderstoodAnswer(session, {
      message: this.buildUnunderstoodAnswerSpeech(field),
    });
  }

  private async confirmAndAdvanceAfterAnswer(session: number): Promise<void> {
    this.resetVoiceRetryCounters();

    if (this.isEditingFromReview()) {
      this.voiceUiState.set('navigating');
      this.voiceHint.set('Okay. Saving your answer.');
      await this.voiceOut.speak('Okay. Saving your answer.');
      if (!this.isVoiceSessionActive(session)) {
        return;
      }
      this.continue();
      return;
    }

    const confirmation = this.isLastVisibleQuestion()
      ? "Okay. Let's review your answers."
      : 'Okay, next question.';

    this.voiceUiState.set('navigating');
    this.voiceHint.set(confirmation);
    await this.voiceOut.speak(confirmation);

    if (!this.isVoiceSessionActive(session)) {
      return;
    }

    this.continue();
  }

  private async retryUnunderstoodAnswer(
    session: number,
    options: { message: string; emptyTranscript?: boolean },
  ): Promise<void> {
    if (!this.isVoiceSessionActive(session) || this.isManualFallbackActive() || this.isReviewPhase()) {
      return;
    }

    if (options.emptyTranscript) {
      this.consecutiveEmptyResults += 1;
    }

    this.voiceRetryCount += 1;
    this.voiceHint.set(options.message);

    if (this.voiceRetryCount > MAX_VOICE_ANSWER_RETRIES) {
      await this.enterVoiceUnderstandingFallback(session);
      return;
    }

    // Empty STT loops: speak only a couple of times, then silently re-listen.
    const shouldSpeak =
      !options.emptyTranscript || this.consecutiveEmptyResults <= MAX_EMPTY_TRANSCRIPT_SPEAKS;

    this.voiceUiState.set('retrying');

    if (shouldSpeak) {
      await this.voiceOut.speak(options.message);
      if (!this.isVoiceSessionActive(session)) {
        return;
      }
    }

    if (this.isManualFallbackActive() || this.isReviewPhase()) {
      return;
    }

    this.startListeningForAnswer();
  }

  private async enterVoiceUnderstandingFallback(session: number): Promise<void> {
    const message =
      "I'm having trouble understanding. You can try again or answer manually.";
    this.voiceHint.set(message);
    this.voiceUiState.set('error');
    await this.voiceOut.speak(message);
    if (!this.isVoiceSessionActive(session)) {
      return;
    }
    // Leave Try Again / Answer Manually buttons available — do not auto-listen.
  }

  private async retryAfterInvalidAnswer(message: string): Promise<void> {
    const session = this.voiceSessionToken;
    await this.retryUnunderstoodAnswer(session, { message });
  }

  private buildInvalidAnswerSpeech(field: DynamicField): string {
    if (
      field.type === 'number' ||
      field.type === 'price' ||
      field.type === 'length' ||
      field.type === 'mass' ||
      field.type === 'volume'
    ) {
      return "I didn't get a valid number. Please try again.";
    }

    if (field.type === 'email') {
      return "That doesn't look like a valid email. Please try again.";
    }

    return 'That answer is not valid. Please try again.';
  }

  private buildUnunderstoodAnswerSpeech(field: DynamicField): string {
    if (
      field.type === 'number' ||
      field.type === 'price' ||
      field.type === 'length' ||
      field.type === 'mass' ||
      field.type === 'volume'
    ) {
      return "I didn't get a valid number. Please try again.";
    }

    if (field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') {
      return "I didn't catch your selection. Please try again.";
    }

    if (field.type === 'rating') {
      return "I didn't catch a valid rating. Please try again.";
    }

    return "I didn't catch that. Please try again.";
  }

  private isVoiceSessionActive(session: number): boolean {
    return (
      session === this.voiceSessionToken &&
      this.isVoiceMode() &&
      !this.isReviewPhase() &&
      !!this.activeField()
    );
  }

  private resetVoiceRetryCounters(): void {
    this.voiceRetryCount = 0;
    this.consecutiveEmptyResults = 0;
  }

  private executeVoiceCommand(command: VoiceCommandType): void {
    switch (command) {
      case 'next':
      case 'skip':
        this.continue();
        break;
      case 'previous':
        this.back();
        break;
      case 'repeat':
        this.repeatCurrentQuestion();
        break;
      case 'startOver':
        this.startOverFromFirstQuestion();
        break;
    }
  }

  private startOverFromFirstQuestion(): void {
    this.stopVoiceActivity({ applyTranscript: false });
    this.editingFromReviewFieldId.set(null);
    this.manualFallbackFieldId.set(null);
    this.lastRecognizedAnswer.set('');
    this.lastSpokenFieldId = null;
    this.resetVoiceRetryCounters();

    const form = this.formComponent();
    const effects = form?.getConditionalEffects() ?? {};
    this.navState.set(createInitialNavigationState(this.fields(), effects));
    this.animationStep.update((value) => value - 1);
    this.focusActiveField();
  }

  private async beginIntelligentQuestionSession(
    field: DynamicField,
    forceSpeak = false,
  ): Promise<void> {
    if (!this.isVoiceMode() || this.isReviewPhase()) {
      return;
    }

    if (!forceSpeak && this.lastSpokenFieldId === field.id) {
      return;
    }

    // Stop any prior TTS/STT FIRST, then mint this session token.
    // (Previously the token was minted before stopVoiceActivity, which
    // incremented it again and caused TTS-end to skip startListening.)
    this.stopVoiceActivity({ applyTranscript: false, invalidateSession: true });
    const session = ++this.voiceSessionToken;

    this.lastSpokenFieldId = field.id;
    this.lastRecognizedAnswer.set('');
    this.voiceHint.set('');
    this.resetVoiceRetryCounters();

    if (!isVoiceInputSupported(field) && this.manualFallbackFieldId() !== field.id) {
      this.manualFallbackFieldId.set(field.id);
    }

    this.voiceUiState.set('reading');
    const speakText = this.buildQuestionSpeechText(field);

    await this.voiceOut.speak(speakText);

    // Stale session (user navigated / cancelled / new question started).
    if (session !== this.voiceSessionToken) {
      return;
    }

    // Question changed while speaking.
    if (this.activeField()?.id !== field.id || !this.isVoiceMode() || this.isReviewPhase()) {
      return;
    }

    if (this.manualFallbackFieldId() === field.id || !isVoiceInputSupported(field)) {
      this.voiceUiState.set('unsupported');
      this.focusActiveField();
      return;
    }

    if (!this.voice.isSupported()) {
      this.voiceHint.set('Voice input is not supported in this browser. Please answer manually.');
      this.voiceUiState.set('error');
      this.manualFallbackFieldId.set(field.id);
      return;
    }

    if (this.voiceOut.errorMessage() && !this.voiceOut.speaking()) {
      // TTS failed — still allow listening so the user is not stuck on Reading.
      this.voiceHint.set(this.voiceOut.errorMessage());
    }

    this.startListeningForAnswer();
  }

  private buildQuestionSpeechText(field: DynamicField): string {
    const required = this.activeFieldRequired() ? ' Required.' : '';
    const placeholder = field.placeholder ? ` ${field.placeholder}.` : '';
    return `${field.label}.${required}${placeholder}`.replace(/\s+/g, ' ').trim();
  }

  private startListeningForAnswer(): void {
    if (!this.isVoiceMode() || this.isManualFallbackActive() || this.isReviewPhase()) {
      return;
    }

    if (this.voice.listening()) {
      this.suppressTranscriptApply = true;
      this.voice.stopListening();
      this.voice.consumeFinalTranscript();
    }

    this.voiceHint.set('');
    this.voiceUiState.set('listening');
    this.voice.startListening();
  }

  /**
   * Stop TTS + STT. When invalidateSession is true, in-flight presentQuestion
   * awaits will bail out. Callers that already mint a new session should pass true
   * before minting, or false when they are about to mint themselves after this call.
   */
  private stopVoiceActivity(options: {
    applyTranscript: boolean;
    invalidateSession?: boolean;
  }): void {
    if (options.invalidateSession !== false) {
      this.voiceSessionToken += 1;
    }

    this.voiceOut.stop();

    if (this.voice.listening()) {
      this.suppressTranscriptApply = !options.applyTranscript;
      this.voice.stopListening();
      if (options.applyTranscript) {
        this.applyPendingVoiceTranscript();
      } else {
        this.voice.consumeFinalTranscript();
      }
    }

    if (
      this.voiceUiState() === 'reading' ||
      this.voiceUiState() === 'listening' ||
      this.voiceUiState() === 'processing' ||
      this.voiceUiState() === 'retrying' ||
      this.voiceUiState() === 'navigating'
    ) {
      this.voiceUiState.set('idle');
    }
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

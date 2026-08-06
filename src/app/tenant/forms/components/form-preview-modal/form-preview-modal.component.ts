import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DynamicField } from '../../../../interfaces/dynamic-field';
import { shouldIncludeFieldInRuntimeForm } from '../../../../shared/conditional-logic';
import { FormField } from '../../../form-builder/models/form-field.model';
import { normalizeFieldOrder } from '../../../form-builder/utils/form-field.factory';
import { FormStorageService } from '../../services/form-storage.service';
import { loadDynamicDropdownOptions } from '../../../../shared/dynamic-listing/dynamic-field-options.loader';

const CLOSE_ANIMATION_MS = 280;

@Component({
  selector: 'app-form-preview-modal',
  standalone: false,
  templateUrl: './form-preview-modal.component.html',
  styleUrl: './form-preview-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormPreviewModalComponent implements OnDestroy {
  private readonly formStorageService = inject(FormStorageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isOpen = input(false);
  readonly formFields = input<FormField[]>([]);
  readonly closed = output<void>();

  readonly isVisible = signal(false);
  readonly isClosing = signal(false);
  readonly previewFields = signal<DynamicField[]>([]);
  readonly loading = signal(false);
  readonly formReady = signal(false);

  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private fieldsCacheKey = '';
  private cachedPreviewFields: DynamicField[] = [];
  private loadRequestId = 0;
  private bodyScrollLocked = false;

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.openModal();
      }
    });
  }

  ngOnDestroy(): void {
    this.clearCloseTimer();
    this.unlockBodyScroll();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    if (this.isClosing() || !this.isVisible()) {
      return;
    }

    this.startCloseAnimation();
  }

  private openModal(): void {
    this.clearCloseTimer();
    this.isClosing.set(false);
    this.isVisible.set(true);
    this.formReady.set(false);
    this.lockBodyScroll();
    this.preparePreviewFields();
  }

  private startCloseAnimation(): void {
    this.isClosing.set(true);
    this.formReady.set(false);
    this.loadRequestId += 1;
    this.clearCloseTimer();

    this.closeTimer = setTimeout(() => {
      this.isVisible.set(false);
      this.isClosing.set(false);
      this.previewFields.set([]);
      this.loading.set(false);
      this.unlockBodyScroll();
      this.closed.emit();
    }, CLOSE_ANIMATION_MS);
  }

  private preparePreviewFields(): void {
    const requestId = ++this.loadRequestId;
    const fields = this.buildPreviewFields(this.formFields());
    const cacheKey = this.buildCacheKey(this.formFields());

    if (!fields.length) {
      this.previewFields.set([]);
      this.loading.set(false);
      this.formReady.set(false);
      return;
    }

    if (cacheKey === this.fieldsCacheKey && this.cachedPreviewFields.length) {
      this.previewFields.set(this.cachedPreviewFields);
      this.loading.set(false);
      this.scheduleFormMount();
      return;
    }

    if (!this.needsAsyncOptions(fields)) {
      this.commitPreviewFields(fields, cacheKey);
      return;
    }

    this.loading.set(true);
    this.previewFields.set([]);

    loadDynamicDropdownOptions(this.formStorageService, fields)
      .pipe(
        finalize(() => {
          if (requestId === this.loadRequestId) {
            this.loading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          this.commitPreviewFields(fields, cacheKey);
        },
        error: () => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          this.commitPreviewFields(fields, cacheKey);
        },
      });
  }

  private commitPreviewFields(fields: DynamicField[], cacheKey: string): void {
    this.fieldsCacheKey = cacheKey;
    this.cachedPreviewFields = fields;
    this.previewFields.set(fields);
    this.scheduleFormMount();
  }

  private scheduleFormMount(): void {
    this.formReady.set(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.isVisible() || this.isClosing()) {
          return;
        }

        this.formReady.set(true);
      });
    });
  }

  private buildPreviewFields(formFields: FormField[]): DynamicField[] {
    return normalizeFieldOrder(
      (formFields || []).filter((field) => shouldIncludeFieldInRuntimeForm(field)),
    ) as DynamicField[];
  }

  private needsAsyncOptions(fields: DynamicField[]): boolean {
    return fields.some(
      (field) =>
        field.type === 'select' &&
        (field.optionSource?.type === 'api' || field.optionSource?.type === 'dynamic') &&
        !!field.optionSource?.endpoint,
    );
  }

  private buildCacheKey(formFields: FormField[]): string {
    return this.buildPreviewFields(formFields)
      .map(
        (field) =>
          `${field.id}|${field.label}|${field.type}|${field.required}|${field.placeholder}|${field.selectionType || 'single'}|${JSON.stringify(field.options)}|${JSON.stringify(field.optionSource)}|${JSON.stringify(field.condition ?? null)}`,
      )
      .join('::');
  }

  private lockBodyScroll(): void {
    if (this.bodyScrollLocked) {
      return;
    }

    document.body.style.overflow = 'hidden';
    this.bodyScrollLocked = true;
  }

  private unlockBodyScroll(): void {
    if (!this.bodyScrollLocked) {
      return;
    }

    document.body.style.overflow = '';
    this.bodyScrollLocked = false;
  }

  private clearCloseTimer(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}

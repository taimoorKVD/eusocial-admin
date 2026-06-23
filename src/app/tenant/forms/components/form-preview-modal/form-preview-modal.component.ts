import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DynamicField } from '../../../../interfaces/dynamic-field';
import { FormField } from '../../../form-builder/models/form-field.model';
import { normalizeFieldOrder } from '../../../form-builder/utils/form-field.factory';
import { FormStorageService } from '../../services/form-storage.service';
import { loadDynamicDropdownOptions } from '../../../../shared/dynamic-listing/dynamic-field-options.loader';

@Component({
  selector: 'app-form-preview-modal',
  standalone: false,
  templateUrl: './form-preview-modal.component.html',
  styleUrl: './form-preview-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormPreviewModalComponent implements OnChanges {
  private readonly formStorageService = inject(FormStorageService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() isOpen = false;
  @Input() formFields: FormField[] = [];

  @Output() closed = new EventEmitter<void>();

  readonly previewFields = signal<DynamicField[]>([]);
  readonly loading = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.loadPreviewFields();
    }

    if (changes['isOpen']?.currentValue === false) {
      this.previewFields.set([]);
      this.loading.set(false);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  private loadPreviewFields(): void {
    const fields = normalizeFieldOrder(
      (this.formFields || []).filter(
        (field) => field.isShow !== false && field.label !== 'Role',
      ),
    ) as DynamicField[];

    if (!fields.length) {
      this.previewFields.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    loadDynamicDropdownOptions(this.formStorageService, fields)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.previewFields.set([...fields]);
        },
        error: () => {
          this.previewFields.set([...fields]);
        },
      });
  }
}

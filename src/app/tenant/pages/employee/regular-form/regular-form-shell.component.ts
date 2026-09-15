import {
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../../shared/shared.module';
import { DynamicFormComponent, DynamicFormSectionLayout } from '../../../../shared/dynamic-form/dynamic-form.component';
import { DynamicField } from '../../../../interfaces/dynamic-field';
import { EmployeeAssignmentSectionView } from '../../../../interfaces/employee-assignment';
import { AssignmentFormMode } from '../assignment-form-mode';

/**
 * Employee Portal — Regular Form mode.
 *
 * Dedicated presentation component for the Employee Portal's Normal Form.
 * It receives the COMPLETE sections -> rows -> fields hierarchy (never a
 * flattened array), derives the flat field list solely for the underlying
 * form engine, and renders each section heading + its rows/fields through a
 * single shared DynamicFormComponent instance (one FormGroup, full conditional
 * logic, existing validation + submission flow).
 *
 * Tenant Admin's DynamicFormComponent behavior is untouched: the grouped
 * `layoutSections` hint defaults to empty for every other consumer.
 */
@Component({
  selector: 'app-regular-form-shell',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './regular-form-shell.component.html',
  styleUrls: ['./regular-form-shell.component.scss'],
})
export class RegularFormShellComponent {
  readonly sections = input<EmployeeAssignmentSectionView[]>([]);
  readonly formTitle = input('');
  readonly dueDateLabel = input('');
  readonly canFill = input(true);
  readonly submitting = input(false);
  readonly interactionMode = input.required<AssignmentFormMode>();

  readonly submitRequested = output<void>();
  readonly interactionModeChange = output<AssignmentFormMode>();
  readonly exitRequested = output<void>();

  private readonly formComponent = viewChild(DynamicFormComponent);

  readonly isManualMode = computed(() => this.interactionMode() === 'manual');
  readonly isNormalMode = computed(() => this.interactionMode() === 'normal');

  /** Flat field list the form engine needs to build its single FormGroup. */
  readonly engineFields = computed<DynamicField[]>(() =>
    this.sections().flatMap((section) => section.fields),
  );

  /**
   * Sections -> rows -> fields layout passed only to DynamicForm's additive
   * `layoutSections` input. Full-width fields (e.g. images) span all columns.
   */
  readonly layoutSections = computed<DynamicFormSectionLayout[]>(() =>
    this.sections()
      .filter((section) => section.fields.length > 0)
      .map((section) => ({
        id: section.id,
        name: section.name,
        rows: section.rows && section.rows.length ? section.rows : [section.fields],
      })),
  );

  getFormComponent(): DynamicFormComponent | undefined {
    return this.formComponent();
  }

  setInteractionMode(mode: AssignmentFormMode): void {
    if (mode === this.interactionMode()) {
      return;
    }

    this.interactionModeChange.emit(mode);
  }

  requestExit(): void {
    this.exitRequested.emit();
  }

  submit(): void {
    if (!this.canFill() || this.submitting()) {
      return;
    }

    const form = this.formComponent();
    if (!form) {
      return;
    }

    if (!form.validate()) {
      this.scrollToFirstInvalid();
      return;
    }

    this.submitRequested.emit();
  }

  private scrollToFirstInvalid(): void {
    queueMicrotask(() => {
      const invalid = document.querySelector(
        '.regular-form-shell .ng-invalid, .regular-form-shell .field-shell--error, .regular-form-shell .field-error',
      );
      if (invalid instanceof HTMLElement) {
        invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
}

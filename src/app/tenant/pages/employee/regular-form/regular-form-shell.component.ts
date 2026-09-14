import {
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../../shared/shared.module';
import { DynamicFormComponent } from '../../../../shared/dynamic-form/dynamic-form.component';
import { DynamicField } from '../../../../interfaces/dynamic-field';
import { AssignmentFormMode } from '../assignment-form-mode';

/**
 * Normal Form shell — traditional multi-field layout (all fields, direct submit).
 * Presentation only; reuses DynamicForm / FormGroup.
 */
@Component({
  selector: 'app-regular-form-shell',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './regular-form-shell.component.html',
  styleUrls: ['./regular-form-shell.component.scss'],
})
export class RegularFormShellComponent {
  readonly fields = input.required<DynamicField[]>();
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

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

/** Shared presentation modes for the employee assignment fill experience. */
export type AssignmentFormMode = 'manual' | 'voice' | 'normal';

@Component({
  selector: 'app-normal-form-shell',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './normal-form-shell.component.html',
  styleUrls: ['./normal-form-shell.component.scss'],
})
export class NormalFormShellComponent {
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

  readonly isNormalMode = computed(() => this.interactionMode() === 'normal');
  readonly isManualMode = computed(() => this.interactionMode() === 'manual');
  readonly isVoiceMode = computed(() => this.interactionMode() === 'voice');

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
        '.normal-form-shell .ng-invalid, .normal-form-shell .field-shell--error, .normal-form-shell .field-error',
      );
      if (invalid instanceof HTMLElement) {
        invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
}

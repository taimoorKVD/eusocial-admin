import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, finalize, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { SharedModule } from '../../../../shared/shared.module';
import { DynamicFormComponent } from '../../../../shared/dynamic-form/dynamic-form.component';
import { DynamicFormFieldMapperService } from '../../../forms/services/dynamic-form-field.mapper.service';
import { EmployeeAssignmentsService } from '../../../../services/employee-assignments.service';
import {
  EmployeeAssignmentDetail,
  EmployeeAssignmentSectionView,
} from '../../../../interfaces/employee-assignment';
import { DynamicField, DynamicFormValue } from '../../../../interfaces/dynamic-field';
import { mapAssignmentSectionsToBuilder } from '../utils/assignment-form.mapper';
import { filterAnswerImages } from '../../../form-builder/utils/image-field.utils';
import { normalizeSignatureValue } from '../../../../shared/dynamic-form/signature-field.utils';
import { TypeformFillShellComponent } from '../typeform-fill/typeform-fill-shell.component';

export type EmployeeFormFillMode = 'classic' | 'typeform';

@Component({
  selector: 'app-employee-assignment',
  standalone: true,
  imports: [CommonModule, SharedModule, TypeformFillShellComponent],
  templateUrl: './employee-assignment.component.html',
})
export class EmployeeAssignmentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly assignmentsService = inject(EmployeeAssignmentsService);
  private readonly fieldMapper = inject(DynamicFormFieldMapperService);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dynamicForms = viewChildren(DynamicFormComponent);
  private readonly typeformShell = viewChild(TypeformFillShellComponent);

  /** Assigned employee forms use Typeform mode by default. */
  readonly fillMode = signal<EmployeeFormFillMode>('typeform');

  readonly loading = signal(true);
  readonly starting = signal(false);
  readonly submitting = signal(false);
  readonly showSuccess = signal(false);
  readonly errorMessage = signal('');
  readonly formError = signal('');
  readonly assignment = signal<EmployeeAssignmentDetail | null>(null);
  readonly sections = signal<EmployeeAssignmentSectionView[]>([]);

  readonly hasForm = computed(() =>
    this.sections().some((section) => section.fields.length > 0),
  );
  readonly isPending = computed(() => this.assignment()?.status === 'pending');
  readonly isCancelled = computed(() => this.assignment()?.status === 'cancelled');
  readonly isCompleted = computed(() => this.assignment()?.status === 'completed');
  readonly canFill = computed(() => {
    const status = this.assignment()?.status;
    return status === 'in_progress' || status === 'overdue';
  });
  readonly formTitle = computed(() => this.assignment()?.title || 'Assigned Form');
  readonly showForm = computed(
    () =>
      this.hasForm() &&
      !this.showSuccess() &&
      !this.isCancelled() &&
      !this.formError() &&
      (this.canFill() || this.isCompleted()),
  );
  readonly mergedFields = computed(() =>
    this.sections().flatMap((section) => section.fields),
  );

  ngOnInit(): void {
    const fillMode = this.route.snapshot.queryParamMap.get('fillMode');
    if (fillMode === 'classic') {
      this.fillMode.set('classic');
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.errorMessage.set('Assignment id is missing.');
      return;
    }
    this.loadAssignment(id);
  }

  goBack(): void {
    this.router.navigate(['/my-forms']);
  }

  statusLabel(status: string | undefined): string {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      case 'completed':
        return 'Completed';
      case 'overdue':
        return 'Overdue';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status || 'Unknown';
    }
  }

  statusClass(status: string | undefined): string {
    switch (status) {
      case 'in_progress':
        return 'bg-[#EEF4FF] text-[#2563EB]';
      case 'completed':
        return 'bg-[#ECFDF3] text-[#067647]';
      case 'overdue':
        return 'bg-[#FEF3F2] text-[#B42318]';
      case 'cancelled':
        return 'bg-[#F5F5F5] text-[#6F6F6F]';
      default:
        return 'bg-[#FFF4EA] text-[#FF9015]';
    }
  }

  startAssignment(): void {
    const current = this.assignment();
    if (!current || this.starting() || current.status !== 'pending') {
      return;
    }

    this.starting.set(true);

    this.assignmentsService
      .startAssignment(current.id)
      .pipe(
        catchError((err) => {
          const message = String(err?.error?.message || '').toLowerCase();
          const alreadyStarted =
            err?.status === 409 ||
            message.includes('already') ||
            message.includes('in_progress') ||
            message.includes('in progress');

          return alreadyStarted
            ? this.assignmentsService.getAssignment(current.id)
            : throwError(() => err);
        }),
        finalize(() => this.starting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          this.applyAssignment(this.mergeDetail(current, detail));
          this.toastr.success('Assignment started');
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Unable to start this assignment.');
        },
      });
  }

  submitForm(): void {
    const current = this.assignment();
    if (!current || this.submitting() || this.showSuccess() || !this.canFill()) {
      return;
    }

    const forms = this.resolveSubmissionForms();
    if (!forms.length || forms.some((form) => !form.validate())) {
      this.toastr.error('Please fill in all required fields.');
      return;
    }

    this.submitting.set(true);

    this.assignmentsService
      .submitAssignment(current.id, {
        answers: this.buildAnswers(forms),
        submit: true,
      })
      .pipe(
        switchMap(() => this.assignmentsService.getAssignment(current.id)),
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          this.applyAssignment(this.mergeDetail(current, detail));
          this.showSuccess.set(true);
          this.toastr.success('Form submitted successfully');
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Unable to submit this form.');
        },
      });
  }

  viewSubmittedForm(): void {
    this.showSuccess.set(false);
    const current = this.assignment();
    if (current) {
      this.applyAssignment(current);
    }
  }

  retry(): void {
    const id = this.assignment()?.id || this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAssignment(id);
    }
  }

  private loadAssignment(id: string): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.formError.set('');
    this.showSuccess.set(false);
    this.sections.set([]);

    this.assignmentsService
      .getAssignment(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => this.applyAssignment(detail),
        error: (err) => {
          this.assignment.set(null);
          this.sections.set([]);
          this.errorMessage.set(
            err?.error?.message || 'Unable to load this assignment. Please try again.',
          );
        },
      });
  }

  private applyAssignment(detail: EmployeeAssignmentDetail): void {
    this.assignment.set(detail);
    this.formError.set('');

    if (!detail.sections.length && !Object.keys(detail.schema).length) {
      this.formError.set('This assignment does not include a form schema to display.');
      this.sections.set([]);
      return;
    }

    this.hydrateSections(detail)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sections) => this.sections.set(sections),
        error: () => {
          this.sections.set([]);
          this.formError.set('Unable to prepare the form fields for this assignment.');
        },
      });
  }

  private hydrateSections(detail: EmployeeAssignmentDetail) {
    const answers = detail.status === 'completed' ? detail.answers : {};
    const mapped = mapAssignmentSectionsToBuilder(detail.sections, detail.schema, answers);
    const readonly = detail.status === 'completed';

    if (!mapped.length) {
      return of([] as EmployeeAssignmentSectionView[]);
    }

    return forkJoin(
      mapped.map((section) =>
        this.fieldMapper.resolveFields(section.builderFields).pipe(
          map((fields) => ({
            ...section,
            fields: this.withAnswersAndReadonly(fields, answers, readonly),
          })),
        ),
      ),
    );
  }

  private withAnswersAndReadonly(
    fields: DynamicField[],
    answers: Record<string, unknown>,
    readonly: boolean,
  ): DynamicField[] {
    return fields.map((field) => {
      const hasAnswer =
        !!field.id && Object.prototype.hasOwnProperty.call(answers, field.id);
      const next: DynamicField = hasAnswer
        ? { ...field, value: answers[field.id], defaultValue: answers[field.id] }
        : field;

      return readonly ? { ...next, isReadonly: true } : next;
    });
  }

  private mergeDetail(
    current: EmployeeAssignmentDetail,
    next: EmployeeAssignmentDetail,
  ): EmployeeAssignmentDetail {
    return {
      ...current,
      ...next,
      id: next.id || current.id,
      title: next.title || current.title,
      schema: Object.keys(next.schema).length ? next.schema : current.schema,
      sections: next.sections.length ? next.sections : current.sections,
      answers: Object.keys(next.answers).length ? next.answers : current.answers,
      submissionId: next.submissionId || current.submissionId,
    };
  }

  private resolveSubmissionForms(): DynamicFormComponent[] {
    if (this.fillMode() === 'typeform') {
      const form = this.typeformShell()?.getFormComponent();
      return form ? [form] : [];
    }

    return [...this.dynamicForms()];
  }

  private buildAnswers(forms: readonly DynamicFormComponent[]): Record<string, unknown> {
    if (this.fillMode() === 'typeform') {
      return this.buildAnswersFromFields(forms[0], this.mergedFields());
    }

    const answers: Record<string, unknown> = {};

    this.sections().forEach((section, index) => {
      const values: DynamicFormValue = forms[index]?.value ?? {};
      for (const field of section.fields) {
        const mapped = this.mapFieldAnswer(field, values);
        if (mapped !== undefined && field.id) {
          answers[field.id] = mapped;
        }
      }
    });

    return answers;
  }

  private buildAnswersFromFields(
    form: DynamicFormComponent | undefined,
    fields: DynamicField[],
  ): Record<string, unknown> {
    const answers: Record<string, unknown> = {};
    if (!form) {
      return answers;
    }

    const values: DynamicFormValue = form.value ?? {};
    for (const field of fields) {
      const mapped = this.mapFieldAnswer(field, values);
      if (mapped !== undefined && field.id) {
        answers[field.id] = mapped;
      }
    }

    return answers;
  }

  private mapFieldAnswer(field: DynamicField, values: DynamicFormValue): unknown {
    if (!field.id) {
      return undefined;
    }

    const hasName = Object.prototype.hasOwnProperty.call(values, field.name);
    const value = hasName ? values[field.name] : values[field.id];

    if (field.type === 'image') {
      return filterAnswerImages(value);
    }

    if (field.type === 'signature') {
      return normalizeSignatureValue(value);
    }

    return value instanceof File ? value.name : value ?? '';
  }
}

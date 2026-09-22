import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { SharedModule } from '../../../shared/shared.module';
import {
  AssignedFormDetail,
  AssignedFormsService,
} from '../../../services/assigned-forms.service';
import { DynamicFormFieldMapperService } from '../../forms/services/dynamic-form-field.mapper.service';
import { EmployeeAssignmentSectionView } from '../../../interfaces/employee-assignment';
import { DynamicField } from '../../../interfaces/dynamic-field';
import { mapAssignmentSectionsToBuilder } from '../employee/utils/assignment-form.mapper';
import { CompletedFormViewComponent } from '../employee/typeform-fill/completed-form-view.component';

/**
 * Tenant Admin read-only view for a completed/assigned form submission.
 */
@Component({
  selector: 'app-assigned-form-view',
  standalone: true,
  imports: [CommonModule, SharedModule, CompletedFormViewComponent],
  templateUrl: './assigned-form-view.component.html',
  styleUrl: './assigned-form-view.component.scss',
})
export class AssignedFormViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly assignedFormsService = inject(AssignedFormsService);
  private readonly fieldMapper = inject(DynamicFormFieldMapperService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly detail = signal<AssignedFormDetail | null>(null);
  readonly sections = signal<EmployeeAssignmentSectionView[]>([]);

  readonly formTitle = computed(() => this.detail()?.formName || 'Assigned Form');
  readonly answers = computed(() => this.detail()?.answers ?? {});
  readonly submittedAt = computed(() => this.detail()?.submittedAt ?? null);
  readonly assignedTo = computed(() => this.detail()?.assignedTo || '—');
  readonly dueDate = computed(() => this.detail()?.dueDate ?? null);
  readonly mode = computed(() => this.detail()?.mode ?? null);

  readonly statusLabel = computed(() => {
    switch (this.detail()?.status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'overdue':
        return 'Overdue';
      default:
        return 'Pending';
    }
  });

  readonly statusClass = computed(() => {
    switch (this.detail()?.status) {
      case 'completed':
        return 'bg-[#ECFDF3] text-[#067647]';
      case 'in_progress':
        return 'bg-[#FFFBEB] text-[#B45309]';
      case 'overdue':
        return 'bg-[#FEF2F2] text-[#B42318]';
      default:
        return 'bg-[#F3F4F6] text-[#4B5563]';
    }
  });

  readonly hasContent = computed(
    () =>
      !!this.detail() &&
      (this.sections().some((section) => section.fields.length > 0) ||
        Object.keys(this.answers()).length > 0),
  );

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          if (!id) {
            this.loading.set(false);
            this.errorMessage.set('Assignment id is missing.');
            return of(null);
          }

          this.loading.set(true);
          this.errorMessage.set('');
          this.detail.set(null);
          this.sections.set([]);

          return this.assignedFormsService.getAssignedForm(id).pipe(
            switchMap((detail) =>
              this.hydrateSections(detail).pipe(
                map((sections) => ({ detail, sections })),
              ),
            ),
            catchError((err) => {
              this.errorMessage.set(
                err?.error?.message ||
                  'Unable to load this assigned form. Please try again.',
              );
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.detail.set(result.detail);
        this.sections.set(result.sections);
      });
  }

  goBack(): void {
    this.router.navigate(['/assigned-forms']);
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.assignedFormsService
      .getAssignedForm(id)
      .pipe(
        switchMap((detail) =>
          this.hydrateSections(detail).pipe(
            map((sections) => ({ detail, sections })),
          ),
        ),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.detail.set(result.detail);
          this.sections.set(result.sections);
        },
        error: (err) => {
          this.detail.set(null);
          this.sections.set([]);
          this.errorMessage.set(
            err?.error?.message ||
              'Unable to load this assigned form. Please try again.',
          );
        },
      });
  }

  formatDueDate(value: string | null): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private hydrateSections(detail: AssignedFormDetail) {
    const answers = detail.answers ?? {};
    const mapped = mapAssignmentSectionsToBuilder(
      detail.sections,
      detail.schema,
      answers,
    );

    if (!mapped.length) {
      return of([] as EmployeeAssignmentSectionView[]);
    }

    return forkJoin(
      mapped.map((section) =>
        this.fieldMapper.resolveFields(section.builderFields).pipe(
          map((fields) => {
            const answered = this.withAnswers(fields, answers);
            const byId = new Map(
              answered.map((field) => [String(field.id), field] as const),
            );
            const rows: DynamicField[][] = section.builderRows.map((row) =>
              row
                .map((builderField) => byId.get(String(builderField.id)))
                .filter((field): field is DynamicField => !!field),
            );

            return {
              id: section.id,
              name: section.name,
              builderFields: section.builderFields,
              fields: answered,
              rows: rows.length ? rows : [answered],
            } satisfies EmployeeAssignmentSectionView;
          }),
        ),
      ),
    );
  }

  private withAnswers(
    fields: DynamicField[],
    answers: Record<string, unknown>,
  ): DynamicField[] {
    return fields.map((field) => {
      const hasAnswer =
        !!field.id && Object.prototype.hasOwnProperty.call(answers, field.id);
      return hasAnswer
        ? {
            ...field,
            value: answers[field.id],
            defaultValue: answers[field.id],
            isReadonly: true,
          }
        : {
            ...field,
            isReadonly: true,
          };
    });
  }
}

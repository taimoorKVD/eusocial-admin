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
import { SharedModule } from '../../../../shared/shared.module';
import { EmployeeHistoryService } from '../../../../services/employee-history.service';
import { DynamicFormFieldMapperService } from '../../../forms/services/dynamic-form-field.mapper.service';
import {
  EmployeeAssignmentSectionView,
} from '../../../../interfaces/employee-assignment';
import {
  EmployeeHistorySubmissionDetail,
} from '../../../../interfaces/employee-history-submission';
import { DynamicField } from '../../../../interfaces/dynamic-field';
import { mapAssignmentSectionsToBuilder } from '../utils/assignment-form.mapper';
import { CompletedFormViewComponent } from '../typeform-fill/completed-form-view.component';

/**
 * Read-only History submission detail — GET /data-collection/submissions/:id.
 * Separate from My Forms editable assignment flow.
 */
@Component({
  selector: 'app-employee-history-detail',
  standalone: true,
  imports: [CommonModule, SharedModule, CompletedFormViewComponent],
  templateUrl: './employee-history-detail.component.html',
})
export class EmployeeHistoryDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly historyService = inject(EmployeeHistoryService);
  private readonly fieldMapper = inject(DynamicFormFieldMapperService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly submission = signal<EmployeeHistorySubmissionDetail | null>(null);
  readonly sections = signal<EmployeeAssignmentSectionView[]>([]);

  readonly formTitle = computed(
    () => this.submission()?.title || 'Submitted Form',
  );
  readonly answers = computed(() => this.submission()?.answers ?? {});
  readonly submittedAt = computed(() => this.submission()?.submittedAt ?? null);
  readonly statusLabel = computed(() =>
    this.formatStatus(this.submission()?.status),
  );
  readonly statusClass = computed(() =>
    this.statusBadgeClass(this.submission()?.status),
  );
  readonly hasContent = computed(
    () =>
      !!this.submission() &&
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
            this.errorMessage.set('Submission id is missing.');
            return of(null);
          }

          this.loading.set(true);
          this.errorMessage.set('');
          this.submission.set(null);
          this.sections.set([]);

          return this.historyService.getSubmission(id).pipe(
            switchMap((detail) =>
              this.hydrateSections(detail).pipe(
                map((sections) => ({ detail, sections })),
              ),
            ),
            catchError((err) => {
              this.errorMessage.set(
                err?.error?.message ||
                  'Unable to load this submission. Please try again.',
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
        this.submission.set(result.detail);
        this.sections.set(result.sections);
      });
  }

  goBack(): void {
    this.router.navigate(['/history']);
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    this.historyService
      .getSubmission(id)
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
          this.submission.set(result.detail);
          this.sections.set(result.sections);
        },
        error: (err) => {
          this.submission.set(null);
          this.sections.set([]);
          this.errorMessage.set(
            err?.error?.message ||
              'Unable to load this submission. Please try again.',
          );
        },
      });
  }

  private hydrateSections(detail: EmployeeHistorySubmissionDetail) {
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
          map((fields) => ({
            id: section.id,
            name: section.name,
            builderFields: section.builderFields,
            fields: this.withAnswers(fields, answers),
            rows: section.builderRows.map((row) =>
              row
                .map((builderField) =>
                  fields.find((field) => field.id === builderField.id),
                )
                .filter((field): field is DynamicField => !!field)
                .map((field) => this.withAnswers([field], answers)[0]),
            ),
          })),
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
        : { ...field, isReadonly: true };
    });
  }

  private formatStatus(status: string | undefined): string {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      case 'overdue':
        return 'Overdue';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status ? status.replace(/_/g, ' ') : 'Completed';
    }
  }

  private statusBadgeClass(status: string | undefined): string {
    switch (status) {
      case 'completed':
        return 'bg-[#ECFDF3] text-[#067647]';
      case 'overdue':
        return 'bg-[#FEF3F2] text-[#B42318]';
      case 'cancelled':
        return 'bg-[#F5F5F5] text-[#6F6F6F]';
      case 'in_progress':
        return 'bg-[#EEF4FF] text-[#2563EB]';
      default:
        return 'bg-[#ECFDF3] text-[#067647]';
    }
  }
}

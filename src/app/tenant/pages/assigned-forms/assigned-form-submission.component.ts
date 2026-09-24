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
import { finalize, forkJoin, map, of } from 'rxjs';
import { SharedModule } from '../../../shared/shared.module';
import {
  AssignmentOccurrenceItem,
  AssignedFormsService,
  OccurrenceSubmissionDetail,
} from '../../../services/assigned-forms.service';
import { DynamicFormFieldMapperService } from '../../forms/services/dynamic-form-field.mapper.service';
import { EmployeeAssignmentSectionView } from '../../../interfaces/employee-assignment';
import { DynamicField } from '../../../interfaces/dynamic-field';
import { mapAssignmentSectionsToBuilder } from '../employee/utils/assignment-form.mapper';
import { CompletedFormViewComponent } from '../employee/typeform-fill/completed-form-view.component';

interface OccurrenceViewNavState {
  occurrence?: AssignmentOccurrenceItem;
  formName?: string;
}

/**
 * Tenant Admin read-only view for a completed occurrence submission.
 * Uses submission data already loaded from Assignment Details — no extra API call.
 */
@Component({
  selector: 'app-assigned-form-submission',
  standalone: true,
  imports: [CommonModule, SharedModule, CompletedFormViewComponent],
  templateUrl: './assigned-form-view.component.html',
  host: { class: 'block' },
})
export class AssignedFormSubmissionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly assignedFormsService = inject(AssignedFormsService);
  private readonly fieldMapper = inject(DynamicFormFieldMapperService);
  private readonly destroyRef = inject(DestroyRef);

  /** Captured in constructor — getCurrentNavigation() is only available then. */
  private readonly navState: OccurrenceViewNavState | null;

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly detail = signal<OccurrenceSubmissionDetail | null>(null);
  readonly sections = signal<EmployeeAssignmentSectionView[]>([]);
  readonly assignmentId = signal('');

  readonly formTitle = computed(() => this.detail()?.formName || 'Completed Form');
  readonly answers = computed(() => this.detail()?.answers ?? {});
  readonly submittedAt = computed(() => this.detail()?.submittedAt ?? null);
  readonly dueDate = computed(() => this.detail()?.dueDate ?? null);

  readonly statusLabel = computed(
    () => this.detail()?.statusLabel || 'Completed',
  );

  readonly statusClass = computed(() => {
    const key = this.statusLabel().trim().toLowerCase().replace(/[\s-]+/g, '_');
    switch (key) {
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

  constructor() {
    const nav = this.router.getCurrentNavigation();
    this.navState =
      (nav?.extras?.state as OccurrenceViewNavState | undefined) ??
      (typeof history !== 'undefined'
        ? (history.state as OccurrenceViewNavState | null)
        : null);
  }

  ngOnInit(): void {
    const assignmentId =
      this.route.snapshot.paramMap.get('assignmentId') ||
      this.route.snapshot.paramMap.get('id') ||
      '';
    this.assignmentId.set(assignmentId);

    const occurrence = this.navState?.occurrence;
    const formNameFallback = this.navState?.formName || '';

    if (!occurrence) {
      this.loading.set(false);
      this.errorMessage.set(
        'Submission data is unavailable. Go back to Assignment Details and open View again.',
      );
      return;
    }

    const detail = this.assignedFormsService.toOccurrenceSubmission(
      occurrence,
      formNameFallback,
    );

    if (!detail) {
      this.loading.set(false);
      this.errorMessage.set(
        'No submission is available for this occurrence.',
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.hydrateSections(detail)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (sections) => {
          this.detail.set(detail);
          this.sections.set(sections);
        },
        error: () => {
          this.detail.set(detail);
          this.sections.set([]);
          this.errorMessage.set(
            'Unable to prepare this submission for display. Please try again.',
          );
        },
      });
  }

  goBack(): void {
    const assignmentId = this.assignmentId();
    if (assignmentId) {
      this.router.navigate(['/assigned-forms', assignmentId]);
      return;
    }
    this.router.navigate(['/assigned-forms']);
  }

  retry(): void {
    this.goBack();
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

  private hydrateSections(detail: OccurrenceSubmissionDetail) {
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

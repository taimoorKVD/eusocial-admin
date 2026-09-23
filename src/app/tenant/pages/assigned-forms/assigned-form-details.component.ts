import {
  ChangeDetectionStrategy,
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
import { catchError, finalize, of, switchMap } from 'rxjs';
import { SharedModule } from '../../../shared/shared.module';
import { PageSizeSelectComponent } from '../../../shared/dynamic-listing/page-size-select.component';
import {
  AssignmentDetailPage,
  AssignmentOccurrenceItem,
  AssignedFormsService,
} from '../../../services/assigned-forms.service';
import { environment } from '../../../../environments/environment';

type OccurrenceStatusFilter =
  | 'completed'
  | 'in_progress'
  | 'overdue'
  | 'upcoming';

interface ProgressCard {
  key: string;
  label: string;
  value: number;
  tone: 'gray' | 'green' | 'amber' | 'red' | 'blue';
  status: OccurrenceStatusFilter | null;
}

@Component({
  selector: 'app-assigned-form-details',
  standalone: true,
  imports: [CommonModule, SharedModule, PageSizeSelectComponent],
  templateUrl: './assigned-form-details.component.html',
  styleUrl: './assigned-form-details.component.scss',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignedFormDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly assignedFormsService = inject(AssignedFormsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly defaultLimit = environment.limit || 15;

  readonly loading = signal(true);
  readonly occurrencesLoading = signal(false);
  readonly errorMessage = signal('');
  readonly detail = signal<AssignmentDetailPage | null>(null);

  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly limit = signal(this.defaultLimit);
  readonly selectedStatus = signal<OccurrenceStatusFilter | null>(null);
  readonly selectedDate = signal<string | null>(null);

  readonly summary = computed(() => this.detail()?.summary ?? null);
  readonly occurrences = computed(() => this.detail()?.occurrences ?? []);

  readonly progressCards = computed((): ProgressCard[] => {
    const progress = this.summary()?.progress;
    if (!progress) {
      return [];
    }
    return [
      {
        key: 'total',
        label: 'Total Occurrences',
        value: progress.total,
        tone: 'gray',
        status: null,
      },
      {
        key: 'completed',
        label: 'Completed',
        value: progress.completed,
        tone: 'green',
        status: 'completed',
      },
      {
        key: 'in-progress',
        label: 'In Progress',
        value: progress.inProgress,
        tone: 'amber',
        status: 'in_progress',
      },
      {
        key: 'overdue',
        label: 'Overdue',
        value: progress.overdue,
        tone: 'red',
        status: 'overdue',
      },
      {
        key: 'upcoming',
        label: 'Upcoming',
        value: progress.upcoming,
        tone: 'blue',
        status: 'upcoming',
      },
    ];
  });

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
          this.page.set(1);
          this.selectedStatus.set(null);
          this.selectedDate.set(null);

          return this.fetchDetail(id, 1, this.limit()).pipe(
            catchError((err) => {
              this.errorMessage.set(
                err?.error?.message ||
                  'Unable to load assignment details. Please try again.',
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
        this.applyDetail(result);
      });
  }

  goBack(): void {
    this.router.navigate(['/assigned-forms']);
  }

  previewForm(): void {
    const templateId = this.summary()?.templateId;
    const assignmentId = this.summary()?.id;
    if (!templateId) {
      return;
    }

    this.router.navigate(['/dynamic-forms/preview', templateId], {
      queryParams: {
        returnTo: assignmentId
          ? `/assigned-forms/${assignmentId}`
          : '/assigned-forms',
      },
    });
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    this.fetchDetail(id, this.page(), this.limit())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => this.applyDetail(result),
        error: (err) => {
          this.detail.set(null);
          this.errorMessage.set(
            err?.error?.message ||
              'Unable to load assignment details. Please try again.',
          );
        },
      });
  }

  prevPage(): void {
    if (this.page() <= 1) {
      return;
    }
    this.loadOccurrences(this.page() - 1);
  }

  nextPage(): void {
    if (this.page() >= this.lastPage()) {
      return;
    }
    this.loadOccurrences(this.page() + 1);
  }

  onPageSizeChange(size: number): void {
    if (!size || size === this.limit()) {
      return;
    }
    this.limit.set(size);
    this.loadOccurrences(1);
  }

  onStatusCardClick(card: ProgressCard): void {
    if (!card.status) {
      return;
    }
    const next =
      this.selectedStatus() === card.status ? null : card.status;
    this.selectedStatus.set(next);
    this.loadOccurrences(1);
  }

  onDateChange(value: string | null): void {
    const next = value?.trim() || null;
    if (next === this.selectedDate()) {
      return;
    }
    this.selectedDate.set(next);
    this.loadOccurrences(1);
  }

  clearDate(): void {
    if (!this.selectedDate()) {
      return;
    }
    this.selectedDate.set(null);
    this.loadOccurrences(1);
  }

  isStatusCardActive(card: ProgressCard): boolean {
    return !!card.status && this.selectedStatus() === card.status;
  }

  onOccurrenceAction(occurrence: AssignmentOccurrenceItem): void {
    const assignmentId = this.summary()?.id;
    if (!assignmentId || !occurrence.id) {
      return;
    }

    if (occurrence.action === 'view') {
      this.router.navigate(
        ['/assigned-forms', assignmentId, 'occurrences', occurrence.id],
        {
          state: {
            occurrence,
            formName: this.summary()?.formName ?? '',
          },
        },
      );
    }
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

  statusBadgeClass(statusLabel: string): string {
    const key = statusLabel.trim().toLowerCase().replace(/[\s-]+/g, '_');
    switch (key) {
      case 'completed':
        return 'bg-[#16A34A] text-white';
      case 'in_progress':
        return 'bg-[#F59E0B] text-white';
      case 'overdue':
        return 'bg-[#DC2626] text-white';
      case 'upcoming':
        return 'bg-[#DBEAFE] text-[#1D4ED8]';
      default:
        return 'bg-[#E5E7EB] text-[#4B5563]';
    }
  }

  progressToneClass(tone: ProgressCard['tone']): string {
    switch (tone) {
      case 'green':
        return 'bg-[#DCFCE7] text-[#166534]';
      case 'amber':
        return 'bg-[#FEF3C7] text-[#92400E]';
      case 'red':
        return 'bg-[#FEE2E2] text-[#991B1B]';
      case 'blue':
        return 'bg-[#DBEAFE] text-[#1E40AF]';
      default:
        return 'bg-[#F3F4F6] text-[#374151]';
    }
  }

  private loadOccurrences(page: number): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.occurrencesLoading.set(true);
    this.fetchDetail(id, page, this.limit())
      .pipe(
        finalize(() => this.occurrencesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => this.applyDetail(result),
        error: (err) => {
          this.errorMessage.set(
            err?.error?.message ||
              'Unable to load occurrences. Please try again.',
          );
        },
      });
  }

  private fetchDetail(id: string, page: number, limit: number) {
    return this.assignedFormsService.getAssignmentDetail(id, {
      page,
      limit,
      status: this.selectedStatus(),
      date: this.selectedDate(),
    });
  }

  private applyDetail(result: AssignmentDetailPage): void {
    this.detail.set(result);
    this.page.set(result.occurrencesMeta.page || 1);
    this.lastPage.set(Math.max(1, result.occurrencesMeta.lastPage || 1));
    this.total.set(result.occurrencesMeta.total);
    this.limit.set(result.occurrencesMeta.limit || this.limit());
  }
}

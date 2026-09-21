import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FlatpickrDirective } from '../../../shared/directives/flatpickr/flatpickr.directive';
import { PageSizeSelectComponent } from '../../../shared/dynamic-listing/page-size-select.component';
import { TenantUserService } from '../../../services/tenant-user.service';
import { TenantJobPositionService } from '../../../services/tenant-job-position.service';
import { FormStorageService } from '../../forms/services/form-storage.service';
import {
  AssignedFormApiStatus,
  AssignedFormListItem,
  AssignedFormsService,
  AssignedFormsStats,
} from '../../../services/assigned-forms.service';
import { environment } from '../../../../environments/environment';

export type AssignedFormStatusLabel =
  | 'Pending'
  | 'In Progress'
  | 'Completed'
  | 'Overdue';

export interface AssignedFormsSummaryCard {
  key: string;
  label: string;
  value: number;
  iconTone: 'blue' | 'green' | 'amber' | 'red' | 'gray';
}

interface AssignedUserOption {
  id: string;
  name: string;
}

interface JobPositionOption {
  id: string;
  name: string;
}

interface StatusOption {
  label: AssignedFormStatusLabel;
  value: AssignedFormApiStatus;
}

type FilterDropdownKey = 'status' | 'assignedTo' | 'jobPosition';

@Component({
  selector: 'app-assigned-forms',
  standalone: true,
  imports: [CommonModule, FormsModule, FlatpickrDirective, PageSizeSelectComponent],
  templateUrl: './assigned-forms.component.html',
  styleUrl: './assigned-forms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignedFormsComponent implements OnInit {
  private readonly assignedFormsService = inject(AssignedFormsService);
  private readonly userService = inject(TenantUserService);
  private readonly jobPositionService = inject(TenantJobPositionService);
  private readonly formStorageService = inject(FormStorageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageLimitDefault = environment.limit || 15;

  readonly statusOptions: StatusOption[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Overdue', value: 'overdue' },
  ];

  readonly searchQuery = signal('');
  readonly selectedStatuses = signal<AssignedFormApiStatus[]>([]);
  readonly selectedUserIds = signal<string[]>([]);
  readonly selectedJobPositionIds = signal<string[]>([]);
  readonly dueFromFilter = signal<string | null>(null);
  readonly dueToFilter = signal<string | null>(null);

  readonly userOptions = signal<AssignedUserOption[]>([]);
  readonly usersLoading = signal(false);
  readonly jobPositionOptions = signal<JobPositionOption[]>([]);
  readonly jobPositionsLoading = signal(false);
  readonly statusSearch = signal('');
  readonly assignedToSearch = signal('');
  readonly jobPositionSearch = signal('');

  readonly statusDropdownOpen = signal(false);
  readonly assignedToDropdownOpen = signal(false);
  readonly jobPositionDropdownOpen = signal(false);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly rows = signal<AssignedFormListItem[]>([]);
  readonly stats = signal<AssignedFormsStats>({
    totalAssigned: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    notStarted: 0,
  });

  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly limit = signal(this.pageLimitDefault);
  readonly pageSizeValue = computed(() => this.limit());
  /** Bound value for the Go to page input (string keeps empty/invalid entry usable). */
  readonly goToPageInput = signal('1');

  readonly summaryCards = computed<AssignedFormsSummaryCard[]>(() => {
    const current = this.stats();
    return [
      {
        key: 'total',
        label: 'Total Assigned',
        value: current.totalAssigned,
        iconTone: 'blue',
      },
      {
        key: 'completed',
        label: 'Completed',
        value: current.completed,
        iconTone: 'green',
      },
      {
        key: 'in-progress',
        label: 'In Progress',
        value: current.inProgress,
        iconTone: 'amber',
      },
      {
        key: 'overdue',
        label: 'Overdue',
        value: current.overdue,
        iconTone: 'red',
      },
      {
        key: 'pending',
        label: 'Pending',
        value: current.notStarted,
        iconTone: 'gray',
      },
    ];
  });

  readonly filteredStatusOptions = computed(() => {
    const q = this.statusSearch().trim().toLowerCase();
    if (!q) {
      return this.statusOptions;
    }
    return this.statusOptions.filter((option) =>
      option.label.toLowerCase().includes(q),
    );
  });

  readonly filteredUserOptions = computed(() => {
    const q = this.assignedToSearch().trim().toLowerCase();
    const selected = new Set(this.selectedUserIds());
    const options = this.userOptions().map((user) => ({
      ...user,
      selected: selected.has(user.id),
    }));

    if (!q) {
      return options;
    }

    return options.filter((user) => user.name.toLowerCase().includes(q));
  });

  readonly selectedUsers = computed(() => {
    const selected = new Set(this.selectedUserIds());
    return this.userOptions().filter((user) => selected.has(user.id));
  });

  readonly filteredJobPositionOptions = computed(() => {
    const q = this.jobPositionSearch().trim().toLowerCase();
    const selected = new Set(this.selectedJobPositionIds());
    const options = this.jobPositionOptions().map((position) => ({
      ...position,
      selected: selected.has(position.id),
    }));

    if (!q) {
      return options;
    }

    return options.filter((position) => position.name.toLowerCase().includes(q));
  });

  readonly selectedJobPositions = computed(() => {
    const selected = new Set(this.selectedJobPositionIds());
    return this.jobPositionOptions().filter((position) => selected.has(position.id));
  });

  readonly pageNumbers = computed(() => {
    const current = this.page();
    const last = this.lastPage();
    if (last <= 1) {
      return [1];
    }

    const windowSize = 5;
    let start = Math.max(1, current - Math.floor(windowSize / 2));
    let end = Math.min(last, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    const pages: number[] = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    return pages;
  });

  readonly showingFrom = computed(() => {
    if (!this.total()) {
      return 0;
    }
    return (this.page() - 1) * this.limit() + 1;
  });

  readonly showingTo = computed(() =>
    Math.min(this.page() * this.limit(), this.total()),
  );

  ngOnInit(): void {
    this.loadUsers();
    this.loadJobPositions();
    this.loadAssignedForms();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.multi-select-dropdown')) {
      return;
    }
    this.closeFilterDropdowns();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  onDueFromChange(value: string | null): void {
    this.dueFromFilter.set(value);
  }

  onDueToChange(value: string | null): void {
    this.dueToFilter.set(value);
  }

  toggleFilterDropdown(key: FilterDropdownKey, event: Event): void {
    event.stopPropagation();

    const wasOpen =
      key === 'status'
        ? this.statusDropdownOpen()
        : key === 'assignedTo'
          ? this.assignedToDropdownOpen()
          : this.jobPositionDropdownOpen();

    this.closeFilterDropdowns();

    if (wasOpen) {
      return;
    }

    if (key === 'status') {
      this.statusDropdownOpen.set(true);
      return;
    }

    if (key === 'assignedTo') {
      this.assignedToDropdownOpen.set(true);
      return;
    }

    this.jobPositionDropdownOpen.set(true);
  }

  onMultiSelectSearch(
    event: Event,
    searchSignal: WritableSignal<string>,
  ): void {
    searchSignal.set((event.target as HTMLInputElement).value);
  }

  toggleStatus(value: AssignedFormApiStatus, event: Event): void {
    event.stopPropagation();
    const current = this.selectedStatuses();
    this.selectedStatuses.set(
      current.includes(value)
        ? current.filter((status) => status !== value)
        : [...current, value],
    );
  }

  removeStatus(value: AssignedFormApiStatus, event: Event): void {
    event.stopPropagation();
    this.selectedStatuses.update((statuses) =>
      statuses.filter((status) => status !== value),
    );
  }

  toggleAssignedUser(userId: string, event: Event): void {
    event.stopPropagation();
    const current = this.selectedUserIds();
    this.selectedUserIds.set(
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  removeAssignedUser(userId: string, event: Event): void {
    event.stopPropagation();
    this.selectedUserIds.update((ids) => ids.filter((id) => id !== userId));
  }

  toggleJobPosition(positionId: string, event: Event): void {
    event.stopPropagation();
    const current = this.selectedJobPositionIds();
    this.selectedJobPositionIds.set(
      current.includes(positionId)
        ? current.filter((id) => id !== positionId)
        : [...current, positionId],
    );
  }

  removeJobPosition(positionId: string, event: Event): void {
    event.stopPropagation();
    this.selectedJobPositionIds.update((ids) =>
      ids.filter((id) => id !== positionId),
    );
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedStatuses.set([]);
    this.selectedUserIds.set([]);
    this.selectedJobPositionIds.set([]);
    this.dueFromFilter.set(null);
    this.dueToFilter.set(null);
    this.closeFilterDropdowns();
    this.page.set(1);
    this.goToPageInput.set('1');
    this.loadAssignedForms();
  }

  onSearchClick(): void {
    this.closeFilterDropdowns();
    this.page.set(1);
    this.loadAssignedForms();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.page()) {
      this.goToPageInput.set(String(this.page()));
      return;
    }
    this.page.set(page);
    this.goToPageInput.set(String(page));
    this.loadAssignedForms();
  }

  onGoToPageInput(value: string | number | null): void {
    this.goToPageInput.set(value == null ? '' : String(value));
  }

  submitGoToPage(): void {
    const raw = this.goToPageInput().trim();
    if (!raw) {
      this.goToPageInput.set(String(this.page()));
      return;
    }

    const page = Number(raw);
    if (!Number.isInteger(page) || page < 1 || page > this.lastPage()) {
      this.goToPageInput.set(String(this.page()));
      return;
    }

    this.goToPage(page);
  }

  prevPage(): void {
    this.goToPage(this.page() - 1);
  }

  nextPage(): void {
    this.goToPage(this.page() + 1);
  }

  onPageSizeChange(size: number): void {
    if (!size || size === this.limit()) {
      return;
    }
    this.limit.set(size);
    this.page.set(1);
    this.goToPageInput.set('1');
    this.loadAssignedForms();
  }

  viewAssignment(row: AssignedFormListItem): void {
    if (!row.id) {
      return;
    }
    this.router.navigate(['/assigned-forms', row.id]);
  }

  statusLabel(status: AssignedFormApiStatus): AssignedFormStatusLabel {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'overdue':
        return 'Overdue';
      default:
        return 'Pending';
    }
  }

  statusClass(status: AssignedFormApiStatus): string {
    switch (status) {
      case 'completed':
        return 'bg-[#16A34A] text-white';
      case 'in_progress':
        return 'bg-[#F59E0B] text-white';
      case 'overdue':
        return 'bg-[#DC2626] text-white';
      default:
        return 'bg-[#E5E7EB] text-[#4B5563]';
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

  cardToneClass(tone: AssignedFormsSummaryCard['iconTone']): string {
    switch (tone) {
      case 'blue':
        return 'bg-[#DBEAFE] text-[#2563EB]';
      case 'green':
        return 'bg-[#DCFCE7] text-[#16A34A]';
      case 'amber':
        return 'bg-[#FEF3C7] text-[#D97706]';
      case 'red':
        return 'bg-[#FEE2E2] text-[#DC2626]';
      case 'gray':
        return 'bg-[#E5E7EB] text-[#4B5563]';
    }
  }

  private closeFilterDropdowns(): void {
    this.statusDropdownOpen.set(false);
    this.assignedToDropdownOpen.set(false);
    this.jobPositionDropdownOpen.set(false);
    this.statusSearch.set('');
    this.assignedToSearch.set('');
    this.jobPositionSearch.set('');
  }

  private loadAssignedForms(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.assignedFormsService
      .getAssignedForms({
        page: this.page(),
        limit: this.limit(),
        search: this.searchQuery(),
        status: this.selectedStatuses(),
        userId: this.selectedUserIds(),
        jobPositionId: this.selectedJobPositionIds(),
        dueFrom: this.dueFromFilter(),
        dueTo: this.dueToFilter(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.rows.set(result.items);
          this.stats.set(result.stats);
          this.page.set(result.meta.page || this.page());
          this.lastPage.set(Math.max(1, result.meta.lastPage || 1));
          this.total.set(result.meta.total);
          this.limit.set(result.meta.limit || this.limit());
          this.goToPageInput.set(String(this.page()));
        },
        error: (err) => {
          this.rows.set([]);
          this.stats.set({
            totalAssigned: 0,
            completed: 0,
            inProgress: 0,
            overdue: 0,
            notStarted: 0,
          });
          this.total.set(0);
          this.lastPage.set(1);
          this.goToPageInput.set('1');
          this.errorMessage.set(
            err?.error?.message ||
              'Unable to load assigned forms. Please try again.',
          );
        },
      });
  }

  /** Same user lookup pattern as Form Template Assign / view-forms. */
  private loadUsers(): void {
    this.usersLoading.set(true);

    this.formStorageService
      .loadForm('users')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (schema) => {
          const fields = schema?.fields || [];
          const nameField =
            fields.find((f: { name?: string }) => f.name === 'name') ||
            fields.find(
              (f: { label?: string }) =>
                (f.label || '').toLowerCase() === 'name',
            );
          this.fetchUsers((nameField as { id?: string } | undefined)?.id || null);
        },
        error: () => this.fetchUsers(null),
      });
  }

  /** Same job-position lookup pattern as Form Template Assign. */
  private loadJobPositions(): void {
    this.jobPositionsLoading.set(true);

    this.jobPositionService
      .getJobPositions(1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: { data?: unknown[] } | unknown[]) => {
          const data = Array.isArray(res) ? res : res?.data;
          if (Array.isArray(data)) {
            this.jobPositionOptions.set(
              data.map((jp: Record<string, unknown>) => ({
                id: String(jp['id'] ?? ''),
                name: String(jp['name'] ?? ''),
              })),
            );
          } else {
            this.jobPositionOptions.set([]);
          }
          this.jobPositionsLoading.set(false);
        },
        error: () => {
          this.jobPositionOptions.set([]);
          this.jobPositionsLoading.set(false);
        },
      });
  }

  private fetchUsers(nameFieldId: string | null): void {
    this.userService
      .getUsers(1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: { data?: unknown[] } | unknown[]) => {
          const data = Array.isArray(res) ? res : res?.data;
          if (Array.isArray(data)) {
            this.userOptions.set(
              data.map((u: Record<string, unknown>) => ({
                id: String(u['id'] ?? ''),
                name: nameFieldId
                  ? String(u[nameFieldId] ?? '')
                  : this.fallbackUserName(u),
              })),
            );
          } else {
            this.userOptions.set([]);
          }
          this.usersLoading.set(false);
        },
        error: () => {
          this.userOptions.set([]);
          this.usersLoading.set(false);
        },
      });
  }

  private fallbackUserName(user: Record<string, unknown>): string {
    const fromParts = [
      user['first_name'],
      user['last_name'],
      user['firstName'],
      user['lastName'],
    ]
      .filter((part) => typeof part === 'string' && part.trim())
      .join(' ')
      .trim();

    if (fromParts) {
      return fromParts;
    }

    if (typeof user['name'] === 'string' && user['name'].trim()) {
      return user['name'].trim();
    }

    if (typeof user['email'] === 'string' && user['email'].trim()) {
      return user['email'].trim();
    }

    return user['id'] != null ? `User ${user['id']}` : 'User';
  }
}

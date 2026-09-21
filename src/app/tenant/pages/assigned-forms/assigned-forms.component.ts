import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FlatpickrDirective } from '../../../shared/directives/flatpickr/flatpickr.directive';
import { TenantUserService } from '../../../services/tenant-user.service';
import { FormStorageService } from '../../forms/services/form-storage.service';

export type AssignedFormStatus =
  | 'Pending'
  | 'In Progress'
  | 'Completed'
  | 'Overdue';

export interface AssignedFormRowItem {
  id: number;
  formName: string;
  assignedTo: string;
  dueDate: string;
  status: AssignedFormStatus;
}

export interface AssignedFormsSummaryCard {
  key: string;
  label: string;
  value: number;
  iconTone: 'blue' | 'green' | 'amber' | 'red';
}

interface AssignedUserOption {
  id: string;
  name: string;
}

type FilterDropdownKey = 'status' | 'assignedTo';

@Component({
  selector: 'app-assigned-forms',
  standalone: true,
  imports: [CommonModule, FormsModule, FlatpickrDirective],
  templateUrl: './assigned-forms.component.html',
  styleUrl: './assigned-forms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignedFormsComponent implements OnInit {
  private readonly userService = inject(TenantUserService);
  private readonly formStorageService = inject(FormStorageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly summaryCards: AssignedFormsSummaryCard[] = [
    { key: 'total', label: 'Total Assigned', value: 24, iconTone: 'blue' },
    { key: 'completed', label: 'Completed', value: 16, iconTone: 'green' },
    { key: 'in-progress', label: 'In Progress', value: 5, iconTone: 'amber' },
    { key: 'overdue', label: 'Overdue', value: 3, iconTone: 'red' },
  ];

  readonly rows: AssignedFormRowItem[] = [
    {
      id: 1,
      formName: 'Daily Kitchen Checklist',
      assignedTo: 'Sarah Johnson',
      dueDate: 'Sep 16, 2026',
      status: 'Completed',
    },
    {
      id: 2,
      formName: 'Hygiene Inspection',
      assignedTo: 'Mike Chen',
      dueDate: 'Sep 17, 2026',
      status: 'In Progress',
    },
    {
      id: 3,
      formName: 'Food Safety Audit',
      assignedTo: 'Emily Davis',
      dueDate: 'Sep 15, 2026',
      status: 'Overdue',
    },
    {
      id: 4,
      formName: 'Stock Inventory Count',
      assignedTo: 'James Wilson',
      dueDate: 'Sep 20, 2026',
      status: 'Pending',
    },
    {
      id: 5,
      formName: 'Opening Shift Report',
      assignedTo: 'Ava Martinez',
      dueDate: 'Sep 21, 2026',
      status: 'In Progress',
    },
  ];

  readonly statusOptions: Array<{ label: string; value: string }> = [
    { label: 'All Statuses', value: '' },
    { label: 'Pending', value: 'Pending' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Overdue', value: 'Overdue' },
  ];

  readonly searchQuery = signal('');
  readonly statusFilter = signal('');
  readonly assignedToFilter = signal('');
  readonly dueDateFilter = signal<string | null>(null);

  readonly userOptions = signal<AssignedUserOption[]>([]);
  readonly usersLoading = signal(false);

  readonly statusDropdownOpen = signal(false);
  readonly assignedToDropdownOpen = signal(false);

  readonly pageNumbers = [1, 2, 3, 4, 5];
  readonly currentPage = 1;

  readonly statusFilterLabel = computed(() => {
    const value = this.statusFilter();
    return this.statusOptions.find((option) => option.value === value)?.label ?? 'All Statuses';
  });

  readonly assignedToFilterLabel = computed(() => {
    const value = this.assignedToFilter();
    if (!value) {
      return 'All Users';
    }
    return (
      this.userOptions().find((user) => user.id === value)?.name ||
      'All Users'
    );
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeFilterDropdowns();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  onDueDateChange(value: string | null): void {
    this.dueDateFilter.set(value);
  }

  toggleFilterDropdown(key: FilterDropdownKey, event: Event): void {
    event.stopPropagation();

    if (key === 'status') {
      this.statusDropdownOpen.update((open) => !open);
      this.assignedToDropdownOpen.set(false);
      return;
    }

    this.assignedToDropdownOpen.update((open) => !open);
    this.statusDropdownOpen.set(false);
  }

  selectStatus(value: string, event: Event): void {
    event.stopPropagation();
    this.statusFilter.set(value);
    this.statusDropdownOpen.set(false);
  }

  selectAssignedTo(value: string, event: Event): void {
    event.stopPropagation();
    this.assignedToFilter.set(value);
    this.assignedToDropdownOpen.set(false);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('');
    this.assignedToFilter.set('');
    this.dueDateFilter.set(null);
    this.closeFilterDropdowns();
  }

  onSearchClick(): void {
    // Static UI only — keep values bound for later wiring.
    this.closeFilterDropdowns();
  }

  statusClass(status: AssignedFormStatus): string {
    switch (status) {
      case 'Completed':
        return 'bg-[#16A34A] text-white';
      case 'In Progress':
        return 'bg-[#F59E0B] text-white';
      case 'Overdue':
        return 'bg-[#DC2626] text-white';
      case 'Pending':
        return 'bg-[#E5E7EB] text-[#4B5563]';
    }
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
    }
  }

  private closeFilterDropdowns(): void {
    this.statusDropdownOpen.set(false);
    this.assignedToDropdownOpen.set(false);
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
              (f: { label?: string }) => (f.label || '').toLowerCase() === 'name',
            );
          this.fetchUsers((nameField as { id?: string } | undefined)?.id || null);
        },
        error: () => this.fetchUsers(null),
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
    const fromParts = [user['first_name'], user['last_name'], user['firstName'], user['lastName']]
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

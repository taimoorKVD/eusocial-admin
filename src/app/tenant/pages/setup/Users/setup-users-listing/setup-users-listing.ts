import { Component } from '@angular/core';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { environment } from '../../../../../../environments/environment.prod';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { normalizeFieldOrder } from '../../../../form-builder/utils/form-field.factory';
import { DynamicField } from '../../../../../interfaces/dynamic-field';

@Component({
  selector: 'app-setup-users-listing',
  standalone: false,
  templateUrl: './setup-users-listing.html',
  styleUrl: './setup-users-listing.scss',
})
export class SetupUsersListing {
  users: Record<string, unknown>[] = [];
  formFields: DynamicField[] = [];
  loading = false;
  slug: string = '';
  page = 1;
  lastPage = 1;
  total = 0;
  readonly columnStorageKey = 'tenant-users-listing-columns';
  private defaultLimit = environment.limit;

  filters: any = {};
  filterFields = [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Search by name...',
    },
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'Search by email...',
    },
  ];

  constructor(
    private userService: TenantUserService,
    public session: TenantSessionService,
    private route: ActivatedRoute,
    private router: Router,
    private formStorageService: FormStorageService,
  ) {}

  ngOnInit(): void {
    this.slug = this.route.parent?.parent?.snapshot.paramMap.get('slug') || '';
    this.loadFormFields();
    this.allUsers(this.page);
  }

  loadFormFields(): void {
    this.formStorageService.loadForm('users').subscribe({
      next: (res) => {
        if (!res) {
          this.formFields = [];
          return;
        }

        this.formFields = normalizeFieldOrder(
          (res.fields || []).filter((field) => field.label !== 'Role'),
        ) as DynamicField[];
      },
      error: () => {
        this.formFields = [];
      },
    });
  }

  goToCreate(): void {
    this.router.navigate(['/tenant', this.session.getSlug(), 'users', 'create']);
  }

  goToEdit(record: Record<string, unknown>): void {
    const id = record['id'];
    if (id == null) {
      return;
    }

    this.router.navigate(['edit', id], { relativeTo: this.route });
  }

  allUsers(page: number = 1): void {
    this.loading = true;

    const activeFilters = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value),
    );

    const apiCall = Object.keys(activeFilters).length
      ? this.userService.searchUsers(activeFilters, this.defaultLimit)
      : this.userService.getUsers(page, this.defaultLimit);

    apiCall.subscribe({
      next: (res) => {
        this.users = res.data || [];
        this.total = Number(res?.meta?.total || 0);
        this.page = Number(res?.meta?.page || 1);
        this.lastPage = Number(res?.meta?.lastPage || 1);
        this.loading = false;
      },
      error: () => {
        this.users = [];
        this.total = 0;
        this.loading = false;
      },
    });
  }

  deleteUser(record: Record<string, unknown>): void {
    const id = Number(record['id']);
    if (!id || !confirm('Are you sure you want to delete this user?')) {
      return;
    }

    this.userService.deleteUser(id).subscribe(() => {
      if (this.users.length === 1 && this.page > 1) {
        this.allUsers(this.page - 1);
      } else {
        this.allUsers(this.page);
      }
    });
  }

  prevPage(): void {
    if (this.page > 1) {
      this.allUsers(this.page - 1);
    }
  }

  nextPage(): void {
    if (this.page < this.lastPage) {
      this.allUsers(this.page + 1);
    }
  }

  onFilterSearch(filters: any): void {
    this.filters = filters;
    this.page = 1;
    this.allUsers(this.page);
  }

  onFilterClear(): void {
    this.filters = {};
    this.page = 1;
    this.allUsers(this.page);
  }
}

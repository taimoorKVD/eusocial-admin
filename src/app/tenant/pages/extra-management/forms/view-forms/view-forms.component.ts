import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../../environments/environment';
import { SharedModule } from '../../../../../shared/shared.module';
import { GlobalFilterField } from '../../../../../shared/global-filter/global-filter';
import { pruneFiltersByAllowedKeys } from '../../../../../shared/dynamic-listing/dynamic-listing.helpers';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { TenantFormsService } from '../services/tenant-forms.service';
import { SavedDynamicForm } from '../models/dynamic-form.models';

const FORM_FILTER_FIELDS: GlobalFilterField[] = [
  { key: 'name', label: 'Form Name', placeholder: 'Search by form name', type: 'text' },
];

@Component({
  selector: 'app-view-forms',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './view-forms.component.html',
  styleUrl: './view-forms.component.scss',
})
export class ViewFormsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(TenantSessionService);
  private readonly formsService = inject(TenantFormsService);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);

  readonly forms = signal<SavedDynamicForm[]>([]);
  readonly loading = signal(false);
  readonly hasForms = computed(() => this.forms().length > 0);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly filterFields = signal<GlobalFilterField[]>([]);
  readonly hasFilterFields = computed(() => this.filterFields().length > 0);

  readonly showPagination = computed(() => !this.loading() && this.forms().length > 0);

  readonly showDeleteConfirmModal = signal(false);
  readonly deleteConfirmTitle = 'Delete Form';
  readonly deleteConfirmDescription =
    'Please confirm that you want to delete this form. All related information will be permanently removed.';

  private readonly defaultLimit = environment.limit;
  private pendingDeleteId: number | null = null;
  private filters: Record<string, unknown> = {};

  ngOnInit(): void {
    this.filterFields.set(FORM_FILTER_FIELDS);
    this.loadForms(this.page());
  }

  private loadForms(page: number): void {
    this.loading.set(true);

    const allowedKeys = this.getAllowedFilterKeys();
    const activeFilters = pruneFiltersByAllowedKeys(this.filters, allowedKeys);

    const apiCall = Object.keys(activeFilters).length
      ? this.formsService.searchForms(activeFilters, this.defaultLimit)
      : this.formsService.getForms(page, this.defaultLimit);

    apiCall
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.forms.set(res.forms);
          this.total.set(res.total);
          this.page.set(res.page);
          this.lastPage.set(res.lastPage);
        },
        error: () => {
          this.forms.set([]);
          this.total.set(0);
        },
      });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.loadForms(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.lastPage()) {
      this.loadForms(this.page() + 1);
    }
  }

  onFilterSearch(filters: Record<string, unknown>): void {
    const allowedKeys = this.getAllowedFilterKeys();
    this.filters = pruneFiltersByAllowedKeys(filters, allowedKeys);
    this.page.set(1);
    this.loadForms(this.page());
  }

  onFilterClear(): void {
    this.filters = {};
    this.page.set(1);
    this.loadForms(this.page());
  }

  private getAllowedFilterKeys(): Set<string> {
    return new Set(this.filterFields().map((field) => field.key));
  }

  goToCreate(): void {
    this.router.navigate(['/tenant', this.session.getSlug(), 'dynamic-forms', 'create']);
  }

  goToEdit(form: SavedDynamicForm): void {
    if (!form.id) {
      return;
    }
    this.router.navigate(['edit', form.id], { relativeTo: this.route });
  }

  deleteForm(form: SavedDynamicForm): void {
    if (!form.id) {
      return;
    }

    this.pendingDeleteId = Number(form.id);
    this.showDeleteConfirmModal.set(true);
  }

  onConfirmDeleteForm(): void {
    const id = this.pendingDeleteId;
    if (!id) {
      return;
    }

    this.formsService
      .deleteTemplate(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('Form deleted successfully');
          if (this.forms().length === 1 && this.page() > 1) {
            this.loadForms(this.page() - 1);
          } else {
            this.loadForms(this.page());
          }
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to delete form');
        },
      });

    this.closeDeleteConfirmModal();
  }

  closeDeleteConfirmModal(): void {
    this.showDeleteConfirmModal.set(false);
    this.pendingDeleteId = null;
  }

  formatSectionTypes(types: string[]): string {
    return types.join(', ');
  }
}

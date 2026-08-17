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
  private readonly formsService = inject(TenantFormsService);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);

  readonly forms = signal<SavedDynamicForm[]>([]);
  readonly loading = signal(false);
  readonly hasForms = computed(() => this.forms().length > 0);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly filterFields = signal<GlobalFilterField[]>([]);
  readonly hasFilterFields = computed(() => this.filterFields().length > 0);

  readonly showPagination = computed(() => !this.loading() && this.forms().length > 0);

  readonly deleting = signal(false);
  readonly showDeleteConfirmModal = signal(false);
  readonly deleteConfirmTitle = 'Delete Form';
  readonly deleteConfirmDescription =
    'Please confirm that you want to delete this form. All related information will be permanently removed.';

  readonly selectedIds = signal<number[]>([]);
  readonly selectedCount = computed(() => this.selectedIds().length);
  readonly hasSelection = computed(() => this.selectedIds().length > 0);
  readonly showBulkDeleteConfirmModal = signal(false);
  readonly bulkDeleteConfirmDescription = computed(() => {
    const count = this.selectedIds().length;
    return `Delete ${count} selected form${count === 1 ? '' : 's'}? This action cannot be undone.`;
  });

  readonly visibleDeletableForms = computed(() =>
    this.forms().filter((form) => this.isFormDeletable(form)),
  );
  readonly isAllSelected = computed(() => {
    const visible = this.visibleDeletableForms();
    return visible.length > 0 && visible.every((form) => this.isSelected(form));
  });
  readonly isIndeterminate = computed(() => {
    const visible = this.visibleDeletableForms();
    const count = visible.filter((form) => this.isSelected(form)).length;
    return count > 0 && count < visible.length;
  });

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
          this.page.set(res.page);
          this.lastPage.set(res.lastPage);
        },
        error: () => {
          this.forms.set([]);
          this.selectedIds.set([]);
        },
      });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.selectedIds.set([]);
      this.loadForms(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.lastPage()) {
      this.selectedIds.set([]);
      this.loadForms(this.page() + 1);
    }
  }

  onFilterSearch(filters: Record<string, unknown>): void {
    const allowedKeys = this.getAllowedFilterKeys();
    this.filters = pruneFiltersByAllowedKeys(filters, allowedKeys);
    this.selectedIds.set([]);
    this.page.set(1);
    this.loadForms(this.page());
  }

  onFilterClear(): void {
    this.filters = {};
    this.selectedIds.set([]);
    this.page.set(1);
    this.loadForms(this.page());
  }

  private getAllowedFilterKeys(): Set<string> {
    return new Set(this.filterFields().map((field) => field.key));
  }

  goToCreate(): void {
    this.router.navigate(['/dynamic-forms', 'create']);
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

    this.closeDeleteConfirmModal();
    this.deleting.set(true);

    this.formsService
      .deleteTemplate(id)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toastr.success('Form deleted successfully');
          this.selectedIds.set([]);
          this.reloadAfterDelete(this.forms().length === 1);
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to delete form');
        },
      });
  }

  closeDeleteConfirmModal(): void {
    this.showDeleteConfirmModal.set(false);
    this.pendingDeleteId = null;
  }

  toggleSelect(form: SavedDynamicForm): void {
    const id = this.toNumericId(form);
    if (id == null) {
      return;
    }

    this.selectedIds.update((current) =>
      current.includes(id)
        ? current.filter((selected) => selected !== id)
        : [...current, id],
    );
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedIds.set([]);
      return;
    }

    this.selectedIds.set(
      this.visibleDeletableForms()
        .map((form) => this.toNumericId(form))
        .filter((id): id is number => id != null),
    );
  }

  isSelected(form: SavedDynamicForm): boolean {
    const id = this.toNumericId(form);
    return id != null && this.selectedIds().includes(id);
  }

  isFormDeletable(form: SavedDynamicForm): boolean {
    return this.toNumericId(form) != null;
  }

  openBulkDeleteConfirm(): void {
    if (!this.hasSelection()) {
      return;
    }

    this.showBulkDeleteConfirmModal.set(true);
  }

  closeBulkDeleteConfirmModal(): void {
    this.showBulkDeleteConfirmModal.set(false);
  }

  onConfirmBulkDelete(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) {
      return;
    }

    const allVisibleSelected =
      this.forms().length > 0 && this.selectedIds().length === this.forms().length;

    this.closeBulkDeleteConfirmModal();
    this.deleting.set(true);

    this.formsService
      .bulkDeleteForms(ids)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toastr.success('Forms deleted successfully');
          this.selectedIds.set([]);
          this.reloadAfterDelete(allVisibleSelected);
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to delete forms');
        },
      });
  }

  private reloadAfterDelete(pageEmpty: boolean): void {
    if (pageEmpty && this.page() > 1) {
      this.loadForms(this.page() - 1);
    } else {
      this.loadForms(this.page());
    }
  }

  private toNumericId(form: SavedDynamicForm): number | null {
    return form.id != null && form.id !== '' ? Number(form.id) : null;
  }
}

import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../../environments/environment.prod';
import { BulkSelectionState, toNumericIds } from '../../../../../shared/dynamic-listing/bulk-selection.state';

@Component({
  selector: 'app-setup-job-position-listing',
  standalone: false,
  templateUrl: './setup-job-position-listing.component.html',
  styleUrl: './setup-job-position-listing.component.scss',
})
export class SetupJobPositionListingComponent {
  jobPositions: any[] = [];
  isLoading = false;
  page = 1;
  lastPage = 1;
  total = 0;
  filters: any = {};
  filterFields = [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Search by name...'
    }
  ];
  private defaultLimit = environment.limit;

  bulkSelection = new BulkSelectionState();
  deleting = false;
  showBulkDeleteConfirmModal = false;

  get bulkDeleteConfirmDescription(): string {
    const count = this.bulkSelection.count();
    return `Delete ${count} selected job position${count === 1 ? '' : 's'}? This action cannot be undone.`;
  }

  constructor( private tenantJobPosition: TenantJobPositionService, private router: Router, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.loadJobPositions();
  }

  // 🔹 Fetch all job positions
  loadJobPositions(page: number = 1) {

    this.isLoading = true;
     const activeFilters = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value)
    );

     const apiCall = Object.keys(activeFilters).length
    ? this.tenantJobPosition.searchJobPositions(activeFilters, this.defaultLimit)
    : this.tenantJobPosition.getJobPositions(page, this.defaultLimit);

    apiCall.subscribe({
      next: (res) => {
        this.jobPositions = res.data;
        this.total = Number(res?.meta?.total) || 1;
        this.page = Number(res?.meta?.page) || 1;
        this.lastPage = Number(res?.meta?.lastPage) || 1;
        this.isLoading = false;
      },
      error: () => {
        this.jobPositions = [];
        this.total = 0;
        this.isLoading = false;
        this.bulkSelection.clear();
      },
    });

    // this.tenantJobPosition.getJobPositions(page).subscribe({

    //   next: (res: any) => {

    //     const rows = Array.isArray(res?.data)
    //       ? res.data
    //       : [];

    //     this.jobPositions = [...rows].sort((a: any, b: any) => {

    //       const aTime = a?.created_at
    //         ? new Date(a.created_at).getTime()
    //         : 0;

    //       const bTime = b?.created_at
    //         ? new Date(b.created_at).getTime()
    //         : 0;

    //       if (aTime && bTime && aTime !== bTime) {
    //         return bTime - aTime;
    //       }

    //       return (b?.id || 0) - (a?.id || 0);
    //     });

    //     this.total = Number(res?.meta?.total || 0);
    //     this.page = Number(res?.meta?.page || 1);
    //     this.lastPage = Number(res?.meta?.lastPage || 1);

    //     this.isLoading = false;
    //   },

    //   error: () => {

    //     this.isLoading = false;
    //     alert('Failed to load job positions');
    //   }
    // });
  }



//   deleteJob(id: number) {

//   const confirmDelete = confirm('Are you sure you want to delete this job position?');

//   if (!confirmDelete) return;

//   this.isLoading = true;

//   this.tenantJobPosition.deleteJobPosition(id).subscribe({
//     next: () => {
//       this.isLoading = false;

//       // Remove from UI instantly (no reload needed)
//       this.jobPositions = this.jobPositions.filter(job => job.id !== id);

//       // alert('Deleted successfully');
//       this.toastr.success('Job deleted successfully');
//     },
//     error: (err) => {
//       this.isLoading = false;
//       alert('Delete failed');
//       this.toastr.error(err?.error?.message || 'Failed to delete Job');
//     }
//   });
// }

deleteJob(id: number) {

  const confirmDelete = confirm('Are you sure you want to delete this job position?');
  if (!confirmDelete) return;

  this.isLoading = true;

  this.tenantJobPosition.deleteJobPosition(id).subscribe({
    next: () => {

      this.toastr.success('Job deleted successfully');

      this.isLoading = false;

      this.bulkSelection.clear();

      this.jobPositions = this.jobPositions.filter(job => job.id !== id);

      if (this.jobPositions.length === 0 && this.page > 1) {

        this.tenantJobPosition.getJobPositions(this.page - 1)
          .subscribe((res: any) => {
            this.jobPositions = res?.data || [];
            this.page = res?.meta?.page || 1;
            this.lastPage = res?.meta?.lastPage || 1;
          });

      } else {

        this.tenantJobPosition.getJobPositions(this.page)
          .subscribe((res: any) => {
            this.jobPositions = res?.data || [];
          });

      }

    },

    error: (err) => {
      this.isLoading = false;
      this.toastr.error(err?.error?.message || 'Failed to delete Job');
    }
  });
}

  isSelected(job: any): boolean {
    const id = Number(job?.id);
    return !Number.isNaN(id) && this.bulkSelection.isSelected(id);
  }

  toggleSelect(job: any): void {
    const id = Number(job?.id);
    if (!Number.isNaN(id)) {
      this.bulkSelection.toggle(id);
    }
  }

  selectableJobPositionIds(): number[] {
    return toNumericIds(this.jobPositions.map((job) => job?.id));
  }

  isAllSelected(): boolean {
    return this.bulkSelection.isAllSelected(this.selectableJobPositionIds());
  }

  isIndeterminate(): boolean {
    return this.bulkSelection.isIndeterminate(this.selectableJobPositionIds());
  }

  toggleSelectAll(): void {
    this.bulkSelection.toggleAll(this.selectableJobPositionIds());
  }

  openBulkDeleteConfirm(): void {
    if (!this.bulkSelection.hasSelection()) {
      return;
    }
    this.showBulkDeleteConfirmModal = true;
  }

  closeBulkDeleteConfirmModal(): void {
    this.showBulkDeleteConfirmModal = false;
  }

  onConfirmBulkDelete(): void {
    const ids = [...this.bulkSelection.selectedIds()];
    if (!ids.length) {
      return;
    }

    const allVisibleSelected =
      this.jobPositions.length > 0 && this.bulkSelection.count() === this.jobPositions.length;

    this.closeBulkDeleteConfirmModal();
    this.deleting = true;

    this.tenantJobPosition.bulkDeleteJobPositions(ids).subscribe({
      next: () => {
        this.toastr.success('Job positions deleted successfully');
        this.bulkSelection.clear();
        this.deleting = false;
        this.reloadAfterDelete(allVisibleSelected);
      },
      error: (err) => {
        this.deleting = false;
        this.toastr.error(err?.error?.message || 'Failed to delete job positions');
      },
    });
  }

  private reloadAfterDelete(pageEmpty: boolean): void {
    if (pageEmpty && this.page > 1) {
      this.loadJobPositions(this.page - 1);
    } else {
      this.loadJobPositions(this.page);
    }
  }

  goToCreate() {
    this.router.navigate(['/job-position', 'create']);
  }

  // 🔹 Navigate to Edit
  goToEdit(id: number) {
    // this.router.navigate(['/tenant/eusocial/job-position/edit', id]);
    this.router.navigate(['/job-position', 'edit', id]);
  }

  getDescription(job: any): string {
    return (
      job?.comment_description ||
      job?.description ||
      job?.comment ||
      '-'
    );
  }

  prevPage(): void {

  if (this.page > 1) {
    this.bulkSelection.clear();
    this.loadJobPositions(this.page - 1);
  }
}

nextPage(): void {
  if (this.page < this.lastPage) {
    this.bulkSelection.clear();
    this.loadJobPositions(this.page + 1);
  }
}

 onFilterSearch(filters: any): void {
    this.filters = filters;
    this.bulkSelection.clear();
    this.page = 1;
    this.loadJobPositions(this.page);
  }

  onFilterClear(): void {
    this.filters = {};
    this.bulkSelection.clear();
    this.page = 1;
    this.loadJobPositions(this.page);
  }
}

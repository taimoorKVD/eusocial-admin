import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';
import { ToastrService } from 'ngx-toastr';
import { TenantSessionService } from '../../../../../services/tenant-session.service';

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

  constructor( private tenantJobPosition: TenantJobPositionService, private router: Router, private toastr: ToastrService, public session: TenantSessionService) {}

  ngOnInit(): void {
    this.loadJobPositions();
  }

  // 🔹 Fetch all job positions
  loadJobPositions(page: number = 1) {

    this.isLoading = true;

    this.tenantJobPosition.getJobPositions(page).subscribe({

      next: (res: any) => {

        const rows = Array.isArray(res?.data)
          ? res.data
          : [];

        this.jobPositions = [...rows].sort((a: any, b: any) => {

          const aTime = a?.created_at
            ? new Date(a.created_at).getTime()
            : 0;

          const bTime = b?.created_at
            ? new Date(b.created_at).getTime()
            : 0;

          if (aTime && bTime && aTime !== bTime) {
            return bTime - aTime;
          }

          return (b?.id || 0) - (a?.id || 0);
        });

        this.total = Number(res?.meta?.total || 0);
        this.page = Number(res?.meta?.page || 1);
        this.lastPage = Number(res?.meta?.lastPage || 1);

        this.isLoading = false;
      },

      error: () => {

        this.isLoading = false;
        alert('Failed to load job positions');
      }
    });
  }



  deleteJob(id: number) {

  const confirmDelete = confirm('Are you sure you want to delete this job position?');

  if (!confirmDelete) return;

  this.isLoading = true;

  this.tenantJobPosition.deleteJobPosition(id).subscribe({
    next: () => {
      this.isLoading = false;

      // Remove from UI instantly (no reload needed)
      this.jobPositions = this.jobPositions.filter(job => job.id !== id);

      // alert('Deleted successfully');
      this.toastr.success('Job deleted successfully');
    },
    error: (err) => {
      this.isLoading = false;
      alert('Delete failed');
      this.toastr.error(err?.error?.message || 'Failed to delete Job');
    }
  });
}

  goToCreate() {
  this.router.navigate([
    '/tenant',
    this.session.getSlug(),
    'job-position',
    'create'
  ]);
}

  // 🔹 Navigate to Edit
  goToEdit(id: number) {
    // this.router.navigate(['/tenant/eusocial/job-position/edit', id]);
    this.router.navigate([
    '/tenant',
    this.session.getSlug(),
    'job-position',
    'edit',
    id
  ]);
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
    this.loadJobPositions(this.page - 1);
  }
}

nextPage(): void {

  if (this.page < this.lastPage) {
    this.loadJobPositions(this.page + 1);
  }
}
}

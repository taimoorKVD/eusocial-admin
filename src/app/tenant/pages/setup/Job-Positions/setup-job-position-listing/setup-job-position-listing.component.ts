import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';

@Component({
  selector: 'app-setup-job-position-listing',
  standalone: false,
  templateUrl: './setup-job-position-listing.component.html',
  styleUrl: './setup-job-position-listing.component.scss',
})
export class SetupJobPositionListingComponent {
  jobPositions: any[] = [];
  isLoading = false;

  constructor(
    private tenantJobPosition: TenantJobPositionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadJobPositions();
  }

  // 🔹 Fetch all job positions
  loadJobPositions() {
    this.isLoading = true;

    this.tenantJobPosition.getJobPositions().subscribe({
      next: (res: any) => {
        this.jobPositions = res.data;
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

      alert('Deleted successfully');
    },
    error: () => {
      this.isLoading = false;
      alert('Delete failed');
    }
  });
}

  // 🔹 Navigate to Create
  goToCreate() {
    this.router.navigate(['/tenant/eusocial/job-position/create']);
  }

  // 🔹 Navigate to Edit
  goToEdit(id: number) {
    this.router.navigate(['/tenant/eusocial/job-position/edit', id]);
  }
}

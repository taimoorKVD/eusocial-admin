import { Component } from '@angular/core';
import { TenantJobPositionService } from '../../../../services/tenant-job-position.service';

@Component({
  selector: 'app-setup-job-position',
  standalone: false,

  templateUrl: './setup-job-position.component.html',
  styleUrl: './setup-job-position.component.scss'
})
export class SetupJobPositionComponent {
constructor(private tenantJobPosition: TenantJobPositionService) {}
  jobPositions: any[] = [];
  selectedJobId: number | null = null;

  jobTitle: string = '';
  selectedPermissions: number[] = [];

  isLoading = false;

  // Temporary permissions list (replace with API later if needed)
  allPermissions = [
    { id: 1, name: 'create-user' },
    { id: 2, name: 'view-job-position' },
    { id: 3, name: 'delete-user' },
    { id: 4, name: 'edit-job-position' },
    { id: 5, name: 'edit-location' },
  ]

  ngOnInit() {
    this.loadJobPositions();
  }

  // 🔹 Load all job positions
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

  // 🔹 On dropdown change
  onSelectJob() {
    if (!this.selectedJobId) return;

    this.isLoading = true;

    this.tenantJobPosition.getJobPositionById(this.selectedJobId).subscribe({
      next: (res: any) => {
        const job = res.data;

        this.jobTitle = job.name;
        this.selectedPermissions = job.permissions.map((p: any) => p.id);

        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        alert('Failed to load job details');
      }
    });
  }

  // 🔹 Checkbox handler
  onPermissionChange(event: any, id: number) {
    if (event.target.checked) {
      if (!this.selectedPermissions.includes(id)) {
        this.selectedPermissions.push(id);
      }
    } else {
      this.selectedPermissions = this.selectedPermissions.filter(p => p !== id);
    }
  }

  // 🔹 Save (Create / Update)
  saveJob() {

    if (!this.jobTitle.trim()) {
      alert('Job title is required');
      return;
    }

    const payload = {
      name: this.jobTitle,
      permissions: this.selectedPermissions
    };

    this.isLoading = true;

    if (this.selectedJobId) {
      // UPDATE
      this.tenantJobPosition.updateJobPosition(this.selectedJobId, payload).subscribe({
        next: () => {
          this.isLoading = false;
          alert('Updated successfully');
          this.loadJobPositions();
        },
        error: () => {
          this.isLoading = false;
          alert('Update failed');
        }
      });

    } else {
      // CREATE
      this.tenantJobPosition.createJobPosition(payload).subscribe({
        next: () => {
          this.isLoading = false;
          alert('Created successfully');
          this.loadJobPositions();
          this.resetForm();
        },
        error: () => {
          this.isLoading = false;
          alert('Creation failed');
        }
      });
    }
  }

  // 🔹 Reset form
  resetForm() {
    this.selectedJobId = null;
    this.jobTitle = '';
    this.selectedPermissions = [];
  }

  // 🔹 Delete (optional)
  deleteJob() {
    if (!this.selectedJobId) {
      alert('Select a job to delete');
      return;
    }

    if (!confirm('Are you sure you want to delete this job?')) return;

    this.isLoading = true;

    this.tenantJobPosition.deleteJobPosition(this.selectedJobId).subscribe({
      next: () => {
        this.isLoading = false;
        alert('Deleted successfully');
        this.resetForm();
        this.loadJobPositions();
      },
      error: () => {
        this.isLoading = false;
        alert('Delete failed');
      }
    });
  }
}

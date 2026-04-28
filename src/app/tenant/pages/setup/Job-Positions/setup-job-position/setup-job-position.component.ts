import { Component } from '@angular/core';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-setup-job-position',
  standalone: false,

  templateUrl: './setup-job-position.component.html',
  styleUrl: './setup-job-position.component.scss'
})
export class SetupJobPositionComponent {
constructor(private tenantJobPosition: TenantJobPositionService, private router:Router, private route: ActivatedRoute, private tenantSession: TenantSessionService, private toastr: ToastrService,) {}
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
    const id = this.route.snapshot.paramMap.get('id');

  if (id) {
    this.selectedJobId = +id;
    this.onSelectJob(); // load data
  }
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

  redirectToListing() {
  const slug = this.tenantSession.getSlug();
  this.router.navigate(['/tenant', slug, 'job-position']);
}

  // 🔹 Save (Create / Update)
  saveJob() {

    if (!this.jobTitle.trim()) {
      alert('Job title is required');
      return;
    }

  const payload = {
    name: this.jobTitle,
    description: 'Supervises day-to-day floor operations.', // or bind from input
    permissionIds: this.selectedPermissions
  };

    this.isLoading = true;

    if (this.selectedJobId) {
      // UPDATE
      this.tenantJobPosition.updateJobPosition(this.selectedJobId, payload).subscribe({
        next: () => {
          this.isLoading = false;
          // alert('Updated successfully');
          this.toastr.success('Job Updated Successfully');
          this.redirectToListing();
        },
        error: (err) => {
          this.isLoading = false;
          this.toastr.error(err?.error?.message || 'Failed to update Job');
          // alert('Update failed');
        }
      });

    } else {
      // CREATE
      this.tenantJobPosition.createJobPosition(payload).subscribe({
        next: () => {
          this.isLoading = false;
          // alert('Created successfully');
          this.toastr.success('Job Created Successfully');
          this.redirectToListing(); // ✅ redirect instead of reset
        },
        error: (err) => {
          this.isLoading = false;
          this.toastr.error(err?.error?.message || 'Failed to create Job');
          // alert('Creation failed');
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

  deleteJob() {
  if (!this.selectedJobId) {
    this.toastr.warning('Please select a job first');
    return;
  }

  this.isLoading = true;

  this.tenantJobPosition.deleteJobPosition(this.selectedJobId).subscribe({
    next: () => {
      this.isLoading = false;
      this.toastr.success('Job Deleted Successfully');
      this.redirectToListing();
    },
    error: (err) => {
      this.isLoading = false;
      this.toastr.error(err?.error?.message || 'Failed to Delete Job');
    }
  });
  }

  // 🔹 Delete (optional)
  // deleteJob() {
  //   if (!this.selectedJobId) {
  //     alert('Select a job to delete');
  //     return;
  //   }

  //   if (!confirm('Are you sure you want to delete this job?')) return;

  //   this.isLoading = true;

  //   this.tenantJobPosition.deleteJobPosition(this.selectedJobId).subscribe({
  //     next: () => {
  //       this.isLoading = false;
  //       this.toastr.success('Job Deleted Successfully');
  //       // alert('Deleted successfully');

  //       this.redirectToListing(); // ✅ redirect instead
  //     },
  //     error: (err) => {
  //       this.isLoading = false;
  //       this.toastr.error(err?.error?.message || 'Failed to Delete Job');
  //       // alert('Delete failed');
  //     }
  //   });
  // }
}

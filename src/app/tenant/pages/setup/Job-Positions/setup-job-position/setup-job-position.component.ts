import { Component, signal } from '@angular/core';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-setup-job-position',
  standalone: false,

  templateUrl: './setup-job-position.component.html',
  styleUrl: './setup-job-position.component.scss',
})
export class SetupJobPositionComponent {
  constructor(
    private tenantJobPosition: TenantJobPositionService,
    private router: Router,
    private route: ActivatedRoute,
    private tenantSession: TenantSessionService,
    private toastr: ToastrService,
  ) {}
  jobPositions: any[] = [];
  selectedJobId: number | null = null;

  jobTitle: string = '';
  selectedPermissions: number[] = [];
  permissionsTouched = false;
  isLoading = false;
  allPermissions: any[] = [];
  groupedPermissions: any = {};
  showConfirmModal = signal(false);
  confirmModalTitle = '';
  confirmModalDescription = '';
  private pendingAction: 'delete' | 'cancel' | null = null;


  ngOnInit() {
    this.loadJobPositions();
    this.loadPermissions();
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.selectedJobId = +id;
      this.onSelectJob(); // load data
    }
  }

  loadPermissions() {
    this.tenantJobPosition.getPermissions().subscribe({
      next: (res: any) => {
        this.allPermissions = res.data || [];

        this.groupPermissions();
      },
      error: () => {
        this.toastr.error('Failed to load permissions');
      },
    });
  }

  groupPermissions() {
    this.groupedPermissions = {};

    this.allPermissions.forEach((perm: any) => {
      const parts = perm.name.split('-');

      // create-user => user
      // edit-vendor => vendor
      const moduleName = parts.slice(1).join('-');

      if (!this.groupedPermissions[moduleName]) {
        this.groupedPermissions[moduleName] = [];
      }

      this.groupedPermissions[moduleName].push(perm);
    });
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
      },
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
        this.permissionsTouched = false;

        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        alert('Failed to load job details');
      },
    });
  }

  // 🔹 Checkbox handler
  onPermissionChange(event: any, id: number) {
    this.permissionsTouched = true;

    if (event.target.checked) {
      if (!this.selectedPermissions.includes(id)) {
        this.selectedPermissions.push(id);
      }
    } else {
      this.selectedPermissions = this.selectedPermissions.filter((p) => p !== id);
    }
  }

  redirectToListing() {
    const slug = this.tenantSession.getSlug();
    this.router.navigate(['/tenant', slug, 'job-position']);
  }

  // 🔹 Save (Create / Update)
  saveJob() {
    if (!this.jobTitle.trim()) {
      this.toastr.error('Job title is required');
      return;
    }

    if (this.selectedPermissions.length === 0) {
      this.permissionsTouched = true;
      this.toastr.error('Please select at least one job related permission');
      return;
    }

    const payload = {
      name: this.jobTitle,
      permissionIds: this.selectedPermissions,
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
        },
      });
    } else {
      // CREATE
      this.tenantJobPosition.createJobPosition(payload).subscribe({
        next: () => {
          this.isLoading = false;
          this.toastr.success('Job Created Successfully');
          this.redirectToListing();
        },
        error: (err) => {
          this.isLoading = false;
          this.toastr.error(err?.error?.message || 'Failed to create Job');
          // alert('Creation failed');
        },
      });
    }
  }

  resetForm() {
    this.pendingAction = 'cancel';

    this.confirmModalTitle = 'Discard Changes';
    this.confirmModalDescription =
      'Are you sure you want to leave this page? Any unsaved changes will be lost.';

    this.showConfirmModal.set(true);
  }

  deleteJob() {
    this.pendingAction = 'delete';
    this.confirmModalTitle = 'Delete Job';
    this.confirmModalDescription = 'Are you sure you want to delete this job? This action cannot be undone.';
    this.showConfirmModal.set(true);
  }

  onConfirmed(): void {

    this.showConfirmModal.set(false);

    switch (this.pendingAction) {
      case 'delete':
        this.confirmDeleteJob();
        break;

      case 'cancel':
        this.goToJobListing();
        break;
    }

    this.pendingAction = null;
  }

  confirmDeleteJob(){
    if (!this.selectedJobId) {
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
      },
    });
  }

  onClosed(): void {
    this.showConfirmModal.set(false);
  }

  goToJobListing() {
    const slug = this.tenantSession.getSlug();
    this.router.navigate(['/tenant', slug, 'job-position']);
  }
}

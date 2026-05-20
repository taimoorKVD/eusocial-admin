import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PermissionService } from '../../../services/permission.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-permissions-form',
  standalone: false,
  templateUrl: './permissions-form.component.html',
  styleUrl: './permissions-form.component.scss',
})
export class PermissionsFormComponent {
  formData = {
    name: '',
  };

  isEdit = false;
  id!: number;
  isLoading = false;
  isSubmitting = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private permissionsService: PermissionService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));

    if (this.id) {
      this.isEdit = true;
      this.loadPermission();
    }
  }

  loadPermission() {
    this.isLoading = true;

    this.permissionsService.getPermissionById(this.id).subscribe({
      next: (res: any) => {
        this.formData = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error('Failed to load permission');
      },
    });
  }

  save() {
    if (!this.formData.name) {
      this.toastr.error('Name is required');
      return;
    }

    this.isSubmitting = true;

    const request =
      this.isEdit
        ? this.permissionsService.updatePermission(this.id, this.formData)
        : this.permissionsService.createPermission(this.formData);

    request.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.toastr.success(
          this.isEdit ? 'Updated successfully' : 'Created successfully'
        );
        this.router.navigate(['/permissions']);
      },
      error: () => {
        this.isSubmitting = false;
        this.toastr.error('Something went wrong');
      },
    });
  }

  cancel() {
    this.router.navigate(['/permissions']);
  }
}

import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { PermissionService } from '../../services/permission.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-permissions',
  standalone: false,
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss',
})
export class PermissionsComponent {
  permissions: any[] = [];
  isLoading = false;
    constructor(
    private permissionsService: PermissionService,
    private toastr: ToastrService,
    private router: Router
  ) {}

    ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions() {
    this.isLoading = true;

    this.permissionsService.getPermissions().subscribe({
      next: (res: any) => {
        this.permissions = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error('Failed to load permissions');
      },
    });
  }

  goToCreate() {
    this.router.navigate(['permissions/create']);
  }

  edit(id: number) {
    this.router.navigate([`permissions/${id}/edit`]);
  }

  delete(id: number) {
    this.permissionsService.deletePermission(id).subscribe({
      next: () => {
        this.toastr.success('Deleted successfully');
        this.loadPermissions();
      },
      error: () => {
        this.toastr.error('Delete failed');
      },
    });
  }
}

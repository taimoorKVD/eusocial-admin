import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { RoleService } from '../../../../../services/role.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantRoleService } from '../../../../../services/tenant-role.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-role',
  standalone: false,
  templateUrl: './role.component.html',
  styleUrl: './role.component.scss',
})
export class RoleComponent {
  roleId: number | null = null;
  permissionsList: any[] = [];
  groupedPermissions: any = {};

  role = {
    name: '',
    permissions: [] as number[],
  };

  constructor(
    private fb: FormBuilder,
    private rolesService: TenantRoleService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.roleId = Number(this.route.snapshot.paramMap.get('id'));

    this.loadPermissions();

    if (this.roleId) {
      this.loadRole();
    }
  }

  // loadPermissions() {
  //   this.rolesService.getPermissions().subscribe({
  //     next: (res: any) => {
  //       this.permissionsList = res.data || [];
  //     },
  //   });
  // }

  loadPermissions() {

  this.rolesService.getPermissions().subscribe({

    next: (res: any) => {

      const permissions = res.data || [];

      this.permissionsList = permissions;

      this.groupedPermissions = permissions.reduce((acc: any, perm: any) => {

        // create-user => user
        const parts = perm.name.split('-');

        const moduleName = parts.slice(1).join('-');

        if (!acc[moduleName]) {
          acc[moduleName] = [];
        }

        acc[moduleName].push(perm);

        return acc;

      }, {});
    }

  });
}

  loadRole() {
    this.rolesService.getRoleById(this.roleId!).subscribe({
      next: (res: any) => {
        this.role.name = res.data.name;
        this.role.permissions = res.data.permissions.map((p: any) => p.id);
      },
    });
  }

  togglePermission(id: number) {
    if (this.role.permissions.includes(id)) {
      this.role.permissions = this.role.permissions.filter((p) => p !== id);
    } else {
      this.role.permissions.push(id);
    }
  }

submit() {

  const payload = {
    name: this.role.name,
    permissions: this.role.permissions,
  };

  if (this.roleId) {

    this.rolesService.updateRole(this.roleId, payload).subscribe({

      next: () => {

        this.toastr.success('Role updated successfully');

        this.router.navigate(['/roles']);
      }

    });

  } else {

    this.rolesService.createRole(payload).subscribe({

      next: () => {

        this.toastr.success('Role created successfully');

        this.router.navigate(['/roles']);
      }

    });

  }
}
}

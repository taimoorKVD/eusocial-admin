import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RoleService } from '../../../services/role.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PermissionService } from '../../../services/permission.service';
import { Permission } from '../../../interfaces/permission';

@Component({
  selector: 'app-role-form',
  standalone: false,
  templateUrl: './role-form.html',
  styleUrl: './role-form.scss',
})
export class RoleForm {
  form!: FormGroup;
  permissions: { module: string; perms: Permission[] }[] = [];
  isEditMode = false;
  roleId!: number;
  message = '';
  saving = false;

  constructor(
    private fb: FormBuilder,
    private roleService: RoleService,
    private router: Router,
    private route: ActivatedRoute,
    private permissionService: PermissionService
  ) { }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      permissions: [[]],
    });

    this.loadPermissions();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.roleId = +id;

      // Step 1: Load all permissions first
      this.loadPermissions(() => this.loadRole(this.roleId));
    } else {
      this.loadPermissions();
    }
  }

  get f() {
    return this.form.controls;
  }

  /** Load and group permissions, then optionally run a callback */
  loadPermissions(callback?: () => void): void {
    this.permissionService.getAll().subscribe({
      next: (data) => {
        const grouped: { [key: string]: Permission[] } = {};

        data.forEach((perm) => {
          const parts = perm.name.split('_');
          const entity = parts.length > 1 ? parts[1] : parts[0];
          const moduleName = entity.charAt(0).toUpperCase() + entity.slice(1);
          if (!grouped[moduleName]) grouped[moduleName] = [];
          grouped[moduleName].push(perm);
        });

        this.permissions = Object.entries(grouped).map(([module, perms]) => ({
          module,
          perms,
        }));

        // ✅ Run callback only after permissions are ready
        if (callback) callback();
      },
      error: () => console.error('Failed to load permissions'),
    });
  }


  formatPermissionName(name: string): string {
    const parts = name.split('_');
    const action = parts[0];
    return action.charAt(0).toUpperCase() + action.slice(1);
  }


  /** Handle permission checkbox toggle */
  togglePermission(id: number, checked: boolean): void {
    const selected = this.form.value.permissions || [];
    if (checked) {
      this.form.patchValue({ permissions: [...selected, id] });
    } else {
      this.form.patchValue({ permissions: selected.filter((p: number) => p !== id) });
    }
  }

  loadRole(id: number): void {
    this.saving = true;
    this.roleService.getRole(id).subscribe({
      next: (res) => {
        const permissionIds = res.permissions?.map((p: any) => p.id) || [];

        this.form.patchValue({
          name: res.name,
          permissions: permissionIds,
        });

        this.saving = false;
      },
      error: () => {
        this.message = 'Failed to load role ❌';
        this.saving = false;
      },
    });
  }


  saveRole() {
    if (this.form.invalid) return;

    this.saving = true;
    const request = this.isEditMode
      ? this.roleService.updateRole(this.roleId, this.form.value)
      : this.roleService.createRole(this.form.value);

    request.subscribe({
      next: () => {
        this.message = this.isEditMode
          ? 'Role updated successfully ✅'
          : 'Role created successfully ✅';
        this.saving = false;
        setTimeout(() => this.router.navigate(['/roles']), 1000);
      },
      error: () => {
        this.message = 'Failed to save role ❌';
        this.saving = false;
      },
    });
  }

  deleteRole() {
    if (!this.isEditMode) return;
    if (!confirm('Are you sure you want to delete this role?')) return;

    this.roleService.deleteRole(this.roleId).subscribe({
      next: () => {
        this.message = 'Role deleted successfully ✅';
        setTimeout(() => this.router.navigate(['/roles']), 800);
      },
      error: () => (this.message = 'Failed to delete role ❌'),
    });
  }

  backToList() {
    this.router.navigate(['/roles']);
  }

}

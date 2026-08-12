import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RoleService } from '../../../services/role.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PermissionService } from '../../../services/permission.service';
import { Permission } from '../../../interfaces/permission';
import { ToastrService } from 'ngx-toastr';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

@Component({
  selector: 'app-role-form',
  standalone: false,
  templateUrl: './role-form.html',
  styleUrl: './role-form.scss',
})
export class RoleForm {
  form!: FormGroup;
  permissions: { module: string; perms: Permission[] }[] = [];
  selectedPermissions: number[] = [];
  isEditMode = false;
  roleId!: number;
  saving = false;
  loadingPermissions = false;

  constructor(
    private fb: FormBuilder,
    private roleService: RoleService,
    private router: Router,
    private route: ActivatedRoute,
    private permissionService: PermissionService,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      permissions: [[], this.minSelectedCheckboxes(1)],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.roleId = +id;
      this.loadPermissions(() => this.loadRole(this.roleId));
    } else {
      this.loadPermissions();
    }
  }
  minSelectedCheckboxes(min = 1): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value || [];
      return value.length >= min ? null : { required: true };
    };
  }

  get f() {
    return this.form.controls;
  }

  /** Load and group permissions, then optionally run a callback */
  loadPermissions(callback?: () => void): void {
    this.loadingPermissions = true;

    this.permissionService.getAll().subscribe({
      next: (res) => {
        const permissions = Array.isArray(res) ? res : res.data;
        const grouped: { [key: string]: Permission[] } = {};

        permissions.forEach((perm: Permission) => {
          const parts = perm.name.split('-');
          const entity = parts.length > 1 ? parts[1] : parts[0];
          const moduleName = entity.charAt(0).toUpperCase() + entity.slice(1);

          if (!grouped[moduleName]) grouped[moduleName] = [];
          grouped[moduleName].push(perm);
        });

        this.permissions = Object.entries(grouped).map(([module, perms]) => ({
          module,
          perms,
        }));

        this.loadingPermissions = false;
        if (callback) callback();
      },
      error: () => {
        this.toastr.error('Failed to load permissions');
        this.loadingPermissions = false;
      },
    });
  }

  formatPermissionName(name: string): string {
    const parts = name.split('-');
    const action = parts[0];
    return action.charAt(0).toUpperCase() + action.slice(1);
  }

  /** Handle permission checkbox toggle */
  togglePermission(id: number, checked: boolean): void {
    const selected = this.form.value.permissions || [];
    if (checked) {
      this.form.patchValue({ permissions: [...selected, id] });
    } else {
      this.form.patchValue({
        permissions: selected.filter((p: number) => p !== id),
      });
    }
  }

  loadRole(id: number): void {
    this.saving = true;
    this.roleService.getRole(id).subscribe({
      next: (res) => {
        const permissionIds = res.permissions?.map((p: Permission) => p.id) || [];

        this.selectedPermissions = [...permissionIds];

        this.form.patchValue({
          name: res.name,
          permissions: permissionIds,
        });

        this.saving = false;
      },
      error: () => {
        this.toastr.error('Failed to load role');
        this.saving = false;
      },
    });
  }

  scrollToFirstError(): void {
    const controls = ['name', 'permissions'] as const;
    const controlName = controls.find((name) => this.form.get(name)?.invalid);
    if (!controlName) return;

    const element =
      controlName === 'permissions'
        ? (document.querySelector('.permissions-section') as HTMLElement | null)
        : (document.querySelector(`[formControlName="${controlName}"]`) as HTMLElement | null);

    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      element.focus({ preventScroll: true });
    }
  }

  saveRole(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.scrollToFirstError();
      return;
    }

    this.saving = true;
    const payload = this.form.value;

    const request = this.isEditMode
      ? this.roleService.updateRole(this.roleId, payload)
      : this.roleService.createRole(payload);

    request.subscribe({
      next: () => {
        this.toastr.success(
          this.isEditMode ? 'Role updated successfully' : 'Role created successfully',
        );
        this.saving = false;
        this.router.navigate(['/roles']);
      },
      error: (error) => {
        const errors = error?.error?.message;
        if (Array.isArray(errors)) {
          errors.forEach((msg: string) => {
            this.toastr.error(msg);
          });
        } else {
          this.toastr.error(
            errors || 'Something went wrong'
          );
        }
        this.saving = false;
      },
    });
  }

  deleteRole(): void {
    if (!this.isEditMode || !this.roleId) return;

    this.roleService.deleteRole(this.roleId).subscribe({
      next: () => {
        this.toastr.success('Role deleted successfully');
        this.router.navigate(['/roles']);
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Failed to delete role'),
    });
  }

  backToList(): void {
    this.router.navigate(['/roles']);
  }

  isChecked(id: number): boolean {
    return this.form.value.permissions?.includes(id);
  }

  /**
   * ✅ Format permission name nicely
   */
}

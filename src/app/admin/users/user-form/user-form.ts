import { Component } from '@angular/core';
import {
  AbstractControl,
  Form,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { HttpClient } from '@angular/common/http';
import { Role } from '../../../interfaces/role';
import { User } from '../../../interfaces/user';
import { RoleService } from '../../../services/role.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-user-form',
  standalone: false,
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm {
  form: FormGroup;
  roles: Role[] = [];
  id: number | null = null;
  isEditMode = false;
  saving = false;
  message = '';

  // 👁️ password visibility flags
  showPassword = false;
  showConfirmPassword = false;

  // // 🧩 Dummy roles for now
  // roles = [
  //   { id: 2, name: 'Super Admin' },
  //   { id: 3, name: 'Editor' },
  //   { id: 5, name: 'Manager' },
  // ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private http: HttpClient,
    private roleService: RoleService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group(
      {
        name: ['', Validators.required],
        // last_name: [''],
        email: ['', [Validators.required, Validators.email]],
        role_id: ['', Validators.required],
        password: [''],
        password_confirm: [''],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );

    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.isEditMode = !!this.id;

    if (this.isEditMode) {
      this.loadUser();
    } else {
      // Only add required validators if creating
      this.form.get('password')?.addValidators([Validators.required, Validators.minLength(6)]);
      this.form.get('password_confirm')?.addValidators([Validators.required]);
    }

    this.loadRoles();
  }

  loadRoles(): void {
    this.roleService.getAllRoles().subscribe({
      next: (roles) => (this.roles = roles),
      error: () => console.error('Failed to load roles'),
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirm = form.get('password_confirm')?.value;
    if (!password && !confirm) return null; // ✅ both empty is fine
    return password === confirm ? null : { passwordsMismatch: true };
  }

  loadUser() {
    this.userService.getUser(this.id!).subscribe((user) => {
      this.form.patchValue({
        name: user.name,
        email: user.email,
        role_id: user.role?.id,
      });
    });
  }

  saveUser() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.error('Please fill in all required fields correctly');
      return;
    }
    this.saving = true;
    this.message = '';

    const payload = this.form.value;
    console.log('Sending user payload:', payload);

    const request = this.isEditMode
      ? this.userService.updateUser(this.id!, payload)
      : this.userService.createUser(payload);

    request.subscribe({
      next: (res) => {
        console.log('Success response:', res);
        this.toastr.success(
          this.isEditMode ? 'User updated successfully' : 'User created successfully'
        );
        this.saving = false;
        setTimeout(() => this.router.navigate(['/users']), 1000);
      },
      error: (err: any) => {
        const msg = this.extractErrorMessage(err);
        console.error('HTTP Error:', { status: err.status, statusText: err.statusText, body: err.error, extractedMsg: msg });
        this.toastr.error(msg);
        this.saving = false;
      },
    });
  }

  private extractErrorMessage(err: any): string {
    try {
      const body = err?.error;
      if (body?.message) {
        if (Array.isArray(body.message)) return body.message.join(', ');
        return String(body.message);
      }
      if (body?.errors && typeof body.errors === 'object') {
        const errors = Object.values(body.errors as any);
        if (errors.length > 0) {
          const first = errors[0];
          if (Array.isArray(first)) return String(first[0]);
          return String(first);
        }
      }
      if (typeof body === 'string') return body;
      if (err?.statusText) return err.statusText;
    } catch (e) {
      console.error('Error extraction failed:', e);
    }
    return 'Failed to save user';
  }

  deleteUser(): void {
    if (!this.isEditMode || !this.id) {
      this.message = 'No user selected for deletion ❌';
      return;
    }

    const confirmDelete = confirm('Are you sure you want to delete this user?');
    if (!confirmDelete) return;

    this.saving = true;
    this.message = '';

    this.userService.deleteUser(this.id).subscribe({
      next: () => {
        this.toastr.success('User deleted successfully');
        this.saving = false;
        this.router.navigate(['/users']);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'Failed to delete user');
        this.saving = false;
      },
    });
  }

  backToList(): void {
    this.router.navigate(['/users']);
  }

  // 👁️ Toggle methods
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // ✅ Easy access to controls
  get f() {
    return this.form.controls;
  }
}

import { Component } from '@angular/core';
import { AbstractControl, Form, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { HttpClient } from '@angular/common/http';
import { Role } from '../../../interfaces/role';
import { User } from '../../../interfaces/user';

@Component({
  selector: 'app-user-form',
  standalone: false,
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm {

  form: FormGroup;
  // roles: Role[] = [];
  id: number | null = null;
  isEditMode = false;
  saving = false;
  message = '';

  // 👁️ password visibility flags
  showPassword = false;
  showConfirmPassword = false;

  // 🧩 Dummy roles for now
  roles = [
    { id: 2, name: 'Super Admin' },
    { id: 3, name: 'Editor' },
    { id: 5, name: 'Manager' },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private http: HttpClient
  ) { }


  ngOnInit(): void {
    this.form = this.fb.group({
      first_name: ['', Validators.required],
      last_name: [''],
      email: ['', [Validators.required, Validators.email]],
      role_id: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      password_confirm: ['', Validators.required],
    },
      {
        validators: this.passwordMatchValidator,
      }
    );

    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.isEditMode = !!this.id;

    if (this.isEditMode) {
      this.loadUser();
    }

    // this.loadRoles();
  }

  // loadRoles(): void {
  //   this.roleService.getRoles().subscribe({
  //     next: (roles) => (this.roles = roles),
  //     error: () => console.error('Failed to load roles'),
  //   });
  // }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirm = form.get('password_confirm')?.value;
    return password === confirm ? null : { passwordsMismatch: true };
  }

  loadUser() {
    this.userService.getUser(this.id!).subscribe((user) => {
      this.form.patchValue({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role_id: user.role?.id,
      });
    });
  }

  saveUser() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.message = '';

    const payload = this.form.value;

    const request = this.isEditMode
      ? this.userService.updateUser(this.id!, payload)
      : this.userService.createUser(payload);

    request.subscribe({
      next: () => {
        this.message = this.isEditMode
          ? 'User updated successfully ✅'
          : 'User created successfully ✅';
        this.saving = false;
        setTimeout(() => this.router.navigate(['/users']), 1500);
      },
      error: () => {
        this.message = 'Failed to save user ❌';
        this.saving = false;
      },
    });
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
        this.message = 'User deleted successfully ✅';
        this.saving = false;

        // Small delay before navigating back to list
        setTimeout(() => {
          this.router.navigate(['/users']);
        }, 800);
      },
      error: () => {
        this.message = 'Failed to delete user ❌';
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

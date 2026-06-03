import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { FormField } from '../../../../form-builder/models/form-field.model';
import { CdkDragDrop } from '@angular/cdk/drag-drop';


@Component({
  selector: 'app-setup-user',
  standalone: false,

  templateUrl: './setup-user.component.html',
  styleUrl: './setup-user.component.scss'
})
export class SetupUserComponent {

constructor(private userService: TenantUserService,  private toastr: ToastrService, private route: ActivatedRoute, private router: Router, private tenantSession : TenantSessionService ) {}
  @ViewChild('firstInput') firstInput!: ElementRef;
  isModalOpen = false;
  modalType: 'delete' | 'exit' | 'save' | null = null;
  modalMessage = '';
  selectedJob: any;
  selectedLocation: any;
  selectedRole: any; // if you have role dropdown
  loadingCount = 0;
  loading = false;
  isSubmitted = false;
  emailFormatError = false;
  passwordMismatch = false;
  mode: 'create' | 'edit' = 'create';
  editingUserId: number | null = null;
  slug: string = '';
  users: any[] = [];
  selectedUser: any;
  jobPositions: any[] = [];
  locations: any[] = [];
  availabilityDays = [
    'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'
  ];
  showPassword = false;
  selectedDays: string[] = [];
  isCredentialsModalOpen = false;
  credentialUserId: number | null = null;
  credentialEmail: string = '';
  sendEmail: string = '';
  generatedPassword: string = '';
  phoneError: string = '';
 @Input() schema: FormField[] = [];
 @Output() selectField = new EventEmitter<FormField>();
 @Output() canvasDrop = new EventEmitter<CdkDragDrop<FormField[]>>();
 @Output() duplicateField = new EventEmitter<FormField>();
 @Output() deleteField = new EventEmitter<FormField>();


  startLoading() {
    this.loadingCount++;
    this.loading = true;
  }

  stopLoading() {
    this.loadingCount--;

    if (this.loadingCount <= 0) {
      this.loading = false;
    }
  }

  formData: any = {
    name: '',
    email: '',
    phone_number: '', // ADD THIS
    address: '',
    username: '',
    password: '',
    password_confirm: '',
    job_position_id: null,
    location_id: null,
    availability_days: []
  };

  ngOnInit(): void {

  this.loadUsers();
  this.loadJobPositions();
  this.loadLocations();
  this.slug = this.tenantSession.getSlug();

  this.route.paramMap.subscribe(params => {

    const id = params.get('id');

    if (id) {
      this.mode = 'edit';
      this.editingUserId = Number(id);
      this.selectedUser = Number(id);

      this.loadUserData(Number(id)); // ✅ yahan call hoga
    } else {
      this.handleCreateUser();
    }

  });
  }

  loadUserData(userId: number) {

    this.startLoading();

    this.userService.getUserById(userId).subscribe({

      next: (res: any) => {

        const user = res.data;

        this.formData = {
          name: user.name,
          email: user.email.split('@')[0],
          phone_number: user.phoneNumber,
          address: user.address,
          username: user.username,
          password: '',
          password_confirm: '',
          job_position_id: user.jobPosition?.id || null,
          location_id: user.location?.id || null,
          // availability_days: user.availabilityDays || []
            // availability_days: [...(user.availabilityDays || [])]
          availability_days: Array.isArray(user.availabilityDays)
          ? [...user.availabilityDays]   // ✅ KEEP ORIGINAL CASE
          : [],
        };

        // this.selectedDays = [...(user.availabilityDays || [])];

        this.stopLoading();
      },

      error: () => {
        this.toastr.error('Failed to load user');
        this.stopLoading();
      }
    });
  }

  loadUsers() {
    this.startLoading();
    this.userService.getUsers().subscribe((res: any) => {

      const apiUsers = res.data.map((user: any) => ({
        label: user.name,
        value: user.id
      }));

      // 👉 Add create option at top
      this.users = [
        { label: 'Create User +', value: 'create' },
        ...apiUsers
      ];
      this.stopLoading();
    }, (err) => {
      this.stopLoading();
    });
  }

  onClearUser() {
    this.selectedUser = null;

    this.formData = {
      name: '',
      email: '',
      phone_number: '',
      address: '',
      username: '',
      password: '',
      password_confirm: '',
      job_position_id: null,
      location_id: null,
      availability_days: []
    };

    this.selectedDays = [];
  }

  onUserSelect(event: any) {

    const userId = event?.value ?? event;

    if (userId === 'create') {
      this.handleCreateUser();
      this.mode = 'create';
      this.editingUserId = null;
      return;
    }

    if (!userId) return;
    this.mode = 'edit';
    this.editingUserId = userId;

    this.userService.getUserById(userId).subscribe((res: any) => {

      const user = res.data;

      this.formData = {
        name: user.name,
        email: user.email,
        phone_number: user.phoneNumber,
        address: user.address,
        username: user.username,
        password: '',
        password_confirm: '',
        job_position_id: user.jobPosition?.id || null,
        location_id: user.location?.id || null,
        // availability_days: user.availability_days || []
              // 🔥 FIX 2 (normalize + safe)
      availability_days: Array.isArray(user.availabilityDays)
        ? user.availabilityDays.map((d: string) => d.toLowerCase())
        : [],
      };

    });
  }

  handleCreateUser() {
    this.mode = 'create';
    this.editingUserId = null;
    this.selectedUser = 'create';

    this.formData = {
      name: '',
      email: '',
      phone_number: '',
      address: '',
      username: '',
      password: '',
      password_confirm: '',
      job_position_id: null,
      location_id: null,
      availability_days: [],
      new_password: '',
      new_password_confirm: ''
    };
  }

  loadJobPositions() {
    this.userService.getJobPositions().subscribe((res: any) => {
      this.jobPositions = res.data.map((job: any) => ({
        label: job.name,
        value: job.id
      }));
      this.stopLoading();
    }, (err) => {
      this.stopLoading();
    });
  }

  loadLocations() {
    this.startLoading();
    this.userService.getLocations().subscribe((res: any) => {
      this.locations = res.data.map((loc: any) => ({
        label: loc.name,
        value: loc.id
      }));
      this.stopLoading();
    }, (err) => {
      this.stopLoading();
    });
  }


  selectDay(day: string) {
  const index = this.formData.availability_days.indexOf(day);

  if (index > -1) {
    this.formData.availability_days.splice(index, 1);
  } else {
    this.formData.availability_days.push(day);
  }
}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  openModal(type: 'delete' | 'exit' | 'save') {

    if (type === 'save') {
      this.isSubmitted = true;

      if (!this.validateForm()) {

        this.toastr.error('Please fix validation errors');

        return;
      }
    }

    // ✅ Prevent delete if no user selected
    if (type === 'delete' && (!this.selectedUser || this.selectedUser === 'create')) {
      this.toastr.warning('Please select a user first');
      return;
    }

    this.modalType = type;
    this.isModalOpen = true;

    switch (type) {
      case 'delete':
        this.modalMessage = 'Are you sure you want to delete this user?'; // improved
        break;

      case 'exit':
        this.modalMessage = 'Do you want to exit without saving?';
        break;

      case 'save':
        this.modalMessage = 'Do you want to save?';
        break;
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.modalType = null;
  }

  redirectToUserListing() {
  const slug = this.tenantSession.getSlug();
  this.router.navigate(['/tenant', slug, 'users']);
  }

confirmAction() {

  // ================= DELETE =================
  if (this.modalType === 'delete') {

    if (!this.selectedUser || this.selectedUser === 'create') return;

    this.startLoading();

    this.userService.deleteUser(this.selectedUser).subscribe({
      next: () => {
        this.closeModal();
        this.toastr.success('User deleted successfully');
        this.stopLoading();
        this.redirectToUserListing();
      },
      error: (err) => {
        console.error('Delete error:', err);
        this.toastr.error(err?.error?.message || 'Failed to delete user');
        this.stopLoading();
      }
    });

    return;
  }

  // ================= EXIT =================
  if (this.modalType === 'exit') {
    this.closeModal();
    this.redirectToUserListing();
    return;
  }

  // ================= SAVE =================
  if (this.modalType === 'save') {

    this.isSubmitted = true;

    if (!this.validateForm()) return;

      // ✅ close confirm modal first
    this.closeModal();

    this.startLoading();

    // ================= BASE PAYLOAD =================
    const payload: any = {
      name: this.formData.name,
      username: this.formData.username,
      address: this.formData.address,
      // phoneNumber: this.formData.phone_number,
        phone_number: this.formData.phone_number,
      email: this.getFullEmail(),
      role_id: 1,
      job_position_id: Number(this.formData.job_position_id),
      location_id: Number(this.formData.location_id),
      availability_days: this.formData.availability_days || []
    };

    // ================= CREATE MODE =================
    if (this.mode === 'create') {

      payload.password = this.formData.password;
      payload.password_confirm = this.formData.password_confirm;

      this.userService.createUser(payload).subscribe({
        next: (res: any) => {

          const newUser = res.data;

          this.setCredentials({
            email: payload.email,
            password: res.data.plainPassword,
             userId: newUser.id   // ✅ IMPORTANT
          });

          this.closeModal();
          this.toastr.success('User created successfully');

          this.isCredentialsModalOpen = true;
          this.stopLoading();
        },

        error: (err) => {
          console.error('Create user error:', err);
          this.toastr.error(err?.error?.message || 'Failed to create user');
          this.stopLoading();
        }
      });

      return;
    }

    // ================= EDIT MODE =================
    if (this.mode === 'edit' && this.editingUserId) {

      // ✅ OPTIONAL PASSWORD UPDATE
      const hasNewPassword = this.formData.new_password?.trim();
      const hasNewConfirm = this.formData.new_password_confirm?.trim();

      if (hasNewPassword || hasNewConfirm) {

        if (!hasNewPassword) {
          this.toastr.error('New password is required');
          this.stopLoading();
          return;
        }

        if (!hasNewConfirm) {
          this.toastr.error('Confirm password is required');
          this.stopLoading();
          return;
        }

        if (this.formData.new_password !== this.formData.new_password_confirm) {
          this.toastr.error('Passwords do not match');
          this.stopLoading();
          return;
        }

        payload.password = this.formData.new_password;
        payload.password_confirm = this.formData.new_password_confirm;
      }

      this.userService.updateUser(this.editingUserId, payload).subscribe({
        next: (res: any) => {

          this.setCredentials({
            email: payload.email,
             userId: this.editingUserId,   // ✅ IMPORTANT
            password: res.data.plainPassword || null
          });

          // reset optional password fields
          this.formData.new_password = '';
          this.formData.new_password_confirm = '';

          this.closeModal();
          this.toastr.success('User updated successfully');

          this.isCredentialsModalOpen = true;
          this.stopLoading();
        },

        error: (err) => {
          console.error('Update user error:', err);
          this.toastr.error(err?.error?.message || 'Failed to update user');
          this.stopLoading();
        }
      });
    }
  }
}

validateForm(): boolean {

  const f = this.formData;

  this.passwordMismatch = false;
  this.emailFormatError = false;

  let valid = true;

  // ================= REQUIRED =================
  if (!f.name || !f.email || !f.username || !f.address || !f.job_position_id || !f.location_id) {
    return false;
  }

  if (!f.availability_days || f.availability_days.length === 0) {
  // this.toastr.error('Availability is required');
  return false;
}

  // ================= EMAIL =================
  const usernameRegex = /^[a-zA-Z0-9._]+$/;

  // ❌ block @ in username field
  if (f.email.includes('@')) {
    this.emailFormatError = true;
    return false;
  }

  if (!usernameRegex.test(f.email)) {
    this.emailFormatError = true;
    return false;
  }

  // ================= PASSWORD =================
  const hasPassword = !!f.password;
  const hasConfirm = !!f.password_confirm;

  // 🔹 CREATE MODE
  if (this.mode === 'create') {

    if (!hasPassword || !hasConfirm) {
      this.toastr.error('Password is required');
      return false;
    }

    if (f.password !== f.password_confirm) {
      this.passwordMismatch = true;
      return false;
    }
  }

  // 🔹 EDIT MODE
  if (this.mode === 'edit') {

    // Only validate if user is typing password
    if (hasPassword || hasConfirm) {

      if (!hasPassword) {
        this.toastr.error('Enter password');
        return false;
      }

      if (!hasConfirm) {
        this.toastr.error('Confirm password is required');
        return false;
      }

      if (f.password !== f.password_confirm) {
        this.passwordMismatch = true;
        return false;
      }
    }
  }

  return valid;
}

  onFieldChange() {

    const f = this.formData;

    if (f.email !== undefined) {

      // if user typed @ → block it
      if (f.email.includes('@')) {
        this.emailFormatError = true;
        return;
      }

      const usernameRegex = /^[a-zA-Z0-9._-]+$/;

      this.emailFormatError = f.email ? !usernameRegex.test(f.email) : false;

      // DO NOT build full email here
    }
  }

  getFullEmail(): string {
    const username = this.formData.email;
    const slug = this.tenantSession.getSlug();

    return username ? `${username}@${slug}.com` : '';
  }

  copyText(value: string) {
  navigator.clipboard.writeText(value);
  this.toastr.success('Copied');
}

allowOnlyNumbers(event: KeyboardEvent) {

  const allowedKeys = [
    'Backspace',
    'Delete',
    'ArrowLeft',
    'ArrowRight',
    'Tab'
  ];

  // allow control keys
  if (allowedKeys.includes(event.key)) {
    return;
  }

  // allow only numbers
  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault();
  }
}

validatePhoneNumber() {

  // remove all non-numeric characters automatically
  this.formData.phone_number =
    this.formData.phone_number.replace(/\D/g, '');

  // phone validation
  const phoneRegex = /^[0-9]{10,15}$/;

  if (!this.formData.phone_number) {

    this.phoneError = 'please enter a valid phone number';

  } else if (!phoneRegex.test(this.formData.phone_number)) {

    this.phoneError =
      'Phone number must be between 10 and 15 digits';

  } else {

    this.phoneError = '';
  }
}

handlePaste(event: ClipboardEvent) {

  event.preventDefault();

  const pastedText =
    event.clipboardData?.getData('text') || '';

  // keep only numbers
  const numbersOnly = pastedText.replace(/\D/g, '');

  // append clean value
  this.formData.phone_number = numbersOnly;

  this.validatePhoneNumber();
}


  sendCredentials() {

    if (!this.credentialUserId) return;

    const payload = {
      recipient_email: this.sendEmail,
      password: this.generatedPassword
    };

    this.userService.sendCredentials(this.credentialUserId, payload).subscribe({

      next: () => {
        this.toastr.success('Credentials sent successfully');
        this.isCredentialsModalOpen = false;
        this.redirectToUserListing();
      },

      error: (err) => {
        this.toastr.error(err?.error?.message || 'Failed to send credentials');
      }
    });
  }

setCredentials(data: any) {
  this.credentialEmail = data.email;
  this.generatedPassword = data.password;

  // ❗ ADD THIS
  this.credentialUserId = data.userId;

  // optional
  this.sendEmail = data.email;
}

onSelectField(field: FormField) {
  this.selectField.emit(field);
}

onCanvasDrop(event: CdkDragDrop<FormField[]>) {
  this.canvasDrop.emit(event);
}

onDuplicateField(field: FormField, event: Event) {
  event.stopPropagation();
  this.duplicateField.emit(field);
}

onDeleteField(field: FormField, event: Event) {
  event.stopPropagation();
  this.deleteField.emit(field);
}
}

import { Component, ElementRef, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';

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
    phone_number: '',
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
          email: user.email,
          phone_number: user.phoneNumber,
          address: user.address,
          username: user.username,
          password: '',
          password_confirm: '',
          job_position_id: user.jobPosition?.id || null,
          location_id: user.location?.id || null,
          availability_days: user.availabilityDays || []
        };

        this.selectedDays = [...(user.availabilityDays || [])];

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
        availability_days: user.availabilityDays || []
      };

      // ✅ ADD THIS LINE (important)
      this.selectedDays = [...(user.availabilityDays || [])];

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
      availability_days: []
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

    const index = this.selectedDays.indexOf(day);

    if (index > -1) {
      // remove (inactive)
      this.selectedDays.splice(index, 1);
    } else {
      // add (active)
      this.selectedDays.push(day);
    }

    // keep formData in sync
    this.formData.availability_days = [...this.selectedDays];
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  openModal(type: 'delete' | 'exit' | 'save') {

    // ✅ ONLY validate for SAVE
    if (type === 'save') {
      this.isSubmitted = true;

      if (!this.validateForm()) {

        // 🔥 ADD TOASTER (instead of silent fail)
        this.toastr.error('Please fix validation errors');

        return; // ❌ modal will NOT open
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

          // ✅ remove user from dropdown
          // this.users = this.users.filter(u => u.value !== this.selectedUser);

          // ✅ reset form + selection
          // this.handleCreateUser();

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

      return; // 🔥 important (stop further execution)
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

  // password check sirf CREATE ke liye
  if (this.mode === 'create') {
    if (!this.formData.password) return;
    if (!this.formData.password_confirm) return;
    if (this.formData.password !== this.formData.password_confirm) return;
  }

  this.startLoading();

  const payload = {
    ...this.formData,
    email: this.getFullEmail(),
    role_id: 1,
    job_position_id: Number(this.formData.job_position_id),
    location_id: Number(this.formData.location_id),
    // password_confirm: this.formData.password_confirm
  };

    if (!this.formData.password) {
    delete payload.password;
    delete payload.password_confirm;
  }

  // ================= CREATE =================
  if (this.mode === 'create') {

    this.userService.createUser(payload).subscribe({

      next: (res: any) => {

        const newUser = res.data;

        const formattedUser = {
          label: newUser.name,
          value: newUser.id
        };

        this.closeModal();
        this.toastr.success('User created successfully');
        this.stopLoading();

          this.redirectToUserListing();
      },

      error: (err) => {
        console.error('Create user error:', err);
        this.toastr.error(err?.error?.message || 'Failed to create user');
        this.stopLoading();
      }
    });
  }

  // ================= UPDATE =================
  else if (this.mode === 'edit' && this.editingUserId) {

    this.userService.updateUser(this.editingUserId, payload).subscribe({

      next: (res: any) => {

        const updatedUser = res.data;

        this.closeModal();
        this.toastr.success('User updated successfully');
        this.stopLoading();
        this.redirectToUserListing();
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

  // this.emailFormatError = false;
  this.passwordMismatch = false;

  let valid = true;

  // ✅ Required fields (password remove from here)
  if (!f.name || !f.email || !f.username || !f.address || !f.job_position_id || !f.location_id) {
    valid = false;
  }

  // ✅ Email validation
  // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // if (f.email && !emailRegex.test(f.email)) {
  //   this.emailFormatError = true;
  //   valid = false;
  // }

  // const usernameRegex = /^[a-zA-Z0-9._]+$/;
  // if (f.email && !usernameRegex.test(f.email)) {
  //   this.emailFormatError = true;
  //   valid = false;
  // } else {
  //   this.emailFormatError = false;
  // }
  const usernameRegex = /^[a-zA-Z0-9._]+$/;

  // explicitly block @
  if (f.email && f.email.includes('@')) {
    this.emailFormatError = true;
    valid = false;
  }
  else if (f.email && !usernameRegex.test(f.email)) {
    this.emailFormatError = true;
    valid = false;
  }
  else {
    this.emailFormatError = false;
  }

  // ================= PASSWORD LOGIC =================

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


    // ================= EDIT =================
  if (this.mode === 'edit') {

    // 🔹 If user starts typing password
    if (hasPassword || hasConfirm) {

      // ❌ confirm missing
      if (!hasConfirm) {
        this.toastr.error('Confirm password is required');
        return false;
      }

      // ❌ password missing
      if (!hasPassword) {
        this.toastr.error('Enter password');
        return false;
      }

      // ❌ mismatch
      if (f.password !== f.password_confirm) {
        this.passwordMismatch = true;
        return false;
      }
    }
  }

  return valid;
  }

  // onFieldChange() {

  //   // clear email format error when user types
  //   if (this.formData.email) {
  //     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  //     this.emailFormatError = emailRegex.test(this.formData.email) ? false : this.emailFormatError;
  //   }

  //   // password match live check
  //   if (this.formData.password && this.formData.password_confirm) {
  //     this.passwordMismatch = this.formData.password === this.formData.password_confirm ? false : true;
  //   }
  // }

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
}

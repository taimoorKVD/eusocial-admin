import { Component, ElementRef, ViewChild } from '@angular/core';
import { TenantUserService } from '../../../../services/tenant-user.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-setup-user',
  standalone: false,

  templateUrl: './setup-user.component.html',
  styleUrl: './setup-user.component.scss'
})
export class SetupUserComponent {

  constructor(private userService: TenantUserService,  private toastr: ToastrService) {}
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
  users: any[] = [];
  selectedUser: any;
  jobPositions: any[] = [];
  locations: any[] = [];
  availabilityDays = [
    'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'
  ];
  showPassword = false;
  selectedDays: string[] = [];

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
      return;
    }

    if (!userId) return;

    this.userService.getUserById(userId).subscribe((res: any) => {

      const user = res.data;

      this.formData = {
        name: user.name,
        email: user.email,
        phone_number: user.phoneNumber,
        address: user.address,
        username: user.username,
        password: '',
        job_position_id: user.jobPosition?.id || null,
        location_id: user.location?.id || null,
        availability_days: user.availabilityDays || []
      };

      // ✅ ADD THIS LINE (important)
      this.selectedDays = [...(user.availabilityDays || [])];

    });
  }

  handleCreateUser() {
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

    // focus after DOM update
    setTimeout(() => {
      this.firstInput?.nativeElement.focus();
    });
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

  confirmAction() {

    // ================= DELETE =================
    if (this.modalType === 'delete') {

      if (!this.selectedUser || this.selectedUser === 'create') return;

      this.startLoading();

      this.userService.deleteUser(this.selectedUser).subscribe({

        next: () => {

          // ✅ remove user from dropdown
          this.users = this.users.filter(u => u.value !== this.selectedUser);

          // ✅ reset form + selection
          this.handleCreateUser();

          this.closeModal();
          this.toastr.success('User deleted successfully'); // ✅ ADD HERE
          this.stopLoading();
        },

        error: (err) => {
          console.error('Delete error:', err);
          this.toastr.error(err?.error?.message || 'Failed to delete user'); // ✅ ADD HERE
          this.stopLoading();
        }
      });

      return; // 🔥 important (stop further execution)
    }


    // ================= SAVE =================
    if (this.modalType === 'save') {

      this.isSubmitted = true;

      if (!this.validateForm()) return;

      if (!this.formData.password) return;
      if (!this.formData.password_confirm) return;
      if (this.formData.password !== this.formData.password_confirm) return;

      this.startLoading();

      const payload = {
        ...this.formData,
        role_id: 1,
        job_position_id: Number(this.formData.job_position_id),
        location_id: Number(this.formData.location_id),
        password_confirm: this.formData.password_confirm
      };

      this.userService.createUser(payload).subscribe({

        next: (res: any) => {

          const newUser = res.data;

          const formattedUser = {
            label: newUser.name,
            value: newUser.id
          };

          this.users = [
            this.users[0],
            formattedUser,
            ...this.users.slice(1)
          ];

          this.selectedUser = newUser.id;

          this.formData = {
            name: newUser.name,
            email: newUser.email,
            phone_number: newUser.phoneNumber,
            address: newUser.address,
            username: newUser.username,
            password: '',
            password_confirm: '',
            job_position_id: newUser.jobPosition?.id || null,
            location_id: newUser.location?.id || null,
            availability_days: newUser.availabilityDays || []
          };

          this.closeModal();
          this.toastr.success('User created successfully'); // ✅ ADD HERE
          this.stopLoading();
        },

        error: (err) => {
          console.error('Create user error:', err);
          this.toastr.error(err?.error?.message || 'Failed to create user'); // ✅ ADD HERE
          this.stopLoading();
        }
      });
    }
  }

  validateForm(): boolean {
    const f = this.formData;

    this.emailFormatError = false;
    this.passwordMismatch = false;

    let valid = true;

    if (!f.name || !f.email || !f.username || !f.password || !f.password_confirm || !f.address || !f.job_position_id || !f.location_id) {
      valid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (f.email && !emailRegex.test(f.email)) {
      this.emailFormatError = true;
      valid = false;
    }

    if (f.password && f.password_confirm && f.password !== f.password_confirm) {
      this.passwordMismatch = true;
      valid = false;
    }

    return valid;
  }

  onFieldChange() {

    // clear email format error when user types
    if (this.formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      this.emailFormatError = emailRegex.test(this.formData.email) ? false : this.emailFormatError;
    }

    // password match live check
    if (this.formData.password && this.formData.password_confirm) {
      this.passwordMismatch = this.formData.password === this.formData.password_confirm ? false : true;
    }
  }
}

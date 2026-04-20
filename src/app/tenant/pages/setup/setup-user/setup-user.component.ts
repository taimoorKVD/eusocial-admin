import { Component } from '@angular/core';
import { TenantUserService } from '../../../../services/tenant-user.service';

@Component({
  selector: 'app-setup-user',
  standalone: false,

  templateUrl: './setup-user.component.html',
  styleUrl: './setup-user.component.scss'
})
export class SetupUserComponent {

  constructor(private userService: TenantUserService) {}

// Dropdown Data
// selectedUser = null;
isModalOpen = false;
modalType: 'delete' | 'exit' | 'save' | null = null;
modalMessage = '';

  users: any[] = [];
  selectedUser: any;

  formData: any = {
    name: '',
    email: '',
    phone_number: '',
    address: '',
    username: '',
    password: '',
    job_position_id: null,
    location_id: null,
    availability_days: []
  };

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers() {
    this.userService.getUsers().subscribe((res: any[]) => {
      this.users = res.map(user => ({
        label: user.name,
        value: user.id
      }));
    });
  }

  onUserSelect(userId: number) {
    if (!userId) return;

    this.userService.getUserById(userId).subscribe(res => {
      this.formData = {
        ...res,
        availability_days: res.availability_days || []
      };
    });
  }

// users = [
//   { label: 'John Doe', value: 1 },
//   { label: 'Ali Khan', value: 2 },
//   { label: 'Umar', value: 3 }
// ];

  jobPositions = [
    { label: 'Admin', value: 'admin' },
    { label: 'Manager', value: 'manager' },
    { label: 'Editor', value: 'editor' }
  ];


  locations = [
    { label: '160 Main', value: '160-main' },
    { label: 'New York', value: 'ny' },
    { label: 'Karachi', value: 'karachi' }
  ];

selectedJob: any = this.jobPositions[0];
selectedLocation: any = this.locations[0];

  availabilityDays = [
    'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'
  ];

  selectedDay = 'Thursday';

  selectDay(day: string) {
    this.selectedDay = day;
  }

showPassword = false;

togglePassword() {
  this.showPassword = !this.showPassword;
}

openModal(type: 'delete' | 'exit' | 'save') {
  this.modalType = type;
  this.isModalOpen = true;

  switch (type) {
    case 'delete':
      this.modalMessage = 'Do you want to delete without saving?';
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
  if (this.modalType === 'delete') {
    console.log('Deleted');
  } else if (this.modalType === 'exit') {
    console.log('Exited');
  } else if (this.modalType === 'save') {
    console.log('Saved');
  }

  this.closeModal();
}
}

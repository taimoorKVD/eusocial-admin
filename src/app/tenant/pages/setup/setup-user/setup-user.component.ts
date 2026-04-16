import { Component } from '@angular/core';

@Component({
  selector: 'app-setup-user',
  standalone: false,

  templateUrl: './setup-user.component.html',
  styleUrl: './setup-user.component.scss'
})
export class SetupUserComponent {
// Dropdown Data
selectedUser = null; // selected value
isModalOpen = false;
modalType: 'delete' | 'exit' | 'save' | null = null;
modalMessage = '';


users = [
  { label: 'John Doe', value: 1 },
  { label: 'Ali Khan', value: 2 },
  { label: 'Umar', value: 3 }
];

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

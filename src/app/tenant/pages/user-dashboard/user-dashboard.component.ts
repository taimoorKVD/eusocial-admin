import { Component } from '@angular/core';      


@Component({
  selector: 'app-user-dashboard',
  standalone: false,

  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss'
})
export class UserDashboardComponent {
// Dropdown Data
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
}

import { Component } from '@angular/core';

@Component({
  selector: 'app-forms-list',
  standalone: false,
  templateUrl: './forms-list.component.html',
  styleUrl: './forms-list.component.scss',
})
export class FormsListComponent {
  modules = [
  { name: 'Users', route: 'users' },
  { name: 'Vendors', route: 'vendors' },
  { name: 'Job Positions', route: 'job-position' }
];

}

import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-tenant-sidebar',
  standalone: false,

  templateUrl: './tenant-sidebar.component.html',
  styleUrl: './tenant-sidebar.component.scss'
})
export class TenantSidebarComponent {
  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  openSetup = false;
  openTraining = false;

  toggleSetup() {
    this.openSetup = !this.openSetup;
  }

  toggleTraining() {
    this.openTraining = !this.openTraining;
  }
}

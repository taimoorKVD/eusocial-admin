import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TenantSessionService } from '../../services/tenant-session.service';

@Component({
  selector: 'app-tenant-sidebar',
  standalone: false,

  templateUrl: './tenant-sidebar.component.html',
  styleUrl: './tenant-sidebar.component.scss'
})
export class TenantSidebarComponent {
  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  constructor(private route: ActivatedRoute, public session: TenantSessionService) {}

  openSetup = false;
  openExtraManagement = false;
  openTraining = false;
  // slug: string = '';

  // ngOnInit() {
  //   this.route.firstChild?.paramMap.subscribe(params => {
  //     this.slug = params.get('slug') || '';
  //   });
  // }

  toggleSetup() {
    this.openSetup = !this.openSetup;
  }

    toggleExtraManagement() {
    this.openExtraManagement = !this.openExtraManagement;
  }

  toggleTraining() {
    this.openTraining = !this.openTraining;
  }
}

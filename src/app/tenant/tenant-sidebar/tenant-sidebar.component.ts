import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TenantSessionService } from '../../services/tenant-session.service';
import { TenantAuthService } from '../../services/tenant-auth.service';

@Component({
  selector: 'app-tenant-sidebar',
  standalone: false,

  templateUrl: './tenant-sidebar.component.html',
  styleUrl: './tenant-sidebar.component.scss',
})
export class TenantSidebarComponent {
  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  constructor(
    private route: ActivatedRoute,
    public session: TenantSessionService,
    private tenantAuth: TenantAuthService,
  ) {}

  get isEmployee(): boolean {
    return this.session.isEmployee();
  }

  logout(): void {
    this.tenantAuth.logout();
  }

  openSetup = false;
  openExtraManagement = false;
  openFormBuilder = false;
  openTraining = false;
  // slug: string = '';

  ngOnInit() {
    this.openSetup = false;
    this.openExtraManagement = false;
    this.openFormBuilder = false;
  }

  toggleSetup() {
    this.openSetup = !this.openSetup;
  }

  toggleExtraManagement() {
    this.openExtraManagement = !this.openExtraManagement;
  }

  toggleOpenFormBuilder() {
    this.openFormBuilder = !this.openFormBuilder;
  }

  toggleTraining() {
    this.openTraining = !this.openTraining;
  }
}

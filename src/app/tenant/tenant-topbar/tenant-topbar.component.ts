import { Component, HostListener, EventEmitter, Output} from '@angular/core';
import { TenantAuthService } from '../../services/tenant-auth.service';
import { TenantSessionService } from '../../services/tenant-session.service';

@Component({
  selector: 'app-tenant-topbar',
  standalone: false,

  templateUrl: './tenant-topbar.component.html',
  styleUrl: './tenant-topbar.component.scss'
})
export class TenantTopbarComponent {
  @Output() toggleSidebar = new EventEmitter<void>();
  dropdownOpen = false;
  userName: string = '';

  constructor(private tenantAuth: TenantAuthService, private tenantSession: TenantSessionService) {}

  ngOnInit() {
  this.userName = this.tenantSession.getSlug() || '';
}

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  closeDropdown() {
    this.dropdownOpen = false;
  }

  // click outside close
  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;

    if (!target.closest('.profile-dropdown')) {
      this.closeDropdown();
    }
  }

  goToProfile() {
    console.log('Profile clicked');
  }

  logout() {
    this.tenantAuth.logout();
  }
}

import { Component, HostListener, EventEmitter, Output, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TenantAuthService } from '../../services/tenant-auth.service';
import { TenantSessionService } from '../../services/tenant-session.service';
import { TenantProfileService } from '../../services/tenant-profile.service';

@Component({
  selector: 'app-tenant-topbar',
  standalone: false,

  templateUrl: './tenant-topbar.component.html',
  styleUrl: './tenant-topbar.component.scss'
})
export class TenantTopbarComponent implements OnInit, OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();
  dropdownOpen = false;
  userName: string = '';
  avatarUrl: string | null = null;

  private readonly tenantAuth = inject(TenantAuthService);
  private readonly tenantSession = inject(TenantSessionService);
  private readonly profileService = inject(TenantProfileService);
  private readonly router = inject(Router);
  private userSub?: Subscription;

  ngOnInit() {
    this.refreshUserDisplay();
    this.userSub = this.tenantSession.user$.subscribe(() => {
      this.profileService.refresh();
      this.refreshUserDisplay();
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  closeDropdown() {
    this.dropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;

    if (!target.closest('.profile-dropdown')) {
      this.closeDropdown();
    }
  }

  goToProfile() {
    this.closeDropdown();
    const slug = this.tenantSession.getSlug();
    if (!slug) {
      return;
    }
    this.router.navigate(['/tenant', slug, 'profile']);
  }

  logout() {
    this.tenantAuth.logout();
  }

  private refreshUserDisplay(): void {
    const profile = this.profileService.getProfile();
    const slug = this.tenantSession.getSlug();

    this.userName =
      this.profileService.getDisplayName(profile) ||
      slug ||
      'Tenant User';

    this.avatarUrl = profile?.avatarUrl || null;
  }
}

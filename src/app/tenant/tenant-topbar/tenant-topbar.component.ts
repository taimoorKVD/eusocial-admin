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
  roleName: string = '';
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
    this.router.navigate(['/profile']);
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

    this.roleName = this.resolveRoleName(profile);
    this.avatarUrl = profile?.avatarUrl || null;
  }

  /** Role name from the authenticated user payload only — no hardcoded labels. */
  private resolveRoleName(profile: ReturnType<TenantProfileService['getProfile']>): string {
    const role = profile?.role;
    if (typeof role === 'string' && role.trim()) {
      return role.trim();
    }
    if (role && typeof role === 'object' && role.name) {
      return String(role.name).trim();
    }
    return '';
  }
}

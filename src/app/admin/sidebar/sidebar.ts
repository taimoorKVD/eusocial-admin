import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { Auth } from '../../services/auth';
import { User } from '../../interfaces/user';

interface SidebarLink {
  label: string;
  icon: string;
  route?: string;
  exact?: boolean;
  comingSoon?: boolean;
}

interface SidebarGroup {
  title: string;
  links: SidebarLink[];
}

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit, OnDestroy {
  user: User | null = null;
  private readonly destroy$ = new Subject<void>();

  readonly topLinks: SidebarLink[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', exact: true },
  ];

  readonly groups: SidebarGroup[] = [
    {
      title: 'Platform',
      links: [
        { label: 'Tenants', icon: 'tenants', route: '/tenants' },
        { label: 'Subscriptions', icon: 'subscriptions', route: '/subscriptions' },
        { label: 'Plan Management', icon: 'plans', route: '/plans' },
        { label: 'Billing & Invoices', icon: 'billing', route: '/invoices' },
      ],
    },
    {
      title: 'User Management',
      links: [
        { label: 'Users', icon: 'users', route: '/users' },
        { label: 'Roles & Permissions', icon: 'roles', route: '/roles' },
      ],
    },
    {
      title: 'System Settings',
      links: [
        { label: 'Global Settings', icon: 'settings', comingSoon: true },
        { label: 'Modules', icon: 'modules', comingSoon: true },
        { label: 'Feature Management', icon: 'features', comingSoon: true },
        { label: 'Email Templates', icon: 'email', comingSoon: true },
        { label: 'Audit Logs', icon: 'audit', comingSoon: true },
      ],
    },
    {
      title: 'System Monitoring',
      links: [
        { label: 'System Health', icon: 'health', comingSoon: true },
        { label: 'Activity Logs', icon: 'activity', comingSoon: true },
        { label: 'Reports', icon: 'reports', comingSoon: true },
      ],
    },
  ];

  constructor(private auth: Auth) {}

  ngOnInit(): void {
    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.user = user;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get displayName(): string {
    return this.user?.name || 'Super Admin';
  }

  get roleLabel(): string {
    return this.user?.role?.name || 'Platform Owner';
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'SA';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  isLinkEnabled(link: SidebarLink): boolean {
    return !!link.route && !link.comingSoon;
  }
}

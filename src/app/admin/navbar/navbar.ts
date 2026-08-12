import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { Auth } from '../../services/auth';
import { User } from '../../interfaces/user';

interface PageMeta {
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-navbar',
  standalone: false,
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit, OnDestroy {
  user: User | null = null;
  dropdownOpen = false;
  page: PageMeta = {
    title: 'Super Admin Dashboard',
    subtitle: 'Overview of your multi-tenant SaaS platform.',
  };

  private readonly destroy$ = new Subject<void>();

  private readonly pageMap: Record<string, PageMeta> = {
    '/dashboard': {
      title: 'Super Admin Dashboard',
      subtitle: 'Overview of your multi-tenant SaaS platform.',
    },
    '/tenants': {
      title: 'Tenants',
      subtitle: 'Manage organizations across your platform.',
    },
    '/users': {
      title: 'Users',
      subtitle: 'Manage super admin users and access.',
    },
    '/roles': {
      title: 'Roles & Permissions',
      subtitle: 'Configure platform roles and permissions.',
    },
    '/profile': {
      title: 'My Profile',
      subtitle: 'Update your account details and password.',
    },
    '/permissions': {
      title: 'Permissions',
      subtitle: 'Manage fine-grained access controls.',
    },
    '/products': {
      title: 'Products',
      subtitle: 'Manage product catalog entries.',
    },
  };

  constructor(private auth: Auth, private router: Router) {}

  ngOnInit(): void {
    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.user = user;
    });

    this.updatePage(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((e) => this.updatePage(e.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get displayName(): string {
    return this.user?.name || 'Super Admin';
  }

  get displayEmail(): string {
    return this.user?.email || '';
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'SA';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  logout(): void {
    this.closeDropdown();
    this.auth.logout();
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  closeDropdown(): void {
    this.dropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-dropdown')) {
      this.closeDropdown();
    }
  }

  private updatePage(url: string): void {
    const path = url.split('?')[0];
    const match = Object.keys(this.pageMap)
      .sort((a, b) => b.length - a.length)
      .find((key) => path === key || path.startsWith(`${key}/`));

    this.page = match
      ? this.pageMap[match]
      : {
          title: 'Super Admin',
          subtitle: 'Platform administration console.',
        };
  }
}

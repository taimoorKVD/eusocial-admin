import { Injectable } from '@angular/core';

export type PortalType = 'admin' | 'tenant';

@Injectable({
  providedIn: 'root',
})
export class PortalService {
  private readonly baseDomain = 'eusocial.thebetawebsite.com';

  get hostname(): string {
    return window.location.hostname.toLowerCase();
  }

  get portalType(): PortalType {
    const host = this.hostname;

    if (host === `admin.${this.baseDomain}`) {
      return 'admin';
    }

    return 'tenant';
  }

  get tenantSlug(): string | null {
    const host = this.hostname;
    const suffix = `.${this.baseDomain}`;

    if (!host.endsWith(suffix)) {
      return null;
    }

    const subdomain = host.slice(0, -suffix.length);

    if (!subdomain || subdomain === 'admin') {
      return null;
    }

    return subdomain;
  }

  isAdmin(): boolean {
    return this.portalType === 'admin';
  }

  isTenant(): boolean {
    return this.portalType === 'tenant';
  }
}

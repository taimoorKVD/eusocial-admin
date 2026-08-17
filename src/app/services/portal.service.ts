import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type PortalType = 'admin' | 'tenant';

export interface PortalIdentity {
  type: PortalType;
  tenantSlug: string | null;
}

const RESERVED_SUBDOMAINS = new Set(['admin', 'www', 'api', 'app', 'mail']);

/**
 * Resolves admin vs tenant from the hostname so the same app can run:
 *
 * Server
 *   admin.eusocial.thebetawebsite.com          → admin
 *   folio3.eusocial.thebetawebsite.com         → tenant "folio3"
 *   logitech.eusocial.thebetawebsite.com       → tenant "logitech"
 *
 * Local (`ng serve`)
 *   localhost / 127.0.0.1 / admin.localhost    → admin
 *   folio3.localhost                           → tenant "folio3"
 */
export function resolvePortalIdentity(
  hostname: string,
  baseDomain = environment.baseDomain,
): PortalIdentity {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');

  if (
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]'
  ) {
    return { type: 'admin', tenantSlug: null };
  }

  const suffixes = [`.${baseDomain}`, '.localhost'];

  for (const suffix of suffixes) {
    const apex = suffix.slice(1);
    if (host === apex) {
      return { type: 'admin', tenantSlug: null };
    }

    if (!host.endsWith(suffix)) {
      continue;
    }

    const subdomain = host.slice(0, -suffix.length);
    const slug = subdomain.split('.').filter(Boolean)[0] || '';

    if (!slug || RESERVED_SUBDOMAINS.has(slug)) {
      return { type: 'admin', tenantSlug: null };
    }

    return { type: 'tenant', tenantSlug: slug };
  }

  return { type: 'admin', tenantSlug: null };
}

export function resolveDocumentTitle(identity: PortalIdentity): string {
  if (identity.type === 'tenant' && identity.tenantSlug) {
    return `${identity.tenantSlug} | Eusocial`;
  }

  return 'Admin | Eusocial';
}

@Injectable({
  providedIn: 'root',
})
export class PortalService {
  get hostname(): string {
    return window.location.hostname.toLowerCase();
  }

  get identity(): PortalIdentity {
    return resolvePortalIdentity(this.hostname);
  }

  get portalType(): PortalType {
    return this.identity.type;
  }

  get tenantSlug(): string | null {
    return this.identity.tenantSlug;
  }

  get documentTitle(): string {
    return resolveDocumentTitle(this.identity);
  }

  applyDocumentTitle(): void {
    document.title = this.documentTitle;
  }

  isAdmin(): boolean {
    return this.portalType === 'admin';
  }

  isTenant(): boolean {
    return this.portalType === 'tenant';
  }
}

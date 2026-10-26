import { Injectable, signal } from '@angular/core';

/**
 * Lets setup Form Builder hosts request the compact (collapsed) sidebar rail
 * while the inline builder is open — same chrome outcome as Form Template
 * create/edit routes, without relying on a route change.
 */
@Injectable({ providedIn: 'root' })
export class TenantLayoutChromeService {
  /** True while a setup module Form Builder is open. */
  readonly formBuilderActive = signal(false);

  setFormBuilderActive(active: boolean): void {
    this.formBuilderActive.set(active);
  }
}

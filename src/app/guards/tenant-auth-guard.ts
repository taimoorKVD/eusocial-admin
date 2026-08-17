import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const tenantAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  // 🔐 token check
  const token = localStorage.getItem('tenant_token');

  // 🏢 tenant slug from URL
  const slug = route.paramMap.get('slug');

  // 💾 stored slug (login ke baad save hona chahiye)
  const savedSlug = localStorage.getItem('tenant_slug');

  // ❌ case 1: user login nahi hai
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  // ❌ case 2: slug mismatch (multi-tenant security)
  if (slug && savedSlug && slug !== savedSlug) {
    router.navigate(['/login']);
    return false;
  }

  // ✅ allow access
  return true;
};

import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
} from '@angular/core';
import { TenantPermissionService } from '../../services/tenant-permission.service';

/**
 * Structural directive that shows content only when the user has the permission.
 *
 * @example
 * <button *appHasPermission="'edit-item'">Edit</button>
 * <button *appHasPermission="['edit-item', 'delete-item']; mode: 'any'">...</button>
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly permissionService = inject(TenantPermissionService);

  private required: string | string[] = [];
  private mode: 'all' | 'any' = 'all';
  private hasView = false;

  constructor() {
    effect(() => {
      // Re-evaluate when permission list changes.
      this.permissionService.permissionList();
      this.updateView();
    });
  }

  @Input()
  set appHasPermission(value: string | string[] | null | undefined) {
    this.required = value ?? [];
    this.updateView();
  }

  @Input()
  set appHasPermissionMode(value: 'all' | 'any' | null | undefined) {
    this.mode = value === 'any' ? 'any' : 'all';
    this.updateView();
  }

  private updateView(): void {
    const names = Array.isArray(this.required)
      ? this.required
      : this.required
        ? [this.required]
        : [];

    const allowed =
      names.length === 0
        ? false
        : this.mode === 'any'
          ? this.permissionService.hasAnyPermission(...names)
          : this.permissionService.hasAllPermissions(...names);

    if (allowed && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}

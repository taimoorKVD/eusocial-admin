import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TenantSessionService } from '../../services/tenant-session.service';
import { TenantAuthService } from '../../services/tenant-auth.service';
import { TenantPermissionService } from '../../services/tenant-permission.service';
import { PERMISSIONS, PERMISSION_MODULES } from '../../constants/permissions';

@Component({
  selector: 'app-tenant-sidebar',
  standalone: false,

  templateUrl: './tenant-sidebar.component.html',
  styleUrl: './tenant-sidebar.component.scss',
})
export class TenantSidebarComponent {
  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  readonly permissions = inject(TenantPermissionService);
  readonly PERMISSIONS = PERMISSIONS;
  readonly MODULES = PERMISSION_MODULES;

  constructor(
    private route: ActivatedRoute,
    public session: TenantSessionService,
    private tenantAuth: TenantAuthService,
  ) {}

  get isEmployee(): boolean {
    return this.session.isEmployee();
  }

  logout(): void {
    this.tenantAuth.logout();
  }

  openSetup = false;
  openExtraManagement = false;
  openFormBuilder = false;
  openTraining = false;

  ngOnInit() {
    this.openSetup = false;
    this.openExtraManagement = false;
    this.openFormBuilder = false;
  }

  toggleSetup() {
    this.openSetup = !this.openSetup;
  }

  toggleExtraManagement() {
    this.openExtraManagement = !this.openExtraManagement;
  }

  toggleOpenFormBuilder() {
    this.openFormBuilder = !this.openFormBuilder;
  }

  toggleTraining() {
    this.openTraining = !this.openTraining;
  }

  canSeeUsers(): boolean {
    return this.permissions.hasModuleAccess(PERMISSION_MODULES.USERS)
      || this.permissions.hasPermissionName(PERMISSIONS.USERS.VIEW);
  }

  canSeeJobPositions(): boolean {
    return this.permissions.hasModuleAccess(PERMISSION_MODULES.JOB_POSITIONS)
      || this.permissions.hasAnyPermission(
        PERMISSIONS.JOB_POSITIONS.VIEW,
        PERMISSIONS.JOB_POSITIONS.CREATE,
        PERMISSIONS.JOB_POSITIONS.EDIT,
        PERMISSIONS.JOB_POSITIONS.DELETE,
      );
  }

  canSeeItems(): boolean {
    return this.permissions.hasModuleAccess(PERMISSION_MODULES.ITEMS)
      || this.permissions.hasPermissionName(PERMISSIONS.ITEMS.VIEW);
  }

  canSeeVendors(): boolean {
    return this.permissions.hasModuleAccess(PERMISSION_MODULES.VENDORS)
      || this.permissions.hasPermissionName(PERMISSIONS.VENDORS.VIEW);
  }

  canSeeReportingGroups(): boolean {
    return this.permissions.hasModuleAccess(PERMISSION_MODULES.REPORTING_GROUPS)
      || this.permissions.hasAnyPermission(
        PERMISSIONS.REPORTING_GROUPS.VIEW,
        PERMISSIONS.REPORTING_GROUPS.CREATE,
        PERMISSIONS.REPORTING_GROUPS.EDIT,
        PERMISSIONS.REPORTING_GROUPS.DELETE,
      );
  }

  canSeeLocations(): boolean {
    return this.permissions.hasModuleAccess(PERMISSION_MODULES.LOCATIONS)
      || this.permissions.hasPermissionName(PERMISSIONS.LOCATIONS.VIEW);
  }

  /**
   * Form Templates (/dynamic-forms) — gated by view-dc-template (or module access).
   * Form-builder (/forms) remains an admin-experience feature.
   */
  canSeeFormTemplates(): boolean {
    return this.permissions.hasModuleAccess(PERMISSION_MODULES.DATA_COLLECTION)
      || this.permissions.hasPermissionName(PERMISSIONS.DATA_COLLECTION.VIEW_TEMPLATE);
  }

  canSeeMyForms(): boolean {
    return this.permissions.hasPermissionName(PERMISSIONS.DATA_COLLECTION.VIEW_ASSIGNMENT)
      || this.permissions.hasPermissionName(PERMISSIONS.DATA_COLLECTION.COMPLETE_ASSIGNMENT)
      || this.permissions.hasPermissionName(PERMISSIONS.FORM_BUILDER.VIEW)
      || this.permissions.hasPermissionName(PERMISSIONS.FORM_BUILDER.SUBMIT);
  }

  canSeeHistory(): boolean {
    return this.permissions.hasPermissionName(PERMISSIONS.DATA_COLLECTION.VIEW_SUBMISSION)
      || this.permissions.hasPermissionName(PERMISSIONS.DATA_COLLECTION.REVIEW_SUBMISSION);
  }

  /** Admin-only setup entries (still gated by permissions for tenant_admin). */
  canSeeAdminOnlySetup(): boolean {
    return !this.isEmployee && (this.canSeeJobPositions() || this.canSeeReportingGroups());
  }

  get showSetupMenu(): boolean {
    return (
      this.canSeeUsers()
      || this.canSeeItems()
      || this.canSeeVendors()
      || this.canSeeAdminOnlySetup()
    );
  }

  get showExtraManagement(): boolean {
    return this.canSeeLocations();
  }
}

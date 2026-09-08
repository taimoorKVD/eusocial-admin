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
      || this.permissions.hasAnyPermission(
        PERMISSIONS.USERS.VIEW,
        PERMISSIONS.USERS.CREATE,
        PERMISSIONS.USERS.EDIT,
        PERMISSIONS.USERS.DELETE,
      );
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
      || this.permissions.hasAnyPermission(
        PERMISSIONS.ITEMS.VIEW,
        PERMISSIONS.ITEMS.CREATE,
        PERMISSIONS.ITEMS.EDIT,
        PERMISSIONS.ITEMS.DELETE,
      );
  }

  canSeeVendors(): boolean {
    return this.permissions.hasModuleAccess(PERMISSION_MODULES.VENDORS)
      || this.permissions.hasAnyPermission(
        PERMISSIONS.VENDORS.VIEW,
        PERMISSIONS.VENDORS.CREATE,
        PERMISSIONS.VENDORS.EDIT,
        PERMISSIONS.VENDORS.DELETE,
      );
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
      || this.permissions.hasAnyPermission(
        PERMISSIONS.LOCATIONS.VIEW,
        PERMISSIONS.LOCATIONS.CREATE,
        PERMISSIONS.LOCATIONS.EDIT,
        PERMISSIONS.LOCATIONS.DELETE,
      );
  }

  /** Data-collection template management (sidebar "Forms"). */
  canSeeTemplates(): boolean {
    return this.permissions.hasModuleAccess(PERMISSION_MODULES.DATA_COLLECTION)
      || this.permissions.hasModuleAccess(PERMISSION_MODULES.FORM_BUILDER)
      || this.permissions.hasModuleAccess('form')
      || this.permissions.hasAnyPermission(
        PERMISSIONS.DATA_COLLECTION.VIEW_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.CREATE_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.EDIT_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.DELETE_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.ACTIVATE_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.ARCHIVE_TEMPLATE,
        PERMISSIONS.FORM_BUILDER.VIEW,
        PERMISSIONS.FORM_BUILDER.CREATE,
        PERMISSIONS.FORM_BUILDER.EDIT,
        PERMISSIONS.FORM_BUILDER.DELETE,
      );
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

  get showSetupMenu(): boolean {
    return (
      this.canSeeUsers()
      || this.canSeeJobPositions()
      || this.canSeeItems()
      || this.canSeeVendors()
      || this.canSeeReportingGroups()
    );
  }

  get showExtraManagement(): boolean {
    return this.canSeeLocations();
  }
}

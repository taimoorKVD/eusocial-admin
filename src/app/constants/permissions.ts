/**
 * Centralized tenant permission names.
 * Values must match backend permission `name` strings on user.role.permissions.
 */
export const PERMISSIONS = {
  USERS: {
    CREATE: 'create-user',
    VIEW: 'view-user',
    EDIT: 'edit-user',
    DELETE: 'delete-user',
  },

  ITEMS: {
    CREATE: 'create-item',
    VIEW: 'view-item',
    EDIT: 'edit-item',
    DELETE: 'delete-item',
  },

  VENDORS: {
    CREATE: 'create-vendor',
    VIEW: 'view-vendor',
    EDIT: 'edit-vendor',
    DELETE: 'delete-vendor',
  },

  LOCATIONS: {
    CREATE: 'create-location',
    VIEW: 'view-location',
    EDIT: 'edit-location',
    DELETE: 'delete-location',
  },

  JOB_POSITIONS: {
    CREATE: 'create-job-position',
    VIEW: 'view-job-position',
    EDIT: 'edit-job-position',
    DELETE: 'delete-job-position',
  },

  REPORTING_GROUPS: {
    CREATE: 'create-reporting-group',
    VIEW: 'view-reporting-group',
    EDIT: 'edit-reporting-group',
    DELETE: 'delete-reporting-group',
  },

  ROLES: {
    CREATE: 'create-role',
    VIEW: 'view-role',
    EDIT: 'edit-role',
    DELETE: 'delete-role',
  },

  FORM_BUILDER: {
    CREATE: 'create-form',
    VIEW: 'view-form',
    EDIT: 'edit-form',
    DELETE: 'delete-form',
    PUBLISH: 'publish-form',
    SUBMIT: 'submit-form',
  },

  DATA_COLLECTION: {
    CREATE_TEMPLATE: 'create-dc-template',
    VIEW_TEMPLATE: 'view-dc-template',
    EDIT_TEMPLATE: 'edit-dc-template',
    DELETE_TEMPLATE: 'delete-dc-template',
    /** Permission id 37 — API action "Restore" (legacy label "Activate"). */
    ACTIVATE_TEMPLATE: 'activate-dc-template',
    /** Alias for id 37 when the API sends action name "Restore". */
    RESTORE_TEMPLATE: 'restore-dc-template',
    ARCHIVE_TEMPLATE: 'archive-dc-template',

    VIEW_ASSIGNMENT: 'view-dc-assignment',
    COMPLETE_ASSIGNMENT: 'complete-dc-assignment',
    VIEW_SUBMISSION: 'view-dc-submission',
    REVIEW_SUBMISSION: 'review-dc-submission',
  },
} as const;

/** Backend `module` values on permission records. */
export const PERMISSION_MODULES = {
  USERS: 'users',
  ITEMS: 'items',
  VENDORS: 'vendors',
  LOCATIONS: 'locations',
  JOB_POSITIONS: 'job-positions',
  REPORTING_GROUPS: 'reporting-groups',
  ROLES: 'roles',
  FORM_BUILDER: 'form-builder',
  DATA_COLLECTION: 'data-collection',
} as const;

export type PermissionName =
  | (typeof PERMISSIONS.USERS)[keyof typeof PERMISSIONS.USERS]
  | (typeof PERMISSIONS.ITEMS)[keyof typeof PERMISSIONS.ITEMS]
  | (typeof PERMISSIONS.VENDORS)[keyof typeof PERMISSIONS.VENDORS]
  | (typeof PERMISSIONS.LOCATIONS)[keyof typeof PERMISSIONS.LOCATIONS]
  | (typeof PERMISSIONS.JOB_POSITIONS)[keyof typeof PERMISSIONS.JOB_POSITIONS]
  | (typeof PERMISSIONS.REPORTING_GROUPS)[keyof typeof PERMISSIONS.REPORTING_GROUPS]
  | (typeof PERMISSIONS.ROLES)[keyof typeof PERMISSIONS.ROLES]
  | (typeof PERMISSIONS.FORM_BUILDER)[keyof typeof PERMISSIONS.FORM_BUILDER]
  | (typeof PERMISSIONS.DATA_COLLECTION)[keyof typeof PERMISSIONS.DATA_COLLECTION]
  | string;

import { PERMISSION_MODULES, PERMISSIONS } from '../../constants/permissions';
import { Permission } from '../../interfaces/permission';

/** Canonical module keys used by sidebar/guards. */
export type CanonicalModule =
  | typeof PERMISSION_MODULES[keyof typeof PERMISSION_MODULES]
  | 'form'
  | 'form-template'
  | 'task';

/** Form Template module (Extra Management) — formerly API name "Template". */
export const FORM_TEMPLATE_MODULE = 'form-template';

/** Task module (Employee My Forms) — formerly API name "Form". */
export const TASK_MODULE = 'task';

/**
 * Flatten login / role permission payloads into a uniform list.
 *
 * Supports:
 * 1) Nested (current API): [{ module: { name }, permissions: [{ id, name }] }]
 * 2) Flat: [{ id, name, module? }]
 * 3) Action-only names under a module (Create/View) and slug names (create-user)
 */
export function flattenRolePermissions(raw: unknown): Permission[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const first = raw[0];
  const isGrouped =
    first &&
    typeof first === 'object' &&
    (first as { module?: unknown }).module != null &&
    Array.isArray((first as { permissions?: unknown }).permissions);

  if (isGrouped) {
    const flat: Permission[] = [];
    for (const group of raw) {
      if (!group || typeof group !== 'object') {
        continue;
      }
      const g = group as { module?: unknown; permissions?: unknown };
      const moduleLabel = readModuleLabel(g.module);
      const nested = Array.isArray(g.permissions) ? g.permissions : [];
      for (const perm of nested) {
        flat.push(...expandPermissionEntry(perm, moduleLabel));
      }
    }
    return dedupePermissions(flat);
  }

  const flat: Permission[] = [];
  for (const item of raw) {
    flat.push(...expandPermissionEntry(item, ''));
  }
  return dedupePermissions(flat);
}

export function canonicalizeModuleKey(raw: string): string {
  const key = normalizeToken(raw);
  if (!key) {
    return '';
  }

  const aliases: Record<string, string> = {
    user: PERMISSION_MODULES.USERS,
    users: PERMISSION_MODULES.USERS,
    item: PERMISSION_MODULES.ITEMS,
    items: PERMISSION_MODULES.ITEMS,
    vendor: PERMISSION_MODULES.VENDORS,
    vendors: PERMISSION_MODULES.VENDORS,
    location: PERMISSION_MODULES.LOCATIONS,
    locations: PERMISSION_MODULES.LOCATIONS,
    'job position': PERMISSION_MODULES.JOB_POSITIONS,
    'job positions': PERMISSION_MODULES.JOB_POSITIONS,
    'job-position': PERMISSION_MODULES.JOB_POSITIONS,
    'job-positions': PERMISSION_MODULES.JOB_POSITIONS,
    jobposition: PERMISSION_MODULES.JOB_POSITIONS,
    jobpositions: PERMISSION_MODULES.JOB_POSITIONS,
    'reporting group': PERMISSION_MODULES.REPORTING_GROUPS,
    'reporting groups': PERMISSION_MODULES.REPORTING_GROUPS,
    'reporting-group': PERMISSION_MODULES.REPORTING_GROUPS,
    'reporting-groups': PERMISSION_MODULES.REPORTING_GROUPS,
    role: PERMISSION_MODULES.ROLES,
    roles: PERMISSION_MODULES.ROLES,
    form: 'form',
    forms: 'form',
    'form builder': PERMISSION_MODULES.FORM_BUILDER,
    'form-builder': PERMISSION_MODULES.FORM_BUILDER,
    // New API: "Form Template" (Extra Management templates). Old: "Template".
    'form template': FORM_TEMPLATE_MODULE,
    'form-template': FORM_TEMPLATE_MODULE,
    formtemplate: FORM_TEMPLATE_MODULE,
    template: FORM_TEMPLATE_MODULE,
    templates: FORM_TEMPLATE_MODULE,
    // New API: "Task" (Employee My Forms / assignments). Old: "Form" stays as ambiguous 'form'.
    task: TASK_MODULE,
    tasks: TASK_MODULE,
    'data collection': PERMISSION_MODULES.DATA_COLLECTION,
    'data-collection': PERMISSION_MODULES.DATA_COLLECTION,
    assignment: PERMISSION_MODULES.DATA_COLLECTION,
    assignments: PERMISSION_MODULES.DATA_COLLECTION,
    submission: PERMISSION_MODULES.DATA_COLLECTION,
    submissions: PERMISSION_MODULES.DATA_COLLECTION,
  };

  return aliases[key] || key;
}

/** Expand a single permission record into one or more canonical Permission rows. */
function expandPermissionEntry(raw: unknown, moduleLabel: string): Permission[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const entry = raw as Record<string, unknown>;
  const id = Number(entry['id']);
  const safeId = Number.isFinite(id) ? id : 0;
  const rawName = normalizeToken(entry['name'] ?? entry['permission'] ?? entry['key']);
  if (!rawName) {
    return [];
  }

  const moduleFromEntry = readModuleLabel(entry['module']);
  const moduleKey = canonicalizeModuleKey(moduleFromEntry || moduleLabel);

  // Already a slug permission name (create-user, view-dc-template, …)
  if (rawName.includes('-')) {
    const derivedModule =
      moduleKey ||
      canonicalizeModuleKey(inferModuleFromPermissionName(rawName));
    return [
      {
        id: safeId,
        name: rawName,
        ...(derivedModule ? { module: derivedModule } : {}),
      },
    ];
  }

  // Action verb under a module: Create / View / Edit / Delete / Submit / Review …
  const action = normalizeAction(rawName);
  if (!action || !moduleKey) {
    return [
      {
        id: safeId,
        name: rawName,
        ...(moduleKey ? { module: moduleKey } : {}),
      },
    ];
  }

  return actionToPermissionNames(moduleKey, action).map((name, index) => ({
    id: safeId || index,
    name,
    module: moduleForExpandedName(name, moduleKey),
  }));
}

function actionToPermissionNames(moduleKey: string, action: string): string[] {
  switch (moduleKey) {
    case PERMISSION_MODULES.USERS:
      return [`${action}-user`];
    case PERMISSION_MODULES.ITEMS:
      return [`${action}-item`];
    case PERMISSION_MODULES.VENDORS:
      return [`${action}-vendor`];
    case PERMISSION_MODULES.LOCATIONS:
      return [`${action}-location`];
    case PERMISSION_MODULES.JOB_POSITIONS:
      return [`${action}-job-position`];
    case PERMISSION_MODULES.REPORTING_GROUPS:
      return [`${action}-reporting-group`];
    case PERMISSION_MODULES.ROLES:
      return [`${action}-role`];
    case PERMISSION_MODULES.FORM_BUILDER:
      return [`${action}-form`];
    case PERMISSION_MODULES.DATA_COLLECTION:
      return dataCollectionNamesForAction(action);
    case FORM_TEMPLATE_MODULE:
      return formTemplateNamesForAction(action);
    case TASK_MODULE:
      return taskNamesForAction(action);
    case 'form':
      // Legacy ambiguous "Form" module — cover builder + DC template + assignment flows.
      return formModuleNamesForAction(action);
    default:
      return [`${action}-${moduleKey.replace(/s$/, '')}`];
  }
}

/** Extra Management → Form Template permissions (IDs 33–40). */
function formTemplateNamesForAction(action: string): string[] {
  switch (action) {
    case 'create':
      return [PERMISSIONS.DATA_COLLECTION.CREATE_TEMPLATE];
    case 'view':
      return [PERMISSIONS.DATA_COLLECTION.VIEW_TEMPLATE];
    case 'edit':
      return [PERMISSIONS.DATA_COLLECTION.EDIT_TEMPLATE];
    case 'delete':
      return [PERMISSIONS.DATA_COLLECTION.DELETE_TEMPLATE];
    case 'activate':
    case 'restore':
      return [
        PERMISSIONS.DATA_COLLECTION.ACTIVATE_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.RESTORE_TEMPLATE,
      ];
    case 'archive':
      return [PERMISSIONS.DATA_COLLECTION.ARCHIVE_TEMPLATE];
    default:
      return [`${action}-dc-template`];
  }
}

/** Employee Portal → Task / My Forms permissions (IDs 41, 43, 45). */
function taskNamesForAction(action: string): string[] {
  switch (action) {
    case 'view':
      return [PERMISSIONS.DATA_COLLECTION.VIEW_ASSIGNMENT];
    case 'submit':
    case 'complete':
      return [PERMISSIONS.DATA_COLLECTION.COMPLETE_ASSIGNMENT];
    case 'review':
      return [PERMISSIONS.DATA_COLLECTION.REVIEW_SUBMISSION];
    default:
      return [`${action}-dc-assignment`];
  }
}

function formModuleNamesForAction(action: string): string[] {
  switch (action) {
    case 'create':
      return [PERMISSIONS.FORM_BUILDER.CREATE, PERMISSIONS.DATA_COLLECTION.CREATE_TEMPLATE];
    case 'edit':
      return [PERMISSIONS.FORM_BUILDER.EDIT, PERMISSIONS.DATA_COLLECTION.EDIT_TEMPLATE];
    case 'delete':
      return [PERMISSIONS.FORM_BUILDER.DELETE, PERMISSIONS.DATA_COLLECTION.DELETE_TEMPLATE];
    case 'publish':
      return [PERMISSIONS.FORM_BUILDER.PUBLISH];
    case 'activate':
    case 'restore':
      return [
        PERMISSIONS.DATA_COLLECTION.ACTIVATE_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.RESTORE_TEMPLATE,
      ];
    case 'archive':
      return [PERMISSIONS.DATA_COLLECTION.ARCHIVE_TEMPLATE];
    case 'submit':
    case 'complete':
      return [PERMISSIONS.FORM_BUILDER.SUBMIT, PERMISSIONS.DATA_COLLECTION.COMPLETE_ASSIGNMENT];
    case 'review':
      return [PERMISSIONS.DATA_COLLECTION.REVIEW_SUBMISSION];
    case 'view':
      return [
        PERMISSIONS.FORM_BUILDER.VIEW,
        PERMISSIONS.DATA_COLLECTION.VIEW_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.VIEW_ASSIGNMENT,
        PERMISSIONS.DATA_COLLECTION.VIEW_SUBMISSION,
      ];
    default:
      return [`${action}-form`];
  }
}

function dataCollectionNamesForAction(action: string): string[] {
  switch (action) {
    case 'create':
      return [PERMISSIONS.DATA_COLLECTION.CREATE_TEMPLATE];
    case 'edit':
      return [PERMISSIONS.DATA_COLLECTION.EDIT_TEMPLATE];
    case 'delete':
      return [PERMISSIONS.DATA_COLLECTION.DELETE_TEMPLATE];
    case 'activate':
    case 'restore':
      return [
        PERMISSIONS.DATA_COLLECTION.ACTIVATE_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.RESTORE_TEMPLATE,
      ];
    case 'archive':
      return [PERMISSIONS.DATA_COLLECTION.ARCHIVE_TEMPLATE];
    case 'submit':
    case 'complete':
      return [PERMISSIONS.DATA_COLLECTION.COMPLETE_ASSIGNMENT];
    case 'review':
      return [PERMISSIONS.DATA_COLLECTION.REVIEW_SUBMISSION];
    case 'view':
      return [
        PERMISSIONS.DATA_COLLECTION.VIEW_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.VIEW_ASSIGNMENT,
        PERMISSIONS.DATA_COLLECTION.VIEW_SUBMISSION,
      ];
    default:
      return [`${action}-dc-template`];
  }
}

function moduleForExpandedName(name: string, fallback: string): string {
  if (name.includes('-dc-') || name.endsWith('-dc-template') || name.includes('dc-')) {
    return PERMISSION_MODULES.DATA_COLLECTION;
  }
  if (name.endsWith('-form') || name.includes('-form')) {
    return PERMISSION_MODULES.FORM_BUILDER;
  }
  if (fallback === FORM_TEMPLATE_MODULE || fallback === TASK_MODULE) {
    return PERMISSION_MODULES.DATA_COLLECTION;
  }
  return fallback === 'form' ? PERMISSION_MODULES.FORM_BUILDER : fallback;
}

function inferModuleFromPermissionName(name: string): string {
  if (name.includes('dc-') || name.includes('data-collection')) {
    return PERMISSION_MODULES.DATA_COLLECTION;
  }
  if (name.endsWith('-user') || name.includes('-user')) {
    return PERMISSION_MODULES.USERS;
  }
  if (name.endsWith('-item')) {
    return PERMISSION_MODULES.ITEMS;
  }
  if (name.endsWith('-vendor')) {
    return PERMISSION_MODULES.VENDORS;
  }
  if (name.endsWith('-location')) {
    return PERMISSION_MODULES.LOCATIONS;
  }
  if (name.includes('job-position')) {
    return PERMISSION_MODULES.JOB_POSITIONS;
  }
  if (name.includes('reporting-group')) {
    return PERMISSION_MODULES.REPORTING_GROUPS;
  }
  if (name.endsWith('-role')) {
    return PERMISSION_MODULES.ROLES;
  }
  if (name.endsWith('-form') || name.includes('-form')) {
    return PERMISSION_MODULES.FORM_BUILDER;
  }
  return '';
}

function readModuleLabel(module: unknown): string {
  if (typeof module === 'string') {
    return module;
  }
  if (module && typeof module === 'object') {
    const m = module as Record<string, unknown>;
    return String(m['name'] ?? m['key'] ?? m['slug'] ?? m['label'] ?? '');
  }
  return '';
}

function normalizeAction(raw: string): string {
  const action = normalizeToken(raw);
  const aliases: Record<string, string> = {
    create: 'create',
    add: 'create',
    view: 'view',
    read: 'view',
    list: 'view',
    edit: 'edit',
    update: 'edit',
    delete: 'delete',
    remove: 'delete',
    publish: 'publish',
    submit: 'submit',
    complete: 'complete',
    review: 'review',
    activate: 'activate',
    restore: 'restore',
    archive: 'archive',
  };
  return aliases[action] || action;
}

function normalizeToken(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^-+|-+$/g, '');
}

function dedupePermissions(list: Permission[]): Permission[] {
  const seen = new Set<string>();
  const result: Permission[] = [];
  for (const permission of list) {
    const key = `${permission.module || ''}::${permission.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(permission);
  }
  return result;
}

/** Normalize plan/module availability lists from login (`allowedModules` / `modules`). */
export function normalizeAllowedModules(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const key = canonicalizeModuleKey(item);
      if (key) {
        result.push(key);
      }
      continue;
    }
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>;
      const enabled = row['enabled'];
      if (enabled === false) {
        continue;
      }
      const key = canonicalizeModuleKey(
        String(row['key'] ?? row['name'] ?? row['slug'] ?? row['module'] ?? ''),
      );
      if (key) {
        result.push(key);
      }
    }
  }

  return Array.from(new Set(result));
}

/** Map a UI/feature module to the keys that count as "allowed" for plan checks. */
export function moduleAllowanceKeys(module: string): string[] {
  const key = canonicalizeModuleKey(module);
  switch (key) {
    case PERMISSION_MODULES.FORM_BUILDER:
    case PERMISSION_MODULES.DATA_COLLECTION:
    case FORM_TEMPLATE_MODULE:
    case TASK_MODULE:
    case 'form':
      return [
        PERMISSION_MODULES.FORM_BUILDER,
        PERMISSION_MODULES.DATA_COLLECTION,
        FORM_TEMPLATE_MODULE,
        TASK_MODULE,
        'form',
        'forms',
        'template',
        'templates',
      ];
    default:
      return key ? [key] : [];
  }
}

import {
  canonicalizeModuleKey,
  flattenRolePermissions,
  normalizeAllowedModules,
} from './permission-normalizer';

describe('permission-normalizer', () => {
  it('flattens nested role.permissions module groups', () => {
    const flat = flattenRolePermissions([
      {
        module: { name: 'User' },
        permissions: [
          { id: 1, name: 'Create' },
          { id: 2, name: 'View' },
          { id: 3, name: 'Edit' },
          { id: 4, name: 'Delete' },
        ],
      },
      {
        module: { name: 'Item' },
        permissions: [
          { id: 5, name: 'View' },
          { id: 6, name: 'Create' },
        ],
      },
      {
        module: { name: 'Form Template' },
        permissions: [
          { id: 33, name: 'Create' },
          { id: 34, name: 'View' },
          { id: 35, name: 'Edit' },
          { id: 37, name: 'Activate' },
          { id: 38, name: 'Archive' },
          { id: 40, name: 'Delete' },
        ],
      },
      {
        module: { name: 'Task' },
        permissions: [
          { id: 45, name: 'View' },
          { id: 41, name: 'Submit' },
          { id: 43, name: 'Review' },
        ],
      },
    ]);

    const names = flat.map((p) => p.name);
    expect(names).toContain('create-user');
    expect(names).toContain('view-user');
    expect(names).toContain('edit-user');
    expect(names).toContain('delete-user');
    expect(names).toContain('view-item');
    expect(names).toContain('create-item');
    expect(names).toContain('create-dc-template');
    expect(names).toContain('view-dc-template');
    expect(names).toContain('edit-dc-template');
    expect(names).toContain('activate-dc-template');
    expect(names).toContain('archive-dc-template');
    expect(names).toContain('delete-dc-template');
    expect(names).toContain('view-dc-assignment');
    expect(names).toContain('complete-dc-assignment');
    expect(names).toContain('review-dc-submission');
    expect(names).not.toContain('view-form');
  });

  it('maps legacy Template / Form module names for backward compatibility', () => {
    const flat = flattenRolePermissions([
      {
        module: { name: 'Template' },
        permissions: [{ id: 34, name: 'View' }],
      },
      {
        module: { name: 'Form' },
        permissions: [
          { id: 7, name: 'View' },
          { id: 8, name: 'Submit' },
          { id: 9, name: 'Review' },
        ],
      },
    ]);

    const names = flat.map((p) => p.name);
    expect(names).toContain('view-dc-template');
    expect(names).toContain('view-form');
    expect(names).toContain('view-dc-assignment');
    expect(names).toContain('submit-form');
    expect(names).toContain('complete-dc-assignment');
    expect(names).toContain('review-dc-submission');
  });

  it('keeps flat slug permissions', () => {
    const flat = flattenRolePermissions([
      { id: 1, name: 'create-user', module: 'users' },
      { id: 2, name: 'view-item', module: 'items' },
    ]);
    expect(flat.map((p) => p.name)).toEqual(['create-user', 'view-item']);
  });

  it('canonicalizes module labels', () => {
    expect(canonicalizeModuleKey('User')).toBe('users');
    expect(canonicalizeModuleKey('Job Position')).toBe('job-positions');
    expect(canonicalizeModuleKey('Location')).toBe('locations');
    expect(canonicalizeModuleKey('Form Template')).toBe('form-template');
    expect(canonicalizeModuleKey('Template')).toBe('form-template');
    expect(canonicalizeModuleKey('Task')).toBe('task');
    expect(canonicalizeModuleKey('Form')).toBe('form');
  });

  it('normalizes allowedModules from strings and objects', () => {
    expect(normalizeAllowedModules(['User', 'Item', 'Form Template', 'Task'])).toEqual([
      'users',
      'items',
      'form-template',
      'task',
    ]);
    expect(
      normalizeAllowedModules([
        { key: 'vendors', enabled: true },
        { name: 'Location', enabled: false },
      ]),
    ).toEqual(['vendors']);
  });
});

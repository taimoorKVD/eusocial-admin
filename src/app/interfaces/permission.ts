/** Permission shape used by admin CRUD APIs and tenant RBAC checks. */
export interface Permission {
  id: number;
  name: string;
  /** Present on tenant user.role.permissions; optional for admin catalog APIs. */
  module?: string;
}

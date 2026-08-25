/** Raw item shape from GET /api/forms (field names may vary). */
export interface FormModuleApiItem {
  id?: number;
  name?: string;
  moduleName?: string;
  module_name?: string;
  route?: string;
  slug?: string;
  type?: string;
  module?: {
    id?: number;
    name?: string;
    slug?: string;
    isActive?: boolean;
    type?: string;
  };
}

export type FormModuleKind = 'static' | 'dynamic';

export interface FormModuleListItem {
  id?: number;
  name: string;
  moduleName: string;
  /** Module kind from API (`static` | `dynamic`). */
  type?: FormModuleKind | string;
  module: {
    id: number;
    name: string;
    slug: string;
    isActive: boolean;
    type?: FormModuleKind | string;
  };
}

export interface FormsListResponse {
  success?: boolean;
  message?: string;
  data: FormModuleListItem[];
}

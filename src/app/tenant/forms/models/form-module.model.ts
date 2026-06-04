/** Raw item shape from GET /api/forms (field names may vary). */
export interface FormModuleApiItem {
  id?: number;
  name?: string;
  moduleName?: string;
  module_name?: string;
  route?: string;
  slug?: string;
  module?: {
    id?: number;
    name?: string;
    slug?: string;
    isActive?: boolean;
  };
}

export interface FormModuleListItem {
  id?: number;
  name: string;
  moduleName: string;
    module: {
    id: number;
    name: string;
    slug: string;
    isActive: boolean;
  };
}

export interface FormsListResponse {
  success?: boolean;
  message?: string;
  data: FormModuleListItem[];
}

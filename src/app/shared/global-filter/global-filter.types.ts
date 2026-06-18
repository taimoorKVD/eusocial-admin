export type GlobalFilterValue = Record<string, unknown>;

export interface GlobalFilterOption {
  id?: number | string;
  name?: string;
  label?: string;
  value?: unknown;
}

export interface GlobalFilterField {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  options?: any[];
  loading?: boolean;
}

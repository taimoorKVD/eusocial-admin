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
  /** Dynamic module endpoint used to identify location fields (states/cities). */
  endpoint?: string;
  labelKey?: string;
  valueKey?: string;
}

export type FilterLocationKind = 'countries' | 'states' | 'cities';

export interface FilterLocationFields {
  country: GlobalFilterField | null;
  state: GlobalFilterField | null;
  city: GlobalFilterField | null;
}

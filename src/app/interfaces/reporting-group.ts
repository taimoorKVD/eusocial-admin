export interface ReportingGroupAssignedItem {
  id: number | string;
  name: string;
}

export interface ReportingGroupCategory {
  id: string;
  name: string;
  items: ReportingGroupAssignedItem[];
}

export interface ReportingGroup {
  id: string;
  name: string;
  categories: ReportingGroupCategory[];
  createdAt: string;
  updatedAt: string;
}

/** Flattened category option for Item form / dynamic select fields. */
export interface ReportingGroupOption {
  id: string;
  name: string;
  label: string;
  value: string;
  groupId: string;
  groupName: string;
}

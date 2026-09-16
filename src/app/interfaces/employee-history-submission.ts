import { FormSection } from '../tenant/pages/extra-management/forms/models/dynamic-form.models';

export interface EmployeeHistorySubmissionListItem {
  id: string;
  title: string;
  status: string;
  submittedAt: string | null;
  dueDate: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
}

export interface EmployeeHistorySubmissionPage {
  items: EmployeeHistorySubmissionListItem[];
  total: number;
  page: number;
  lastPage: number;
}

/** Detail payload from GET /data-collection/submissions/:id */
export interface EmployeeHistorySubmissionDetail {
  id: string;
  title: string;
  status: string;
  submittedAt: string | null;
  dueDate: string | null;
  answers: Record<string, unknown>;
  schema: Record<string, unknown>;
  sections: FormSection[];
  assignmentId: string | null;
  raw: Record<string, unknown>;
}

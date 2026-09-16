import { DynamicField } from './dynamic-field';
import { FormField } from '../tenant/form-builder/models/form-field.model';
import { FormSection } from '../tenant/pages/extra-management/forms/models/dynamic-form.models';

export type EmployeeAssignmentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export interface EmployeeAssignmentListItem {
  id: string;
  status: string;
  title: string;
  dueDate: string | null;
  createdAt: string | null;
  /** Completion timestamp for submitted assignments. */
  submittedAt: string | null;
  raw: Record<string, unknown>;
}

export interface EmployeeAssignmentPage {
  items: EmployeeAssignmentListItem[];
  total: number;
  page: number;
  lastPage: number;
}

export interface EmployeeAssignmentDetail {
  id: string;
  status: string;
  title: string;
  dueDate: string | null;
  createdAt: string | null;
  templateId: string | null;
  templateVersionId: string | null;
  submissionId: string | null;
  /** From assignment.template.schema */
  schema: Record<string, unknown>;
  sections: FormSection[];
  /** From assignment.submission.answers (empty when not submitted) */
  answers: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface EmployeeAssignmentSectionView {
  id: string;
  name: string;
  builderFields: FormField[];
  fields: DynamicField[];
  /**
   * Resolved fields regrouped by the API's logical rows (section.rows -> row.fields).
   * Falls back to a single row of `fields` when no row structure is available.
   */
  rows?: DynamicField[][];
}

export interface EmployeeSubmissionPayload {
  answers: Record<string, unknown>;
  submit: boolean;
}

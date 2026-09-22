import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { FormSection } from '../tenant/pages/extra-management/forms/models/dynamic-form.models';

/** API status values for Assigned Forms filters. */
export type AssignedFormApiStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue';

/** Assignment-level summary cards from `assignmentStats`. */
export interface AssignedFormsAssignmentStats {
  totalAssigned: number;
  withOverdue: number;
  inProgress: number;
  fullyCompleted: number;
}

/** Occurrence-level rollup from `stats` (kept available, not used for main cards). */
export interface AssignedFormsOccurrenceStats {
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  notStarted: number;
}

export interface AssignedFormsMeta {
  total: number;
  page: number;
  lastPage: number;
  limit: number;
}

export interface AssignmentProgress {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  upcoming: number;
}

export interface AssignedFormListItem {
  id: string;
  formName: string;
  assignedTo: string;
  assignedUserCount: number;
  frequencyLabel: string;
  periodLabel: string;
  progress: AssignmentProgress;
  statusLabel: string;
  raw: Record<string, unknown>;
}

export interface AssignedFormsPage {
  assignmentStats: AssignedFormsAssignmentStats;
  occurrenceStats: AssignedFormsOccurrenceStats;
  meta: AssignedFormsMeta;
  items: AssignedFormListItem[];
}

export interface AssignedFormsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string[];
  userId?: string[];
  jobPositionId?: string[];
  dueFrom?: string | null;
  dueTo?: string | null;
}

export interface AssignmentSummary {
  id: string;
  formName: string;
  assignedTo: string;
  frequencyLabel: string;
  periodLabel: string;
  progress: AssignmentProgress;
  statusLabel: string;
}

export type OccurrenceAction = 'view' | 'continue' | '';

/** Read-only completed occurrence submission. */
export interface OccurrenceSubmissionDetail {
  id: string;
  formName: string;
  dueDate: string | null;
  statusLabel: string;
  submittedAt: string | null;
  schema: Record<string, unknown>;
  sections: FormSection[];
  answers: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface AssignmentOccurrenceItem {
  id: string;
  dueDate: string | null;
  statusLabel: string;
  action: OccurrenceAction;
  /** Embedded completed submission from View Details API (when present). */
  submission: OccurrenceSubmissionDetail | null;
  raw: Record<string, unknown>;
}

export interface OccurrencesMeta {
  total: number;
  page: number;
  lastPage: number;
  limit: number;
  month: string | null;
}

export interface AssignmentDetailPage {
  summary: AssignmentSummary;
  occurrences: AssignmentOccurrenceItem[];
  occurrencesMeta: OccurrencesMeta;
  raw: Record<string, unknown>;
}

export interface AssignmentDetailQuery {
  page?: number;
  limit?: number;
  month?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AssignedFormsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.tenantApiUrl}/data-collection/assignments`;

  getAssignedForms(query: AssignedFormsQuery = {}): Observable<AssignedFormsPage> {
    const page = query.page ?? 1;
    const limit = query.limit ?? environment.limit;

    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    const search = query.search?.trim();
    if (search) {
      params = params.set('search', search);
    }

    for (const status of query.status ?? []) {
      const value = status.trim();
      if (value) {
        params = params.append('status', value);
      }
    }

    for (const userId of query.userId ?? []) {
      const value = String(userId).trim();
      if (value) {
        params = params.append('userId', value);
      }
    }

    for (const jobPositionId of query.jobPositionId ?? []) {
      const value = String(jobPositionId).trim();
      if (value) {
        params = params.append('jobPositionId', value);
      }
    }

    const dueFrom = query.dueFrom?.trim();
    if (dueFrom) {
      params = params.set('dueFrom', dueFrom);
    }

    const dueTo = query.dueTo?.trim();
    if (dueTo) {
      params = params.set('dueTo', dueTo);
    }

    return this.http
      .get<unknown>(`${this.apiUrl}/assigned-forms`, { params })
      .pipe(map((response) => this.normalizePage(response, page, limit)));
  }

  /** Assignment summary + paginated occurrences. */
  getAssignmentDetail(
    assignmentId: string,
    query: AssignmentDetailQuery = {},
  ): Observable<AssignmentDetailPage> {
    let params = new HttpParams();
    if (query.page != null) {
      params = params.set('page', String(query.page));
    }
    if (query.limit != null) {
      params = params.set('limit', String(query.limit));
    }
    const month = query.month?.trim();
    if (month) {
      params = params.set('month', month);
    }

    return this.http
      .get<unknown>(`${this.apiUrl}/assigned-forms/${assignmentId}`, { params })
      .pipe(map((response) => this.normalizeAssignmentDetail(response, assignmentId)));
  }

  /**
   * Build a read-only submission view model from an occurrence already loaded
   * via GET /assigned-forms/:assignmentId (no extra HTTP call).
   */
  toOccurrenceSubmission(
    occurrence: AssignmentOccurrenceItem,
    formNameFallback?: string,
  ): OccurrenceSubmissionDetail | null {
    if (occurrence.submission) {
      return {
        ...occurrence.submission,
        formName:
          occurrence.submission.formName ||
          formNameFallback ||
          occurrence.submission.formName,
        dueDate: occurrence.submission.dueDate ?? occurrence.dueDate,
        statusLabel: occurrence.submission.statusLabel || occurrence.statusLabel,
      };
    }

    const submissionRaw = this.asRecord(occurrence.raw['submission']);
    if (!Object.keys(submissionRaw).length) {
      return null;
    }

    return this.normalizeOccurrenceSubmission(
      {
        ...occurrence.raw,
        submission: submissionRaw,
        dueDate: occurrence.dueDate,
        statusLabel: occurrence.statusLabel,
        formName: formNameFallback,
      },
      occurrence.id,
    );
  }

  private normalizePage(
    response: unknown,
    fallbackPage: number,
    fallbackLimit: number,
  ): AssignedFormsPage {
    const record = this.asRecord(response);
    const assignmentStats = this.asRecord(
      record['assignmentStats'] ?? record['assignment_stats'],
    );
    const occurrenceStats = this.asRecord(record['stats']);
    const meta = this.asRecord(record['meta']);
    const items = this.extractArray(response).map((item) =>
      this.normalizeListItem(this.asRecord(item)),
    );

    return {
      assignmentStats: {
        totalAssigned: this.toNumber(
          assignmentStats['totalAssigned'] ??
            assignmentStats['total_assigned'] ??
            meta['total'],
        ),
        withOverdue: this.toNumber(
          assignmentStats['withOverdue'] ?? assignmentStats['with_overdue'],
        ),
        inProgress: this.toNumber(
          assignmentStats['inProgress'] ?? assignmentStats['in_progress'],
        ),
        fullyCompleted: this.toNumber(
          assignmentStats['fullyCompleted'] ??
            assignmentStats['fully_completed'] ??
            assignmentStats['completed'],
        ),
      },
      occurrenceStats: {
        totalAssigned: this.toNumber(
          occurrenceStats['totalAssigned'] ?? occurrenceStats['total_assigned'],
        ),
        completed: this.toNumber(occurrenceStats['completed']),
        inProgress: this.toNumber(
          occurrenceStats['inProgress'] ?? occurrenceStats['in_progress'],
        ),
        overdue: this.toNumber(occurrenceStats['overdue']),
        notStarted: this.toNumber(
          occurrenceStats['notStarted'] ??
            occurrenceStats['not_started'] ??
            occurrenceStats['pending'],
        ),
      },
      meta: {
        total: this.toNumber(meta['total'] ?? record['count'] ?? items.length),
        page: this.toNumber(meta['page'] ?? fallbackPage),
        lastPage: this.toNumber(meta['lastPage'] ?? meta['last_page'] ?? 1),
        limit: this.toNumber(meta['limit'] ?? fallbackLimit),
      },
      items,
    };
  }

  private normalizeListItem(item: Record<string, unknown>): AssignedFormListItem {
    const progress = this.normalizeProgress(
      item['progress'] ?? item['Progress'],
    );
    const assigned = this.readAssignedToDisplay(item);

    return {
      id: this.readId(item),
      formName: this.readFormName(item),
      assignedTo: assigned.label,
      assignedUserCount: assigned.count,
      frequencyLabel:
        this.readString(item['frequencyLabel'] ?? item['frequency_label']) ||
        this.readString(item['frequency']) ||
        '—',
      periodLabel:
        this.readString(item['periodLabel'] ?? item['period_label']) ||
        this.readPeriodFallback(item),
      progress,
      statusLabel:
        this.readString(item['statusLabel'] ?? item['status_label']) ||
        this.formatStatusLabel(item['status']),
      raw: item,
    };
  }

  private normalizeAssignmentDetail(
    response: unknown,
    fallbackId: string,
  ): AssignmentDetailPage {
    const root = this.unwrapRecord(response);
    const assignment = this.asRecord(
      root['assignment'] ?? root['data'] ?? root,
    );
    const summarySource = this.asRecord(
      assignment['summary'] ?? assignment,
    );
    const occurrencesBlock = this.asRecord(
      root['occurrences'] ?? assignment['occurrences'],
    );
    const occurrencesMeta = this.asRecord(occurrencesBlock['meta']);
    const occurrenceItems = this.extractNestedArray(occurrencesBlock).map((item) =>
      this.normalizeOccurrence(this.asRecord(item)),
    );

    const progress = this.normalizeProgress(
      summarySource['progress'] ?? assignment['progress'],
    );

    return {
      summary: {
        id: this.readId(summarySource) || this.readId(assignment) || fallbackId,
        formName: this.readFormName(summarySource) || this.readFormName(assignment),
        assignedTo: this.readAssignedToDisplay(summarySource).label ||
          this.readAssignedToDisplay(assignment).label,
        frequencyLabel:
          this.readString(
            summarySource['frequencyLabel'] ?? summarySource['frequency_label'],
          ) ||
          this.readString(summarySource['frequency']) ||
          '—',
        periodLabel:
          this.readString(
            summarySource['periodLabel'] ?? summarySource['period_label'],
          ) || this.readPeriodFallback(summarySource),
        progress,
        statusLabel:
          this.readString(
            summarySource['statusLabel'] ?? summarySource['status_label'],
          ) || this.formatStatusLabel(summarySource['status']),
      },
      occurrences: occurrenceItems,
      occurrencesMeta: {
        total: this.toNumber(
          occurrencesMeta['total'] ?? occurrenceItems.length,
        ),
        page: this.toNumber(occurrencesMeta['page'] ?? 1),
        lastPage: this.toNumber(
          occurrencesMeta['lastPage'] ?? occurrencesMeta['last_page'] ?? 1,
        ),
        limit: this.toNumber(
          occurrencesMeta['limit'] ?? environment.limit ?? 15,
        ),
        month: this.readString(occurrencesMeta['month']) || null,
      },
      raw: root,
    };
  }

  private normalizeOccurrence(item: Record<string, unknown>): AssignmentOccurrenceItem {
    const actionRaw = this.readString(item['action']).toLowerCase();
    let action: OccurrenceAction = '';
    if (actionRaw === 'view') {
      action = 'view';
    } else if (actionRaw === 'continue') {
      action = 'continue';
    }

    const id = this.readId(item);
    const dueDate = this.readDate(item);
    const statusLabel =
      this.readString(item['statusLabel'] ?? item['status_label']) ||
      this.formatStatusLabel(item['status']);

    const submissionRaw = this.asRecord(item['submission']);
    const submission =
      Object.keys(submissionRaw).length > 0
        ? this.normalizeOccurrenceSubmission(
            {
              ...item,
              submission: submissionRaw,
              dueDate,
              statusLabel,
            },
            id,
          )
        : null;

    return {
      id,
      dueDate,
      statusLabel,
      action,
      submission,
      raw: item,
    };
  }

  private normalizeOccurrenceSubmission(
    item: Record<string, unknown>,
    fallbackId: string,
  ): OccurrenceSubmissionDetail {
    const submission = this.asRecord(
      item['submission'] ?? item['data'] ?? item,
    );
    const template = this.asRecord(
      submission['template'] ?? item['template'],
    );
    const schema = this.extractSchema(item, template, submission);
    const answers = this.extractAnswers(submission, item);

    return {
      id: this.readId(item) || this.readId(submission) || fallbackId,
      formName:
        this.readFormName(item) ||
        this.readFormName(template) ||
        this.readString(schema['formName']) ||
        'Completed Form',
      dueDate: this.readDate(item),
      statusLabel:
        this.readString(item['statusLabel'] ?? item['status_label']) ||
        'Completed',
      submittedAt: this.readSubmittedAt(item, submission),
      schema,
      sections: this.extractSections(schema),
      answers,
      raw: item,
    };
  }

  private normalizeProgress(value: unknown): AssignmentProgress {
    const progress = this.asRecord(value);
    return {
      total: this.toNumber(progress['total']),
      completed: this.toNumber(progress['completed']),
      inProgress: this.toNumber(
        progress['inProgress'] ?? progress['in_progress'],
      ),
      overdue: this.toNumber(progress['overdue']),
      upcoming: this.toNumber(progress['upcoming']),
    };
  }

  private extractSchema(
    item: Record<string, unknown>,
    template: Record<string, unknown>,
    submission: Record<string, unknown> = {},
  ): Record<string, unknown> {
    if (this.isObject(item['schema'])) {
      return this.asRecord(item['schema']);
    }
    if (this.isObject(template['schema'])) {
      return this.asRecord(template['schema']);
    }
    const submissionTemplate = this.asRecord(submission['template']);
    if (this.isObject(submissionTemplate['schema'])) {
      return this.asRecord(submissionTemplate['schema']);
    }
    return {};
  }

  private extractSections(schema: Record<string, unknown>): FormSection[] {
    const sections = schema['sections'];
    if (!Array.isArray(sections)) {
      return [];
    }
    return sections
      .filter((section) => this.isObject(section))
      .map((section) =>
        this.normalizeSectionShape(this.asRecord(section)),
      ) as unknown as FormSection[];
  }

  private normalizeSectionShape(
    section: Record<string, unknown>,
  ): Record<string, unknown> {
    const rows = section['rows'];
    if (Array.isArray(rows) && rows.length) {
      return section;
    }

    const fields = section['fields'];
    if (Array.isArray(fields) && fields.length) {
      return {
        ...section,
        rows: [{ fields }],
      };
    }

    return section;
  }

  private extractAnswers(
    submission: Record<string, unknown>,
    item: Record<string, unknown>,
  ): Record<string, unknown> {
    if (this.isObject(submission['answers'])) {
      return this.asRecord(submission['answers']);
    }
    if (this.isObject(submission['response'])) {
      return this.asRecord(submission['response']);
    }
    if (this.isObject(item['answers'])) {
      return this.asRecord(item['answers']);
    }
    return {};
  }

  private readFormName(item: Record<string, unknown>): string {
    const template = this.asRecord(item['template']);
    const schema = this.asRecord(template['schema'] ?? item['schema']);
    const candidates = [
      item['formName'],
      item['form_name'],
      item['templateName'],
      item['template_name'],
      item['title'],
      item['name'],
      template['name'],
      schema['formName'],
    ];

    for (const candidate of candidates) {
      const value = this.readString(candidate);
      if (value) {
        return value;
      }
    }

    const id = this.readId(item);
    return id ? `Assignment #${id}` : 'Untitled form';
  }

  private readAssignedToDisplay(item: Record<string, unknown>): {
    label: string;
    count: number;
  } {
    const fromAssignedTo = this.readAssigneeNames(
      item['assignedTo'] ?? item['assigned_to'] ?? item['assignees'],
    );
    if (fromAssignedTo.names.length) {
      return {
        label: this.formatAssigneeList(fromAssignedTo.names),
        count: fromAssignedTo.names.length,
      };
    }

    const user = this.asRecord(
      item['user'] ?? item['assignee'] ?? item['assignedUser'],
    );
    const single =
      this.readString(user['name']) ||
      [user['first_name'], user['last_name']].filter(Boolean).join(' ').trim();
    if (single) {
      return { label: single, count: 1 };
    }

    return { label: '—', count: 0 };
  }

  private formatAssigneeList(names: string[]): string {
    if (names.length <= 3) {
      return names.join(', ');
    }
    const shown = names.slice(0, 3).join(', ');
    return `${shown} + others`;
  }

  private readAssigneeNames(value: unknown): { names: string[] } {
    if (value == null) {
      return { names: [] };
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      return { names: text ? [text] : [] };
    }

    if (Array.isArray(value)) {
      const names = value
        .map((entry) => {
          if (typeof entry === 'string' || typeof entry === 'number') {
            return String(entry).trim();
          }
          if (!this.isObject(entry)) {
            return '';
          }
          const record = this.asRecord(entry);
          return (
            this.readString(record['name']) ||
            [record['first_name'], record['last_name']]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            [record['firstName'], record['lastName']]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            this.readString(record['email'])
          );
        })
        .filter(Boolean);
      return { names };
    }

    if (this.isObject(value)) {
      const record = this.asRecord(value);
      const name =
        this.readString(record['name']) ||
        [record['first_name'], record['last_name']]
          .filter(Boolean)
          .join(' ')
          .trim();
      return { names: name ? [name] : [] };
    }

    return { names: [] };
  }

  private readPeriodFallback(item: Record<string, unknown>): string {
    const start = this.readString(
      item['periodStart'] ??
        item['period_start'] ??
        item['startDate'] ??
        item['start_date'],
    );
    const end = this.readString(
      item['periodEnd'] ??
        item['period_end'] ??
        item['endDate'] ??
        item['end_date'],
    );
    if (start && end) {
      return `${start} → ${end}`;
    }
    return start || end || '—';
  }

  private readDate(item: Record<string, unknown>): string | null {
    const text = this.readString(
      item['dueAt'] ??
        item['due_at'] ??
        item['dueDate'] ??
        item['due_date'] ??
        item['date'],
    );
    return text || null;
  }

  private readSubmittedAt(
    item: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): string | null {
    const text = this.readString(
      item['submittedAt'] ??
        item['submitted_at'] ??
        submission['submittedAt'] ??
        submission['submitted_at'] ??
        submission['createdAt'] ??
        submission['created_at'],
    );
    return text || null;
  }

  private formatStatusLabel(value: unknown): string {
    const raw = this.readString(value).toLowerCase().replace(/[\s-]+/g, '_');
    switch (raw) {
      case 'completed':
      case 'complete':
      case 'submitted':
        return 'Completed';
      case 'in_progress':
      case 'inprogress':
        return 'In Progress';
      case 'overdue':
        return 'Overdue';
      case 'upcoming':
        return 'Upcoming';
      case 'pending':
      case 'not_started':
        return 'Pending';
      default:
        return this.readString(value) || '—';
    }
  }

  private unwrapRecord(response: unknown): Record<string, unknown> {
    const record = this.asRecord(response);
    const data = record['data'];
    if (this.isObject(data) && !Array.isArray(data)) {
      return data;
    }
    return record;
  }

  private extractArray(response: unknown): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    const record = this.asRecord(response);
    const data = record['data'];

    if (Array.isArray(data)) {
      return data;
    }

    if (this.isObject(data)) {
      const nested =
        data['items'] ?? data['assignments'] ?? data['data'] ?? data['results'];
      if (Array.isArray(nested)) {
        return nested;
      }
    }

    const fallback =
      record['items'] ?? record['assignments'] ?? record['results'];
    return Array.isArray(fallback) ? fallback : [];
  }

  private extractNestedArray(block: Record<string, unknown>): unknown[] {
    const data = block['data'];
    if (Array.isArray(data)) {
      return data;
    }
    const items = block['items'] ?? block['results'];
    return Array.isArray(items) ? items : [];
  }

  private readId(item: Record<string, unknown>): string {
    const value =
      item['id'] ??
      item['_id'] ??
      item['assignmentId'] ??
      item['assignment_id'] ??
      item['occurrenceId'] ??
      item['occurrence_id'];
    return value == null ? '' : String(value);
  }

  private readString(value: unknown): string {
    if (value == null) {
      return '';
    }
    return String(value).trim();
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isObject(value) ? value : {};
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { FormSection } from '../tenant/pages/extra-management/forms/models/dynamic-form.models';

/** API status values for Assigned Forms filters/listing. */
export type AssignedFormApiStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue';

export interface AssignedFormsStats {
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

export interface AssignedFormListItem {
  id: string;
  formName: string;
  assignedTo: string;
  assignedUserIds: string[];
  dueDate: string | null;
  status: AssignedFormApiStatus;
  mode: string | null;
  submissionId: string | null;
  raw: Record<string, unknown>;
}

export interface AssignedFormsPage {
  stats: AssignedFormsStats;
  meta: AssignedFormsMeta;
  items: AssignedFormListItem[];
}

export interface AssignedFormsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string[];
  userId?: string[];
  /** Same repeated-param convention as `userId`. */
  jobPositionId?: string[];
  dueFrom?: string | null;
  dueTo?: string | null;
}

export interface AssignedFormDetail {
  id: string;
  status: AssignedFormApiStatus;
  formName: string;
  assignedTo: string;
  dueDate: string | null;
  mode: string | null;
  submittedAt: string | null;
  submissionId: string | null;
  schema: Record<string, unknown>;
  sections: FormSection[];
  answers: Record<string, unknown>;
  raw: Record<string, unknown>;
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

  /** Detail for read-only View — same assignment detail endpoint used elsewhere. */
  getAssignedForm(id: string): Observable<AssignedFormDetail> {
    return this.http
      .get<unknown>(`${this.apiUrl}/${id}`)
      .pipe(map((response) => this.normalizeDetail(this.unwrapRecord(response), id)));
  }

  private normalizePage(
    response: unknown,
    fallbackPage: number,
    fallbackLimit: number,
  ): AssignedFormsPage {
    const record = this.asRecord(response);
    const stats = this.asRecord(record['stats']);
    const meta = this.asRecord(record['meta']);
    const items = this.extractArray(response).map((item) =>
      this.normalizeListItem(this.asRecord(item)),
    );

    return {
      stats: {
        totalAssigned: this.toNumber(
          stats['totalAssigned'] ?? stats['total_assigned'] ?? meta['total'],
        ),
        completed: this.toNumber(stats['completed']),
        inProgress: this.toNumber(stats['inProgress'] ?? stats['in_progress']),
        overdue: this.toNumber(stats['overdue']),
        notStarted: this.toNumber(
          stats['notStarted'] ?? stats['not_started'] ?? stats['pending'],
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
    const submission = this.asRecord(item['submission']);
    const user = this.asRecord(
      item['user'] ?? item['assignee'] ?? item['assignedUser'] ?? item['assigned_user'],
    );

    return {
      id: this.readId(item),
      formName: this.readFormName(item),
      assignedTo: this.readAssignedTo(item, user),
      assignedUserIds: this.readAssignedUserIds(item, user),
      dueDate: this.readDate(item),
      status: this.normalizeStatus(item['status']),
      mode: this.readMode(item),
      submissionId: this.readNullableId(
        item['submissionId'] ?? item['submission_id'] ?? submission['id'],
      ),
      raw: item,
    };
  }

  private normalizeDetail(
    item: Record<string, unknown>,
    fallbackId: string,
  ): AssignedFormDetail {
    const template = this.asRecord(item['template']);
    const schema = this.extractSchema(item, template);
    const submission = this.asRecord(item['submission']);
    const user = this.asRecord(
      item['user'] ?? item['assignee'] ?? item['assignedUser'] ?? item['assigned_user'],
    );

    return {
      id: this.readId(item) || fallbackId,
      status: this.normalizeStatus(item['status']),
      formName: this.readFormName(item),
      assignedTo: this.readAssignedTo(item, user),
      dueDate: this.readDate(item),
      mode: this.readMode(item),
      submittedAt: this.readSubmittedAt(item, submission),
      submissionId: this.readNullableId(
        item['submissionId'] ?? item['submission_id'] ?? submission['id'],
      ),
      schema,
      sections: this.extractSections(schema),
      answers: this.extractAnswers(submission, item),
      raw: item,
    };
  }

  private extractSchema(
    item: Record<string, unknown>,
    template: Record<string, unknown>,
  ): Record<string, unknown> {
    if (this.isObject(item['schema'])) {
      return this.asRecord(item['schema']);
    }
    if (this.isObject(template['schema'])) {
      return this.asRecord(template['schema']);
    }
    const submission = this.asRecord(item['submission']);
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
      .map((section) => this.normalizeSectionShape(this.asRecord(section))) as unknown as FormSection[];
  }

  /**
   * Some payloads expose section.fields instead of section.rows.
   * Normalize locally so shared form mappers can read rows.
   */
  private normalizeSectionShape(section: Record<string, unknown>): Record<string, unknown> {
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

  private readAssignedTo(
    item: Record<string, unknown>,
    user: Record<string, unknown>,
  ): string {
    const fromAssignedTo = this.readAssigneeNames(
      item['assignedTo'] ?? item['assigned_to'],
    );
    if (fromAssignedTo) {
      return fromAssignedTo;
    }

    const candidates = [
      item['assigneeName'],
      item['assignee_name'],
      user['name'],
      [user['first_name'], user['last_name']].filter(Boolean).join(' '),
      [user['firstName'], user['lastName']].filter(Boolean).join(' '),
      user['email'],
    ];

    for (const candidate of candidates) {
      const value = this.readString(candidate);
      if (value) {
        return value;
      }
    }

    const fromUsers = this.readAssigneeNames(item['users'] ?? item['assignees']);
    if (fromUsers) {
      return fromUsers;
    }

    return '—';
  }

  /** Resolve assignee display names from string/object/array payloads. */
  private readAssigneeNames(value: unknown): string {
    if (value == null) {
      return '';
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim();
    }

    if (Array.isArray(value)) {
      const names = value
        .map((entry) => this.readAssigneeNames(entry))
        .filter(Boolean);
      return names.join(', ');
    }

    if (this.isObject(value)) {
      const record = this.asRecord(value);
      return (
        this.readString(record['name']) ||
        [record['first_name'], record['last_name']].filter(Boolean).join(' ').trim() ||
        [record['firstName'], record['lastName']].filter(Boolean).join(' ').trim() ||
        this.readString(record['email'])
      );
    }

    return '';
  }

  private readAssignedUserIds(
    item: Record<string, unknown>,
    user: Record<string, unknown>,
  ): string[] {
    const ids = new Set<string>();
    const single = this.readNullableId(
      item['userId'] ?? item['user_id'] ?? item['assignedUserId'] ?? user['id'],
    );
    if (single) {
      ids.add(single);
    }

    const list = item['userIds'] ?? item['user_ids'] ?? item['users'] ?? item['assignees'];
    if (Array.isArray(list)) {
      for (const entry of list) {
        if (typeof entry === 'string' || typeof entry === 'number') {
          ids.add(String(entry));
          continue;
        }
        const id = this.readNullableId(this.asRecord(entry)['id']);
        if (id) {
          ids.add(id);
        }
      }
    }

    return [...ids];
  }

  private readMode(item: Record<string, unknown>): string | null {
    const assign = this.asRecord(item['assign']);
    const value = this.readString(
      item['mode'] ?? item['assignMode'] ?? item['assign_mode'] ?? assign['mode'],
    );
    return value || null;
  }

  private readDate(item: Record<string, unknown>): string | null {
    const text = this.readString(
      item['dueAt'] ?? item['due_at'] ?? item['dueDate'] ?? item['due_date'],
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

  private normalizeStatus(value: unknown): AssignedFormApiStatus {
    const raw = this.readString(value).toLowerCase().replace(/[\s-]+/g, '_');
    if (
      raw === 'inprogress' ||
      raw === 'in_progress' ||
      raw === 'started' ||
      raw === 'active'
    ) {
      return 'in_progress';
    }
    if (
      raw === 'complete' ||
      raw === 'completed' ||
      raw === 'submitted' ||
      raw === 'done'
    ) {
      return 'completed';
    }
    if (raw === 'overdue' || raw === 'past_due' || raw === 'pastdue') {
      return 'overdue';
    }
    return 'pending';
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

    const fallback = record['items'] ?? record['assignments'] ?? record['results'];
    return Array.isArray(fallback) ? fallback : [];
  }

  private readId(item: Record<string, unknown>): string {
    const value = item['id'] ?? item['_id'] ?? item['assignmentId'] ?? item['assignment_id'];
    return value == null ? '' : String(value);
  }

  private readNullableId(value: unknown): string | null {
    if (value == null || value === '') {
      return null;
    }
    return String(value);
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

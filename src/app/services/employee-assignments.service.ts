import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  EmployeeAssignmentDetail,
  EmployeeAssignmentListItem,
  EmployeeAssignmentPage,
  EmployeeAssignmentStatus,
  EmployeeSubmissionPayload,
} from '../interfaces/employee-assignment';
import { FormSection } from '../tenant/pages/extra-management/forms/models/dynamic-form.models';

@Injectable({ providedIn: 'root' })
export class EmployeeAssignmentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.tenantApiUrl}/data-collection/assignments`;

  getMyWork(options: {
    page?: number;
    limit?: number;
    status?: EmployeeAssignmentStatus | '';
  } = {}): Observable<EmployeeAssignmentPage> {
    const page = options.page ?? 1;
    const limit = options.limit ?? environment.limit;

    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    if (options.status) {
      params = params.set('status', options.status);
    }

    return this.http.get<unknown>(`${this.apiUrl}/my-work`, { params }).pipe(
      map((response) => this.normalizeList(response, page)),
    );
  }

  /** Single source of truth for employee form schema + submission answers. */
  getAssignment(id: string): Observable<EmployeeAssignmentDetail> {
    return this.http
      .get<unknown>(`${this.apiUrl}/${id}`)
      .pipe(map((response) => this.normalizeDetail(this.unwrapRecord(response), id)));
  }

  startAssignment(id: string): Observable<EmployeeAssignmentDetail> {
    return this.http.post<unknown>(`${this.apiUrl}/${id}/start`, {}).pipe(
      map((response) => this.normalizeDetail(this.unwrapRecord(response), id)),
    );
  }

  submitAssignment(
    id: string,
    payload: EmployeeSubmissionPayload,
  ): Observable<unknown> {
    return this.http.post<unknown>(`${this.apiUrl}/${id}/submissions`, payload);
  }

  private normalizeList(response: unknown, fallbackPage: number): EmployeeAssignmentPage {
    const record = this.asRecord(response);
    const meta = this.asRecord(record['meta']);
    const items = this.extractArray(response).map((item) =>
      this.normalizeListItem(this.asRecord(item)),
    );

    return {
      items,
      total: this.toNumber(meta['total'] ?? record['count'] ?? items.length),
      page: this.toNumber(meta['page'] ?? fallbackPage),
      lastPage: this.toNumber(meta['lastPage'] ?? meta['last_page'] ?? 1),
    };
  }

  private normalizeListItem(item: Record<string, unknown>): EmployeeAssignmentListItem {
    const submission = this.asRecord(item['submission']);

    return {
      id: this.readId(item),
      status: this.normalizeStatus(item['status']),
      title: this.readTitle(item),
      dueDate: this.readDate(item),
      createdAt: this.readCreatedAt(item),
      submittedAt: this.readSubmittedAt(item, submission),
      raw: item,
    };
  }

  private normalizeDetail(
    item: Record<string, unknown>,
    fallbackId: string,
  ): EmployeeAssignmentDetail {
    const template = this.asRecord(item['template']);
    const schema = this.extractSchema(item, template);
    const submission = this.asRecord(item['submission']);
    const answers = this.extractAnswers(submission, item);

    return {
      id: this.readId(item) || fallbackId,
      status: this.normalizeStatus(item['status']),
      title: this.readTitle(item),
      dueDate: this.readDate(item),
      createdAt: this.readCreatedAt(item),
      templateId: this.readNullableId(item['templateId'] ?? item['template_id'] ?? template['id']),
      templateVersionId: this.readNullableId(
        item['templateVersionId'] ?? item['template_version_id'],
      ),
      submissionId: this.readNullableId(
        item['submissionId'] ??
          item['submission_id'] ??
          submission['id'],
      ),
      schema,
      sections: this.extractSections(schema),
      answers,
      raw: item,
    };
  }

  private extractSchema(
    item: Record<string, unknown>,
    template: Record<string, unknown>,
  ): Record<string, unknown> {
    const fromTemplate = template['schema'];
    if (this.isObject(fromTemplate)) {
      return fromTemplate;
    }

    const direct = item['schema'];
    if (this.isObject(direct)) {
      return direct;
    }

    if (Array.isArray(item['sections'])) {
      return item;
    }

    return {};
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

  private extractSections(schema: Record<string, unknown>): FormSection[] {
    const sections = schema['sections'];
    if (!Array.isArray(sections)) {
      return [];
    }
    return sections.filter((section) => this.isObject(section)) as unknown as FormSection[];
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

  private readTitle(item: Record<string, unknown>): string {
    const template = this.asRecord(item['template']);
    const schema = this.asRecord(template['schema']);
    const candidates = [
      item['formName'],
      item['templateName'],
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
    return id ? `Assignment #${id}` : 'Untitled assignment';
  }

  private readDate(item: Record<string, unknown>): string | null {
    const text = this.readString(
      item['dueAt'] ?? item['due_at'] ?? item['dueDate'] ?? item['due_date'],
    );
    return text || null;
  }

  private readCreatedAt(item: Record<string, unknown>): string | null {
    const text = this.readString(item['createdAt'] ?? item['created_at']);
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
        submission['createdAt'],
    );
    return text || null;
  }

  private readId(item: Record<string, unknown>): string {
    const value = item['id'] ?? item['_id'] ?? item['assignmentId'];
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

  /** Map API status variants onto the statuses used by the employee UI. */
  private normalizeStatus(value: unknown): string {
    const raw = this.readString(value).toLowerCase().replace(/[\s-]+/g, '_');
    if (!raw) {
      return 'pending';
    }

    if (raw === 'inprogress' || raw === 'in_progress' || raw === 'started' || raw === 'active') {
      return 'in_progress';
    }
    if (raw === 'complete' || raw === 'completed' || raw === 'submitted' || raw === 'done') {
      return 'completed';
    }
    if (raw === 'cancel' || raw === 'cancelled' || raw === 'canceled') {
      return 'cancelled';
    }
    if (raw === 'overdue' || raw === 'past_due' || raw === 'pastdue') {
      return 'overdue';
    }
    if (raw === 'pending' || raw === 'assigned' || raw === 'new' || raw === 'not_started') {
      return 'pending';
    }

    return raw;
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

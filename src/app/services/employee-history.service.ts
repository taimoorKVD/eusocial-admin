import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { FormSection } from '../tenant/pages/extra-management/forms/models/dynamic-form.models';
import {
  EmployeeHistorySubmissionDetail,
  EmployeeHistorySubmissionListItem,
  EmployeeHistorySubmissionPage,
} from '../interfaces/employee-history-submission';

/**
 * Employee Portal History — submitted forms via `/data-collection/submissions`.
 * Separate from My Forms assignment APIs.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeHistoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.tenantApiUrl}/data-collection/submissions`;

  getSubmissions(options: {
    page?: number;
    limit?: number;
  } = {}): Observable<EmployeeHistorySubmissionPage> {
    const page = options.page ?? 1;
    const limit = options.limit ?? environment.limit;

    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    return this.http.get<unknown>(this.apiUrl, { params }).pipe(
      map((response) => this.normalizeList(response, page)),
    );
  }

  getSubmission(id: string): Observable<EmployeeHistorySubmissionDetail> {
    return this.http.get<unknown>(`${this.apiUrl}/${id}`).pipe(
      map((response) => this.normalizeDetail(this.unwrapRecord(response), id)),
    );
  }

  private normalizeList(
    response: unknown,
    fallbackPage: number,
  ): EmployeeHistorySubmissionPage {
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

  private normalizeListItem(
    item: Record<string, unknown>,
  ): EmployeeHistorySubmissionListItem {
    const assignment = this.asRecord(item['assignment']);
    const template = this.asRecord(
      item['template'] ?? assignment['template'],
    );

    return {
      id: this.readId(item),
      title: this.readTitle(item, assignment, template),
      status: this.normalizeStatus(item['status'] ?? assignment['status']),
      submittedAt: this.readSubmittedAt(item),
      dueDate: this.readDate(
        item['dueAt'] ??
          item['due_at'] ??
          assignment['dueAt'] ??
          assignment['due_at'],
      ),
      createdAt: this.readDate(item['createdAt'] ?? item['created_at']),
      raw: item,
    };
  }

  private normalizeDetail(
    item: Record<string, unknown>,
    fallbackId: string,
  ): EmployeeHistorySubmissionDetail {
    const assignment = this.asRecord(item['assignment']);
    const template = this.asRecord(
      item['template'] ?? assignment['template'],
    );
    const schema = this.extractSchema(item, assignment, template);

    return {
      id: this.readId(item) || fallbackId,
      title: this.readTitle(item, assignment, template),
      status: this.normalizeStatus(item['status'] ?? 'completed'),
      submittedAt: this.readSubmittedAt(item),
      dueDate: this.readDate(
        item['dueAt'] ??
          item['due_at'] ??
          assignment['dueAt'] ??
          assignment['due_at'],
      ),
      answers: this.extractAnswers(item),
      schema,
      sections: this.extractSections(schema),
      assignmentId: this.readNullableId(
        item['assignmentId'] ??
          item['assignment_id'] ??
          assignment['id'],
      ),
      raw: item,
    };
  }

  private extractSchema(
    item: Record<string, unknown>,
    assignment: Record<string, unknown>,
    template: Record<string, unknown>,
  ): Record<string, unknown> {
    const candidates = [
      template['schema'],
      item['schema'],
      assignment['schema'],
      this.asRecord(assignment['template'])['schema'],
    ];

    for (const candidate of candidates) {
      if (this.isObject(candidate)) {
        return candidate;
      }
    }

    if (Array.isArray(item['sections'])) {
      return item;
    }

    return {};
  }

  private extractAnswers(item: Record<string, unknown>): Record<string, unknown> {
    if (this.isObject(item['answers'])) {
      return this.asRecord(item['answers']);
    }
    if (this.isObject(item['response'])) {
      return this.asRecord(item['response']);
    }
    const submission = this.asRecord(item['submission']);
    if (this.isObject(submission['answers'])) {
      return this.asRecord(submission['answers']);
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

  private readTitle(
    item: Record<string, unknown>,
    assignment: Record<string, unknown>,
    template: Record<string, unknown>,
  ): string {
    const schema = this.asRecord(template['schema']);
    const candidates = [
      item['formName'],
      item['title'],
      item['name'],
      assignment['title'],
      assignment['formName'],
      assignment['name'],
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
    return id ? `Submission #${id}` : 'Submitted form';
  }

  private readSubmittedAt(item: Record<string, unknown>): string | null {
    return this.readDate(
      item['submittedAt'] ??
        item['submitted_at'] ??
        item['createdAt'] ??
        item['created_at'],
    );
  }

  private readDate(value: unknown): string | null {
    const text = this.readString(value);
    return text || null;
  }

  private readId(item: Record<string, unknown>): string {
    const value = item['id'] ?? item['_id'] ?? item['submissionId'];
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

  private normalizeStatus(value: unknown): string {
    const raw = this.readString(value).toLowerCase().replace(/[\s-]+/g, '_');
    if (!raw) {
      return 'completed';
    }
    if (raw === 'complete' || raw === 'completed' || raw === 'submitted' || raw === 'done') {
      return 'completed';
    }
    return raw;
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
        data['items'] ?? data['submissions'] ?? data['data'] ?? data['results'];
      if (Array.isArray(nested)) {
        return nested;
      }
    }

    const fallback =
      record['items'] ?? record['submissions'] ?? record['results'];
    return Array.isArray(fallback) ? fallback : [];
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

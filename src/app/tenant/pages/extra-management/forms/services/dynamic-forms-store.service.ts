import { Injectable, signal } from '@angular/core';
import { DynamicFormPayload, SavedDynamicForm, createId } from '../models/dynamic-form.models';

@Injectable({ providedIn: 'root' })
export class DynamicFormsStoreService {
  private readonly formsSignal = signal<SavedDynamicForm[]>([]);

  readonly forms = this.formsSignal.asReadonly();

  getAll(): SavedDynamicForm[] {
    return this.formsSignal();
  }

  save(payload: DynamicFormPayload): SavedDynamicForm {
    const saved: SavedDynamicForm = {
      id: createId('form'),
      formName: payload.formName,
      sectionCount: payload.sections.length,
      sectionTypes: payload.sections.map((s) => s.type),
      createdAt: new Date().toISOString(),
      payload,
    };

    this.formsSignal.update((list) => [saved, ...list]);
    return saved;
  }
}

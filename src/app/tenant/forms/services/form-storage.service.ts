import { Injectable } from '@angular/core';
import { FormField } from '../../form-builder/models/form-field.model';

export interface StoredFormSchema {
  moduleName: string;
  formName: string;
  formId: string | number | null;
  fields: FormField[];
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class FormStorageService {
  private storagePrefix = 'dynamic_form_builder';

  saveForm(moduleName: string, data: { formName: string; formId: string | number | null; fields: FormField[] }): StoredFormSchema {
    const payload: StoredFormSchema = {
      moduleName,
      formName: data.formName,
      formId: data.formId,
      fields: data.fields,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(this.storageKey(moduleName), JSON.stringify(payload));
    return payload;
  }

  loadForm(moduleName: string): StoredFormSchema | null {
    const raw = localStorage.getItem(this.storageKey(moduleName));
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredFormSchema;
    } catch {
      return null;
    }
  }

  deleteForm(moduleName: string): void {
    localStorage.removeItem(this.storageKey(moduleName));
  }

  private storageKey(moduleName: string): string {
    return `${this.storagePrefix}:${moduleName}`;
  }
}

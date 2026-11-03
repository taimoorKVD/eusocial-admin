import { Injectable } from '@angular/core';
import { FormLogicRule } from '../../../../forms/logic-rules/logic-rule.models';
import {
  DynamicFormPayload,
  FormMetaConfig,
  FormSection,
} from '../models/dynamic-form.models';

export interface FormPreviewPayload {
  templateId: number;
  formName: string;
  payload: DynamicFormPayload;
}

export interface FormEditorPreviewState {
  formId: string;
  formName: string;
  sections: FormSection[];
  meta: FormMetaConfig;
  logicRules: FormLogicRule[];
  frequencyPayload: DynamicFormPayload;
  savedSnapshot: string;
  baselineReady: boolean;
  freezeBaseline: boolean;
  currentStep: number;
}

/**
 * Transient bridge between the template editor and its preview route.
 * Keeps unsaved editor state in memory so Preview never saves or reloads it.
 */
@Injectable({
  providedIn: 'root',
})
export class FormPreviewBridgeService {
  private preview: FormPreviewPayload | null = null;
  private editorState: FormEditorPreviewState | null = null;

  setPreview(preview: FormPreviewPayload): void {
    this.preview = preview;
  }

  consumePreview(templateId: number): FormPreviewPayload | null {
    const preview = this.preview;
    if (!preview || preview.templateId !== templateId) {
      return null;
    }
    this.preview = null;
    return preview;
  }

  setEditorState(state: FormEditorPreviewState): void {
    this.editorState = state;
  }

  consumeEditorState(formId: string): FormEditorPreviewState | null {
    const state = this.editorState;
    if (!state || state.formId !== formId) {
      return null;
    }
    this.editorState = null;
    return state;
  }

  clear(): void {
    this.preview = null;
    this.editorState = null;
  }
}

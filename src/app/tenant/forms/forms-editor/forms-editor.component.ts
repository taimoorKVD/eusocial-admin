import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ToastrService } from 'ngx-toastr';
import { FormField } from '../../form-builder/models/form-field.model';
import {
  createFieldFromTemplate,
  normalizeFieldOrder,
  sanitizeField,
} from '../../form-builder/utils/form-field.factory';
import { FormStorageService } from '../services/form-storage.service';
import { FormsEditorCanDeactivate } from '../guards/forms-editor-can-deactivate.interface';

@Component({
  selector: 'app-forms-editor',
  standalone: false,
  templateUrl: './forms-editor.component.html',
  styleUrl: './forms-editor.component.scss',
})
export class FormsEditorComponent
  implements OnInit, OnDestroy, FormsEditorCanDeactivate
{
  moduleName = '';
  builderSchema: FormField[] = [];
  selectedFieldId: string | null = null;
  activeTab: 'fields' | 'settings' | 'versions' = 'fields';
  formName = 'Users Dynamic Form';
  formId: string | number | null = null;
  showExitConfirmModal = false;

  private readonly loadingStates = new Set<string>();
  private savedSnapshot = '';
  private schemaReady = false;
  private allowModuleNavigation = false;
  private pendingModule: string | null = null;
  private navigationResolver: ((allowed: boolean) => void) | null = null;

  get isLoading(): boolean {
    return this.loadingStates.size > 0;
  }

  /** Connected list IDs (palette ↔ canvas). */
  readonly paletteListId = 'sidebarList';
  readonly canvasListId = 'canvasList';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formStorageService: FormStorageService,
    private toastr: ToastrService
  ) {}

  get selectedField(): FormField | null {
    if (!this.selectedFieldId) {
      return null;
    }

    return this.builderSchema.find(field => field.id === this.selectedFieldId) || null;
  }

  get hiddenFields(): FormField[] {
    return this.builderSchema.filter(field => field.isShow === false);
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const nextModule = params.get('module') ?? '';
      this.handleModuleNavigation(nextModule);
    });
  }

  ngOnDestroy(): void {
    this.navigationResolver = null;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.hasUnsavedChanges()) {
      return true;
    }

    this.showExitConfirmModal = true;
    return new Promise<boolean>(resolve => {
      this.navigationResolver = resolve;
    });
  }

  onConfirmExit(): void {
    this.showExitConfirmModal = false;

    if (this.navigationResolver) {
      this.navigationResolver(true);
      this.navigationResolver = null;
      return;
    }

    if (this.pendingModule) {
      const slug = this.getTenantSlug();
      const nextModule = this.pendingModule;
      this.pendingModule = null;
      this.allowModuleNavigation = true;
      this.router.navigate(['/tenant', slug, 'forms', nextModule]);
    }
  }

  onCancelExit(): void {
    this.showExitConfirmModal = false;
    this.pendingModule = null;

    if (this.navigationResolver) {
      this.navigationResolver(false);
      this.navigationResolver = null;
    }
  }

  onCanvasDrop(event: CdkDragDrop<FormField[]>): void {
    if (event.previousContainer === event.container) {
      const reordered = [...this.builderSchema];
      moveItemInArray(reordered, event.previousIndex, event.currentIndex);
      this.builderSchema = normalizeFieldOrder(reordered);
      return;
    }

    const template = event.item.data as Partial<FormField>;
    const field = createFieldFromTemplate(template);
    const updated = [...this.builderSchema];
    const insertIndex = Math.min(
      Math.max(event.currentIndex, 0),
      updated.length
    );

    updated.splice(insertIndex, 0, field);
    this.builderSchema = normalizeFieldOrder(updated);
    this.onSelectField(field);
  }

  onSelectField(field: FormField): void {
    this.selectedFieldId = field.id;
    this.activeTab = 'settings';
  }

  trackByFieldId(_index: number, field: FormField): string {
    return field.id;
  }

  onDuplicateField(field: FormField): void {
    const index = this.builderSchema.findIndex(item => item.id === field.id);
    if (index === -1) {
      return;
    }

    const clone = createFieldFromTemplate({
      ...field,
      label: `${field.label} Copy`,
    });

    const updated = [...this.builderSchema];
    updated.splice(index + 1, 0, clone);
    this.builderSchema = normalizeFieldOrder(updated);
    this.onSelectField(clone);
  }

  onDeleteField(field: FormField): void {
    this.builderSchema = normalizeFieldOrder(
      this.builderSchema.filter(item => item.id !== field.id)
    );

    if (this.selectedFieldId === field.id) {
      this.selectedFieldId = null;
      this.activeTab = 'fields';
    }
  }

  setActiveTab(tab: 'fields' | 'settings' | 'versions'): void {
    if (tab === 'settings' && !this.selectedFieldId) {
      return;
    }

    this.activeTab = tab;
  }

  onRestoreVersion(_fields: FormField[]): void {
    this.selectedFieldId = null;
    this.activeTab = 'fields';
    this.setLoadingState('restore-reload', true);

    this.formStorageService.loadForm(this.moduleName).subscribe({
      next: saved => {
        this.setLoadingState('restore-reload', false);
        this.setLoadingState('restore-api', false);
        if (saved) {
          this.formName = saved.formName || this.formName;
          this.formId = saved.formId ?? null;
          this.builderSchema = normalizeFieldOrder(saved.fields || []);
          this.updateSavedSnapshot();
        }
      },
      error: () => {
        this.setLoadingState('restore-reload', false);
        this.setLoadingState('restore-api', false);
        this.toastr.error('Restore succeeded but failed to reload schema');
      },
    });
  }

  onDynamicOptionsLoading(loading: boolean): void {
    this.setLoadingState('dynamic-options', loading);
  }

  onVersionsLoadingChange(loading: boolean): void {
    this.setLoadingState('restore-api', loading);
  }

  updateField(updated: FormField): void {
    const index = this.builderSchema.findIndex(field => field.id === updated.id);

    if (index === -1) {
      return;
    }

    this.builderSchema[index] = sanitizeField({
      ...updated,
      isShow: updated.isShow !== false,
      isReadonly: updated.isReadonly === true,
      options: [...(updated.options || [])],
      optionSource: updated.optionSource
        ? { ...updated.optionSource }
        : undefined,
      condition: updated.condition
        ? { ...updated.condition }
        : { fieldId: '', value: '' },
    });

    this.builderSchema = normalizeFieldOrder([...this.builderSchema]);
    this.selectedFieldId = updated.id;
    this.activeTab = 'settings';
  }

  buildPayload() {
    const orderedFields = normalizeFieldOrder([...this.builderSchema]);

    return {
      schema: {
        sections: [],
        fields: orderedFields.map((field, index) => ({
          ...field,
          id: field.id,
          fieldTypeName: field.fieldTypeName || field.type,
          fieldKey: 'name',
          label: field.label,
          name: field.name || field.label,
          placeholder: field.placeholder,
          isRequired: field.required,
          isShow: field.isShow !== false,
          optionSource: field.optionSource,
          isReadonly: field.isReadonly === true,
          isSystemField: true,
          isEditable: true,
          isDeletable: false,
          layoutConfig: {
            grid_width_mobile: 12,
            grid_width_desktop: 6,
          },
          defaultValue: field.defaultValue ?? field.value ?? null,
          options: field.options || [],
          validations: field.validations || {},
          sortOrder: index + 1,
          width: field.width ?? 12,
        })),
        conditionalRules: [],
      },
      markAsDraft: false,
    };
  }

  saveForm(): void {
    if (this.moduleName !== 'users') {
      return;
    }

    this.setLoadingState('save', true);
    this.builderSchema = normalizeFieldOrder([...this.builderSchema]);

    this.formStorageService
      .saveForm('users', {
        formName: this.formName,
        formId: this.formId,
        fields: this.builderSchema,
        markAsDraft: false,
      })
      .subscribe({
        next: () => {
          this.setLoadingState('save', false);
          this.updateSavedSnapshot();
          this.toastr.success('Form saved successfully');
        },
        error: error => {
          console.error('Failed to save form schema:', error);
          this.setLoadingState('save', false);
          this.toastr.error('Failed to save form');
        },
      });
  }

  previewPayload(): void {
    console.log('Preview payload:', this.buildPayload());
  }

  private handleModuleNavigation(nextModule: string): void {
    if (!nextModule) {
      return;
    }

    if (
      this.schemaReady &&
      this.moduleName === 'users' &&
      nextModule !== this.moduleName &&
      this.hasUnsavedChanges() &&
      !this.allowModuleNavigation
    ) {
      this.pendingModule = nextModule;
      this.showExitConfirmModal = true;
      this.revertModuleRoute();
      return;
    }

    this.allowModuleNavigation = false;
    const previousModule = this.moduleName;
    this.moduleName = nextModule;

    if (nextModule === 'users' && previousModule !== nextModule) {
      this.loadSavedSchema();
    } else if (nextModule !== 'users') {
      this.schemaReady = false;
      this.savedSnapshot = '';
      this.builderSchema = [];
    }
  }

  private loadSavedSchema(): void {
    this.schemaReady = false;
    this.setLoadingState('schema', true);

    this.formStorageService.loadForm('users').subscribe({
      next: saved => {
        this.setLoadingState('schema', false);

        if (!saved) {
          this.builderSchema = [];
          this.schemaReady = true;
          this.updateSavedSnapshot();
          return;
        }

        this.formName = saved.formName || this.formName;
        this.formId = saved.formId ?? null;
        this.builderSchema = normalizeFieldOrder(saved.fields || []);
        this.schemaReady = true;
        this.updateSavedSnapshot();
      },
      error: error => {
        this.setLoadingState('schema', false);
        this.schemaReady = true;
        this.updateSavedSnapshot();
        console.error('Failed to load form schema:', error);
        this.builderSchema = [];
      },
    });
  }

  private hasUnsavedChanges(): boolean {
    if (!this.schemaReady || this.moduleName !== 'users') {
      return false;
    }

    return this.serializeSchema(this.builderSchema) !== this.savedSnapshot;
  }

  private updateSavedSnapshot(): void {
    this.savedSnapshot = this.serializeSchema(this.builderSchema);
  }

  private serializeSchema(fields: FormField[]): string {
    return JSON.stringify(this.buildPayload().schema.fields);
  }

  private revertModuleRoute(): void {
    const slug = this.getTenantSlug();

    if (!slug || !this.moduleName) {
      return;
    }

    this.router.navigate(['/tenant', slug, 'forms', this.moduleName], {
      replaceUrl: true,
    });
  }

  private getTenantSlug(): string {
    let route: ActivatedRoute | null = this.route;

    while (route) {
      const slug = route.snapshot.paramMap.get('slug');
      if (slug) {
        return slug;
      }
      route = route.parent;
    }

    return '';
  }

  private setLoadingState(key: string, active: boolean): void {
    if (active) {
      this.loadingStates.add(key);
    } else {
      this.loadingStates.delete(key);
    }
  }
}

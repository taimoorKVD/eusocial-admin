import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { FormField } from '../../form-builder/models/form-field.model';
import { normalizeFieldOrder } from '../../form-builder/utils/form-field.factory';
import {
  applyCanvasDrop,
  duplicateFormField,
  removeFormField,
  updateFormField,
} from '../../form-builder/utils/form-field-operations';
import { FormBuilderTab } from '../components/form-builder-workspace/form-builder-workspace.component';
import { FormStorageService } from '../services/form-storage.service';
import { FormsEditorCanDeactivate } from '../guards/forms-editor-can-deactivate.interface';
import {
  buildFormSchemaPayload,
  serializeSchemaFields,
} from '../utils/form-schema-payload.utils';

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
  activeTab: FormBuilderTab = 'fields';
  formName = 'Users Dynamic Form';
  formId: string | number | null = null;
  showExitConfirmModal = false;
  showPreviewModal = false;

  private readonly loadingStates = new Set<string>();
  private savedSnapshot = '';
  private schemaReady = false;
  private allowModuleNavigation = false;
  private pendingModule: string | null = null;
  private navigationResolver: ((allowed: boolean) => void) | null = null;

  get isLoading(): boolean {
    return this.loadingStates.size > 0;
  }

  readonly paletteListId = 'sidebarList';
  readonly canvasListId = 'canvasList';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formStorageService: FormStorageService,
    private toastr: ToastrService
  ) {}

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

  onCanvasDrop(event: Parameters<typeof applyCanvasDrop>[0]): void {
    const result = applyCanvasDrop(event, this.builderSchema);
    this.builderSchema = result.schema;

    if (result.insertedField) {
      this.onSelectField(result.insertedField);
    }
  }

  onSelectField(field: FormField): void {
    this.selectedFieldId = field.id;
    this.activeTab = 'settings';
  }

  onDuplicateField(field: FormField): void {
    const result = duplicateFormField(field, this.builderSchema);
    this.builderSchema = result.schema;

    if (result.duplicate) {
      this.onSelectField(result.duplicate);
    }
  }

  onDeleteField(field: FormField): void {
    this.builderSchema = removeFormField(field, this.builderSchema);

    if (
      this.selectedFieldId &&
      !this.builderSchema.some(item => item.id === this.selectedFieldId)
    ) {
      this.selectedFieldId = null;
      this.activeTab = 'fields';
    }
  }

  onActiveTabChange(tab: FormBuilderTab): void {
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
    this.builderSchema = updateFormField(updated, this.builderSchema);
    const normalizedField = this.builderSchema.find(
      field => field.id === updated.id
    );

    if (normalizedField) {
      this.selectedFieldId = normalizedField.id;
      this.activeTab = 'settings';
    }
  }

  buildPayload() {
    return buildFormSchemaPayload(this.builderSchema);
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

  openPreviewModal(): void {
    if (this.moduleName !== 'users') {
      return;
    }

    this.showPreviewModal = true;
  }

  closePreviewModal(): void {
    this.showPreviewModal = false;
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

    return serializeSchemaFields(this.builderSchema) !== this.savedSnapshot;
  }

  private updateSavedSnapshot(): void {
    this.savedSnapshot = serializeSchemaFields(this.builderSchema);
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

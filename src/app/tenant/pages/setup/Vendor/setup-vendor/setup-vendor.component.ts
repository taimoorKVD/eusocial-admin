import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { TenantVendorService } from '../../../../../services/tenant-vendor.service';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { FormField } from '../../../../form-builder/models/form-field.model';
import { normalizeFieldOrder } from '../../../../form-builder/utils/form-field.factory';
import {
  applyCanvasDrop,
  duplicateFormField,
  isFormFieldBulkDeletable,
  removeFormField,
  updateFormField,
} from '../../../../form-builder/utils/form-field-operations';
import { applyBulkFieldDelete } from '../../../../form-builder/utils/bulk-field-delete.utils';
import { FormBuilderTab } from '../../../../forms/components/form-builder-workspace/form-builder-workspace.component';
import { serializeSchemaFields } from '../../../../forms/utils/form-schema-payload.utils';
import { DynamicFormComponent } from '../../../../../shared/dynamic-form/dynamic-form.component';
import { remapDynamicFormValuesByFieldId } from '../../../../../shared/dynamic-form/dynamic-form.builder';
import {
  DynamicField,
  DynamicFormValue,
} from '../../../../../interfaces/dynamic-field';

@Component({
  selector: 'app-setup-vendor',
  standalone: false,
  templateUrl: './setup-vendor.component.html',
  styleUrl: './setup-vendor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupVendorComponent {
  private readonly toastr = inject(ToastrService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formStorageService = inject(FormStorageService);
  private readonly vendorService = inject(TenantVendorService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dynamicForm = viewChild(DynamicFormComponent);

  readonly loading = signal(false);
  readonly formFields = signal<DynamicField[]>([]);
  readonly vendorId = signal('');
  readonly latestFormValue = signal<DynamicFormValue>({});

  readonly builderVisible = signal(false);
  readonly builderLoading = signal(false);

  readonly builderSchema = signal<FormField[]>([]);
  readonly selectedFieldId = signal<string | null>(null);
  readonly activeTab = signal<FormBuilderTab>('fields');
  readonly showPreviewModal = signal(false);
  readonly showBuilderExitConfirm = signal(false);
  readonly builderVersionsLoading = signal(false);
  readonly bulkDeleteMode = signal(false);
  readonly bulkSelectedFieldIds = signal<string[]>([]);
  readonly showBulkDeleteConfirm = signal(false);

  readonly paletteListId = 'vendorSetupPaletteList';
  readonly canvasListId = 'vendorSetupCanvasList';

  private formName = 'Vendors Dynamic Form';
  private formId: string | number | null = null;
  private savedSnapshot = '';
  private schemaReady = false;

  readonly hasFormFields = computed(() => this.formFields().length > 0);
  readonly showEmptyState = computed(
    () => !this.loading() && !this.hasFormFields() && !this.builderVisible()
  );
  readonly showVendorFormLoader = computed(
    () => this.loading() && !this.builderVisible()
  );
  readonly bulkSelectedCount = computed(() => this.bulkSelectedFieldIds().length);
  readonly bulkDeleteConfirmMessage = computed(() => {
    const count = this.bulkSelectedCount();
    const noun = count === 1 ? 'field' : 'fields';
    return `Delete ${count} selected ${noun}? This action cannot be undone.`;
  });

  ngOnInit(): void {
    this.vendorId.set(this.route.snapshot.paramMap.get('id') || '');
    this.loadFormFields();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.builderVisible() && this.hasBuilderUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  onDynamicFormChange(value: DynamicFormValue): void {
    this.latestFormValue.set(value);
  }

  onFormSubmit(): void {
    const form = this.dynamicForm();
    if (!form) {
      return;
    }

    if (!form.validate()) {
      this.toastr.error('Please fill in all required fields.');
      return;
    }

    const formValues = this.mapFormValuesToFieldIds(form.value);
    const id = this.vendorId();

    if (id) {
      this.vendorService
        .updateVendor(Number(id), formValues)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.toastr.success('Vendor updated successfully');
            this.router.navigate(['/vendors']);
          },
          error: (err) => {
            this.toastr.error(err?.error?.message || 'Failed to update vendor');
          },
        });
      return;
    }

    this.vendorService
      .createVendor(formValues)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('Vendor created successfully');
          this.router.navigate(['/vendors']);
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to create vendor');
        },
      });
  }

  onEditForm(): void {
    if (this.builderVisible() || this.builderLoading()) {
      return;
    }

    this.builderLoading.set(true);
    this.resetBuilderState();

    this.formStorageService
      .loadForm('vendors')
      .pipe(
        finalize(() => this.builderLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: saved => {
          if (saved) {
            this.formName = saved.formName || this.formName;
            this.formId = saved.formId ?? null;
            this.builderSchema.set(normalizeFieldOrder(saved.fields || []));
          } else {
            this.builderSchema.set([]);
          }

          this.schemaReady = true;
          this.updateBuilderSnapshot();
          this.builderVisible.set(true);
        },
        error: () => {
          this.toastr.error('Failed to load form configuration');
          this.builderSchema.set([]);
          this.schemaReady = true;
          this.updateBuilderSnapshot();
        },
      });
  }

  onCloseBuilder(): void {
    if (this.hasBuilderUnsavedChanges()) {
      this.showBuilderExitConfirm.set(true);
      return;
    }

    this.closeBuilder();
  }

  onConfirmBuilderExit(): void {
    this.showBuilderExitConfirm.set(false);
    this.closeBuilder();
  }

  onCancelBuilderExit(): void {
    this.showBuilderExitConfirm.set(false);
  }

  onCanvasDrop(event: Parameters<typeof applyCanvasDrop>[0]): void {
    if (this.bulkDeleteMode()) {
      return;
    }

    const result = applyCanvasDrop(event, this.builderSchema());
    this.builderSchema.set(result.schema);

    if (result.insertedField) {
      this.onSelectField(result.insertedField);
    }
  }

  onSelectField(field: FormField): void {
    if (this.bulkDeleteMode()) {
      return;
    }

    this.selectedFieldId.set(field.id);
    this.activeTab.set('settings');
  }

  enterBulkDeleteMode(): void {
    this.bulkDeleteMode.set(true);
    this.bulkSelectedFieldIds.set([]);
    this.showBulkDeleteConfirm.set(false);
    this.selectedFieldId.set(null);
    this.activeTab.set('fields');
  }

  cancelBulkDeleteMode(): void {
    this.bulkDeleteMode.set(false);
    this.bulkSelectedFieldIds.set([]);
    this.showBulkDeleteConfirm.set(false);
  }

  onToggleBulkFieldSelection(field: FormField): void {
    if (!this.bulkDeleteMode() || !isFormFieldBulkDeletable(field)) {
      return;
    }

    const current = this.bulkSelectedFieldIds();
    if (current.includes(field.id)) {
      this.bulkSelectedFieldIds.set(current.filter(id => id !== field.id));
      return;
    }

    this.bulkSelectedFieldIds.set([...current, field.id]);
  }

  requestBulkDelete(): void {
    if (!this.bulkDeleteMode() || this.bulkSelectedCount() === 0) {
      return;
    }

    this.showBulkDeleteConfirm.set(true);
  }

  onConfirmBulkDelete(): void {
    const selectedIds = this.bulkSelectedFieldIds();
    if (selectedIds.length === 0) {
      this.showBulkDeleteConfirm.set(false);
      return;
    }

    const result = applyBulkFieldDelete(selectedIds, this.builderSchema());
    this.showBulkDeleteConfirm.set(false);

    if (result.blockReason) {
      this.toastr.warning(result.blockReason);
      return;
    }

    if (result.deletedCount === 0) {
      return;
    }

    this.builderSchema.set(result.schema);

    const selectedId = this.selectedFieldId();
    if (selectedId && !result.schema.some(item => item.id === selectedId)) {
      this.selectedFieldId.set(null);
    }

    this.cancelBulkDeleteMode();
  }

  onCancelBulkDeleteConfirm(): void {
    this.showBulkDeleteConfirm.set(false);
  }

  onDuplicateField(field: FormField): void {
    if (this.bulkDeleteMode()) {
      return;
    }

    const result = duplicateFormField(field, this.builderSchema());
    this.builderSchema.set(result.schema);

    if (result.duplicate) {
      this.onSelectField(result.duplicate);
    }
  }

  onDeleteField(field: FormField): void {
    if (this.bulkDeleteMode()) {
      return;
    }

    const nextSchema = removeFormField(field, this.builderSchema());
    this.builderSchema.set(nextSchema);

    const selectedId = this.selectedFieldId();
    if (selectedId && !nextSchema.some(item => item.id === selectedId)) {
      this.selectedFieldId.set(null);
      this.activeTab.set('fields');
    }
  }

  onActiveTabChange(tab: FormBuilderTab): void {
    if (this.bulkDeleteMode() && tab === 'settings') {
      return;
    }

    this.activeTab.set(tab);
  }

  onRestoreVersion(_fields: FormField[]): void {
    this.selectedFieldId.set(null);
    this.activeTab.set('fields');
    this.builderLoading.set(true);

    this.formStorageService
      .loadForm('vendors')
      .pipe(
        finalize(() => this.builderLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: saved => {
          if (saved) {
            this.formName = saved.formName || this.formName;
            this.formId = saved.formId ?? null;
            this.builderSchema.set(normalizeFieldOrder(saved.fields || []));
            this.updateBuilderSnapshot();
          }
        },
        error: () => {
          this.toastr.error('Restore succeeded but failed to reload schema');
        },
      });
  }

  onDynamicOptionsLoading(_loading: boolean): void {
    // Reserved for future loading indicators inside the inline builder.
  }

  onVersionsLoadingChange(loading: boolean): void {
    this.builderVersionsLoading.set(loading);
  }

  updateField(updated: FormField): void {
    if (this.bulkDeleteMode()) {
      return;
    }

    const nextSchema = updateFormField(updated, this.builderSchema());
    this.builderSchema.set(nextSchema);

    const normalizedField = nextSchema.find(field => field.id === updated.id);
    if (normalizedField) {
      this.selectedFieldId.set(normalizedField.id);
      this.activeTab.set('settings');
    }
  }

  saveBuilderForm(): void {
    if (this.bulkDeleteMode()) {
      return;
    }

    const orderedSchema = normalizeFieldOrder([...this.builderSchema()]);
    this.builderSchema.set(orderedSchema);
    this.builderLoading.set(true);
    this.formStorageService
      .saveForm('vendors', {
        formName: this.formName,
        formId: this.formId,
        fields: orderedSchema,
        markAsDraft: false,
      })
      .pipe(
        finalize(() => this.builderLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.updateBuilderSnapshot();
          this.toastr.success('Form saved successfully');
          this.closeBuilder();
          this.loadFormFields();
        },
        error: (error) => {
          this.toastr.error(error.error?.message || 'Failed to save form configuration');
        },
      });
  }

  openPreviewModal(): void {
    this.showPreviewModal.set(true);
  }

  closePreviewModal(): void {
    this.showPreviewModal.set(false);
  }

  private closeBuilder(): void {
    this.builderVisible.set(false);
    this.resetBuilderState();
  }

  private resetBuilderState(): void {
    this.builderSchema.set([]);
    this.selectedFieldId.set(null);
    this.activeTab.set('fields');
    this.showPreviewModal.set(false);
    this.savedSnapshot = '';
    this.schemaReady = false;
    this.cancelBulkDeleteMode();
  }

  private hasBuilderUnsavedChanges(): boolean {
    if (!this.schemaReady) {
      return false;
    }

    return serializeSchemaFields(this.builderSchema()) !== this.savedSnapshot;
  }

  private updateBuilderSnapshot(): void {
    this.savedSnapshot = serializeSchemaFields(this.builderSchema());
  }

  private loadFormFields(): void {
    this.loading.set(true);

    this.formStorageService
      .loadForm('vendors')
      .pipe(
        switchMap((res) => {
          if (!res) {
            return of([] as DynamicField[]);
          }

          const fields = normalizeFieldOrder(res.fields || []) as DynamicField[];

          const dropdownRequests = fields
            .filter(
              (field) =>
                field.type === 'select' &&
                field.optionSource?.type === 'api' ||
                (field.optionSource?.type === 'dynamic' && field.optionSource?.endpoint),
            )
            .map((field) =>
              this.formStorageService.getEndpointApi<Record<string, unknown>>(
                field.optionSource!.endpoint!,
              ).pipe(
                map((response) => ({ field, response })),
                catchError(() => of({ field, response: null })),
              ),
            );

          if (!dropdownRequests.length) {
            return of(fields);
          }

          return forkJoin(dropdownRequests).pipe(
            map((results) => {
              results.forEach(({ field, response }) => {
                if (!response) {
                  return;
                }
                this.applyApiOptionsToField(field, response);
              });
              return fields;
            }),
          );
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (fields) => {
          const previousFields = this.formFields();
          const preservedValues = this.latestFormValue();
          this.formFields.set(fields);

          const remappedValues = remapDynamicFormValuesByFieldId(
            preservedValues,
            previousFields,
            fields,
          );

          if (Object.keys(remappedValues).length) {
            setTimeout(() => this.dynamicForm()?.patchValue(remappedValues));
          }

          if (this.vendorId()) {
            this.loadVendor();
          }
        },
        error: () => {
          this.formFields.set([]);
        },
      });
  }

  private loadVendor(): void {
    this.vendorService
      .getVendorById(Number(this.vendorId()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: { data: Record<string, unknown> }) => {
          const vendor = { ...res.data };
          const patchData = this.buildVendorPatchData(vendor, this.formFields());

          setTimeout(() => {
            this.dynamicForm()?.patchValue(patchData);
          });
        },
      });
  }

  private buildVendorPatchData(
    vendor: Record<string, unknown>,
    fields: DynamicField[],
  ): DynamicFormValue {
    const patchData: DynamicFormValue = {};

    for (const field of fields) {
      const value = this.resolveFieldValue(vendor, field);

      if (field.type === 'checkbox') {
        if (Array.isArray(value)) {
          patchData[field.name] = value;
        } else if (value) {
          patchData[field.name] = [value];
        } else {
          patchData[field.name] = [];
        }
        continue;
      }

      if (field.type === 'select') {
        const normalized = this.normalizeMultiSelectPatchValue(value);

        // Single-select UI still uses a scalar control value.
        patchData[field.name] =
          field.selectionType === 'multi'
            ? normalized
            : normalized.length
              ? normalized[0]
              : '';
        continue;
      }

      patchData[field.name] = value;
    }

    return patchData;
  }

  private getFieldKey(field: DynamicField): string {
    return field.id || field.name;
  }

  private normalizeMultiSelectPatchValue(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value.map((item) =>
        item != null && typeof item === 'object'
          ? (item as { id: unknown }).id
          : item,
      );
    }

    if (value == null || value === '') {
      return [];
    }

    if (typeof value === 'object') {
      return [(value as { id: unknown }).id];
    }

    return [value];
  }

  private resolveFieldValue(
    record: Record<string, unknown>,
    field: DynamicField,
  ): unknown {
    const key = this.getFieldKey(field);
    const value = record[key];
    return value === undefined ? record[field.name] : value;
  }

  private mapFormValuesToFieldIds(values: DynamicFormValue): DynamicFormValue {
    const payload: DynamicFormValue = { ...values };

    for (const field of this.formFields()) {
      const key = this.getFieldKey(field);
      const hasNameValue = Object.prototype.hasOwnProperty.call(values, field.name);
      const rawValue = hasNameValue ? values[field.name] : payload[key];

      if (field.type === 'select') {
        const arrayValue = this.normalizeSelectPayloadValue(rawValue);
        payload[key] = arrayValue;
        if (key !== field.name) {
          delete payload[field.name];
        }
        continue;
      }

      if (key === field.name) {
        continue;
      }

      if (hasNameValue) {
        payload[key] = values[field.name];
        delete payload[field.name];
      }
    }

    return payload;
  }

  /** Always persist select values as arrays for single and multi selection. */
  private normalizeSelectPayloadValue(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value.filter((item) => item !== '' && item != null);
    }

    if (value == null || value === '') {
      return [];
    }

    if (typeof value === 'object') {
      return [(value as { id: unknown }).id];
    }

    return [value];
  }

  private applyApiOptionsToField(
    field: DynamicField,
    response: Record<string, unknown>,
  ): void {
    const dataPath = field.optionSource?.response?.dataPath ?? 'data';
    const labelKey = field.optionSource?.response?.labelKey ?? 'label';
    const valueKey = field.optionSource?.response?.valueKey ?? 'value';
    const data = (response[dataPath] as Record<string, unknown>[]) || [];

    field.options = data.map((item) => ({
      label: item[labelKey],
      value: item[valueKey],
    })) as DynamicField['options'];
  }

  readonly showConfirmModal = signal(false);
  confirmModalTitle = '';
  confirmModalDescription = '';

  private pendingAction: 'delete' | 'cancel' | null = null;

  onFormDelete() {
    this.pendingAction = 'delete';

    this.confirmModalTitle = 'Delete Vendor';
    this.confirmModalDescription =
      'Are you sure you want to delete this vendor?';

    this.showConfirmModal.set(true);
  }

  onFormCancel() {
    this.pendingAction = 'cancel';

    this.confirmModalTitle = 'Discard Changes';
    this.confirmModalDescription =
      'Are you sure you want to leave this page? Any unsaved changes will be lost.';

    this.showConfirmModal.set(true);
  }

  onConfirmed() {
    this.showConfirmModal.set(false);

    switch (this.pendingAction) {
      case 'delete':
        this.deleteVendor();
        break;

      case 'cancel':
        this.router.navigate(['/vendors']);
        break;
    }

    this.pendingAction = null;
  }

  onClosed() {
    this.showConfirmModal.set(false);
    this.pendingAction = null;
  }

  private deleteVendor() {
    const id = this.vendorId();

    if (!id) return;

    this.vendorService
      .deleteVendor(Number(id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('Vendor deleted successfully');
          this.router.navigate(['/vendors']);
        },
        error: (err) => {
          this.toastr.error(
            err?.error?.message || 'Failed to delete vendor'
          );
        },
      });
  }

  goToVendorListing(): void {
    this.router.navigate(['/vendors']);
  }
}

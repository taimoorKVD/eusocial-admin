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
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { FormField } from '../../../../form-builder/models/form-field.model';
import { normalizeFieldOrder } from '../../../../form-builder/utils/form-field.factory';
import {
  applyCanvasDrop,
  duplicateFormField,
  removeFormField,
  updateFormField,
} from '../../../../form-builder/utils/form-field-operations';
import { FormBuilderTab } from '../../../../forms/components/form-builder-workspace/form-builder-workspace.component';
import { serializeSchemaFields } from '../../../../forms/utils/form-schema-payload.utils';
import { DynamicFormComponent } from '../../../../../shared/dynamic-form/dynamic-form.component';
import { remapDynamicFormValuesByFieldId } from '../../../../../shared/dynamic-form/dynamic-form.builder';
import {
  DynamicField,
  DynamicFormValue,
} from '../../../../../interfaces/dynamic-field';

@Component({
  selector: 'app-setup-user',
  standalone: false,
  templateUrl: './setup-user.component.html',
  styleUrl: './setup-user.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupUserComponent {
  private readonly toastr = inject(ToastrService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantSession = inject(TenantSessionService);
  private readonly formStorageService = inject(FormStorageService);
  private readonly userService = inject(TenantUserService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dynamicForm = viewChild(DynamicFormComponent);

  readonly loading = signal(false);
  readonly formFields = signal<DynamicField[]>([]);
  readonly userId = signal('');
  readonly latestFormValue = signal<DynamicFormValue>({});

  readonly builderVisible = signal(false);
  readonly builderLoading = signal(false);

  readonly builderSchema = signal<FormField[]>([]);
  readonly selectedFieldId = signal<string | null>(null);
  readonly activeTab = signal<FormBuilderTab>('fields');
  readonly showPreviewModal = signal(false);
  readonly showBuilderExitConfirm = signal(false);
  readonly builderVersionsLoading = signal(false);

  readonly paletteListId = 'userSetupPaletteList';
  readonly canvasListId = 'userSetupCanvasList';

  private formName = 'Users Dynamic Form';
  private formId: string | number | null = null;
  private savedSnapshot = '';
  private schemaReady = false;

  readonly hasFormFields = computed(() => this.formFields().length > 0);
  readonly showEmptyState = computed(
    () => !this.loading() && !this.hasFormFields() && !this.builderVisible()
  );
  readonly showUserFormLoader = computed(
    () => this.loading() && !this.builderVisible()
  );

  ngOnInit(): void {
    this.userId.set(this.route.snapshot.paramMap.get('id') || '');
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
    const id = this.userId();

    if (id) {
      this.userService
        .updateUser(Number(id), formValues)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.toastr.success('User updated successfully');
            this.router.navigate(['/tenant', this.tenantSession.getSlug(), 'users']);
          },
          error: (err) => {
            this.toastr.error(err?.error?.message || 'Failed to update user');
          },
        });
      return;
    }

    this.userService
      .createUser(formValues)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('User created successfully');
          this.router.navigate(['/tenant', this.tenantSession.getSlug(), 'users']);
        },
        error: (err) => {
          console.error('Create user error:', err);
          this.toastr.error(err?.error?.message || 'Failed to create user');
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
      .loadForm('users')
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
        error: error => {
          console.error('Failed to load form schema:', error);
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
    const result = applyCanvasDrop(event, this.builderSchema());
    this.builderSchema.set(result.schema);

    if (result.insertedField) {
      this.onSelectField(result.insertedField);
    }
  }

  onSelectField(field: FormField): void {
    this.selectedFieldId.set(field.id);
    this.activeTab.set('settings');
  }

  onDuplicateField(field: FormField): void {
    const result = duplicateFormField(field, this.builderSchema());
    this.builderSchema.set(result.schema);

    if (result.duplicate) {
      this.onSelectField(result.duplicate);
    }
  }

  onDeleteField(field: FormField): void {
    const nextSchema = removeFormField(field, this.builderSchema());
    this.builderSchema.set(nextSchema);

    const selectedId = this.selectedFieldId();
    if (selectedId && !nextSchema.some(item => item.id === selectedId)) {
      this.selectedFieldId.set(null);
      this.activeTab.set('fields');
    }
  }

  onActiveTabChange(tab: FormBuilderTab): void {
    this.activeTab.set(tab);
  }

  onRestoreVersion(_fields: FormField[]): void {
    this.selectedFieldId.set(null);
    this.activeTab.set('fields');
    this.builderLoading.set(true);

    this.formStorageService
      .loadForm('users')
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
    const nextSchema = updateFormField(updated, this.builderSchema());
    this.builderSchema.set(nextSchema);

    const normalizedField = nextSchema.find(field => field.id === updated.id);
    if (normalizedField) {
      this.selectedFieldId.set(normalizedField.id);
      this.activeTab.set('settings');
    }
  }

  saveBuilderForm(): void {
    const orderedSchema = normalizeFieldOrder([...this.builderSchema()]);
    this.builderSchema.set(orderedSchema);
    const hasRequiredField = orderedSchema.some(field => field.required);
    // if (!hasRequiredField) {
    //   this.toastr.error('Please mark at least one field as required.');
    //   return;
    // }
    this.builderLoading.set(true);
      this.formStorageService
      .saveForm('users', {
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
        error: error => {
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
      .loadForm('users')
      .pipe(
        switchMap((res) => {
          if (!res) {
            return of([] as DynamicField[]);
          }

          const fields = normalizeFieldOrder(
            res.fields.filter((field) => field.label !== 'Role') || [],
          ) as DynamicField[];

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

          if (this.userId()) {
            this.loadUser();
          }
        },
        error: () => {
          this.formFields.set([]);
        },
      });
  }

  private loadUser(): void {
    this.userService
      .getUserById(Number(this.userId()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: { data: Record<string, unknown> }) => {
          const user = { ...res.data };

          if (user['plain_password']) {
            user['password'] = user['plain_password'];
          }

          const patchData = this.buildUserPatchData(user, this.formFields());

          setTimeout(() => {
            this.dynamicForm()?.patchValue(patchData);
          });
        },
      });
  }

  private buildUserPatchData(
    user: Record<string, unknown>,
    fields: DynamicField[],
  ): DynamicFormValue {
    const patchData: DynamicFormValue = {};

    for (const field of fields) {
      const value = this.resolveFieldValue(user, field);

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
        patchData[field.name] =
          value == null
            ? ''
            : typeof value === 'object'
              ? (value as { id: unknown }).id
              : value;
        continue;
      }

      patchData[field.name] = value;
    }

    return patchData;
  }

  private getFieldKey(field: DynamicField): string {
    return field.id || field.name;
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
      if (key === field.name) {
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(values, field.name)) {
        payload[key] = values[field.name];
        delete payload[field.name];
      }
    }

    return payload;
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

    this.confirmModalTitle = 'Delete User';
    this.confirmModalDescription =
      'Are you sure you want to delete this user?';

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
        this.deleteUser();
        break;

      case 'cancel':
        this.router.navigate([
          '/tenant',
          this.tenantSession.getSlug(),
          'users',
        ]);
        break;
    }

    this.pendingAction = null;
  }

  onClosed() {
    this.showConfirmModal.set(false);
    this.pendingAction = null;
  }

  private deleteUser() {
    const id = this.userId();

    if (!id) return;

    this.userService
      .deleteUser(Number(id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('User deleted successfully');
          this.router.navigate([
            '/tenant',
            this.tenantSession.getSlug(),
            'users',
          ]);
        },
        error: (err) => {
          this.toastr.error(
            err?.error?.message || 'Failed to delete user'
          );
        },
      });
  }

  goToUserListing(): void {
    this.router.navigate(['/tenant', this.tenantSession.getSlug(), 'users']);
  }

}

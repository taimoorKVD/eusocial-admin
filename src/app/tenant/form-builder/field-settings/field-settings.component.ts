import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormField, FieldOption } from '../models/form-field.model';
import { toFieldName } from '../utils/form-field.factory';
import { normalizeFieldOption } from '../utils/field-options.utils';
import { DynamicModuleOptionsService } from '../services/dynamic-module-options.service';
import { FormModuleListItem } from '../../forms/models/form-module.model';

type SelectOptionsMode = 'static' | 'dynamic';

@Component({
  selector: 'app-field-settings',
  standalone: false,
  templateUrl: './field-settings.component.html',
  styleUrl: './field-settings.component.scss',
})
export class FieldSettingsComponent {
  @Input() activeModuleName = '';

  @Input() set field(value: FormField | undefined) {
    if (value) {
      this._field = {
        ...value,
        name: value.name || toFieldName(value.label),
        defaultValue: value.defaultValue ?? value.value ?? '',
        width: value.width ?? 12,
        validations: value.validations || {},
        condition: value.condition || { fieldId: '', value: '' },
        options: [...(value.options || [])],
        optionSource: value.optionSource ? { ...value.optionSource } : undefined,
        isShow: value.isShow !== false,
        isReadonly: value.isReadonly === true,
      };

      this.initializeSelectOptionsState(this._field);
    }
  }

  get field(): FormField | undefined {
    return this._field;
  }

  private _field!: FormField;

  optionsMode: SelectOptionsMode = 'static';
  availableModules: FormModuleListItem[] = [];
  selectedModuleSlug = '';
  recordFieldKeys: string[] = [];
  selectedLabelField = '';
  moduleRecords: Record<string, unknown>[] = [];

  modulesLoading = false;
  modulesError: string | null = null;
  recordsLoading = false;
  recordsError: string | null = null;

  @Output() update = new EventEmitter<FormField>();
  @Output() duplicate = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  constructor(private dynamicModuleOptionsService: DynamicModuleOptionsService) {}

  onChange(): void {
    if (!this._field) {
      return;
    }

    this.update.emit({
      ...this._field,
      isShow: this._field.isShow !== false,
      isReadonly: this._field.isReadonly === true,
      options: [...(this._field.options || [])],
      optionSource:
        this.optionsMode === 'dynamic'
          ? undefined
          : this._field.optionSource
            ? { ...this._field.optionSource }
            : undefined,
      condition: this._field.condition
        ? { ...this._field.condition }
        : { fieldId: '', value: '' },
    });
  }

  onShowChange(show: boolean): void {
    if (!this._field) {
      return;
    }

    this._field.isShow = show;
    this.onChange();
  }

  get isFieldHidden(): boolean {
    return this._field?.isShow === false;
  }

  get isLegacyApiSelect(): boolean {
    return (
      this._field?.type === 'select' && this._field.optionSource?.type === 'api'
    );
  }

  get isSelectField(): boolean {
    return this._field?.type === 'select';
  }

  get dynamicOptionsCount(): number {
    return this.optionsMode === 'dynamic' ? this._field?.options?.length ?? 0 : 0;
  }

  setOptionsMode(mode: SelectOptionsMode): void {
    this.optionsMode = mode;

    if (mode === 'dynamic') {
      this._field.optionSource = undefined;
      this.loadAvailableModules();
      return;
    }

    this.onChange();
  }

  onModuleChange(moduleSlug: string): void {
    this.selectedModuleSlug = moduleSlug;
    this.selectedLabelField = '';
    this.recordFieldKeys = [];
    this.moduleRecords = [];

    if (!moduleSlug) {
      return;
    }

    this.recordsLoading = true;
    this.recordsError = null;

    this.dynamicModuleOptionsService.getModuleRecords(moduleSlug).subscribe({
      next: records => {
        this.moduleRecords = records;
        this.recordFieldKeys =
          this.dynamicModuleOptionsService.extractDisplayFieldKeys(records);
        this.recordsLoading = false;

        if (!records.length) {
          this.recordsError = 'No records found for this module.';
        }
      },
      error: () => {
        this.moduleRecords = [];
        this.recordFieldKeys = [];
        this.recordsLoading = false;
        this.recordsError = 'Failed to load module records.';
      },
    });
  }

  onLabelFieldChange(labelField: string): void {
    this.selectedLabelField = labelField;

    if (!labelField) {
      return;
    }

    this.applyDynamicOptions();
  }

  getModuleSlug(form: FormModuleListItem): string {
    return this.dynamicModuleOptionsService.getModuleSlug(form);
  }

  getModuleLabel(form: FormModuleListItem): string {
    return this.dynamicModuleOptionsService.getModuleLabel(form);
  }

  updateOptions(event: Event): void {
    if (!this._field) {
      return;
    }

    const value = (event.target as HTMLTextAreaElement).value;

    this._field.options = value
      .split('\n')
      .map(v => v.trim())
      .filter(v => v);

    this._field.optionSource = undefined;
    this.onChange();
  }

  get optionsText(): string {
    return (this._field?.options || [])
      .map(option => {
        if (typeof option === 'string') {
          return option;
        }

        return normalizeFieldOption(option)?.label ?? '';
      })
      .filter(Boolean)
      .join('\n');
  }

  onDuplicateClick(): void {
    this.duplicate.emit();
  }

  onDeleteClick(): void {
    if (!confirm('Remove this field from the form?')) {
      return;
    }

    this.delete.emit();
  }

  private initializeSelectOptionsState(field: FormField): void {
    this.optionsMode = this.resolveOptionsMode(field);
    this.selectedModuleSlug = '';
    this.selectedLabelField = '';
    this.recordFieldKeys = [];
    this.moduleRecords = [];
    this.recordsError = null;

    if (this.optionsMode === 'dynamic') {
      this.loadAvailableModules();
    }
  }

  private resolveOptionsMode(field: FormField): SelectOptionsMode {
    if (field.optionSource?.type === 'api') {
      return 'static';
    }

    const options = field.options || [];

    if (
      options.length > 0 &&
      options.every(option => typeof option === 'object' && option !== null)
    ) {
      return 'dynamic';
    }

    return 'static';
  }

  private loadAvailableModules(): void {
    this.modulesLoading = true;
    this.modulesError = null;

    this.dynamicModuleOptionsService
      .getAvailableModules(this.activeModuleName)
      .subscribe({
        next: modules => {
          this.availableModules = modules;
          this.modulesLoading = false;
        },
        error: () => {
          this.availableModules = [];
          this.modulesLoading = false;
          this.modulesError = 'Failed to load form modules.';
        },
      });
  }

  private applyDynamicOptions(): void {
    if (!this._field || !this.selectedLabelField) {
      return;
    }

    const options: FieldOption[] =
      this.dynamicModuleOptionsService.buildOptionsFromRecords(
        this.moduleRecords,
        this.selectedLabelField
      );

    this._field.options = options;
    this._field.optionSource = undefined;
    this.onChange();
  }
}

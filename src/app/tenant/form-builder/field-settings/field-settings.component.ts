import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormField, OptionSource } from '../models/form-field.model';
import { toFieldName } from '../utils/form-field.factory';
import { normalizeFieldOption } from '../utils/field-options.utils';
import { DynamicModuleOptionsService } from '../services/dynamic-module-options.service';
import { FormModuleListItem } from '../../forms/models/form-module.model';

type SelectOptionsMode = 'static' | 'dynamic';

interface ModuleDataCache {
  records: Record<string, unknown>[];
  columns: string[];
}

interface LoadModuleDataOptions {
  preserveDisplayColumn?: boolean;
  emitUpdate?: boolean;
}

@Component({
  selector: 'app-field-settings',
  standalone: false,
  templateUrl: './field-settings.component.html',
  styleUrl: './field-settings.component.scss',
})
export class FieldSettingsComponent {
  @Input() activeModuleName = '';

  @Input() set field(value: FormField | undefined) {
    if (!value) {
      return;
    }

    const isSameField = this._field?.id === value.id;

    if (this.skipFieldReinitialize && isSameField) {
      this.skipFieldReinitialize = false;
      this.assignField(value);
      return;
    }

    const preservedModuleSlug = isSameField ? this.selectedModuleSlug : '';
    const preservedDisplayColumn = isSameField ? this.selectedDisplayColumn : '';

    this.assignField(value);
    this.initializeSelectOptionsState(
      this._field,
      preservedModuleSlug,
      preservedDisplayColumn
    );
  }

  get field(): FormField | undefined {
    return this._field;
  }

  private _field!: FormField;
  private skipFieldReinitialize = false;
  private modulesLoaded = false;
  private modulesLoadPending = false;
  private modulesLoadCallbacks: Array<() => void> = [];
  private loadingModuleSlug: string | null = null;
  private readonly moduleDataBySlug = new Map<string, ModuleDataCache>();

  optionsMode: SelectOptionsMode = 'static';
  availableModules: FormModuleListItem[] = [];
  selectedModuleSlug = '';
  selectedDisplayColumn = '';
  moduleRecords: Record<string, unknown>[] = [];
  moduleColumns: string[] = [];

  modulesLoading = false;
  modulesError: string | null = null;
  recordsLoading = false;

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
      optionSource: this.resolveEmittedOptionSource(),
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
      this.selectedModuleSlug = '';
      this.selectedDisplayColumn = '';
      this.moduleRecords = [];
      this.moduleColumns = [];
      this._field.optionSource = undefined;
      this.ensureModulesLoaded();
      return;
    }

    this.onChange();
  }

  onModuleChange(moduleSlug: string): void {
    if (!moduleSlug) {
      this.selectedModuleSlug = '';
      this.selectedDisplayColumn = '';
      this.moduleRecords = [];
      this.moduleColumns = [];
      this._field.options = [];
      this._field.optionSource = undefined;
      this.onChange();
      return;
    }

    this.selectedModuleSlug = moduleSlug;
    this.selectedDisplayColumn = '';
    this.moduleRecords = [];
    this.moduleColumns = [];

    this.loadModuleData(moduleSlug, {
      preserveDisplayColumn: false,
      emitUpdate: true,
    });
  }

  onDisplayColumnChange(column: string): void {
    this.selectedDisplayColumn = column;

    if (!column) {
      this._field.options = [];
      this._field.optionSource = undefined;
      this.onChange();
      return;
    }

    this.commitDynamicOptions();
  }

  getModuleSlug(form: FormModuleListItem): string {
    return this.dynamicModuleOptionsService.getModuleSlug(form);
  }

  getModuleLabel(form: FormModuleListItem): string {
    return this.dynamicModuleOptionsService.getModuleLabel(form);
  }

  getModuleLabelBySlug(moduleSlug: string): string {
    const module = this.availableModules.find(
      item => this.getModuleSlug(item) === moduleSlug
    );

    return module ? this.getModuleLabel(module) : moduleSlug;
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

  private assignField(value: FormField): void {
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
  }

  private initializeSelectOptionsState(
    field: FormField,
    preservedModuleSlug = '',
    preservedDisplayColumn = ''
  ): void {
    const dynamicConfig = this.readDynamicConfig(field);

    this.optionsMode = this.resolveOptionsMode(field);

    if (preservedModuleSlug) {
      this.selectedModuleSlug = preservedModuleSlug;
      this.selectedDisplayColumn =
        preservedDisplayColumn || dynamicConfig?.displayColumn || '';
    } else if (dynamicConfig) {
      this.selectedModuleSlug = dynamicConfig.moduleSlug;
      this.selectedDisplayColumn = dynamicConfig.displayColumn;
    } else {
      this.selectedModuleSlug = '';
      this.selectedDisplayColumn = '';
    }

    this.restoreModuleDataFromCache();

    if (this.optionsMode === 'dynamic') {
      this.ensureModulesLoaded(() => {
        if (this.selectedModuleSlug) {
          this.loadModuleData(this.selectedModuleSlug, {
            preserveDisplayColumn: true,
            emitUpdate: false,
          });
        }
      });
    }
  }

  private restoreModuleDataFromCache(): void {
    if (!this.selectedModuleSlug) {
      this.moduleRecords = [];
      this.moduleColumns = [];
      return;
    }

    const cached = this.moduleDataBySlug.get(this.selectedModuleSlug);

    if (cached) {
      this.moduleRecords = cached.records;
      this.moduleColumns = cached.columns;
      return;
    }

    this.moduleRecords = [];
    this.moduleColumns = [];
  }

  private resolveOptionsMode(field: FormField): SelectOptionsMode {
    if (field.optionSource?.type === 'api') {
      return 'static';
    }

    if (field.optionSource?.type === 'dynamic') {
      return 'dynamic';
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

  private ensureModulesLoaded(onLoaded?: () => void): void {
    if (this.modulesLoaded) {
      onLoaded?.();
      return;
    }

    if (onLoaded) {
      this.modulesLoadCallbacks.push(onLoaded);
    }

    if (this.modulesLoadPending) {
      return;
    }

    this.modulesLoadPending = true;
    this.modulesLoading = true;
    this.modulesError = null;

    this.dynamicModuleOptionsService
      .getAvailableModules(this.activeModuleName)
      .subscribe({
        next: modules => {
          this.availableModules = modules;
          this.modulesLoaded = true;
          this.modulesLoading = false;
          this.modulesLoadPending = false;
          this.flushModulesLoadCallbacks();
        },
        error: () => {
          this.availableModules = [];
          this.modulesLoaded = false;
          this.modulesLoading = false;
          this.modulesLoadPending = false;
          this.modulesError = 'Failed to load form modules.';
          this.flushModulesLoadCallbacks();
        },
      });
  }

  private flushModulesLoadCallbacks(): void {
    const callbacks = [...this.modulesLoadCallbacks];
    this.modulesLoadCallbacks = [];
    callbacks.forEach(callback => callback());
  }

  private loadModuleData(
    moduleSlug: string,
    options: LoadModuleDataOptions = {}
  ): void {
    const { preserveDisplayColumn = false, emitUpdate = true } = options;

    const cached = this.moduleDataBySlug.get(moduleSlug);

    if (cached) {
      this.recordsLoading = false;
      this.applyLoadedModuleData(cached, preserveDisplayColumn, emitUpdate);
      return;
    }

    if (this.loadingModuleSlug === moduleSlug) {
      return;
    }

    this.loadingModuleSlug = moduleSlug;
    this.recordsLoading = true;

    this.dynamicModuleOptionsService.getModuleData(moduleSlug).subscribe({
      next: moduleData => {
        this.recordsLoading = false;
        this.loadingModuleSlug = null;
        this.moduleDataBySlug.set(moduleSlug, moduleData);
        this.applyLoadedModuleData(moduleData, preserveDisplayColumn, emitUpdate);
      },
      error: () => {
        this.recordsLoading = false;
        this.loadingModuleSlug = null;
      },
    });
  }

  private applyLoadedModuleData(
    data: ModuleDataCache,
    preserveDisplayColumn: boolean,
    emitUpdate: boolean
  ): void {
    this.moduleRecords = data.records;
    this.moduleColumns = data.columns;

    if (
      !preserveDisplayColumn ||
      !this.selectedDisplayColumn ||
      !this.moduleColumns.includes(this.selectedDisplayColumn)
    ) {
      this.selectedDisplayColumn =
        this.dynamicModuleOptionsService.getDefaultDisplayColumn(
          this.moduleColumns
        );
    }

    if (emitUpdate && this.selectedDisplayColumn) {
      this.commitDynamicOptions();
    }
  }

  private commitDynamicOptions(): void {
    if (!this._field || !this.selectedModuleSlug || !this.selectedDisplayColumn) {
      return;
    }

    this._field.options = this.moduleRecords.length
      ? this.dynamicModuleOptionsService.buildOptionsFromRecords(
          this.moduleRecords,
          this.selectedDisplayColumn
        )
      : [];
    this._field.optionSource = this.buildDynamicOptionSource();
    this.skipFieldReinitialize = true;
    this.onChange();
  }

  private resolveEmittedOptionSource(): OptionSource | undefined {
    if (this.optionsMode === 'dynamic') {
      return this.buildDynamicOptionSource();
    }

    if (this._field.optionSource?.type === 'api') {
      return { ...this._field.optionSource };
    }

    return undefined;
  }

  private buildDynamicOptionSource(): OptionSource | undefined {
    if (!this.selectedModuleSlug || !this.selectedDisplayColumn) {
      return undefined;
    }

    return {
      type: 'dynamic',
      endpoint: this.selectedModuleSlug,
      response: {
        labelKey: this.selectedDisplayColumn,
        valueKey: 'id',
        dataPath: 'data',
      },
    };
  }

  private readDynamicConfig(
    field: FormField
  ): { moduleSlug: string; displayColumn: string } | null {
    if (field.optionSource?.type !== 'dynamic' || !field.optionSource.endpoint) {
      return null;
    }

    return {
      moduleSlug: field.optionSource.endpoint,
      displayColumn: field.optionSource.response?.labelKey ?? 'name',
    };
  }

}

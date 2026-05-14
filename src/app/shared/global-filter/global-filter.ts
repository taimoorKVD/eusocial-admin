import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type GlobalFilterValue = Record<string, unknown>;

export interface GlobalFilterField {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  options?: { label: string; value: any }[];
  loading?: boolean;
}

@Component({
  selector: 'app-global-filter',
  standalone: false,
  templateUrl: './global-filter.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalFilterComponent {
  @Input() fields: GlobalFilterField[] = [];
  @Output() search = new EventEmitter<GlobalFilterValue>();
  @Output() clear = new EventEmitter<void>();

  filters: GlobalFilterValue = {};

  get hasFilters(): boolean {
    return Object.values(this.filters).some(value => !!value);
  }

  get activeFields(): GlobalFilterField[] {
    return this.fields.filter(field => !!this.filters[field.key]);
  }

  trackByFieldKey(_: number, field: GlobalFilterField): string {
    return field.key;
  }

  onInputChange(field: GlobalFilterField, event: Event): void {
    if (field.type !== 'number') {
      return;
    }

    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^0-9]/g, '');

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    this.filters[field.key] = sanitized;
  }

  onSearch(): void {
    this.search.emit(this.filters);
  }

  getFieldOptions(field: GlobalFilterField): any[] {
    return field.options ?? [];
  }

  getSelectedOptionLabel(field: GlobalFilterField): string {
    const value = this.filters[field.key];
    if (!value) {
      return '';
    }

    const option = this.getFieldOptions(field).find(
      opt => String(opt.value) === String(value)
    );
    return option?.label ?? '';
  }

  onClear(): void {
    this.filters = {};
    this.clear.emit();
  }
}

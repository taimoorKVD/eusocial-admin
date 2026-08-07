import { computed, signal } from '@angular/core';

export function toNumericIds(ids: readonly unknown[]): number[] {
  return ids
    .map((id) => (id != null && id !== '' ? Number(id) : Number.NaN))
    .filter((id) => !Number.isNaN(id));
}

export class BulkSelectionState {
  readonly selectedIds = signal<number[]>([]);
  readonly count = computed(() => this.selectedIds().length);
  readonly hasSelection = computed(() => this.selectedIds().length > 0);

  toggle(id: number): void {
    this.selectedIds.update((current) =>
      current.includes(id)
        ? current.filter((selected) => selected !== id)
        : [...current, id],
    );
  }

  toggleAll(ids: readonly (number | string | null | undefined)[]): void {
    const selectable = toNumericIds(ids);
    if (this.isAllSelected(selectable)) {
      this.clear();
      return;
    }
    this.selectedIds.set(selectable);
  }

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  isAllSelected(ids: readonly (number | string | null | undefined)[]): boolean {
    const selectable = toNumericIds(ids);
    return selectable.length > 0 && selectable.every((id) => this.isSelected(id));
  }

  isIndeterminate(ids: readonly (number | string | null | undefined)[]): boolean {
    const selectable = toNumericIds(ids);
    const count = selectable.filter((id) => this.isSelected(id)).length;
    return count > 0 && count < selectable.length;
  }

  clear(): void {
    this.selectedIds.set([]);
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DEFAULT_PAGE_SIZE,
  resolveAvailablePageSizes,
} from './page-size.utils';

/**
 * Compact "Rows per page" control for Tenant Admin listing footers.
 */
@Component({
  selector: 'app-page-size-select',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="inline-flex items-center gap-2 text-sm text-gray-500 font-ibm">
      <span class="whitespace-nowrap">Rows per page</span>
      <select
        class="min-w-[4.5rem] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-medium text-[#161616] outline-none transition focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 disabled:cursor-not-allowed disabled:opacity-40 font-ibm"
        [disabled]="disabled()"
        [value]="value()"
        (change)="onChange($event)"
        aria-label="Rows per page"
      >
        @for (option of options(); track option) {
          <option [value]="option">{{ option }}</option>
        }
      </select>
    </label>
  `,
})
export class PageSizeSelectComponent {
  /** Total records from the listing API (`meta.total`). */
  readonly total = input(0);
  /** Currently selected page size / limit. */
  readonly value = input(DEFAULT_PAGE_SIZE);
  readonly disabled = input(false);
  readonly valueChange = output<number>();

  readonly options = computed(() =>
    resolveAvailablePageSizes(this.total(), this.value()),
  );

  onChange(event: Event): void {
    const next = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(next) || next === this.value()) {
      return;
    }
    this.valueChange.emit(next);
  }
}

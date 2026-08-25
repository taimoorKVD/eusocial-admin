import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import flatpickr from 'flatpickr';
import { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';

/**
 * Reusable Flatpickr binding matching the project's existing create-form
 * frequency date picker configuration (Y-m-d storage, alt display).
 */
@Directive({
  selector: 'input[appFlatpickr]',
  standalone: true,
})
export class FlatpickrDirective implements AfterViewInit, OnChanges, OnDestroy {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private instance: FlatpickrInstance | null = null;
  private viewReady = false;

  /** Stored value in `Y-m-d` format. */
  @Input() fpValue: string | null | undefined = null;
  @Input() fpMinDate: string | null | undefined = null;
  @Input() fpMaxDate: string | null | undefined = null;
  @Input() fpDisabled = false;
  @Input() fpAllowInput = false;
  @Input() fpAltFormat = 'F j, Y';
  @Output() fpChange = new EventEmitter<string | null>();

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.initPicker();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) {
      return;
    }

    if (!this.instance) {
      this.initPicker();
      return;
    }

    if (changes['fpMinDate'] || changes['fpMaxDate']) {
      // Keep the current selection so Angular validators can surface
      // From/To order errors instead of silently clearing the input.
      const retained = this.fpValue || this.instance.input.value || '';
      this.instance.set('minDate', this.fpMinDate || undefined);
      this.instance.set('maxDate', this.fpMaxDate || undefined);
      if (retained) {
        const current = this.instance.input.value || '';
        if (current !== retained) {
          this.instance.setDate(retained, false);
        }
      }
      this.instance.redraw();
    }

    if (changes['fpValue'] && !changes['fpValue'].firstChange) {
      const next = this.fpValue || '';
      const current = this.instance.input.value || '';
      if (next !== current) {
        this.instance.setDate(next || '', false);
      }
    }

    if (changes['fpDisabled']) {
      this.applyDisabledState();
    }

    if (changes['fpAltFormat'] && !changes['fpAltFormat'].firstChange) {
      this.initPicker();
    }
  }

  ngOnDestroy(): void {
    this.destroyPicker();
  }

  private initPicker(): void {
    this.destroyPicker();

    const host = this.el.nativeElement;
    const placeholder = host.getAttribute('placeholder') || '';

    this.instance = flatpickr(host, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: this.fpAltFormat,
      altInputClass: host.className || undefined,
      allowInput: this.fpAllowInput,
      minDate: this.fpMinDate || undefined,
      maxDate: this.fpMaxDate || undefined,
      defaultDate: this.fpValue || undefined,
      onChange: (_selectedDates, dateStr) => {
        this.fpChange.emit(dateStr || null);
      },
    });

    this.syncPlaceholder(placeholder);
    this.applyDisabledState();
  }

  private syncPlaceholder(placeholder?: string | null): void {
    if (!this.instance?.altInput) {
      return;
    }

    const text =
      placeholder ?? this.el.nativeElement.getAttribute('placeholder') ?? '';
    this.instance.altInput.setAttribute('placeholder', text);
  }

  private applyDisabledState(): void {
    if (!this.instance) {
      return;
    }

    const disabled = this.fpDisabled === true;
    this.el.nativeElement.disabled = disabled;

    if (this.instance.altInput) {
      this.instance.altInput.disabled = disabled;
    }
  }

  private destroyPicker(): void {
    if (this.instance) {
      this.instance.destroy();
      this.instance = null;
    }
  }
}

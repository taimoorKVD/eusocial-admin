import { Component, Input } from '@angular/core';

/**
 * Shared Logic Map glyph (15×15). Uses currentColor so parent text/button
 * colors and hover states apply unchanged.
 */
@Component({
  selector: 'app-logic-map-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      class="shrink-0"
      [class]="hostClass"
    >
      <path
        d="M3.75 1.875V9.375M3.75 9.375C3.25272 9.375 2.77581 9.57254 2.42417 9.92417C2.07254 10.2758 1.875 10.7527 1.875 11.25C1.875 11.7473 2.07254 12.2242 2.42417 12.5758C2.77581 12.9275 3.25272 13.125 3.75 13.125C4.24728 13.125 4.72419 12.9275 5.07583 12.5758C5.42746 12.2242 5.625 11.7473 5.625 11.25M3.75 9.375C4.24728 9.375 4.72419 9.57254 5.07583 9.92417C5.42746 10.2758 5.625 10.7527 5.625 11.25M11.25 5.625C11.25 7.11684 10.6574 8.54758 9.60248 9.60248C8.54758 10.6574 7.11684 11.25 5.625 11.25M11.25 5.625C10.7527 5.625 10.2758 5.42746 9.92417 5.07583C9.57254 4.72419 9.375 4.24728 9.375 3.75C9.375 3.25272 9.57254 2.77581 9.92417 2.42417C10.2758 2.07254 10.7527 1.875 11.25 1.875C11.7473 1.875 12.2242 2.07254 12.5758 2.42417C12.9275 2.77581 13.125 3.25272 13.125 3.75C13.125 4.24728 12.9275 4.72419 12.5758 5.07583C12.2242 5.42746 11.7473 5.625 11.25 5.625Z"
        stroke-width="1.375"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke="currentColor"
      />
    </svg>
  `,
})
export class LogicMapIconComponent {
  /** Pixel size; defaults to the supplied 15×15 artwork. */
  @Input() size: number | string = 15;
  /** Optional extra classes on the SVG element. */
  @Input() hostClass = '';
}

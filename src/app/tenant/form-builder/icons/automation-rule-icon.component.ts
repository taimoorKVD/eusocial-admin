import { Component, Input } from '@angular/core';

/**
 * Shared Automation Rule glyph (11×12).
 * Stroke uses currentColor so Figma states match parent text color:
 * lime/active → dark; gray/inactive → white.
 */
@Component({
  selector: 'app-automation-rule-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="width"
      [attr.height]="height"
      viewBox="0 0 11 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      [attr.class]="svgClass"
    >
      <path
        d="M5.60004 0.600098L0.600037 6.6001H5.10004L4.60004 10.6001L9.60004 4.6001H5.10004L5.60004 0.600098Z"
        stroke-width="1.2"
        stroke-linejoin="round"
        stroke="currentColor"
      />
    </svg>
  `,
})
export class AutomationRuleIconComponent {
  /** Defaults to the supplied 11×12 artwork. */
  @Input() width: number | string = 11;
  @Input() height: number | string = 12;
  /** Extra classes merged with shrink-0. */
  @Input() hostClass = '';

  get svgClass(): string {
    return ['shrink-0', this.hostClass].filter(Boolean).join(' ');
  }
}

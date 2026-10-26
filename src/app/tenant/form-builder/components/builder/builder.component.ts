import {
  Component,
  HostListener,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';
import { FormField } from '../../models/form-field.model';
import { FIELD_TEMPLATES } from '../../data/field-templates';

@Component({
  selector: 'app-builder',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './builder.component.html',
  styleUrl: './builder.component.scss',
})
export class BuilderComponent implements OnDestroy {
  @Input() connectedDropLists: Array<CdkDropList<FormField[]> | string> = [];
  @Input() dropListId = 'sidebarList';
  /** Disables palette drag when form interactions are locked (e.g. bulk delete). */
  @Input() disabled = false;
  /**
   * Setup-user / setup-item / setup-vendor palette polish.
   * Leave false for Form Template and legacy editors.
   */
  @Input() setupPalette = false;

  @ViewChild('paletteList', { static: true })
  paletteListRef!: CdkDropList<FormField[]>;

  /** Immutable palette — never modified by drag & drop. */
  readonly fieldTemplates = FIELD_TEMPLATES;

  /** Body-level tooltip clone so overflow parents cannot clip it. */
  private portalTooltip: HTMLElement | null = null;
  private readonly onScrollCapture = (): void => this.hidePaletteTooltip();

  constructor() {
    // Capture scroll from nested overflow containers (palette panel).
    document.addEventListener('scroll', this.onScrollCapture, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.onScrollCapture, true);
    this.hidePaletteTooltip();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.hidePaletteTooltip();
  }

  trackByTemplate(_index: number, item: Omit<FormField, 'id'>): string {
    return item.type;
  }

  /**
   * Show field-info tooltip portaled to document.body with viewport-aware
   * placement (flips above/below and clamps horizontally).
   */
  showPaletteTooltip(event: Event): void {
    if (this.disabled) {
      return;
    }

    const trigger = event.currentTarget as HTMLElement | null;
    const source = trigger?.querySelector('.app-tooltip') as HTMLElement | null;
    if (!trigger || !source) {
      return;
    }

    this.hidePaletteTooltip();

    const tip = source.cloneNode(true) as HTMLElement;
    tip.classList.add('app-tooltip--portal');
    tip.classList.remove(
      'app-tooltip--top-end',
      'app-tooltip--below-end',
      'palette-tooltip-source',
    );
    tip.style.display = 'block';
    tip.style.visibility = 'visible';
    tip.style.opacity = '1';
    tip.style.pointerEvents = 'none';
    document.body.appendChild(tip);
    this.portalTooltip = tip;

    // Layout after insert so width/height are measurable.
    requestAnimationFrame(() => {
      if (this.portalTooltip !== tip) {
        return;
      }
      this.placePortalTooltip(trigger, tip);
    });
  }

  hidePaletteTooltip(): void {
    if (!this.portalTooltip) {
      return;
    }
    this.portalTooltip.remove();
    this.portalTooltip = null;
  }

  private placePortalTooltip(trigger: HTMLElement, tip: HTMLElement): void {
    const margin = 8;
    const gap = 8;
    const rect = trigger.getBoundingClientRect();
    const tipWidth = tip.offsetWidth;
    const tipHeight = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceAbove = rect.top - margin;
    const spaceBelow = vh - rect.bottom - margin;
    const preferAbove =
      spaceAbove >= tipHeight + gap || spaceAbove >= spaceBelow;

    tip.classList.remove('app-tooltip--top-end', 'app-tooltip--below-end');

    let top: number;
    if (preferAbove) {
      top = rect.top - tipHeight - gap;
      tip.classList.add('app-tooltip--top-end');
    } else {
      top = rect.bottom + gap;
      tip.classList.add('app-tooltip--below-end');
    }

    // Prefer end-aligned (right of trigger), then clamp into the viewport.
    let left = rect.right - tipWidth;
    left = Math.min(Math.max(margin, left), Math.max(margin, vw - tipWidth - margin));
    top = Math.min(Math.max(margin, top), Math.max(margin, vh - tipHeight - margin));

    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.right = 'auto';
    tip.style.bottom = 'auto';
    tip.style.transform = 'none';
  }
}

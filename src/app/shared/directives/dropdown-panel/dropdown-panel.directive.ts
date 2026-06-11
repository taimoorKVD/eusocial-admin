import {
  ChangeDetectorRef,
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { DropdownOverlayService } from './dropdown-overlay.service';

@Directive({
  selector: '[appDropdownPanel]',
  exportAs: 'dropdownPanel',
  standalone: false,
})
export class DropdownPanelDirective implements OnInit, OnDestroy {
  @Input({ required: true }) dropdownId!: string;
  @Input() dropdownGroup = 'default';

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private overlayService: DropdownOverlayService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.overlayService.register(this.dropdownGroup, this.dropdownId, {
      root: this.elementRef.nativeElement,
      notifyChange: () => this.cdr.markForCheck(),
    });
  }

  ngOnDestroy(): void {
    if (this.isOpen) {
      this.overlayService.close();
    }

    this.overlayService.unregister(this.dropdownGroup, this.dropdownId);
  }

  get isOpen(): boolean {
    return this.overlayService.isOpen(this.dropdownGroup, this.dropdownId);
  }

  toggle(event?: Event): void {
    event?.stopPropagation();
    this.overlayService.toggle(
      this.dropdownGroup,
      this.dropdownId,
      this.elementRef.nativeElement,
    );
  }

  open(event?: Event): void {
    event?.stopPropagation();
    this.overlayService.open(
      this.dropdownGroup,
      this.dropdownId,
      this.elementRef.nativeElement,
    );
  }

  close(): void {
    if (this.isOpen) {
      this.overlayService.close();
    }
  }
}

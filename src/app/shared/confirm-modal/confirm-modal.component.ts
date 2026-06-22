import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.component.html',
  standalone: false,
  styleUrl: './confirm-modal.component.scss',
})
export class ConfirmModalComponent {
  @Input() isOpen = false;
  @Input() title = 'Confirmation';
  @Input() message = 'Are you sure?';
  @Input() description = '';

  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Close';

  @Output() confirmed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  get displayDescription(): string {
    return this.description || this.message;
  }

  get displayMessage(): string {
    const description = this.displayDescription?.trim();
    const title = this.title?.trim();

    if (description && title && description !== title) {
      return `${description}`;
      // return `${title}. ${description}`;
    }

    return description || title || 'Are you sure?';
  }

  onConfirm(): void {
    this.confirmed.emit();
  }

  onClose(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}

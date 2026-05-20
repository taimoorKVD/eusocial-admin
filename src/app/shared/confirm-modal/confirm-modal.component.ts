import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.component.html',
  standalone: false,
  styleUrl: './confirm-modal.component.scss'
})
export class ConfirmModalComponent {

  @Input() isOpen = false;
  @Input() title = 'Confirmation';
  @Input() message = 'Are you sure?';

  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Close';

  @Output() confirmed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onClose(): void {
    this.closed.emit();
  }
}

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-top-header',
  standalone: false,
  templateUrl: './top-header.html',
  styleUrls: ['./top-header.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopHeaderComponent {
  @Input() title: string = '';
  @Input() buttonLabel: string = '';
  @Input() showButton: boolean = true;
  @Output() buttonClick = new EventEmitter<void>();

  onButtonClick(): void {
    this.buttonClick.emit();
  }
}

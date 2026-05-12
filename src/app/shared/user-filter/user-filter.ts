import { Component, EventEmitter, Output } from '@angular/core';

export interface UserFilterValue {
  name: string;
  email: string;
}

@Component({
  selector: 'app-user-filter',
  standalone: false,
  templateUrl: './user-filter.html',
})
export class UserFilterComponent {
  name = '';
  email = '';

  @Output() search = new EventEmitter<UserFilterValue>();
  @Output() clear = new EventEmitter<void>();

  get hasFilters(): boolean {
    return !!this.name || !!this.email;
  }

  onSearch(): void {
    this.search.emit({ name: this.name, email: this.email });
  }

  onClear(): void {
    this.name = '';
    this.email = '';
    this.clear.emit();
  }
}

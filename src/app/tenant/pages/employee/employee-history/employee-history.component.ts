import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EmployeeHistoryService } from '../../../../services/employee-history.service';
import { EmployeeHistoryItem } from '../../../../interfaces/employee-assignment';

@Component({
  selector: 'app-employee-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-history.component.html',
})
export class EmployeeHistoryComponent {
  private readonly historyService = inject(EmployeeHistoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly items = signal<EmployeeHistoryItem[]>([]);

  ngOnInit(): void {
    this.historyService
      .getHistory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set(items);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }
}

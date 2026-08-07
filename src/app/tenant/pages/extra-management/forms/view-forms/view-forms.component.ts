import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { SharedModule } from '../../../../../shared/shared.module';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { TenantFormsService } from '../services/tenant-forms.service';
import { SavedDynamicForm } from '../models/dynamic-form.models';

@Component({
  selector: 'app-view-forms',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './view-forms.component.html',
  styleUrl: './view-forms.component.scss',
})
export class ViewFormsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(TenantSessionService);
  private readonly formsService = inject(TenantFormsService);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);

  readonly forms = signal<SavedDynamicForm[]>([]);
  readonly loading = signal(false);
  readonly hasForms = computed(() => this.forms().length > 0);

  readonly showDeleteConfirmModal = signal(false);
  readonly deleteConfirmTitle = 'Delete Form';
  readonly deleteConfirmDescription =
    'Please confirm that you want to delete this form. All related information will be permanently removed.';

  private pendingDeleteId: number | null = null;

  ngOnInit(): void {
    this.loadForms();
  }

  private loadForms(): void {
    this.loading.set(true);

    this.formsService
      .getForms()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (forms) => this.forms.set(forms),
        error: () => this.forms.set([]),
      });
  }

  goToCreate(): void {
    this.router.navigate(['/tenant', this.session.getSlug(), 'dynamic-forms', 'create']);
  }

  goToEdit(form: SavedDynamicForm): void {
    if (!form.id) {
      return;
    }
    this.router.navigate(['edit', form.id], { relativeTo: this.route });
  }

  deleteForm(form: SavedDynamicForm): void {
    if (!form.id) {
      return;
    }

    this.pendingDeleteId = Number(form.id);
    this.showDeleteConfirmModal.set(true);
  }

  onConfirmDeleteForm(): void {
    const id = this.pendingDeleteId;
    if (!id) {
      return;
    }

    this.formsService
      .deleteTemplate(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('Form deleted successfully');
          this.loadForms();
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to delete form');
        },
      });

    this.closeDeleteConfirmModal();
  }

  closeDeleteConfirmModal(): void {
    this.showDeleteConfirmModal.set(false);
    this.pendingDeleteId = null;
  }

  formatSectionTypes(types: string[]): string {
    return types.join(', ');
  }
}

import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { SharedModule } from '../../../../../shared/shared.module';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { TenantFormsService } from '../services/tenant-forms.service';
import { SECTION_OPTIONS, SavedDynamicForm, SectionType } from '../models/dynamic-form.models';

@Component({
  selector: 'app-view-forms',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './view-forms.component.html',
  styleUrl: './view-forms.component.scss',
})
export class ViewFormsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly session = inject(TenantSessionService);
  private readonly formsService = inject(TenantFormsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly forms = signal<SavedDynamicForm[]>([]);
  readonly loading = signal(false);
  readonly hasForms = computed(() => this.forms().length > 0);

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

  sectionLabel(type: SectionType): string {
    return SECTION_OPTIONS.find((o) => o.value === type)?.label ?? type;
  }

  formatSectionTypes(types: SectionType[]): string {
    return types.map((t) => this.sectionLabel(t)).join(', ');
  }
}

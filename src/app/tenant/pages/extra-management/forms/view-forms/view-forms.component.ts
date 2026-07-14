import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../../shared/shared.module';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { DynamicFormsStoreService } from '../services/dynamic-forms-store.service';
import { SECTION_OPTIONS, SectionType } from '../models/dynamic-form.models';

@Component({
  selector: 'app-view-forms',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './view-forms.component.html',
  styleUrl: './view-forms.component.scss',
})
export class ViewFormsComponent {
  private readonly router = inject(Router);
  private readonly session = inject(TenantSessionService);
  private readonly store = inject(DynamicFormsStoreService);

  readonly forms = this.store.forms;
  readonly hasForms = computed(() => this.forms().length > 0);

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

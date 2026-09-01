import { CommonModule } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { EmployeeAssignmentSectionView } from '../../../../interfaces/employee-assignment';
import {
  buildCompletedFormSectionViews,
  COMPLETED_FORM_EMPTY_LABEL,
  CompletedFormSectionView,
  TypeformReviewItemView,
} from './format-typeform-review.utils';

@Component({
  selector: 'app-completed-form-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './completed-form-view.component.html',
})
export class CompletedFormViewComponent {
  readonly formTitle = input.required<string>();
  readonly sections = input.required<EmployeeAssignmentSectionView[]>();
  readonly answers = input.required<Record<string, unknown>>();
  readonly submittedAt = input<string | null>(null);
  readonly statusLabel = input('Completed');
  readonly statusClass = input('bg-[#ECFDF3] text-[#067647]');

  readonly lightboxUrl = signal<string | null>(null);
  readonly brokenImages = signal<Set<string>>(new Set());

  readonly sectionGroups = computed((): CompletedFormSectionView[] =>
    buildCompletedFormSectionViews(this.sections(), this.answers()),
  );

  readonly emptyLabel = COMPLETED_FORM_EMPTY_LABEL;

  openLightbox(url: string): void {
    this.lightboxUrl.set(url);
  }

  closeLightbox(): void {
    this.lightboxUrl.set(null);
  }

  onImageError(url: string): void {
    this.brokenImages.update((current) => {
      const next = new Set(current);
      next.add(url);
      return next;
    });
  }

  isImageBroken(url: string): boolean {
    return this.brokenImages().has(url);
  }

  displayValue(item: TypeformReviewItemView): string {
    return item.isEmpty ? this.emptyLabel : item.display;
  }
}

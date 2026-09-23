import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { SharedModule } from '../../../../../shared/shared.module';
import { DynamicFormFieldMapperService } from '../../../../forms/services/dynamic-form-field.mapper.service';
import { TenantFormsService } from '../services/tenant-forms.service';
import { FormSection } from '../models/dynamic-form.models';
import { mapAssignmentSectionsToBuilder } from '../../../employee/utils/assignment-form.mapper';
import { RegularFormShellComponent } from '../../../employee/regular-form/regular-form-shell.component';
import { EmployeeAssignmentSectionView } from '../../../../../interfaces/employee-assignment';
import { DynamicField } from '../../../../../interfaces/dynamic-field';
import { FormField } from '../../../../form-builder/models/form-field.model';

/**
 * Admin Portal — Form Template Preview.
 * Renders the template with the same Regular Form pipeline employees use,
 * forced read-only (no submit / save / assignment APIs).
 */
@Component({
  selector: 'app-form-template-preview',
  standalone: true,
  imports: [CommonModule, SharedModule, RegularFormShellComponent],
  templateUrl: './form-template-preview.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormTemplatePreviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formsService = inject(TenantFormsService);
  private readonly fieldMapper = inject(DynamicFormFieldMapperService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<number>();

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly formTitle = signal('Form Template');
  readonly sections = signal<EmployeeAssignmentSectionView[]>([]);

  ngOnInit(): void {
    this.reload$
      .pipe(
        switchMap((templateId) => {
          this.loading.set(true);
          this.errorMessage.set('');
          this.sections.set([]);

          return this.formsService.getTemplateById(templateId).pipe(
            switchMap((form) => {
              this.formTitle.set(form.formName || 'Form Template');
              const schema = (form.payload ?? {}) as Record<string, unknown>;
              const sections = (form.payload?.sections ?? []) as FormSection[];
              return this.hydrateSections(sections, schema);
            }),
            catchError((err) => {
              this.errorMessage.set(
                err?.error?.message ||
                  'Unable to load form template preview. Please try again.',
              );
              return of([] as EmployeeAssignmentSectionView[]);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (views) => {
          if (!this.errorMessage()) {
            this.sections.set(views);
          }
        },
      });

    const idParam = this.route.snapshot.paramMap.get('id');
    const templateId = idParam ? Number(idParam) : NaN;

    if (!Number.isFinite(templateId) || templateId <= 0) {
      this.loading.set(false);
      this.errorMessage.set('Form template id is missing or invalid.');
      return;
    }

    this.reload$.next(templateId);
  }

  goBack(): void {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
      this.router.navigateByUrl(returnTo);
      return;
    }
    this.router.navigate(['/dynamic-forms']);
  }

  retry(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const templateId = idParam ? Number(idParam) : NaN;
    if (!Number.isFinite(templateId) || templateId <= 0) {
      return;
    }
    this.reload$.next(templateId);
  }

  private hydrateSections(
    sections: FormSection[],
    schema: Record<string, unknown>,
  ) {
    const mapped = mapAssignmentSectionsToBuilder(sections, schema, {});

    if (!mapped.length) {
      return of([] as EmployeeAssignmentSectionView[]);
    }

    return forkJoin(
      mapped.map((section) =>
        this.fieldMapper.resolveFields(section.builderFields).pipe(
          map((fields) => {
            const readonlyFields = this.asReadonly(fields);
            return {
              id: section.id,
              name: section.name,
              builderFields: section.builderFields,
              fields: readonlyFields,
              rows: this.buildSectionRows(section.builderRows, readonlyFields),
            } satisfies EmployeeAssignmentSectionView;
          }),
        ),
      ),
    );
  }

  private buildSectionRows(
    builderRows: FormField[][],
    fields: DynamicField[],
  ): DynamicField[][] {
    const byId = new Map(
      fields.map((field) => [String(field.id), field] as const),
    );

    return (builderRows || [])
      .map((row) =>
        (row || [])
          .map((builderField) => byId.get(String(builderField.id)))
          .filter((field): field is DynamicField => !!field),
      )
      .filter((row) => row.length > 0);
  }

  private asReadonly(fields: DynamicField[]): DynamicField[] {
    return fields.map((field) => ({
      ...field,
      isReadonly: true,
    }));
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { normalizeFieldOrder } from '../../../../form-builder/utils/form-field.factory';
import { DynamicFormComponent } from '../../../../../shared/dynamic-form/dynamic-form.component';
import {
  DynamicField,
  DynamicFormValue,
} from '../../../../../interfaces/dynamic-field';

@Component({
  selector: 'app-setup-user',
  standalone: false,
  templateUrl: './setup-user.component.html',
  styleUrl: './setup-user.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupUserComponent {
  private readonly toastr = inject(ToastrService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantSession = inject(TenantSessionService);
  private readonly formStorageService = inject(FormStorageService);
  private readonly userService = inject(TenantUserService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dynamicForm = viewChild(DynamicFormComponent);

  readonly loading = signal(false);
  readonly formFields = signal<DynamicField[]>([]);
  readonly userId = signal('');
  readonly latestFormValue = signal<DynamicFormValue>({});

  readonly hasFormFields = computed(() => this.formFields().length > 0);
  readonly showEmptyState = computed(() => !this.loading() && !this.hasFormFields());

  ngOnInit(): void {
    this.userId.set(this.route.snapshot.paramMap.get('id') || '');
    this.loadFormFields();
  }

  onDynamicFormChange(value: DynamicFormValue): void {
    this.latestFormValue.set(value);
  }

  onFormSubmit(): void {
    const form = this.dynamicForm();
    if (!form) {
      return;
    }

    if (!form.validate()) {
      this.toastr.error('Please fill in all required fields.');
      return;
    }

    const formValues = form.value;
    const id = this.userId();

    if (id) {
      this.userService
        .updateUser(Number(id), formValues)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.toastr.success('User updated successfully');
            this.router.navigate(['/tenant', this.tenantSession.getSlug(), 'users']);
          },
          error: (err) => {
            this.toastr.error(err?.error?.message || 'Failed to update user');
          },
        });
      return;
    }

    this.userService
      .createUser(formValues)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('User created successfully');
          this.router.navigate(['/tenant', this.tenantSession.getSlug(), 'users']);
        },
        error: (err) => {
          console.error('Create user error:', err);
          this.toastr.error(err?.error?.message || 'Failed to create user');
        },
      });
  }

  private loadFormFields(): void {
    this.loading.set(true);

    this.formStorageService
      .loadForm('users')
      .pipe(
        switchMap((res) => {
          if (!res) {
            return of([] as DynamicField[]);
          }

          const fields = normalizeFieldOrder(
            res.fields.filter((field) => field.label !== 'Role') || [],
          ) as DynamicField[];

          const dropdownRequests = fields
            .filter(
              (field) =>
                field.type === 'select' &&
                field.optionSource?.type === 'api' ||
                (field.optionSource?.type === 'dynamic' && field.optionSource?.endpoint),
            )
            .map((field) =>
              this.formStorageService.getEndpointApi<Record<string, unknown>>(
                field.optionSource!.endpoint!,
              ).pipe(
                map((response) => ({ field, response })),
                catchError(() => of({ field, response: null })),
              ),
            );

          if (!dropdownRequests.length) {
            return of(fields);
          }

          return forkJoin(dropdownRequests).pipe(
            map((results) => {
              results.forEach(({ field, response }) => {
                if (!response) {
                  return;
                }
                this.applyApiOptionsToField(field, response);
              });
              return fields;
            }),
          );
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (fields) => {
          this.formFields.set(fields);
          if (this.userId()) {
            this.loadUser();
          }
        },
        error: () => {
          this.formFields.set([]);
        },
      });
  }

  private loadUser(): void {
    this.userService
      .getUserById(Number(this.userId()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: { data: Record<string, unknown> }) => {
          const user = { ...res.data };

          if (user['plain_password']) {
            user['password'] = user['plain_password'];
          }

          const patchData = this.buildUserPatchData(user, this.formFields());

          setTimeout(() => {
            this.dynamicForm()?.patchValue(patchData);
          });
        },
      });
  }

  private buildUserPatchData(
    user: Record<string, unknown>,
    fields: DynamicField[],
  ): DynamicFormValue {
    const patchData: DynamicFormValue = {};

    for (const field of fields) {
      if (field.type === 'checkbox') {
        const value = user[field.name];
        if (Array.isArray(value)) {
          patchData[field.name] = value;
        } else if (value) {
          patchData[field.name] = [value];
        } else {
          patchData[field.name] = [];
        }
        continue;
      }

      if (field.type === 'select') {
        const value = user[field.name];
        patchData[field.name] =
          value == null
            ? ''
            : typeof value === 'object'
              ? (value as { id: unknown }).id
              : value;
        continue;
      }

      patchData[field.name] = user[field.name];
    }

    return patchData;
  }

  private applyApiOptionsToField(
    field: DynamicField,
    response: Record<string, unknown>,
  ): void {
    const dataPath = field.optionSource?.response?.dataPath ?? 'data';
    const labelKey = field.optionSource?.response?.labelKey ?? 'label';
    const valueKey = field.optionSource?.response?.valueKey ?? 'value';
    const data = (response[dataPath] as Record<string, unknown>[]) || [];

    field.options = data.map((item) => ({
      label: item[labelKey],
      value: item[valueKey],
    })) as DynamicField['options'];
  }
}

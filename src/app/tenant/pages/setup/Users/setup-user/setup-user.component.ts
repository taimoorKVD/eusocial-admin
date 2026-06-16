import { Component, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { normalizeFieldOrder } from '../../../../form-builder/utils/form-field.factory';
import { DynamicFormComponent } from '../../../../../shared/dynamic-form/dynamic-form.component';
import { DynamicFormValue } from '../../../../../interfaces/dynamic-field';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-setup-user',
  standalone: false,
  templateUrl: './setup-user.component.html',
  styleUrl: './setup-user.component.scss',
})
export class SetupUserComponent {

  @ViewChild(DynamicFormComponent) dynamicForm?: DynamicFormComponent;

  constructor(
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private router: Router,
    private tenantSession: TenantSessionService,
    private formStorageService: FormStorageService,
    private userService: TenantUserService
  ) {}

  loading = false;
  formFields: any[] = [];
  latestFormValue: DynamicFormValue = {};
  userId!: string;


  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    this.getFormFields();
  }

  getFormFields(): void {
    this.loading = true;
    this.formStorageService.loadForm('users').subscribe({
      next: (res) => {
        if (!res) {
          this.formFields = [];
          this.loading = false;
          return;
        }

        const fields = normalizeFieldOrder(
          res.fields.filter(field => field.label !== 'Role') || []
        );

        const dropdownRequests = fields
          .filter(
            field =>
              field.type === 'select' &&
              field.optionSource?.type === 'api' || field.optionSource?.type === 'dynamic'  &&
              field.optionSource?.endpoint
          )
          .map(field =>
            this.formStorageService
            .getEndpointApi<any>(field.optionSource.endpoint)
            .pipe(
              map(response => ({
                field,
                response
              })),
              catchError(() =>
                of({
                  field,
                  response: null
                })
              )
            )
          );

        if (!dropdownRequests.length) {
          this.formFields = fields;
          this.loading = false;
          if (this.userId) {
            this.loadUser();
          }
          return;
        }

        forkJoin(dropdownRequests).subscribe(results => {
          results.forEach(({ field, response }) => {
            if (!response) {
              return;
            }

            const dataPath =
              field.optionSource?.response?.dataPath ?? 'data';

            const labelKey =
              field.optionSource?.response?.labelKey ?? 'label';

            const valueKey =
              field.optionSource?.response?.valueKey ?? 'value';

            const data = response[dataPath] || [];

            field.options = data.map((item: any) => ({
              label: item[labelKey],
              value: item[valueKey]
            }));
          });

          this.formFields = fields;
          this.loading = false;
          if (this.userId) {
            this.loadUser();
          }
        });
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadUser(): void {
    this.userService.getUserById(Number(this.userId)).subscribe({
      next: (res: any) => {
        const user = res.data;
        if(user.availabilityDays){
          user.availability_days = res.data.availabilityDays.map(v => v === 'true');
        }
        if(user.plainPassword){
          user.password = user.plainPassword;
        }
        if(user.jobPosition){
          user.job_position = user.jobPosition;
        }
        const patchData: any = {};
        this.formFields.forEach(field => {
          if (field.type === 'checkbox') {
            if ((field.options?.length ?? 0) > 1) {
              patchData[field.name] =
                Array.isArray(user[field.name])
                  ? user[field.name]
                  : [];
            } else {
              patchData[field.name] = !!user[field.name];
            }
          } else if(field.type === 'select') {
             patchData[field.name] = user[field.name] == null ? '' : user[field.name].id;
           } else {
            patchData[field.name] = user[field.name];
          }
        });

        setTimeout(() => {
          this.dynamicForm?.patchValue(patchData);
        });
      }
    });
  }

  onDynamicFormChange(value: DynamicFormValue): void {
    this.latestFormValue = value;
  }

  onFormSubmit(): void {
     console.log('Submitting form with values:', this.dynamicForm.value);
    if (!this.dynamicForm) {
      return;
    }
    const isValid = this.dynamicForm.validate();
    if (!isValid) {
      this.toastr.error('Please fill in all required fields.');
      return;
    }
      const formValues = this.dynamicForm.value;
       if (this.userId) {
        this.userService.updateUser(Number(this.userId), formValues).subscribe({
          next: () => {
            this.toastr.success('User updated successfully');
            this.router.navigate([
              '/tenant',
              this.tenantSession.getSlug(),
              'users'
            ]);
          },
          error: (err) => {
            this.toastr.error(
              err?.error?.message || 'Failed to update user'
            );
          }
        });
      } else {
      this.userService.createUser(formValues).subscribe({
        next: (res: any) => {
          this.toastr.success('User created successfully');
            this.router.navigate(['/tenant', this.tenantSession.getSlug(), 'users']);
        },

        error: (err) => {
          console.error('Create user error:', err);
          this.toastr.error(err?.error?.message || 'Failed to create user');
        }
      });
    }
  }
}

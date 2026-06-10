import { Component, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { normalizeFieldOrder } from '../../../../form-builder/utils/form-field.factory';
import { DynamicFormComponent } from '../../../../../shared/dynamic-form/dynamic-form.component';
import { DynamicFormValue } from '../../../../../interfaces/dynamic-field';

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
  ) {}

  loading = false;
  formFields: any[] = [];
  latestFormValue: DynamicFormValue = {};

  ngOnInit(): void {
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

        this.formFields = normalizeFieldOrder(res.fields || []);
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load form schema:', err);
        this.loading = false;
      },
    });
  }

  onDynamicFormChange(value: DynamicFormValue): void {
    this.latestFormValue = value;
  }

  onFormSubmit(): void {
    if (!this.dynamicForm) {
      return;
    }

    const isValid = this.dynamicForm.validate();

    if (!isValid) {
      this.toastr.error('Please fill in all required fields.');
      return;
    }

    const formValues = this.dynamicForm.value;
    console.log('Form submitted:', formValues);
    this.toastr.success('Form submitted successfully');
  }
}

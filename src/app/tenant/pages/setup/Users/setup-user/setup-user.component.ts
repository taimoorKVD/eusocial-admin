import { Component, ElementRef, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { normalizeFieldOrder } from '../../../../form-builder/utils/form-field.factory';


@Component({
  selector: 'app-setup-user',
  standalone: false,

  templateUrl: './setup-user.component.html',
  styleUrl: './setup-user.component.scss'
})
export class SetupUserComponent {

constructor(
  private toastr: ToastrService,
  private route: ActivatedRoute,
  private router: Router,
  private tenantSession : TenantSessionService,
  private formStorageService: FormStorageService) {}

  loading = false;
  formFields: any[] = [];

  ngOnInit(): void {
    this.getFormFields()
  }

  getFormFields() {
    this.formStorageService.loadForm('users').subscribe({
          next: res => {
            console.log('Loaded form schema:', res);
            if (!res) {
              this.formFields = [];
              return;
            }
            // this.formName = res.formName || this.formName;
            // this.formId = res.formId ?? null;
            this.formFields = normalizeFieldOrder(res.fields || []);
          },
          error: error => {
            console.error('Failed to load form schema:', error);
            // this.builderSchema = [];
          },
        });
  }

  onDynamicFormChange(event: any) {
    console.log('Form data changed:', event);
  }
}

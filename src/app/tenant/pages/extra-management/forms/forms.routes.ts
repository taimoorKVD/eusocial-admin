import { Routes } from '@angular/router';
import { ViewFormsComponent } from './view-forms/view-forms.component';
import { CreateFormComponent } from './create-form/create-form.component';
import { permissionGuard } from '../../../../guards/permission.guard';
import { PERMISSIONS } from '../../../../constants/permissions';

export const DYNAMIC_FORMS_ROUTES: Routes = [
  {
    path: '',
    component: ViewFormsComponent,
    canActivate: [permissionGuard],
    data: { permission: PERMISSIONS.DATA_COLLECTION.VIEW_TEMPLATE },
  },
  {
    path: 'create',
    component: CreateFormComponent,
    canActivate: [permissionGuard],
    data: { permission: PERMISSIONS.DATA_COLLECTION.CREATE_TEMPLATE },
  },
  {
    path: 'edit/:id',
    component: CreateFormComponent,
    canActivate: [permissionGuard],
    data: {
      anyPermission: [
        PERMISSIONS.DATA_COLLECTION.VIEW_TEMPLATE,
        PERMISSIONS.DATA_COLLECTION.EDIT_TEMPLATE,
      ],
    },
  },
];

import { Routes } from '@angular/router';
import { ViewFormsComponent } from './view-forms/view-forms.component';
import { CreateFormComponent } from './create-form/create-form.component';

export const DYNAMIC_FORMS_ROUTES: Routes = [
  {
    path: '',
    component: ViewFormsComponent,
  },
  {
    path: 'create',
    component: CreateFormComponent,
  },
];

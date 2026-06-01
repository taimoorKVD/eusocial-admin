import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsRoutingModule } from './forms-routing-module';
import { FormsListComponent } from './forms-list/forms-list.component';
import { FormsEditorComponent } from './forms-editor/forms-editor.component';
import { TenantModule } from '../tenant.module';
import { FormBuilderModule } from '../form-builder/form-builder-module';


@NgModule({
  declarations: [
    FormsListComponent,
    FormsEditorComponent
  ],
  imports: [
    CommonModule,
    FormsRoutingModule,
    TenantModule,
    FormBuilderModule

  ]
})
export class FormsModule { }

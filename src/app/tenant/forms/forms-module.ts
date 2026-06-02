import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsRoutingModule } from './forms-routing-module';
import { FormsListComponent } from './forms-list/forms-list.component';
import { FormsEditorComponent } from './forms-editor/forms-editor.component';
import { TenantModule } from '../tenant.module';
import { FormBuilderModule } from '../form-builder/form-builder-module';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FieldSettingsComponent } from '../form-builder/field-settings/field-settings.component';


@NgModule({
  declarations: [
    FormsListComponent,
    FormsEditorComponent,
    // FieldSettingsComponent
  ],
  imports: [
    CommonModule,
    FormsRoutingModule,
    TenantModule,
    FormBuilderModule,
    DragDropModule,

  ]
})
export class FormsModule { }

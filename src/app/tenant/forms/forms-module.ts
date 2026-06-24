import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule as NgFormsModule } from '@angular/forms';

import { FormsRoutingModule } from './forms-routing-module';
import { FormsListComponent } from './forms-list/forms-list.component';
import { FormsEditorComponent } from './forms-editor/forms-editor.component';
import { TenantModule } from '../tenant.module';
import { FormEditorCoreModule } from './form-editor-core.module';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [FormsListComponent, FormsEditorComponent],
  imports: [
    CommonModule,
    NgFormsModule,
    FormsRoutingModule,
    TenantModule,
    FormEditorCoreModule,
    SharedModule,
  ],
})
export class FormsModule {}

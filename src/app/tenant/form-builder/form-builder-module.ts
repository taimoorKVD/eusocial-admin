import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuilderComponent } from './components/builder/builder.component';
import { SharedModule } from '../../shared/shared.module';
import { FieldSettingsComponent } from './field-settings/field-settings.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';



@NgModule({
  declarations: [
    BuilderComponent,
    FieldSettingsComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    DragDropModule,
    FormsModule
  ],
    exports: [
    BuilderComponent,
    FieldSettingsComponent
  ]
})
export class FormBuilderModule { }

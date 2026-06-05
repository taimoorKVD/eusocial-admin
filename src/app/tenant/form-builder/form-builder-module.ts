import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuilderComponent } from './components/builder/builder.component';
import { FormCanvasComponent } from './components/form-canvas/form-canvas.component';
import { FormFieldPreviewComponent } from './components/form-field-preview/form-field-preview.component';
import { SharedModule } from '../../shared/shared.module';
import { FieldSettingsComponent } from './field-settings/field-settings.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [FieldSettingsComponent],
  imports: [
    CommonModule,
    SharedModule,
    DragDropModule,
    FormsModule,
    BuilderComponent,
    FormCanvasComponent,
    FormFieldPreviewComponent,
  ],
  exports: [
    BuilderComponent,
    FormCanvasComponent,
    FieldSettingsComponent,
    DragDropModule,
  ],
})
export class FormBuilderModule {}

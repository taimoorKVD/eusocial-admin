import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { GlobalFilterComponent } from './global-filter/global-filter';
import { TopHeaderComponent } from './top-header/top-header';
import { ConfirmModalComponent } from './confirm-modal/confirm-modal.component';
import { EuLoaderComponent } from './eu-loader/eu-loader.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { DynamicFormComponent } from './dynamic-form/dynamic-form.component';

@NgModule({
  declarations: [GlobalFilterComponent, TopHeaderComponent, ConfirmModalComponent, EuLoaderComponent, DynamicFormComponent],
  imports: [CommonModule, FormsModule, DragDropModule, ReactiveFormsModule ],
  exports: [GlobalFilterComponent, TopHeaderComponent, ConfirmModalComponent, EuLoaderComponent, DragDropModule, DynamicFormComponent],
})
export class SharedModule {}

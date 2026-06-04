import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { GlobalFilterComponent } from './global-filter/global-filter';
import { TopHeaderComponent } from './top-header/top-header';
import { ConfirmModalComponent } from './confirm-modal/confirm-modal.component';
import { EuLoaderComponent } from './eu-loader/eu-loader.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule({
  declarations: [GlobalFilterComponent, TopHeaderComponent, ConfirmModalComponent, EuLoaderComponent],
  imports: [CommonModule, FormsModule, DragDropModule],
  exports: [GlobalFilterComponent, TopHeaderComponent, ConfirmModalComponent, EuLoaderComponent, DragDropModule],
})
export class SharedModule {}

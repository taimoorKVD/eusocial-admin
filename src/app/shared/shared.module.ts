import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { GlobalFilterComponent } from './global-filter/global-filter';
import { TopHeaderComponent } from './top-header/top-header';
import { ConfirmModalComponent } from './confirm-modal/confirm-modal.component';

@NgModule({
  declarations: [GlobalFilterComponent, TopHeaderComponent, ConfirmModalComponent],
  imports: [CommonModule, FormsModule],
  exports: [GlobalFilterComponent, TopHeaderComponent, ConfirmModalComponent],
})
export class SharedModule {}

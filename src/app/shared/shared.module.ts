import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { GlobalFilterComponent } from './global-filter/global-filter';

@NgModule({
  declarations: [GlobalFilterComponent],
  imports: [CommonModule, FormsModule],
  exports: [GlobalFilterComponent],
})
export class SharedModule {}

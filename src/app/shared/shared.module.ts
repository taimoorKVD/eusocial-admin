import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { GlobalFilterComponent } from './global-filter/global-filter';
import { TopHeaderComponent } from './top-header/top-header';

@NgModule({
  declarations: [GlobalFilterComponent, TopHeaderComponent],
  imports: [CommonModule, FormsModule],
  exports: [GlobalFilterComponent, TopHeaderComponent],
})
export class SharedModule {}

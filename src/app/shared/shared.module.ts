import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { UserFilterComponent } from './user-filter/user-filter';

@NgModule({
  declarations: [UserFilterComponent],
  imports: [CommonModule, FormsModule],
  exports: [UserFilterComponent],
})
export class SharedModule {}

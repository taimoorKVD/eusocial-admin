import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { GlobalFilterComponent } from './global-filter/global-filter';
import { TopHeaderComponent } from './top-header/top-header';
import { ConfirmModalComponent } from './confirm-modal/confirm-modal.component';
import { EuLoaderComponent } from './eu-loader/eu-loader.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { DynamicFormComponent } from './dynamic-form/dynamic-form.component';
import { DynamicListingComponent } from './dynamic-listing/dynamic-listing.component';
import { DropdownPanelDirective } from './directives/dropdown-panel/dropdown-panel.directive';
import { FlatpickrDirective } from './directives/flatpickr/flatpickr.directive';

@NgModule({
  declarations: [
    GlobalFilterComponent,
    TopHeaderComponent,
    ConfirmModalComponent,
    EuLoaderComponent,
    DynamicFormComponent,
    DynamicListingComponent,
    DropdownPanelDirective,
  ],
  imports: [CommonModule, FormsModule, DragDropModule, ReactiveFormsModule, FlatpickrDirective],
  exports: [
    GlobalFilterComponent,
    TopHeaderComponent,
    ConfirmModalComponent,
    EuLoaderComponent,
    DragDropModule,
    DynamicFormComponent,
    DynamicListingComponent,
    DropdownPanelDirective,
    FlatpickrDirective,
  ],
})
export class SharedModule {}

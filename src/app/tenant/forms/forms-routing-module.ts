import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsListComponent } from './forms-list/forms-list.component';
import { FormsEditorComponent } from './forms-editor/forms-editor.component';

// const routes: Routes = [
//   {
//     path: '',
//     component: FormsListComponent
//   },
//   {
//     path: ':module',
//     component: FormsEditorComponent
//   }
// ];

const routes: Routes = [
  {
    path: '',
    component: FormsListComponent
  },
  {
    path: ':module',
    component: FormsEditorComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FormsRoutingModule { }

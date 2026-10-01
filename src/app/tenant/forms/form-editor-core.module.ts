import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormBuilderModule } from '../form-builder/form-builder-module';
import { SharedModule } from '../../shared/shared.module';
import { FormVersionsPanelComponent } from './form-versions-panel/form-versions-panel.component';
import { FormPreviewModalComponent } from './components/form-preview-modal/form-preview-modal.component';
import { FormBuilderWorkspaceComponent } from './components/form-builder-workspace/form-builder-workspace.component';
import { LogicRulesPanelComponent } from './logic-rules-panel/logic-rules-panel.component';

/**
 * Reusable Form Editor building blocks — import this module to embed
 * the form builder workspace, preview modal, or versions panel
 * without pulling in routing or tenant setup pages.
 */
@NgModule({
  declarations: [
    FormVersionsPanelComponent,
    FormPreviewModalComponent,
    FormBuilderWorkspaceComponent,
    LogicRulesPanelComponent,
  ],
  imports: [CommonModule, FormsModule, FormBuilderModule, DragDropModule, SharedModule],
  exports: [
    FormBuilderModule,
    FormVersionsPanelComponent,
    FormPreviewModalComponent,
    FormBuilderWorkspaceComponent,
    LogicRulesPanelComponent,
    DragDropModule,
  ],
})
export class FormEditorCoreModule {}

import { CanDeactivateFn } from '@angular/router';
import { FormsEditorCanDeactivate } from './forms-editor-can-deactivate.interface';

export const formsEditorCanDeactivateGuard: CanDeactivateFn<FormsEditorCanDeactivate> = (
  component
) => component.canDeactivate();

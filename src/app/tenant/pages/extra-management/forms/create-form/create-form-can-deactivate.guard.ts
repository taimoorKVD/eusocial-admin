import { CanDeactivateFn } from '@angular/router';
import { CreateFormCanDeactivate } from './create-form-can-deactivate.interface';

export const createFormCanDeactivateGuard: CanDeactivateFn<CreateFormCanDeactivate> = (
  component,
) => component.canDeactivate();

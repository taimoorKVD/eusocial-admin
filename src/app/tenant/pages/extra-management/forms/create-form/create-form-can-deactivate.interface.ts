export interface CreateFormCanDeactivate {
  canDeactivate(): boolean | Promise<boolean>;
}

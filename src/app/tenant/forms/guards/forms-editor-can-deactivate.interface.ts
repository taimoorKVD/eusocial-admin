export interface FormsEditorCanDeactivate {
  canDeactivate(): boolean | Promise<boolean>;
}

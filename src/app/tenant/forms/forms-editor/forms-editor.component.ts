import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TenantUserService } from '../../../services/tenant-user.service';
// import { FormField } from 'src/app/tenant/form-builder/models/form-field.model';
import { FormField } from '../../form-builder/models/form-field.model';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-forms-editor',
  standalone: false,
  templateUrl: './forms-editor.component.html',
  styleUrl: './forms-editor.component.scss',
})
export class FormsEditorComponent {
  moduleName = '';
  builderFields: any[] = [];
  builderSchema: FormField[] = [];
  selectedFieldId: string | null = null;
  activeTab: 'fields' | 'settings' = 'fields';

  constructor(
    private route: ActivatedRoute,
    private userService: TenantUserService
  ) {}

  get selectedField(): FormField | null {
    if (!this.selectedFieldId) return null;
    return this.builderSchema.find(f => f.id === this.selectedFieldId) || null;
  }

  onSchemaChange(schema: FormField[]) {
    this.builderSchema = schema;
  }

  onUserDrop(event: CdkDragDrop<any[]>) {
    const field = {
      ...event.item.data,
      id: Date.now() + Math.random()
    };

    this.builderSchema = [...this.builderSchema, field];
  }

  onSelectField(field: any) {
    this.selectedFieldId = field.id;
    this.activeTab = 'settings';
  }

  setActiveTab(tab: 'fields' | 'settings') {
    this.activeTab = tab;
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.moduleName = params['module'];
    });
  }

  updateField(updated: any) {
    const index = this.builderSchema.findIndex(
      f => f.id === updated.id
    );

    if (index === -1) return;

    this.builderSchema[index] = {
      ...updated,
      options: updated.options ? [...updated.options] : []
    };

    this.builderSchema = [...this.builderSchema];
  }

  saveUserSchema() {
    const payload = {
      module: this.moduleName,
      fields: this.builderSchema
    };

    console.log("🔥 FINAL PAYLOAD:", payload);

    this.userService.saveFormSchema(this.moduleName, payload)
      .subscribe(res => {
        console.log("✅ SAVED RESPONSE:", res);
      });
  }
}

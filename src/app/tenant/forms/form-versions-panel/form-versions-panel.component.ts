import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { FormField } from '../../form-builder/models/form-field.model';
import {
  FormVersion,
  FormVersionDetail,
  FormVersionService,
} from '../services/form-version.service';

interface VersionAccordionItem {
  version: FormVersion;
  expanded: boolean;
  loading: boolean;
  detail: FormVersionDetail | null;
  restoring: boolean;
  previewing: boolean;
}

@Component({
  selector: 'app-form-versions-panel',
  standalone: false,
  templateUrl: './form-versions-panel.component.html',
  styleUrl: './form-versions-panel.component.scss',
})
export class FormVersionsPanelComponent implements OnChanges {
  @Input() moduleName = '';
  @Output() restore = new EventEmitter<FormField[]>();

  panelOpen = false;
  loading = false;
  error: string | null = null;
  items: VersionAccordionItem[] = [];

  /** Preview modal state */
  previewModalOpen = false;
  previewLabel = '';
  previewFields: FormField[] = [];
  previewLoading = false;

  constructor(
    private versionService: FormVersionService,
    private toastr: ToastrService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['moduleName'] && this.moduleName) {
      this.reset();
    }
  }

  togglePanel(): void {
    this.panelOpen = !this.panelOpen;
    if (this.panelOpen && this.items.length === 0 && !this.loading) {
      this.loadVersions();
    }
  }

  toggleItem(item: VersionAccordionItem): void {
    item.expanded = !item.expanded;
    if (item.expanded && !item.detail && !item.loading) {
      this.loadDetail(item);
    }
  }

  restoreVersion(item: VersionAccordionItem): void {
    if (item.restoring) {
      return;
    }
    item.restoring = true;

    this.versionService.restoreVersion(this.moduleName, item.version.id).subscribe({
      next: detail => {
        item.restoring = false;
        item.detail = detail;
        this.restore.emit(detail.fields);
        this.toastr.success(`${this.versionLabel(item.version)} restored successfully`);
      },
      error: () => {
        item.restoring = false;
        this.toastr.error('Failed to restore version');
      },
    });
  }

  openPreview(item: VersionAccordionItem): void {
    if (item.previewing) {
      return;
    }

    this.previewLabel = this.versionLabel(item.version);
    this.previewFields = [];
    this.previewModalOpen = true;

    if (item.detail) {
      this.previewFields = item.detail.fields;
      return;
    }

    item.previewing = true;
    this.previewLoading = true;

    this.versionService.getVersionDetail(this.moduleName, item.version.id).subscribe({
      next: detail => {
        item.detail = detail;
        item.previewing = false;
        this.previewLoading = false;
        this.previewFields = detail.fields;
      },
      error: () => {
        item.previewing = false;
        this.previewLoading = false;
        this.previewModalOpen = false;
        this.toastr.error('Failed to load version preview');
      },
    });
  }

  closePreview(): void {
    this.previewModalOpen = false;
    this.previewFields = [];
  }

  versionLabel(version: FormVersion): string {
    if (version.label) {
      return version.label;
    }
    const num = version.versionNumber ?? version.id;
    return `Version ${num}`;
  }

  trackById(_: number, item: VersionAccordionItem): number {
    return item.version.id;
  }

  trackByField(_: number, field: FormField): string {
    return field.id;
  }

  reload(): void {
    this.reset();
    this.loadVersions();
  }

  private reset(): void {
    this.items = [];
    this.error = null;
    this.loading = false;
    this.previewModalOpen = false;
    this.previewFields = [];
  }

  private loadVersions(): void {
    this.loading = true;
    this.error = null;

    this.versionService.getVersions(this.moduleName).subscribe({
      next: versions => {
        this.loading = false;
        this.items = versions.map(v => ({
          version: v,
          expanded: false,
          loading: false,
          detail: null,
          restoring: false,
          previewing: false,
        }));
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load versions.';
      },
    });
  }

  private loadDetail(item: VersionAccordionItem): void {
    item.loading = true;

    this.versionService.getVersionDetail(this.moduleName, item.version.id).subscribe({
      next: detail => {
        item.loading = false;
        item.detail = detail;
      },
      error: () => {
        item.loading = false;
        item.expanded = false;
        this.toastr.error('Failed to load version details');
      },
    });
  }
}

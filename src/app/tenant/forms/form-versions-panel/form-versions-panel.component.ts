import {
  ChangeDetectorRef,
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

interface VersionListItem {
  version: FormVersion;
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
  @Output() loadingChange = new EventEmitter<boolean>();

  loading = false;
  error: string | null = null;
  items: VersionListItem[] = [];

  /** Preview modal state */
  previewModalOpen = false;
  previewLabel = '';
  previewFields: FormField[] = [];
  previewLoading = false;

  constructor(
    private versionService: FormVersionService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['moduleName'] && this.moduleName) {
      this.reset();
      this.loadVersions();
    }
  }

  restoreVersion(item: VersionListItem): void {
    if (item.restoring) {
      return;
    }
    item.restoring = true;
    this.loadingChange.emit(true);

    this.versionService.restoreVersion(this.moduleName, item.version.id).subscribe({
      next: detail => {
        item.restoring = false;
        item.detail = detail;
        this.restore.emit(detail.fields);
        this.toastr.success(`${this.versionLabel(item.version)} restored successfully`);
        this.cdr.markForCheck();
      },
      error: () => {
        item.restoring = false;
        this.loadingChange.emit(false);
        this.toastr.error('Failed to restore version');
        this.cdr.markForCheck();
      },
    });
  }

  openPreview(item: VersionListItem): void {
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
        this.cdr.markForCheck();
      },
      error: () => {
        item.previewing = false;
        this.previewLoading = false;
        this.previewModalOpen = false;
        this.toastr.error('Failed to load version preview');
        this.cdr.markForCheck();
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

  trackById(_: number, item: VersionListItem): number {
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
          detail: null,
          restoring: false,
          previewing: false,
        }));
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load versions.';
        this.cdr.markForCheck();
      },
    });
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ImageFile, ImageUploadPurpose } from '../models/image-file.model';
import {
  getImageUploadRejectionReason,
  normalizeImageFile,
} from '../utils/image-field.utils';

/**
 * Uploads / deletes form images via the tenant uploads API.
 *
 * Upload:  POST /api/uploads/images?purpose=reference|answer
 *          FormData: file only (purpose is query param only)
 * Delete:  DELETE /api/uploads/images?key=<key>
 */
@Injectable({
  providedIn: 'root',
})
export class FormImageUploadService {
  private readonly http = inject(HttpClient);
  private readonly uploadUrl = `${environment.tenantApiUrl.replace(/\/$/, '')}/uploads/images`;

  upload(file: File, purpose: ImageUploadPurpose): Observable<ImageFile> {
    const rejection = getImageUploadRejectionReason(file);
    if (rejection) {
      return throwError(() => new Error(rejection));
    }

    const formData = new FormData();
    formData.append('file', file, file.name);

    const params = new HttpParams().set('purpose', purpose);

    return this.http.post<unknown>(this.uploadUrl, formData, { params }).pipe(
      map((response) => this.mapUploadResponse(response, file, purpose)),
    );
  }

  /**
   * Deletes an uploaded image by its backend storage key.
   * Prefer calling this when the UI removes a reference or answer image.
   */
  deleteImage(key: string): Observable<unknown> {
    const trimmed = String(key ?? '').trim();
    if (!trimmed) {
      return throwError(() => new Error('Missing image key for delete.'));
    }

    const params = new HttpParams().set('key', trimmed);
    return this.http.delete(this.uploadUrl, { params });
  }

  private mapUploadResponse(
    response: unknown,
    file: File,
    purpose: ImageUploadPurpose,
  ): ImageFile {
    const root = (response ?? {}) as Record<string, unknown>;
    const data =
      (root['data'] as Record<string, unknown> | undefined) ??
      (root['file'] as Record<string, unknown> | undefined) ??
      (root['upload'] as Record<string, unknown> | undefined) ??
      root;

    const normalized = normalizeImageFile(
      {
        ...data,
        url: data['url'] ?? data['fileUrl'] ?? data['file_url'],
        path: data['path'] ?? data['filePath'] ?? data['file_path'],
        key: data['key'] ?? data['fileKey'] ?? data['file_key'],
        fileName:
          data['fileName'] ?? data['filename'] ?? data['name'] ?? file.name,
        mimeType:
          data['mimeType'] ?? data['mime_type'] ?? data['contentType'] ?? file.type,
        size: data['size'] ?? file.size,
        purpose: data['purpose'] ?? purpose,
      },
      purpose,
    );

    if (!normalized?.url && !normalized?.path) {
      throw new Error('Upload succeeded but no image URL was returned.');
    }

    return {
      ...normalized!,
      purpose,
    };
  }
}

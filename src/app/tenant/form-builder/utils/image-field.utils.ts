import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { DynamicField } from '../../../interfaces/dynamic-field';
import { FormField } from '../models/form-field.model';
import { ImageFile, ImageUploadPurpose } from '../models/image-file.model';
import { environment } from '../../../../environments/environment';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const IMAGE_ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.gif,.webp';

/** Maximum upload size: 5MB. */
export const IMAGE_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const IMAGE_TYPE_ERROR_MESSAGE =
  'Only JPG, JPEG, PNG, GIF, and WEBP images are allowed.';

export const IMAGE_SIZE_ERROR_MESSAGE = 'Image must be 5MB or smaller.';

const DEFAULT_MULTI_MAX_FILES = 10;

export function isAllowedImageMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) {
    return false;
  }
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

export function isAllowedImageFileSize(size: number | null | undefined): boolean {
  return Number.isFinite(Number(size)) && Number(size) > 0 && Number(size) <= IMAGE_MAX_FILE_SIZE_BYTES;
}

/** Returns a user-facing rejection reason, or null if the file is acceptable. */
export function getImageUploadRejectionReason(file: File): string | null {
  if (!isAllowedImageMimeType(file.type)) {
    return IMAGE_TYPE_ERROR_MESSAGE;
  }
  if (!isAllowedImageFileSize(file.size)) {
    return IMAGE_SIZE_ERROR_MESSAGE;
  }
  return null;
}

export function isImageFile(value: unknown): value is ImageFile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasUrl =
    typeof candidate['url'] === 'string' && !!String(candidate['url']).trim();
  const hasPath =
    typeof candidate['path'] === 'string' && !!String(candidate['path']).trim();
  return hasUrl || hasPath;
}

/**
 * Resolve a displayable image src from backend metadata.
 * Prefer absolute `url`; fall back to API origin + `path`.
 */
export function resolveImageDisplayUrl(
  image: Pick<ImageFile, 'url' | 'path'> | null | undefined,
): string {
  if (!image) {
    return '';
  }

  const url = typeof image.url === 'string' ? image.url.trim() : '';
  if (url) {
    return url;
  }

  const path = typeof image.path === 'string' ? image.path.trim() : '';
  if (!path) {
    return '';
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  try {
    const apiOrigin = new URL(environment.tenantApiUrl).origin;
    return `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`;
  } catch {
    return path;
  }
}

export function normalizeImageFile(
  value: unknown,
  fallbackPurpose: ImageUploadPurpose = 'answer',
): ImageFile | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const url = value.trim();
    if (!url) {
      return null;
    }

    const fileName = url.split('/').pop() || 'image';
    return {
      url,
      path: url,
      key: '',
      fileName,
      mimeType: 'image/*',
      size: 0,
      purpose: fallbackPurpose,
    };
  }

  if (!isImageFile(value)) {
    return null;
  }

  const raw = value as ImageFile & Record<string, unknown>;
  const purposeRaw = String(raw.purpose ?? fallbackPurpose).toLowerCase();
  const purpose: ImageUploadPurpose =
    purposeRaw === 'reference' ? 'reference' : 'answer';

  const url =
    typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : '';
  const path =
    typeof raw.path === 'string' && raw.path.trim() ? raw.path.trim() : undefined;

  return {
    url: url || resolveImageDisplayUrl({ url: '', path }),
    path,
    key: typeof raw.key === 'string' ? raw.key : undefined,
    fileName:
      typeof raw.fileName === 'string' && raw.fileName.trim()
        ? raw.fileName.trim()
        : typeof raw['filename'] === 'string' && String(raw['filename']).trim()
          ? String(raw['filename']).trim()
          : 'image',
    mimeType:
      typeof raw.mimeType === 'string' && raw.mimeType.trim()
        ? raw.mimeType.trim()
        : typeof raw['mime_type'] === 'string'
          ? String(raw['mime_type'])
          : 'image/*',
    size: Number.isFinite(Number(raw.size)) ? Number(raw.size) : 0,
    purpose,
  };
}

export function normalizeImageFiles(
  value: unknown,
  fallbackPurpose: ImageUploadPurpose = 'answer',
): ImageFile[] {
  if (value == null || value === '') {
    return [];
  }

  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => normalizeImageFile(item, fallbackPurpose))
    .filter((item): item is ImageFile => !!item);
}

export function cloneImageFiles(files: ImageFile[] | null | undefined): ImageFile[] {
  return (files || []).map((file) => ({ ...file }));
}

export function filterAnswerImages(value: unknown): ImageFile[] {
  return normalizeImageFiles(value, 'answer').filter(
    (file) => file.purpose !== 'reference',
  );
}

export function filterReferenceImages(value: unknown): ImageFile[] {
  return normalizeImageFiles(value, 'reference').map((file) => ({
    ...file,
    purpose: 'reference' as const,
  }));
}

export function readImageMultiple(field: Pick<FormField | DynamicField, 'multiple'>): boolean {
  return field.multiple === true;
}

export function resolveMinFiles(
  field: Pick<FormField | DynamicField, 'minFiles' | 'required' | 'multiple'>,
): number {
  const raw = Number(field.minFiles);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return field.required ? 1 : 0;
}

export function resolveMaxFiles(
  field: Pick<FormField | DynamicField, 'maxFiles' | 'multiple'>,
): number {
  if (!readImageMultiple(field)) {
    return 1;
  }

  const raw = Number(field.maxFiles);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }

  return DEFAULT_MULTI_MAX_FILES;
}

export function sanitizeImageFieldConfig(
  field: Partial<FormField> & Record<string, unknown>,
): {
  referenceImages: ImageFile[];
  multiple: boolean;
  minFiles?: number;
  maxFiles?: number;
} {
  const multiple = field.multiple === true || field['allowMultiple'] === true;
  const referenceImages = filterReferenceImages(
    field.referenceImages ?? field['reference_images'],
  );

  let minFiles: number | undefined;
  const rawMin = Number(field.minFiles ?? field['min_files']);
  if (Number.isFinite(rawMin) && rawMin > 0) {
    minFiles = Math.floor(rawMin);
  }

  let maxFiles: number | undefined;
  const rawMax = Number(field.maxFiles ?? field['max_files']);
  if (Number.isFinite(rawMax) && rawMax > 0) {
    maxFiles = Math.floor(rawMax);
  }

  if (!multiple) {
    maxFiles = 1;
    if (minFiles != null && minFiles > 1) {
      minFiles = 1;
    }
  } else if (maxFiles != null && minFiles != null && minFiles > maxFiles) {
    minFiles = maxFiles;
  }

  return {
    referenceImages,
    multiple,
    minFiles,
    maxFiles: multiple ? maxFiles : 1,
  };
}

/** Validator: only answer images count toward required / min / max. */
export function imageFieldValidator(
  field: DynamicField,
  options?: { required?: boolean; visible?: boolean },
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const visible = options?.visible ?? true;
    if (!visible) {
      return null;
    }

    const files = filterAnswerImages(control.value);
    const required = options?.required ?? !!field.required;
    const minFiles = resolveMinFiles({ ...field, required });
    const maxFiles = resolveMaxFiles(field);

    if (required && files.length === 0) {
      return { required: true };
    }

    if (minFiles > 0 && files.length < minFiles) {
      return { minFiles: { required: minFiles, actual: files.length } };
    }

    if (files.length > maxFiles) {
      return { maxFiles: { max: maxFiles, actual: files.length } };
    }

    return null;
  };
}

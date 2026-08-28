/** Upload purpose for form image files. */
export type ImageUploadPurpose = 'reference' | 'answer';

/**
 * Stored image metadata returned by the upload API and persisted in schema / answers.
 */
export interface ImageFile {
  url: string;
  path?: string;
  key?: string;
  fileName: string;
  mimeType: string;
  size: number;
  purpose: ImageUploadPurpose;
}

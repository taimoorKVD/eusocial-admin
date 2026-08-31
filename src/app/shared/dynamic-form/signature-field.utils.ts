import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { DynamicField } from '../../interfaces/dynamic-field';
import { ImageFile } from '../../tenant/form-builder/models/image-file.model';
import {
  normalizeImageFile,
  resolveImageDisplayUrl,
} from '../../tenant/form-builder/utils/image-field.utils';

/** Single signature answer: ImageFile metadata (same upload API as image answers). */
export type SignatureValue = ImageFile | null;

export function normalizeSignatureValue(value: unknown): SignatureValue {
  if (value == null || value === '') {
    return null;
  }

  // Prefer first item when legacy/array payloads appear.
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeImageFile(item, 'answer');
      if (normalized) {
        return { ...normalized, purpose: 'answer' };
      }
    }
    return null;
  }

  const normalized = normalizeImageFile(value, 'answer');
  return normalized ? { ...normalized, purpose: 'answer' } : null;
}

export function getSignatureDisplayUrl(value: unknown): string {
  const signature = normalizeSignatureValue(value);
  return signature ? resolveImageDisplayUrl(signature) : '';
}

export function hasSignatureValue(value: unknown): boolean {
  return !!getSignatureDisplayUrl(value);
}

export function signatureFieldValidator(
  field: DynamicField,
  options?: { required?: boolean; visible?: boolean },
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const visible = options?.visible ?? true;
    if (!visible) {
      return null;
    }

    const required = options?.required ?? !!field.required;
    if (!required) {
      return null;
    }

    return hasSignatureValue(control.value) ? null : { required: true };
  };
}

/** Fit canvas backing store to its CSS box (HiDPI-aware). */
export function prepareSignatureCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.floor(rect.width) || canvas.clientWidth || 480);
  const cssHeight = Math.max(1, Math.floor(rect.height) || canvas.clientHeight || 160);
  const ratio = Math.max(window.devicePixelRatio || 1, 1);

  const nextWidth = Math.floor(cssWidth * ratio);
  const nextHeight = Math.floor(cssHeight * ratio);

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  return ctx;
}

export function clearSignatureCanvas(canvas: HTMLCanvasElement): void {
  const ctx = prepareSignatureCanvas(canvas);
  if (!ctx) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width || canvas.clientWidth, rect.height || canvas.clientHeight);
}

export function paintSignatureUrlOnCanvas(
  canvas: HTMLCanvasElement,
  url: string,
): Promise<void> {
  return new Promise((resolve) => {
    if (!url) {
      clearSignatureCanvas(canvas);
      resolve();
      return;
    }

    const ctx = prepareSignatureCanvas(canvas);
    if (!ctx) {
      resolve();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || 480;
    const height = rect.height || canvas.clientHeight || 160;
    ctx.clearRect(0, 0, width, height);

    const image = new Image();
    image.onload = () => {
      const scale = Math.min(width / image.width, height / image.height, 1);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const dx = (width - drawWidth) / 2;
      const dy = (height - drawHeight) / 2;
      ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
      resolve();
    };
    image.onerror = () => resolve();
    image.src = url;
  });
}

export function getSignaturePointerPosition(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

/** Convert the canvas drawing to a PNG File for the shared image upload API. */
export function canvasToSignatureFile(
  canvas: HTMLCanvasElement,
  fileName = `signature-${Date.now()}.png`,
): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size <= 0) {
          resolve(null);
          return;
        }
        resolve(new File([blob], fileName, { type: 'image/png' }));
      },
      'image/png',
      0.92,
    );
  });
}

/** True when the canvas has any non-transparent ink (rough empty check). */
export function isSignatureCanvasEmpty(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx || !canvas.width || !canvas.height) {
    return true;
  }

  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) {
        return false;
      }
    }
    return true;
  } catch {
    // Cross-origin paint may taint the canvas; treat as non-empty if we have pixels.
    return false;
  }
}

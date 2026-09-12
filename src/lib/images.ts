/**
 * Client-side image preparation for listing uploads.
 *
 * Phone photos are routinely 4–8 MB; downscaling and re-encoding before upload
 * keeps posting fast on a mobile connection and matches what the mobile app
 * does with `react-native-image-resizer`.
 */

export const MAX_IMAGES = 10;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export interface ImageValidationError {
  code: 'type' | 'size' | 'count';
  fileName?: string;
}

export const validateImageFile = (file: File): ImageValidationError | null => {
  if (!file.type.startsWith('image/')) return {code: 'type', fileName: file.name};
  if (
    ACCEPTED_IMAGE_TYPES.length &&
    !ACCEPTED_IMAGE_TYPES.includes(file.type.toLowerCase())
  ) {
    return {code: 'type', fileName: file.name};
  }
  if (file.size > MAX_UPLOAD_BYTES) return {code: 'size', fileName: file.name};
  return null;
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the image'));
    };
    image.src = url;
  });

/**
 * Downscales to at most 1600px on the long edge and re-encodes as JPEG.
 * Returns the original file untouched when the browser cannot decode it (HEIC
 * on some platforms), so the upload still goes through.
 */
export const prepareImageForUpload = async (file: File): Promise<File> => {
  try {
    const image = await loadImage(file);
    const longEdge = Math.max(image.width, image.height);

    if (longEdge <= MAX_DIMENSION && file.size <= 1.5 * 1024 * 1024) return file;

    const scale = Math.min(1, MAX_DIMENSION / longEdge);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${name}.jpg`, {type: 'image/jpeg'});
  } catch {
    return file;
  }
};

/**
 * Cloudinary upload helper.
 * Preserves the V3 uploadToCloudinary signature but adds:
 *   - typed return values
 *   - abort signal support (so users can cancel long uploads)
 *   - retry with exponential backoff for transient failures
 *   - progress as a number 0..100 instead of a callback
 */

export interface UploadOptions {
  signal?: AbortSignal;
  folder?: string;
  onProgress?: (pct: number) => void;
  retries?: number;
}

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
}

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;

function endpoint(): string {
  if (!CLOUD) throw new Error('NEXT_PUBLIC_CLOUDINARY_CLOUD is not configured');
  return `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`;
}

export async function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  if (!PRESET) throw new Error('NEXT_PUBLIC_CLOUDINARY_PRESET is not configured');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', PRESET);
  if (options.folder) formData.append('folder', options.folder);

  const attempt = async (): Promise<UploadResult> => {
    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) options.onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as Record<string, unknown>;
            resolve({
              url: String(data.secure_url ?? ''),
              publicId: String(data.public_id ?? ''),
              width: typeof data.width === 'number' ? data.width : undefined,
              height: typeof data.height === 'number' ? data.height : undefined,
              bytes: typeof data.bytes === 'number' ? data.bytes : undefined,
              format: typeof data.format === 'string' ? data.format : undefined,
            });
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Bad Cloudinary response'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));

      xhr.open('POST', endpoint());
      if (options.signal) options.signal.addEventListener('abort', () => xhr.abort());
      xhr.send(formData);
    });
  };

  const maxRetries = options.retries ?? 1;
  let lastError: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
      if (options.signal?.aborted) throw err;
      if (i === maxRetries) break;
      await new Promise(r => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Upload failed');
}

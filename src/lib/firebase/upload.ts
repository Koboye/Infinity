export interface UploadResult { url: string; publicId: string; }

export async function uploadFile(file: File, options: { onProgress?: (pct: number) => void } = {}): Promise<UploadResult> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;
  if (!cloud || !preset) throw new Error('Cloudinary not configured');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) options.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({ url: data.secure_url, publicId: data.public_id });
      } else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`);
    xhr.send(formData);
  });
}

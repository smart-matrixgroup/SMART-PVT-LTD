// ─────────────────────────────────────────────────────────────────
//  Attendance Camera & Monochrome Image Optimization
//  Captures selfie from camera/video or file input, converts to sharp
//  monochrome (black & white), and compresses to lightweight KB size.
// ─────────────────────────────────────────────────────────────────

/**
 * Convert canvas image data to high-contrast monochrome (black & white).
 * Uses human eye luminance weighting (0.299 R + 0.587 G + 0.114 B)
 * with a slight contrast boost for crisp face visibility.
 */
export function applyMonochromeFilter(ctx, width, height, contrastBoost = 1.15) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const factor = (259 * (contrastBoost * 255 + 255)) / (255 * (259 - contrastBoost * 255));

  for (let i = 0; i < d.length; i += 4) {
    // Luminance
    let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Contrast boost
    gray = factor * (gray - 128) + 128;
    gray = Math.max(0, Math.min(255, Math.round(gray)));

    d[i] = gray;     // R
    d[i + 1] = gray; // G
    d[i + 2] = gray; // B
    // d[i + 3] stays alpha
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Calculate approximate byte size and KB of a base64 data URL.
 */
export function getDataUrlSize(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return { bytes: 0, kb: '0.0' };
  const commaIdx = dataUrl.indexOf(',');
  const b64Str = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const padding = (b64Str.match(/=*$/) || [''])[0].length;
  const bytes = Math.max(0, Math.round((b64Str.length * 3) / 4 - padding));
  const kb = (bytes / 1024).toFixed(1);
  return { bytes, kb };
}

/**
 * Capture frame from an HTML5 <video> element, crop square / resize to
 * lightweight resolution, apply monochrome filter, and compress as JPEG.
 *
 * @param {HTMLVideoElement} video
 * @param {Object} options
 * @returns {Promise<{ dataUrl: string, sizeBytes: number, sizeKb: string, width: number, height: number, timestamp: number }>}
 */
export async function captureVideoToMonochrome(video, { maxDim = 360, quality = 0.65 } = {}) {
  if (!video || !video.videoWidth) {
    throw new Error('Video stream is not ready for capture.');
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  // Center-crop to square
  const minDim = Math.min(vw, vh);
  const sx = Math.floor((vw - minDim) / 2);
  const sy = Math.floor((vh - minDim) / 2);

  const targetDim = Math.min(maxDim, minDim);
  const canvas = document.createElement('canvas');
  canvas.width = targetDim;
  canvas.height = targetDim;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Draw square cropped video
  ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, targetDim, targetDim);

  // Apply monochrome filter
  applyMonochromeFilter(ctx, targetDim, targetDim);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const { bytes, kb } = getDataUrlSize(dataUrl);

  return {
    dataUrl,
    sizeBytes: bytes,
    sizeKb: kb,
    width: targetDim,
    height: targetDim,
    timestamp: Date.now(),
  };
}

/**
 * Process an uploaded image File or Blob into monochrome compressed JPEG.
 * Useful as a camera fallback for mobile devices or file upload.
 *
 * @param {File|Blob} file
 * @param {Object} options
 * @returns {Promise<{ dataUrl: string, sizeBytes: number, sizeKb: string, width: number, height: number, timestamp: number }>}
 */
export function processFileToMonochrome(file, { maxDim = 360, quality = 0.65 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No image file provided.'));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.onload = () => {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const minDim = Math.min(iw, ih);
        const sx = Math.floor((iw - minDim) / 2);
        const sy = Math.floor((ih - minDim) / 2);

        const targetDim = Math.min(maxDim, minDim);
        const canvas = document.createElement('canvas');
        canvas.width = targetDim;
        canvas.height = targetDim;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetDim, targetDim);
        applyMonochromeFilter(ctx, targetDim, targetDim);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const { bytes, kb } = getDataUrlSize(dataUrl);

        resolve({
          dataUrl,
          sizeBytes: bytes,
          sizeKb: kb,
          width: targetDim,
          height: targetDim,
          timestamp: Date.now(),
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

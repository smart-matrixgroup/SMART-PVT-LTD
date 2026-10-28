import { buildDoc } from './QuotationDocStudio';
import { TEMPLATE_QUOTATION, renderTemplate } from './quotationTemplateRenderer';

// ────────────────────────────────────────────────────────────────────
// Automatic quotation image
//
// Renders the quotation onto the owner's letterhead exactly like the
// Image Studio, but with no UI: the auto-filled quotation document is
// drawn straight onto an offscreen canvas and returned as a JPEG blob.
// The letterhead + screenshots are cached, so repeat saves are fast.
// ────────────────────────────────────────────────────────────────────

const imgCache = new Map();

function loadImage(src, crossOrigin) {
  if (!src) return Promise.resolve(null);
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise(resolve => {
    const im = new Image();
    if (crossOrigin) im.crossOrigin = 'anonymous';
    im.onload  = () => resolve(im.naturalWidth ? im : null);
    im.onerror = () => resolve(null);
    im.src = src;
    if (im.complete && im.naturalWidth) resolve(im);
  });
  imgCache.set(src, p);
  return p;
}

// Warm the letterhead early (called when the quotations page mounts) so
// "Save & Send" only has to paint, not wait on the network.
export function preloadQuotationTemplate() {
  return loadImage(TEMPLATE_QUOTATION.src);
}

export async function renderQuotationImageBlob(quotation, bank) {
  if (!quotation) throw new Error('No quotation to render.');
  const [tpl, laptop, phone] = await Promise.all([
    loadImage(TEMPLATE_QUOTATION.src),
    loadImage(quotation.laptopShot || ''),
    loadImage(quotation.phoneShot || ''),
  ]);
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* fonts are optional */ }
  }
  const d = buildDoc(quotation, bank || null);
  const canvas = document.createElement('canvas');
  // Acquired before renderTemplate so the context is CPU-backed: the renderer
  // reads pixel blocks back to lift the sample text off the letterhead.
  canvas.getContext('2d', { willReadFrequently: true });
  renderTemplate(canvas, tpl, {
    ...d,
    shots: { laptop: laptop || null, phone: phone || null },
  });
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Could not build the quotation image.');
  return blob;
}

// Share the finished image straight to WhatsApp (mobile) via the native
// share sheet; returns true when the sheet handled it.
export async function shareImageFile(blob, fileName, text) {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  const file = new File([blob], fileName || 'quotation.jpg', { type: 'image/jpeg' });
  if (!navigator.canShare({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: 'Quotation', text: text || '' });
    return true;
  } catch (e) {
    // User dismissed the sheet — not an error worth surfacing.
    return e?.name === 'AbortError' ? true : false;
  }
}

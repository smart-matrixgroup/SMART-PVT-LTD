import QRCode from 'qrcode';

// The public site that QRs must always point at. smartpvtltd.com is NOT
// registered (a scan there shows a "503 Backend Error" parking page), and
// localhost / LAN previews are unreachable from a phone — so QR URLs are
// pinned to the live hosting origin unless the app is already running on a
// real public domain.
export const PUBLIC_APP_ORIGIN = 'https://smart-erp-2a2d3.web.app';

function isPrivateHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

export function getPublicAppOrigin() {
  const origin = typeof window !== 'undefined' ? window.location?.origin : '';
  if (!origin) return PUBLIC_APP_ORIGIN;
  try {
    const u = new URL(origin);
    if (isPrivateHost(u.hostname)) return PUBLIC_APP_ORIGIN;
    // Code-host previews / tunnels are not stable for printed QRs either.
    if (/\.(qoder\.site|ngrok-free\.app|trycloudflare\.com|vercel\.app)$/.test(u.hostname)) {
      return PUBLIC_APP_ORIGIN;
    }
    return origin.replace(/\/+$/, '');
  } catch {
    return PUBLIC_APP_ORIGIN;
  }
}

const base = () => getPublicAppOrigin();

/**
 * Returns the stable public URL for a given service slug.
 */
export function getServicePublicUrl(slug) {
  return `${base()}/services/qr/${encodeURIComponent(slug)}`;
}

/**
 * Returns the public URL for the full Services listing (master services QR).
 */
export function getServicesPublicUrl() {
  return `${base()}/services`;
}

/**
 * Returns the public URL for the General Client Request Onboarding Form.
 */
export function getClientRequestPublicUrl() {
  return `${base()}/request?source=qr`;
}

/**
 * Office attendance QR — staff scan this at the office, sign in with the
 * account created by the admin, and only check in / check out.
 */
export function getStaffCheckInPublicUrl() {
  return `${base()}/staff-checkin`;
}

export async function generateStaffCheckInQRCodeDataUrl(options = {}) {
  const url = getStaffCheckInPublicUrl();
  try {
    return await QRCode.toDataURL(url, {
      width: options.width || 600,
      margin: options.margin !== undefined ? options.margin : 2,
      color: {
        dark: options.darkColor || '#040D1F',
        light: options.lightColor || '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Staff check-in QR code generation failed:', err);
    return null;
  }
}

export function downloadStaffCheckInQRPng(dataUrl) {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.download = 'SMART-Staff-Attendance-QR.png';
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates a high-resolution base64 PNG Data URL for a given service QR code.
 */
export async function generateServiceQRCodeDataUrl(slug, options = {}) {
  const url = getServicePublicUrl(slug);
  try {
    return await QRCode.toDataURL(url, {
      width: options.width || 450,
      margin: options.margin !== undefined ? options.margin : 2,
      color: {
        dark: options.darkColor || '#040D1F',
        light: options.lightColor || '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('QR code generation failed:', err);
    return null;
  }
}

/**
 * Generates a high-resolution base64 PNG Data URL for the General Client Request QR code.
 */
export async function generateClientRequestQRCodeDataUrl(options = {}) {
  const url = getClientRequestPublicUrl();
  try {
    return await QRCode.toDataURL(url, {
      width: options.width || 500,
      margin: options.margin !== undefined ? options.margin : 2,
      color: {
        dark: options.darkColor || '#040D1F',
        light: options.lightColor || '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Master client request QR code generation failed:', err);
    return null;
  }
}

/**
 * Triggers a download of the QR code PNG with an informative filename.
 */
export function downloadQRCodePng(dataUrl, serviceTitle) {
  if (!dataUrl) return;
  const link = document.createElement('a');
  const safeName = (serviceTitle || 'service')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  link.download = `SMART-QR-${safeName}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates the MASTER services QR — one code that opens the full
 * "All Services" listing (/services), not a single service.
 */
export async function generateServicesQRCodeDataUrl(options = {}) {
  const url = getServicesPublicUrl();
  try {
    return await QRCode.toDataURL(url, {
      width: options.width || 500,
      margin: options.margin !== undefined ? options.margin : 2,
      color: {
        dark: options.darkColor || '#040D1F',
        light: options.lightColor || '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Master services QR code generation failed:', err);
    return null;
  }
}

/**
 * Downloads the master services QR PNG.
 */
export function downloadServicesQRPng(dataUrl) {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.download = 'SMART-Services-Master-QR.png';
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Triggers a download of the Master Client Request QR code PNG.
 */
export function downloadClientRequestQRPng(dataUrl) {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.download = 'SMART-Client-Request-QR.png';
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

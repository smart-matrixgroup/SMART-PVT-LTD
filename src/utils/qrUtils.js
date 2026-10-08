import QRCode from 'qrcode';
import { company } from '../config/company';

/**
 * Returns the stable public URL for a given service slug.
 */
export function getServicePublicUrl(slug) {
  const base = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : (company.website || 'https://smartpvtltd.com');
  return `${base.replace(/\/+$/, '')}/services/qr/${encodeURIComponent(slug)}`;
}

/**
 * Returns the public URL for the General Client Request Onboarding Form.
 */
export function getClientRequestPublicUrl() {
  const base = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : (company.website || 'https://smartpvtltd.com');
  return `${base.replace(/\/+$/, '')}/request?source=qr`;
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

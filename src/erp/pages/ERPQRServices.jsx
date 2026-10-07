import React, { useState, useEffect } from 'react';
import { services as defaultServices } from '../../config/services';
import { company } from '../../config/company';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPEmpty, C
} from '../components/ERPui';
import {
  getServicePublicUrl,
  generateServiceQRCodeDataUrl,
  downloadQRCodePng
} from '../../utils/qrUtils';
import {
  QrCode, Download, Printer, ExternalLink, Copy, Check,
  Search, Eye, Sparkles, Building2, Globe, FileCheck, Calculator,
  Cpu, Smartphone, Code2, LayoutGrid, Receipt, ShieldCheck
} from 'lucide-react';

export default function ERPQRServices() {
  const [servicesList] = useState(defaultServices);
  const [qrMap, setQrMap] = useState({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [previewService, setPreviewService] = useState(null);
  const [showPrintAll, setShowPrintAll] = useState(false);

  // Pre-generate QR codes for all services
  useEffect(() => {
    let isMounted = true;
    async function loadAllQRs() {
      const map = {};
      for (const s of servicesList) {
        const dataUrl = await generateServiceQRCodeDataUrl(s.slug, { width: 450 });
        if (dataUrl) {
          map[s.slug] = dataUrl;
        }
      }
      if (isMounted) setQrMap(map);
    }
    loadAllQRs();
    return () => { isMounted = false; };
  }, [servicesList]);

  const categories = ['All', ...new Set(servicesList.map(s => s.category))];

  const filtered = servicesList.filter(s => {
    const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase()) ||
      (s.shortDesc || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleCopyUrl = (slug) => {
    const url = getServicePublicUrl(slug);
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handlePrintSingle = (service) => {
    const qr = qrMap[service.slug];
    const url = getServicePublicUrl(service.slug);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${service.title} — QR Code</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; margin: 0; padding: 40px; color: #040D1F; }
            .card { border: 2px solid #0066FF; border-radius: 20px; padding: 30px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .logo { height: 44px; margin-bottom: 8px; }
            .company { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; }
            .tagline { font-size: 11px; color: #64748B; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: 800; color: #0066FF; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #475569; margin-bottom: 16px; }
            .qr-img { width: 260px; height: 260px; margin: 0 auto; display: block; border-radius: 12px; }
            .url { font-size: 11px; font-family: monospace; color: #64748B; margin-top: 14px; word-break: break-all; }
            .scan-text { font-size: 12px; font-weight: 700; color: #0066FF; margin-top: 10px; }
            @media print { body { padding: 0; } .card { box-shadow: none; border-width: 1px; } }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="/logos/SMART_LOGO_LM.png" class="logo" alt="SMART Pvt Ltd" onerror="this.style.display='none'" />
            <div class="company">${company.fullName}</div>
            <div class="tagline">${company.tagline}</div>
            <div class="title">${service.title}</div>
            <div class="subtitle">${service.subtitle || service.category}</div>
            <img src="${qr}" class="qr-img" alt="QR" />
            <div class="scan-text">Scan with any smartphone camera</div>
            <div class="url">${url}</div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handlePrintAll = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const cardsHtml = servicesList.map(s => {
      const qr = qrMap[s.slug] || '';
      const url = getServicePublicUrl(s.slug);
      return `
        <div class="grid-card">
          <div class="card-brand">${company.name}</div>
          <div class="card-title">${s.title}</div>
          <div class="card-cat">${s.category}</div>
          <img src="${qr}" class="card-qr" />
          <div class="card-hint">Scan to view details</div>
          <div class="card-url">${url}</div>
        </div>
      `;
    }).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${company.fullName} — All Services QR Catalog</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #040D1F; }
            .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #E2E8F0; padding-bottom: 16px; }
            .header h1 { margin: 0; font-size: 22px; color: #0066FF; }
            .header p { margin: 4px 0 0; font-size: 12px; color: #64748B; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
            .grid-card { border: 1.5px solid #CBD5E1; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
            .card-brand { font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #64748B; text-transform: uppercase; }
            .card-title { font-size: 14px; font-weight: 800; color: #040D1F; margin: 4px 0 2px; }
            .card-cat { font-size: 10px; color: #0066FF; font-weight: 600; margin-bottom: 8px; }
            .card-qr { width: 140px; height: 140px; margin: 0 auto; display: block; }
            .card-hint { font-size: 10px; font-weight: 700; color: #475569; margin-top: 6px; }
            .card-url { font-size: 8px; color: #94A3B8; word-break: break-all; margin-top: 2px; font-family: monospace; }
            @media print { body { padding: 10mm; } .grid { gap: 10mm; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${company.fullName} — Official QR Code Directory</h1>
            <p>Direct Public Service Portals · Production Domain: ${company.website}</p>
          </div>
          <div class="grid">
            ${cardsHtml}
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Summary & Actions Bar ── */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '18px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #0066FF, #00D9FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 16px rgba(0,102,255,0.3)',
          }}>
            <QrCode size={22} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.text, letterSpacing: '0.2px' }}>
              Service QR Code System
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              Unique, high-resolution QR codes pointing to stable public URLs ({company.website}/services/qr/[slug])
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ERPBtn variant="secondary" onClick={handlePrintAll}>
            <Printer size={13} /> Print All QR Catalog
          </ERPBtn>
        </div>
      </div>

      {/* ── Filter & Search Row ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search service by name or slug..."
            style={{
              width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '8px 14px 8px 32px', color: C.text, fontSize: 12,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                border: selectedCategory === cat ? 'none' : `1px solid ${C.border}`,
                background: selectedCategory === cat ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.7)',
                color: selectedCategory === cat ? '#fff' : C.muted,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>
          Showing {filtered.length} service{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Services QR Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {filtered.map(service => {
          const qrUrl = qrMap[service.slug];
          const publicUrl = getServicePublicUrl(service.slug);
          const isCopied = copiedSlug === service.slug;

          return (
            <div
              key={service.slug}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                position: 'relative',
                transition: 'all 0.2s',
                backdropFilter: 'blur(12px)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = C.borderHi;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                    {service.title}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {service.subtitle || service.category}
                  </div>
                </div>
                <ERPBadge status="active" label={service.category} size="sm" />
              </div>

              {/* QR Preview Card */}
              <div style={{
                background: '#fff',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 180,
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.05)',
              }}>
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt={service.title}
                    style={{ width: 160, height: 160, display: 'block', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ color: '#040D1F', fontSize: 11, fontWeight: 600 }}>
                    Generating QR...
                  </div>
                )}
              </div>

              {/* Public URL row */}
              <div style={{
                background: 'rgba(10,24,56,0.6)',
                border: `1px solid ${C.border}40`,
                borderRadius: 8,
                padding: '7px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}>
                <span style={{
                  fontSize: 10, color: C.cyan, fontFamily: 'monospace',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  flex: 1,
                }}>
                  {publicUrl}
                </span>

                <button
                  onClick={() => handleCopyUrl(service.slug)}
                  title="Copy public link"
                  style={{
                    background: 'none', border: 'none', color: isCopied ? C.green : C.muted,
                    cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center',
                  }}
                >
                  {isCopied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 'auto' }}>
                <ERPBtn
                  size="sm"
                  variant="secondary"
                  onClick={() => setPreviewService(service)}
                  style={{ justifyContent: 'center' }}
                >
                  <Eye size={12} /> View
                </ERPBtn>

                <ERPBtn
                  size="sm"
                  variant="primary"
                  onClick={() => downloadQRCodePng(qrUrl, service.title)}
                  style={{ justifyContent: 'center' }}
                >
                  <Download size={12} /> PNG
                </ERPBtn>

                <ERPBtn
                  size="sm"
                  variant="secondary"
                  onClick={() => handlePrintSingle(service)}
                  style={{ justifyContent: 'center' }}
                >
                  <Printer size={12} /> Print
                </ERPBtn>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <ERPEmpty
          icon={QrCode}
          title="No services match your search"
          sub="Try another keyword or select All categories."
        />
      )}

      {/* ── Single Service QR Modal Preview ── */}
      <ERPModal
        isOpen={!!previewService}
        onClose={() => setPreviewService(null)}
        title={previewService ? `${previewService.title} — QR Card` : ''}
        width={420}
      >
        {previewService && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
            <div style={{
              background: '#fff', borderRadius: 16, padding: 20,
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            }}>
              <img
                src={qrMap[previewService.slug]}
                alt={previewService.title}
                style={{ width: 240, height: 240, display: 'block' }}
              />
            </div>

            <div style={{ width: '100%' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>
                {previewService.title}
              </div>
              <div style={{ fontSize: 12, color: C.cyan, marginTop: 2 }}>
                {previewService.category} · {previewService.startingPrice || 'Custom Quote'}
              </div>
              <div style={{
                fontSize: 11, color: C.muted, marginTop: 8,
                background: 'rgba(10,24,56,0.6)', padding: '6px 12px',
                borderRadius: 8, wordBreak: 'break-all', fontFamily: 'monospace',
              }}>
                {getServicePublicUrl(previewService.slug)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <a
                href={`/services/qr/${previewService.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10,
                  background: 'rgba(0,102,255,0.15)', border: `1px solid ${C.blue}`,
                  color: C.cyan, fontSize: 12, fontWeight: 700,
                }}
              >
                <ExternalLink size={13} /> Test Public Page
              </a>

              <ERPBtn
                variant="primary"
                onClick={() => downloadQRCodePng(qrMap[previewService.slug], previewService.title)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Download size={13} /> Download PNG
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}

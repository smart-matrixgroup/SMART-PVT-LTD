// ─────────────────────────────────────────────────────────────────
//  ERP QR Services & Master Client Request QR System.
//  1. Dedicated Master Client Request QR Code (PNG):
//     When scanned by any phone, opens the public Client Request Form
//     (/request?source=qr), which posts directly to ERP Leads!
//  2. Per-Service QR Codes Directory for individual services.
// ─────────────────────────────────────────────────────────────────
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
  downloadQRCodePng,
  getClientRequestPublicUrl,
  generateClientRequestQRCodeDataUrl,
  downloadClientRequestQRPng,
} from '../../utils/qrUtils';
import {
  QrCode, Download, Printer, ExternalLink, Copy, Check,
  Search, Eye, Sparkles, Building2, Globe, FileCheck, Calculator,
  Cpu, Smartphone, Code2, LayoutGrid, Receipt, ShieldCheck,
  Send, SmartphoneCharging
} from 'lucide-react';

export default function ERPQRServices() {
  const [servicesList] = useState(defaultServices);
  const [activeTab, setActiveTab] = useState('master'); // 'master' | 'services'
  const [qrMap, setQrMap] = useState({});
  const [masterQr, setMasterQr] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [copiedMaster, setCopiedMaster] = useState(false);
  const [previewService, setPreviewService] = useState(null);

  // Generate QR codes on mount
  useEffect(() => {
    let isMounted = true;
    async function loadAllQRs() {
      // 1. Generate Master Client Request QR Code
      const masterDataUrl = await generateClientRequestQRCodeDataUrl({ width: 600 });
      if (isMounted && masterDataUrl) {
        setMasterQr(masterDataUrl);
      }

      // 2. Generate per-service QRs
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

  const masterRequestUrl = getClientRequestPublicUrl();

  const handleCopyMasterUrl = () => {
    navigator.clipboard.writeText(masterRequestUrl);
    setCopiedMaster(true);
    setTimeout(() => setCopiedMaster(false), 2000);
  };

  const handlePrintMasterStandee = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SMART Pvt Ltd — Client Project Request Standee</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; text-align: center; margin: 0; padding: 40px; color: #040D1F; background: #fff; }
            .standee { border: 3px solid #0066FF; border-radius: 24px; padding: 36px 30px; max-width: 440px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            .logo { height: 48px; margin-bottom: 12px; }
            .company { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; color: #040D1F; }
            .tagline { font-size: 12px; color: #64748B; margin-bottom: 24px; }
            .cta-badge { display: inline-block; background: #E0E7FF; color: #1D4ED8; font-size: 11px; font-weight: 800; padding: 5px 14px; border-radius: 20px; margin-bottom: 14px; }
            .heading { font-size: 22px; font-weight: 900; color: #0066FF; margin-bottom: 6px; }
            .subheading { font-size: 13px; color: #475569; margin-bottom: 20px; line-height: 1.5; }
            .qr-wrap { background: #F8FAFC; border: 2px dashed #CBD5E1; border-radius: 20px; padding: 18px; display: inline-block; margin-bottom: 16px; }
            .qr-img { width: 280px; height: 280px; display: block; border-radius: 12px; }
            .steps { font-size: 12px; font-weight: 700; color: #040D1F; margin-top: 10px; }
            .steps span { color: #0066FF; }
            .url { font-size: 10.5px; font-family: monospace; color: #64748B; margin-top: 14px; word-break: break-all; }
            @media print { body { padding: 0; } .standee { box-shadow: none; border-width: 2px; } }
          </style>
        </head>
        <body>
          <div class="standee">
            <img src="/logos/SMART_LOGO_LM.png" class="logo" alt="SMART Pvt Ltd" onerror="this.style.display='none'" />
            <div class="company">${company.fullName}</div>
            <div class="tagline">${company.tagline}</div>
            <div class="cta-badge">OFFICIAL CLIENT ONBOARDING</div>
            <div class="heading">Scan to Request a Project</div>
            <div class="subheading">Scan with any smartphone camera to fill your requirements directly to our engineering team.</div>
            <div class="qr-wrap">
              <img src="${masterQr}" class="qr-img" alt="Request QR" />
            </div>
            <div class="steps">1. Scan QR Code &nbsp;•&nbsp; 2. Enter Requirements &nbsp;•&nbsp; 3. Receive Quotation</div>
            <div class="url">${masterRequestUrl}</div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handlePrintServiceSingle = (service) => {
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
            .company { font-size: 16px; font-weight: 900; }
            .title { font-size: 20px; font-weight: 800; color: #0066FF; margin-bottom: 4px; }
            .qr-img { width: 260px; height: 260px; margin: 0 auto; display: block; border-radius: 12px; }
            .url { font-size: 11px; font-family: monospace; color: #64748B; margin-top: 14px; word-break: break-all; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="/logos/SMART_LOGO_LM.png" class="logo" alt="SMART Pvt Ltd" onerror="this.style.display='none'" />
            <div class="company">${company.fullName}</div>
            <div class="title">${service.title}</div>
            <img src="${qr}" class="qr-img" alt="QR" />
            <div class="url">${url}</div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const categories = ['All', ...new Set(servicesList.map(s => s.category))];

  const filtered = servicesList.filter(s => {
    const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase()) ||
      (s.shortDesc || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Top Header / Tab Switcher ── */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '18px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'linear-gradient(135deg, #0066FF, #00D9FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 16px rgba(0,102,255,0.4)',
          }}>
            <QrCode size={24} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.text, letterSpacing: '0.2px' }}>
              SMART QR Code Portal
            </div>
            <div style={{ fontSize: 11, color: C.subtle, marginTop: 2 }}>
              Master Client Request QR Code (PNG) & Individual Service QR Directory
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTab('master')}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: activeTab === 'master' ? 'linear-gradient(135deg, #0066FF, #1787FF)' : 'rgba(10,24,56,0.8)',
              color: activeTab === 'master' ? '#fff' : C.muted,
              border: activeTab === 'master' ? 'none' : `1px solid ${C.border}`,
              boxShadow: activeTab === 'master' ? '0 4px 14px rgba(0,102,255,0.35)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
            }}
          >
            <Sparkles size={13} /> Master Request QR (PNG)
          </button>
          <button
            onClick={() => setActiveTab('services')}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: activeTab === 'services' ? 'linear-gradient(135deg, #0066FF, #1787FF)' : 'rgba(10,24,56,0.8)',
              color: activeTab === 'services' ? '#fff' : C.muted,
              border: activeTab === 'services' ? 'none' : `1px solid ${C.border}`,
              boxShadow: activeTab === 'services' ? '0 4px 14px rgba(0,102,255,0.35)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
            }}
          >
            <LayoutGrid size={13} /> Service QRs Catalog ({servicesList.length})
          </button>
        </div>
      </div>

      {/* ── TAB 1: MASTER CLIENT REQUEST QR CODE (PNG) ───────────── */}
      {activeTab === 'master' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ERPPanel style={{ overflow: 'hidden' }}>
            <ERPPanelHeader
              title="Master Client Project Request QR Code (PNG)"
              icon="📱"
              action={
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                  background: 'rgba(24,199,122,0.15)', color: C.green, border: '1px solid rgba(24,199,122,0.3)'
                }}>
                  ✓ Direct ERP Leads Pipeline
                </span>
              }
            />

            <div style={{
              padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 24, alignItems: 'center'
            }}>
              {/* QR Image Box */}
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: `2px dashed ${C.borderHi}`,
                borderRadius: 20, padding: 24, textAlign: 'center', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
              }}>
                {masterQr ? (
                  <div style={{
                    background: '#FFFFFF', padding: 16, borderRadius: 16,
                    boxShadow: '0 8px 30px rgba(0,102,255,0.25)', display: 'inline-block'
                  }}>
                    <img
                      src={masterQr}
                      alt="SMART Client Request QR Code"
                      style={{ width: 240, height: 240, display: 'block', borderRadius: 8 }}
                    />
                  </div>
                ) : (
                  <div style={{ padding: 60, color: C.muted }}>Generating Master QR PNG...</div>
                )}
                <div style={{ fontSize: 11, color: C.muted, marginTop: 12 }}>
                  High-Resolution PNG (300 DPI) • Error Correction High (H)
                </div>
              </div>

              {/* Instructions and Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>
                    Scan to Open Client Request Form
                  </div>
                  <p style={{ fontSize: 12.5, color: C.subtle, lineHeight: 1.6, marginTop: 6 }}>
                    Print or display this single QR code on tabletop standees, business cards, brochures, or your office entrance.
                    When any client scans this code with their smartphone camera:
                  </p>
                </div>

                {/* Workflow steps */}
                <div style={{
                  background: 'rgba(10,24,56,0.7)', borderRadius: 12, border: `1px solid ${C.border}`,
                  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.text }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: C.blue, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                    Client scans the QR code on their smartphone.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.text }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: C.blue, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                    Fills in Name, WhatsApp, Email, Service Needed & Project Details.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.text }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: C.green, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                    <span>Submission appears <strong>instantly in ERP Leads</strong> with source <em>"QR Code Scan"</em>!</span>
                  </div>
                </div>

                {/* Direct Link box */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>TARGET FORM URL :</div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(4,13,31,0.8)',
                    border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px'
                  }}>
                    <input
                      readOnly
                      value={masterRequestUrl}
                      style={{
                        flex: 1, background: 'none', border: 'none', color: C.cyan,
                        fontSize: 11.5, fontFamily: 'monospace', outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCopyMasterUrl}
                      style={{
                        background: copiedMaster ? 'rgba(24,199,122,0.2)' : 'rgba(0,102,255,0.15)',
                        border: `1px solid ${copiedMaster ? 'rgba(24,199,122,0.4)' : C.borderHi}`,
                        borderRadius: 6, color: copiedMaster ? C.green : C.cyan, padding: '4px 8px',
                        fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      {copiedMaster ? <Check size={12} /> : <Copy size={12} />}
                      {copiedMaster ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => downloadClientRequestQRPng(masterQr)}
                    style={{
                      background: 'linear-gradient(135deg, #0066FF, #00D9FF)', border: 'none',
                      borderRadius: 10, color: '#fff', padding: '10px 18px', fontSize: 12,
                      fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 4px 16px rgba(0,102,255,0.4)'
                    }}
                  >
                    <Download size={14} /> Download QR Code (PNG)
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintMasterStandee}
                    style={{
                      background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                      borderRadius: 10, color: C.text, padding: '10px 16px', fontSize: 12,
                      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <Printer size={14} /> Print Tabletop Standee
                  </button>

                  <a
                    href={masterRequestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
                      borderRadius: 10, color: C.cyan, padding: '10px 14px', fontSize: 12,
                      fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <ExternalLink size={13} /> Test / Open Form
                  </a>
                </div>

              </div>
            </div>
          </ERPPanel>
        </div>
      )}

      {/* ── TAB 2: INDIVIDUAL SERVICE QR CODES CATALOG ────────────── */}
      {activeTab === 'services' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Search and Categories Bar */}
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
                    cursor: 'pointer', border: 'none',
                    background: selectedCategory === cat ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.8)',
                    color: selectedCategory === cat ? '#fff' : C.muted,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16
          }}>
            {filtered.map(s => {
              const qr = qrMap[s.slug];
              const isCopied = copiedSlug === s.slug;

              return (
                <ERPPanel key={s.slug} style={{ display: 'flex', flexDirection: 'column', padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: C.cyan, marginTop: 2 }}>{s.category}</div>
                    </div>
                  </div>

                  <div style={{
                    background: '#FFFFFF', padding: 14, borderRadius: 12, textAlign: 'center',
                    margin: '8px auto 14px', display: 'inline-block'
                  }}>
                    {qr ? (
                      <img src={qr} alt={s.title} style={{ width: 160, height: 160, display: 'block' }} />
                    ) : (
                      <div style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: 11 }}>
                        Loading QR...
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <button
                      onClick={() => downloadQRCodePng(qr, s.title)}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 8, background: 'rgba(0,102,255,0.15)',
                        border: `1px solid ${C.borderHi}`, color: C.cyan, fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                      }}
                    >
                      <Download size={12} /> PNG
                    </button>
                    <button
                      onClick={() => handlePrintServiceSingle(s)}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 8, background: 'rgba(10,24,56,0.8)',
                        border: `1px solid ${C.border}`, color: C.text, fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                      }}
                    >
                      <Printer size={12} /> Print
                    </button>
                    <a
                      href={getServicePublicUrl(s.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${C.border}`, color: C.muted, fontSize: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      title="Open page"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </ERPPanel>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

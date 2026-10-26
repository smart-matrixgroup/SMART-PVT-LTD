import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { services } from '../config/services';
import { company } from '../config/company';
import SEO from '../components/SEO';
import {
  MessageSquare, Phone, Sparkles, ShieldCheck, ChevronDown,
  CheckCircle2, Clock, Layers, BadgeCheck, ArrowRight,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────
// QR scan landing page — a phone-first "app" view of ONE service.
// No website navbar/footer: brand app-bar on top, scrollable service
// content, and a sticky bottom action dock (Quote / WhatsApp / Call).
// ────────────────────────────────────────────────────────────────────

const C = {
  bg: '#040D1F',
  card: 'rgba(10,23,48,0.88)',
  cardSoft: 'rgba(13,29,59,0.72)',
  border: 'rgba(96,165,250,0.16)',
  borderSoft: 'rgba(96,165,250,0.10)',
  text: '#F1F5F9',
  muted: '#94A3B8',
  dim: '#64748B',
  blue: '#3B82F6',
  cyan: '#22D3EE',
  green: '#34D399',
};

const PAGE_CSS = `
  .qr-app-page{min-height:100dvh;background:
    radial-gradient(900px 420px at 15% -8%, rgba(37,99,235,0.22), transparent 60%),
    radial-gradient(700px 420px at 95% 8%, rgba(6,182,212,0.14), transparent 60%),
    #020817;display:flex;justify-content:center}
  .qr-app-shell{width:100%;max-width:460px;min-height:100dvh;position:relative;
    background:linear-gradient(180deg,#061127 0%,#040D1F 40%,#040D1F 100%);
    display:flex;flex-direction:column;overflow:hidden}
  @media(min-width:640px){
    .qr-app-page{padding:22px 16px}
    .qr-app-shell{min-height:calc(100dvh - 44px);border-radius:32px;
      border:1px solid rgba(96,165,250,0.16);
      box-shadow:0 40px 90px rgba(0,0,0,0.65),0 0 0 6px rgba(10,23,48,0.55)}
  }
  .qr-app-scroll{flex:1;overflow:visible;padding:14px 16px 22px}
  .qr-card{background:${C.card};border:1px solid ${C.border};border-radius:20px}
  .qr-tap{-webkit-tap-highlight-color:transparent;transition:transform .16s ease, box-shadow .16s ease, opacity .16s ease}
  .qr-tap:active{transform:scale(.97)}
  .qr-fade{animation:qrFade .45s ease both}
  @keyframes qrFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .qr-dock{padding-bottom:calc(10px + env(safe-area-inset-bottom))}
  .qr-hero{position:relative;overflow:hidden;border-radius:22px;padding:20px;
    border:1px solid rgba(96,165,250,0.22);
    background:
      radial-gradient(360px 220px at 88% 0%, rgba(6,182,212,0.22), transparent 65%),
      linear-gradient(150deg, rgba(29,78,216,0.38), rgba(8,19,42,0.94) 55%)}
  .qr-hero:after{content:'';position:absolute;right:-46px;top:-56px;width:170px;height:170px;
    border-radius:50%;border:1px solid rgba(96,165,250,0.22)}
  .qr-faq summary{cursor:pointer;list-style:none;display:flex;gap:10px;align-items:flex-start;justify-content:space-between}
  .qr-faq summary::-webkit-details-marker{display:none}
  .qr-faq[open] .qr-chev{transform:rotate(180deg)}
  .qr-chev{transition:transform .2s ease;flex-shrink:0}
  .qr-sec-title{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;
    letter-spacing:.09em;text-transform:uppercase;color:${C.cyan};margin:26px 4px 10px}
  .qr-sec-title:after{content:'';flex:1;height:1px;background:${C.borderSoft}}
`;

export default function QrServicePage({ onOpenQuote }) {
  const { slug } = useParams();
  const [openFaq, setOpenFaq] = useState(0);
  const service = services.find(s => s.slug === slug);
  if (!service) return <Navigate to="/services" replace />;

  const waText = `Hi ${company.fullName}, I scanned the QR for "${service.title}" and I'm interested. Could you share the details?`;
  const waUrl = `https://wa.me/${company.contact.whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(waText)}`;
  const telUrl = `tel:${company.contact.phone.replace(/[^\d+]/g, '')}`;
  const requestQuote = () => onOpenQuote(service.title, {
    title: `Request ${service.title} Quote`,
    eyebrow: 'Service Quote',
    subtitle: `Get a detailed quotation and scope for ${service.title}.`,
    source: `Service Quote — ${service.title}`,
  });

  return (
    <div className="qr-app-page">
      <style>{PAGE_CSS}</style>
      <div className="qr-app-shell">
        <SEO title={service.title} description={service.shortDesc} />

        {/* ── App bar ─────────────────────────────────────────── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 16px', borderBottom: `1px solid ${C.borderSoft}`,
          background: 'rgba(4,13,31,0.88)', backdropFilter: 'blur(14px)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: 'linear-gradient(135deg,#1D4ED8,#06B6D4)',
            boxShadow: '0 6px 16px rgba(37,99,235,0.35)',
          }}>
            <img src={company.logos?.headOnly || '/logos/SMART_LOGO_ONLY_HEAD.png'} alt="SMART"
              style={{ width: 22, height: 22, objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 900, color: C.text, letterSpacing: 0.2 }}>
              {company.fullName}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{company.positioning}</div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
            color: C.green, background: 'rgba(52,211,153,0.10)',
            border: '1px solid rgba(52,211,153,0.25)', borderRadius: 20, padding: '5px 9px',
          }}>
            <BadgeCheck size={11} /> QR Verified
          </span>
        </header>

        <div className="qr-app-scroll">
          {/* ── Hero ──────────────────────────────────────────── */}
          <section className="qr-hero qr-fade" style={{ marginTop: 4 }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <span style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                  color: C.cyan, background: 'rgba(34,211,238,0.10)',
                  border: '1px solid rgba(34,211,238,0.25)', borderRadius: 20, padding: '5px 10px',
                }}>{service.category}</span>
                {service.badge && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                    color: '#FBBF24', background: 'rgba(251,191,36,0.10)',
                    border: '1px solid rgba(251,191,36,0.25)', borderRadius: 20, padding: '5px 10px',
                  }}>{service.badge}</span>
                )}
              </div>

              <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.22, fontWeight: 900, color: '#fff', letterSpacing: -0.3 }}>
                {service.title}
              </h1>
              <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 700, color: '#93C5FD', lineHeight: 1.45 }}>
                {service.subtitle}
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.65, color: C.muted }}>
                {service.overview}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                <div style={{
                  padding: '10px 12px', borderRadius: 14,
                  background: 'rgba(4,13,31,0.55)', border: `1px solid ${C.borderSoft}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, color: C.dim, textTransform: 'uppercase' }}>
                    <Sparkles size={11} /> Starting
                  </div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1.25 }}>
                    {service.startingPrice}
                  </div>
                </div>
                <div style={{
                  padding: '10px 12px', borderRadius: 14,
                  background: 'rgba(4,13,31,0.55)', border: `1px solid ${C.borderSoft}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, color: C.dim, textTransform: 'uppercase' }}>
                    <Clock size={11} /> Timeline
                  </div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1.25 }}>
                    {service.timeline}
                  </div>
                </div>
              </div>

              <button onClick={requestQuote} className="qr-tap" style={{
                width: '100%', marginTop: 14, padding: '14px', border: 'none', borderRadius: 15,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 13.5, fontWeight: 900, color: '#fff',
                background: 'linear-gradient(135deg,#2563EB,#06B6D4)',
                boxShadow: '0 10px 26px rgba(37,99,235,0.38)',
              }}>
                Request Quotation & Scope <ArrowRight size={16} />
              </button>
            </div>
          </section>

          {/* ── Features ──────────────────────────────────────── */}
          <div className="qr-sec-title"><Sparkles size={12} /> What this service covers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {service.features.map((feat, i) => (
              <div key={i} className="qr-card qr-fade" style={{
                padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
                animationDelay: `${Math.min(i, 6) * 40}ms`,
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.22)',
                }}>
                  <CheckCircle2 size={15} color={C.cyan} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{feat.name}</div>
                  <div style={{ marginTop: 3, fontSize: 11.5, lineHeight: 1.55, color: C.muted }}>{feat.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Deliverables ──────────────────────────────────── */}
          <div className="qr-sec-title"><Layers size={12} /> What you receive</div>
          <div className="qr-card" style={{ padding: '14px 14px 6px' }}>
            {service.deliverables.map((item, i) => (
              <div key={i} style={{
                display: 'flex', gap: 9, alignItems: 'flex-start',
                padding: '9px 2px',
                borderBottom: i < service.deliverables.length - 1 ? `1px solid ${C.borderSoft}` : 'none',
              }}>
                <CheckCircle2 size={14} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, lineHeight: 1.55, color: '#CBD5E1' }}>{item}</span>
              </div>
            ))}
          </div>

          {/* ── Pricing ───────────────────────────────────────── */}
          <div className="qr-sec-title"><ShieldCheck size={12} /> Pricing & scope</div>
          <div className="qr-card" style={{ padding: 16 }}>
            <div style={{
              padding: '12px 14px', borderRadius: 14, marginBottom: 10,
              background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(96,165,250,0.22)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, color: C.muted }}>Pricing baseline</span>
                <span style={{ fontSize: 13.5, fontWeight: 900, color: C.green, textAlign: 'right' }}>
                  {service.startingPrice}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11.5, lineHeight: 1.6, color: C.muted }}>
                {service.priceNote}
              </p>
            </div>
            <button onClick={requestQuote} className="qr-tap" style={{
              width: '100%', padding: '13px', border: '1px solid rgba(96,165,250,0.35)',
              borderRadius: 14, cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
              color: '#BFDBFE', background: 'rgba(37,99,235,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              Get itemized quotation <ArrowRight size={14} />
            </button>
          </div>

          {/* ── FAQs ──────────────────────────────────────────── */}
          {service.faqs?.length > 0 && (
            <>
              <div className="qr-sec-title"><MessageSquare size={12} /> Common questions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {service.faqs.map((faq, i) => {
                  const isOpen = openFaq === i;
                  return (
                    <div key={i} className="qr-card" style={{ padding: '0 14px' }}>
                      <button
                        onClick={() => setOpenFaq(isOpen ? -1 : i)}
                        className="qr-tap"
                        style={{
                          width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                          padding: '13px 0', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.text, lineHeight: 1.45 }}>{faq.q}</span>
                        <ChevronDown size={15} color={C.muted}
                          style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
                      </button>
                      {isOpen && (
                        <div style={{ padding: '0 0 13px', fontSize: 11.5, lineHeight: 1.65, color: C.muted }}>
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Footer ────────────────────────────────────────── */}
          <div style={{
            margin: '26px 4px 6px', paddingTop: 16, borderTop: `1px solid ${C.borderSoft}`,
            fontSize: 10, lineHeight: 1.7, color: C.dim, textAlign: 'center',
          }}>
            {company.fullName} · {company.contact.address}<br />
            {company.contact.phoneDisplay} · {company.contact.email}<br />
            <span style={{ color: C.dim }}>Scanned via official SMART service QR</span>
          </div>
        </div>

        {/* ── Bottom app dock ─────────────────────────────────── */}
        <div className="qr-dock" style={{
          position: 'sticky', bottom: 0, zIndex: 30,
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '10px 14px 10px', borderTop: `1px solid ${C.borderSoft}`,
          background: 'rgba(4,13,31,0.94)', backdropFilter: 'blur(16px)',
        }}>
          <a href={telUrl} className="qr-tap" aria-label="Call SMART"
            style={{
              width: 46, height: 46, flexShrink: 0, borderRadius: 14,
              display: 'grid', placeItems: 'center', textDecoration: 'none',
              background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.24)',
            }}>
            <Phone size={18} color="#93C5FD" />
          </a>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="qr-tap" aria-label="WhatsApp SMART"
            style={{
              width: 46, height: 46, flexShrink: 0, borderRadius: 14,
              display: 'grid', placeItems: 'center', textDecoration: 'none',
              background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.26)',
            }}>
            <MessageSquare size={18} color="#34D399" />
          </a>
          <button onClick={requestQuote} className="qr-tap" style={{
            flex: 1, height: 46, border: 'none', borderRadius: 14, cursor: 'pointer',
            fontSize: 13, fontWeight: 900, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: 'linear-gradient(135deg,#2563EB,#06B6D4)',
            boxShadow: '0 8px 22px rgba(37,99,235,0.34)',
          }}>
            Get Quotation <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

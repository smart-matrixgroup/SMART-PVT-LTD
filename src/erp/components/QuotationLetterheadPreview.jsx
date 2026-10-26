import React, { useEffect, useRef, useState } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { TEMPLATE_QUOTATION, renderTemplate } from './quotationTemplateRenderer';
import { buildDoc } from './QuotationDocStudio';
import { C } from './ERPui';
import { Image as ImageIcon, Maximize2 } from 'lucide-react';

// Small live preview of the owner's quotation letterhead, rendered with the
// same canvas overlay as the Image Studio. Used inside the New/Edit quotation
// form so the document is visible while typing (not only after saving).
let letterheadPromise = null;
function loadLetterhead() {
  if (!letterheadPromise) {
    letterheadPromise = new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = TEMPLATE_QUOTATION.src;
    });
  }
  return letterheadPromise;
}

export default function QuotationLetterheadPreview({ quotation, onOpen }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [bank, setBank] = useState(null);
  const [fontsReady, setFontsReady] = useState(0);
  // Client screenshots for the laptop / phone mockups (data URLs on the quote)
  const [shots, setShots] = useState({ laptop:null, phone:null });

  useEffect(() => {
    let alive = true;
    const load = (src) => new Promise(resolve => {
      if (!src) { resolve(null); return; }
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
    Promise.all([load(quotation?.laptopShot), load(quotation?.phoneShot)])
      .then(([laptop, phone]) => { if (alive) setShots({ laptop, phone }); });
    return () => { alive = false; };
  }, [quotation?.laptopShot, quotation?.phoneShot]);

  useEffect(() => {
    let alive = true;
    loadLetterhead().then(i => { if (alive) setImg(i); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    getDoc(doc(db, 'settings', 'bankDetails'))
      .then(snap => { if (snap.exists()) setBank(snap.data()); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (document.fonts?.ready) document.fonts.ready.then(() => setFontsReady(n => n + 1));
  }, []);

  // Re-render a little after typing stops, so keystrokes stay smooth.
  const key = JSON.stringify(quotation || {});
  useEffect(() => {
    if (!img || !quotation) return;
    const t = setTimeout(() => {
      try { renderTemplate(canvasRef.current, img, { ...buildDoc(quotation, bank), shots }, 1); }
      catch (e) { console.error('letterhead preview failed', e); }
    }, 180);
    return () => clearTimeout(t);
  }, [key, img, bank, fontsReady, quotation, shots]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6 }}>
        <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, fontWeight:700, color:C.muted,
          textTransform:'uppercase', letterSpacing:'0.5px' }}>
          <ImageIcon size={11}/> Letterhead preview
        </span>
        <button onClick={onOpen}
          style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(0,102,255,0.14)',
            border:'1px solid rgba(0,102,255,0.45)', color:'#8CC2FF', borderRadius:8, padding:'4px 8px',
            fontSize:10, fontWeight:700, cursor:'pointer' }}>
          <Maximize2 size={10}/> Edit / Image & PDF
        </button>
      </div>
      <button onClick={onOpen} title="Open the full Image Studio"
        style={{ padding:0, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:10,
          cursor:'zoom-in', overflow:'hidden', display:'block', width:'100%' }}>
        <canvas ref={canvasRef} style={{ display:'block', width:'100%', height:'auto' }}/>
      </button>
      <div style={{ fontSize:9.5, color:C.muted, textAlign:'center' }}>
        Live preview — updates as you type. Tap the image to edit & download.
      </div>
    </div>
  );
}

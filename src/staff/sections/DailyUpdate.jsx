// ─────────────────────────────────────────────────────────────────
//  Phase 3 D (portal side) — Daily Work Update.
//  Staff submit: date + list of work done (multiple items) + notes.
//  Admins monitor everything from ERP → Staff → Daily Updates.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBtn, ERPEmpty, C } from '../../erp/components/ERPui';
import { toMs, todayKey } from '../staffUtils';
import { Plus, Trash2, ClipboardList, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';

const DEV_UPDATES = [
  { id: 'du1', date: todayKey(), items: ['Finished POS order-screen components', 'Fixed quotation print layout'],
    notes: 'Blocked on client logo assets.', submittedAt: new Date().setHours(17, 10, 0, 0) },
  { id: 'du2', date: '2026-10-05', items: ['Code review — admin panel'], notes: '',
    submittedAt: new Date('2026-10-05T16:40:00').getTime() },
];

export default function DailyUpdate() {
  const { staffProfile, isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || '';

  const [updates,   setUpdates]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [date,  setDate]  = useState(todayKey());
  const [items, setItems] = useState(['']);
  const [notes, setNotes] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [ok,    setOk]    = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!live) { setUpdates(DEV_UPDATES); setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'dailyUpdates'), where('authUid', '==', uid)),
      snap => { setUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err => { console.error(err); setLoadError(`Daily updates — ${err.message}`); setLoading(false); },
    );
    return unsub;
  }, [live, uid]);

  const cleanItems = () => items.map(s => s.trim()).filter(Boolean);
  const canSubmit  = date && cleanItems().length > 0 && !busy;

  const handleSubmit = async () => {
    setBusy(true); setError(null); setOk(false);
    try {
      const payload = {
        staffId: uid, staffName: staffProfile?.name || '—', authUid: uid,
        date, items: cleanItems(), notes: notes.trim(),
        submittedAt: serverTimestamp(), createdAt: serverTimestamp(),
      };
      if (!live) setUpdates(p => [{ id: `dev-${Date.now()}`, ...payload, submittedAt: Date.now() }, ...p]);
      else await addDoc(collection(db, 'dailyUpdates'), payload);
      setItems(['']); setNotes(''); setOk(true);
      setTimeout(() => setOk(false), 4000);
    } catch (e) { console.error(e); setError(e.message || 'Submit failed.'); }
    finally { setBusy(false); }
  };

  const history = [...updates]
    .sort((a, b) => toMs(b.submittedAt) - toMs(a.submittedAt) || String(b.date).localeCompare(String(a.date)))
    .slice(0, 15);

  const submittedToday = updates.some(u => u.date === todayKey());

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading daily updates…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {/* Submit form */}
      <ERPPanel>
        <ERPPanelHeader title="Submit Daily Work Update" icon="📝"
          action={submittedToday ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: C.green, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(24,199,122,0.12)', border: '1px solid rgba(24,199,122,0.3)' }}>
              ✓ already submitted today — you can still add another
            </span>
          ) : null} />
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ width: 180 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{
              width: '100%', boxSizing: 'border-box', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 12, outline: 'none',
            }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>
              Work Done <span style={{ color: C.red }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.muted, width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                  <input value={item} onChange={e => setItems(p => p.map((x, j) => j === i ? e.target.value : x))}
                    placeholder={i === 0 ? 'e.g. Completed login API integration' : 'Another item…'}
                    style={{
                      flex: 1, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
                      padding: '9px 12px', color: C.text, fontSize: 12, outline: 'none',
                    }} />
                  {items.length > 1 && (
                    <button onClick={() => setItems(p => p.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}
                      title="Remove item">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <ERPBtn size="sm" variant="ghost" onClick={() => setItems(p => [...p, ''])} style={{ marginTop: 8 }}>
              <Plus size={11} /> Add Item
            </ERPBtn>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>
              Notes / Blockers (optional)
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Anything your lead should know — blockers, questions, context…"
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical', background: 'rgba(10,24,56,0.8)',
                border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.text,
                fontSize: 12, outline: 'none', fontFamily: 'inherit',
              }} />
          </div>

          {ok && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: C.green,
              padding: '9px 12px', borderRadius: 8, background: 'rgba(24,199,122,0.1)', border: '1px solid rgba(24,199,122,0.3)' }}>
              <CheckCircle2 size={13} /> Daily update submitted — your admin can see it now.
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: C.red,
              padding: '9px 12px', borderRadius: 8, background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.3)' }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          <ERPBtn variant="primary" disabled={!canSubmit} onClick={handleSubmit}
            style={{ justifyContent: 'center', alignSelf: 'flex-start', minWidth: 200 }}>
            <Send size={13} /> Submit Update
          </ERPBtn>
        </div>
      </ERPPanel>

      {/* My recent submissions */}
      <ERPPanel>
        <ERPPanelHeader title="My Recent Updates" icon="🗂️"
          action={<span style={{ fontSize: 10, color: C.muted }}>{history.length} recent</span>} />
        {history.length === 0 ? (
          <ERPEmpty icon="📝" title="No updates submitted yet"
            sub="Submit your first daily update above — it takes under a minute." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.map((u, i) => (
              <div key={u.id} style={{ padding: '13px 18px', borderTop: i > 0 ? `1px solid ${C.border}20` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                  <ClipboardList size={13} style={{ color: C.blue }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{u.date}</span>
                  {u.date === todayKey() && (
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: 'rgba(24,199,122,0.12)',
                      color: C.green, border: '1px solid rgba(24,199,122,0.3)', fontWeight: 700 }}>TODAY</span>
                  )}
                  {toMs(u.submittedAt) > 0 && (
                    <span style={{ fontSize: 10, color: C.muted }}>
                      at {new Date(toMs(u.submittedAt)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>{(u.items || []).length} item{(u.items || []).length === 1 ? '' : 's'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 21 }}>
                  {(u.items || []).map((item, j) => (
                    <span key={j} style={{ fontSize: 11, color: C.subtle }}>• {item}</span>
                  ))}
                  {u.notes && (
                    <span style={{ fontSize: 10.5, color: C.amber, marginTop: 2 }}>Note: {u.notes}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ERPPanel>
    </div>
  );
}

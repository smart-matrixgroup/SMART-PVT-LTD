// ─────────────────────────────────────────────────────────────────
//  Staff portal → Leave Application
//
//  The staff member fills a short form (type, dates, reason, contact),
//  previews it as the printed SMART letter (src/staff/leaveLetter.js
//  paints the answer sheet on canvas), and sends that image to the
//  admin. One document per application in `leaves`; the letter and any
//  supporting photo go to the staff member's own private Storage folder
//  (staff-docs/{uid}/…) — only the PATH is stored, so every open runs
//  the storage rules. Nothing here uses a public download URL.
//
//  The staff write lands as status 'Pending'; only the admin can move it
//  to Approved / Rejected (enforced in firestore.rules, not just here).
// ─────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, onSnapshot, query, where, addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { staffRulesNotice } from '../../erp/rulesNotice';
import {
  ERPPanel, ERPPanelHeader, ERPBtn, ERPModal, ERPInput, ERPSelect, ERPTextarea, C,
} from '../../erp/components/ERPui';
import PrivateFileLink from '../../erp/components/PrivateFileLink';
import PrivateImage from '../../erp/components/PrivateImage';
import StaffEmpty from '../components/StaffEmpty';
import { todayKey, toMs } from '../staffUtils';
import { LEAVE_TYPES, letterDate, leaveDays, leaveLetterBlob } from '../leaveLetter';
import { Plus, CalendarOff, AlertTriangle, Image as ImageIcon, X } from 'lucide-react';

const STATUS_COLOR = {
  Pending:  { color: C.amber, bg: 'rgba(245,185,66,0.12)', border: 'rgba(245,185,66,0.35)' },
  Approved: { color: C.green, bg: 'rgba(24,199,122,0.12)', border: 'rgba(24,199,122,0.35)' },
  Rejected: { color: C.red,   bg: 'rgba(240,90,103,0.12)', border: 'rgba(240,90,103,0.35)' },
};

const EMPTY = {
  type: 'Casual', from: todayKey(), to: todayKey(),
  reason: '', handover: '', contact: '',
};

const prettyTime = v => {
  const ms = toMs(v);
  return ms ? new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};

/** The painted letter, opened through the private path (no public URL). */
const LetterImage = ({ file }) => (
  <PrivateImage file={file} alt="Leave application letter" maxWidth={460} />
);

export default function MyLeave() {
  const { staffProfile, isFirebaseConfigured: cfg, isDevSession } = useAuth();
  const live = cfg && !isDevSession;
  const uid = staffProfile?.id || '';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [makingPreview, setMakingPreview] = useState(false);
  const [extra, setExtra] = useState(null);          // File — supporting photo
  const [view, setView] = useState(null);            // leave doc being viewed
  const [delTarget, setDelTarget] = useState(null);  // Pending application being withdrawn
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');
  const devSeq = useRef(1);

  useEffect(() => {
    if (!live) { setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'leaves'), where('staffUid', '==', uid)),
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)));
        setLoading(false);
      },
      err => {
        console.error(err);
        setLoading(false);
        setLoadError(err.code === 'permission-denied'
          ? staffRulesNotice('Leave applications')
          : `Couldn't load your leave applications — ${err.message}`);
      },
    );
    return unsub;
  }, [live, uid]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const days = leaveDays(form.from, form.to);
  const counts = useMemo(() => ({
    Pending: items.filter(i => (i.status || 'Pending') === 'Pending').length,
    Approved: items.filter(i => i.status === 'Approved').length,
    Rejected: items.filter(i => i.status === 'Rejected').length,
  }), [items]);

  const letterData = () => ({
    staffName: staffProfile?.name || '—',
    staffRole: staffProfile?.role || staffProfile?.department || 'Staff',
    staffId: staffProfile?.staffId || uid || '—',
    contact: form.contact || staffProfile?.phone || '',
    type: form.type,
    from: form.from,
    to: form.to,
    days,
    reason: form.reason,
    handover: form.handover,
    appliedOn: todayKey(),
  });

  const makePreview = async () => {
    if (!form.reason.trim()) { setFormErr('Write the reason — it is printed on the letter.'); return; }
    if (days <= 0) { setFormErr('Check the dates — the end day cannot be before the start day.'); return; }
    setFormErr('');
    setMakingPreview(true);
    try {
      const blob = await leaveLetterBlob(letterData());
      if (!blob) { setFormErr('Could not draw the letter in this browser.'); return; }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error(e);
      setFormErr(e.message || 'Could not draw the letter.');
    } finally {
      setMakingPreview(false);
    }
  };

  const submit = async () => {
    if (!form.reason.trim()) { setFormErr('Write the reason — it is printed on the letter.'); return; }
    if (days <= 0) { setFormErr('Check the dates — the end day cannot be before the start day.'); return; }
    setFormErr('');
    setBusy(true);
    try {
      // Always re-drawn here, so what is sent is exactly the current form —
      // a preview drawn a minute ago and then edited cannot drift apart.
      const letterBlob = await leaveLetterBlob(letterData());
      if (!letterBlob) throw new Error('Could not draw the leave letter in this browser.');
      const stamp = Date.now();
      const letterPath = `staff-docs/${uid}/leave_${stamp}.png`;
      const files = [];

      if (live) {
        await uploadBytes(storageRef(storage, letterPath), letterBlob, { contentType: 'image/png' });
        files.push({ name: `Leave letter ${letterDate(form.from)}.png`, path: letterPath, size: letterBlob.size, type: 'image/png' });
      } else {
        // A fresh URL — the preview one gets revoked when the form resets.
        files.push({ name: `Leave letter ${letterDate(form.from)}.png`, path: '', localUrl: URL.createObjectURL(letterBlob), size: letterBlob.size, type: 'image/png' });
      }

      if (extra) {
        const safe = String(extra.name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
        const attachPath = `staff-docs/${uid}/leaveatt_${stamp}_${safe}`;
        if (live) {
          await uploadBytes(storageRef(storage, attachPath), extra, { contentType: extra.type || 'application/octet-stream' });
          files.push({ name: extra.name, path: attachPath, size: extra.size, type: extra.type || 'application/octet-stream' });
        } else {
          files.push({ name: extra.name, path: '', localUrl: URL.createObjectURL(extra), size: extra.size, type: extra.type });
        }
      }

      const payload = {
        staffUid: uid,
        staffId: staffProfile?.staffId || uid,
        staffName: staffProfile?.name || '—',
        staffRole: staffProfile?.role || staffProfile?.department || 'Staff',
        contact: form.contact || staffProfile?.phone || '',
        type: form.type,
        from: form.from,
        to: form.to,
        days,
        reason: form.reason.trim(),
        handover: form.handover.trim(),
        status: 'Pending',
        adminNote: '',
        reviewedBy: '',
        letter: files[0],
        files,
        history: [{ at: Date.now(), by: staffProfile?.name || 'Staff', text: `Applied for ${days} day${days === 1 ? '' : 's'} ${form.type.toLowerCase()} leave` }],
        createdAt: live ? serverTimestamp() : Date.now(),
        updatedAt: live ? serverTimestamp() : Date.now(),
      };

      if (live) await addDoc(collection(db, 'leaves'), payload);
      else setItems(p => [{ ...payload, id: `dev-leave-${devSeq.current++}`, createdAt: Date.now() }, ...p]);

      setForm(EMPTY); setExtra(null); setPreviewUrl(''); setOpen(false);
    } catch (e) {
      console.error(e);
      setFormErr(e?.code === 'permission-denied'
        ? staffRulesNotice('This leave application')
        : (e.message || 'Could not send the leave application.'));
    } finally {
      setBusy(false);
    }
  };

  // Withdraw a Pending application: the doc and the letter it painted are
  // both removed (the rules only allow this while nothing is decided yet).
  const withdrawLeave = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    setDelErr('');
    try {
      if (live) {
        const paths = [...(Array.isArray(delTarget.files) ? delTarget.files : []), delTarget.letter]
          .map(f => f?.path).filter(Boolean);
        await Promise.all(paths.map(p => deleteObject(storageRef(storage, p)).catch(() => {})));
        await deleteDoc(doc(db, 'leaves', delTarget.id));
      }
      setItems(p => p.filter(l => l.id !== delTarget.id));
      setDelTarget(null);
    } catch (e) {
      console.error(e);
      setDelErr(e?.code === 'permission-denied'
        ? staffRulesNotice('This withdrawal')
        : (e?.message || 'Could not withdraw the application.'));
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      <ERPPanel>
        <ERPPanelHeader title="Leave Application" icon={<CalendarOff size={15} style={{ color: C.cyan }} />}
          action={<ERPBtn size="sm" variant="primary" onClick={() => { setForm({ ...EMPTY, contact: staffProfile?.phone || '' }); setFormErr(''); setPreviewUrl(''); setExtra(null); setOpen(true); }}>
            <Plus size={12} /> New Application
          </ERPBtn>} />

        <div style={{ padding: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(counts).map(([k, v]) => (
            <span key={k} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 10.5, fontWeight: 800,
              color: STATUS_COLOR[k].color, background: STATUS_COLOR[k].bg, border: `1px solid ${STATUS_COLOR[k].border}`,
            }}>{k} · {v}</span>
          ))}
        </div>
      </ERPPanel>

      <ERPPanel>
        <ERPPanelHeader title="My Leave Applications" icon="🗂"
          action={<span style={{ fontSize: 10, color: C.muted }}>{items.length} total</span>} />
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 12 }}>Loading…</div>
        ) : items.length === 0 ? (
          <StaffEmpty icon="🗓" title="No leave applied yet" sub="Use “New Application” to send one to the admin." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((l, i) => {
              const st = l.status || 'Pending';
              const cfg2 = STATUS_COLOR[st] || STATUS_COLOR.Pending;
              return (
                <div key={l.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', flexWrap: 'wrap',
                  borderTop: i > 0 ? `1px solid ${C.border}25` : 'none',
                }}>
                  <div style={{ flex: '1 1 220px', minWidth: 180 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>
                      {l.type} leave · {l.days} day{l.days === 1 ? '' : 's'}
                    </div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
                      {letterDate(l.from)}{l.to && l.to !== l.from ? ` → ${letterDate(l.to)}` : ''} · applied {prettyTime(l.createdAt)}
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 11px', borderRadius: 20, fontSize: 10, fontWeight: 800,
                    color: cfg2.color, background: cfg2.bg, border: `1px solid ${cfg2.border}`,
                  }}>{st}</span>
                  {(l.adminNote || '').trim() && (
                    <span style={{ fontSize: 10.5, color: C.subtle, maxWidth: 260 }}>“{l.adminNote}”</span>
                  )}
                  <ERPBtn size="sm" variant="secondary" onClick={() => setView(l)}><ImageIcon size={11} /> Letter</ERPBtn>
                  {st === 'Pending' && (
                    <ERPBtn size="sm" variant="danger" onClick={() => { setDelTarget(l); setDelErr(''); }}>
                      <X size={11} /> Withdraw
                    </ERPBtn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>

      {/* ── New application ── */}
      <ERPModal isOpen={open} onClose={() => setOpen(false)} title="New Leave Application" width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPSelect label="Leave type" value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              options={LEAVE_TYPES.map(t => ({ value: t, label: t }))} />
            <ERPInput label="Contact number" value={form.contact}
              onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
              placeholder={staffProfile?.phone || '+94 77 000 0000'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPInput label="From" type="date" value={form.from}
              onChange={e => setForm(p => ({ ...p, from: e.target.value, to: p.to < e.target.value ? e.target.value : p.to }))} />
            <ERPInput label="To" type="date" value={form.to} min={form.from}
              onChange={e => setForm(p => ({ ...p, to: e.target.value }))} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: days > 0 ? C.cyan : C.red }}>
            {days > 0
              ? <>{days} day{days === 1 ? '' : 's'} · {letterDate(form.from)}{form.to !== form.from ? ` → ${letterDate(form.to)}` : ''}</>
              : 'The end day cannot be before the start day.'}
          </div>
          <ERPTextarea label="Reason" rows={4} value={form.reason}
            onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            placeholder="Short reason for the leave" />
          <ERPTextarea label="Work handover line (optional)" rows={2} value={form.handover}
            onChange={e => setForm(p => ({ ...p, handover: e.target.value }))}
            placeholder="e.g. My current task is handed over to Paththima." />

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>
              Supporting photo (optional)
            </label>
            <input type="file" accept="image/*,application/pdf"
              onChange={e => setExtra(e.target.files?.[0] || null)}
              style={{ fontSize: 11, color: C.muted, width: '100%' }} />
          </div>

          <ERPBtn variant="secondary" onClick={makePreview} disabled={makingPreview}>
            <ImageIcon size={12} /> {makingPreview ? 'Drawing…' : 'Preview letter'}
          </ERPBtn>
          {previewUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <img src={previewUrl} alt="Leave letter preview" style={{
                width: '100%', maxWidth: 300, alignSelf: 'center', borderRadius: 8,
                border: `1px solid ${C.border}`, background: '#fff',
              }} />
              <span style={{ fontSize: 10, color: C.muted }}>This is the image the admin receives.</span>
            </div>
          )}

          {formErr && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,185,66,0.1)',
              border: '1px solid rgba(245,185,66,0.35)', fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
              {formErr}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <ERPBtn variant="secondary" onClick={() => setOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={submit} disabled={busy} style={{ flex: 1, justifyContent: 'center' }}>
              {busy ? 'Sending…' : 'Send to Admin'}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── One application, full letter ── */}
      <ERPModal isOpen={!!view} onClose={() => setView(null)}
        title={view ? `${view.type} leave — ${letterDate(view.from)}` : ''} width={520}>
        {view && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                padding: '4px 11px', borderRadius: 20, fontSize: 10, fontWeight: 800,
                color: (STATUS_COLOR[view.status] || STATUS_COLOR.Pending).color,
                background: (STATUS_COLOR[view.status] || STATUS_COLOR.Pending).bg,
                border: `1px solid ${(STATUS_COLOR[view.status] || STATUS_COLOR.Pending).border}`,
              }}>{view.status || 'Pending'}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{view.days} day{view.days === 1 ? '' : 's'} · applied {prettyTime(view.createdAt)}</span>
            </div>

            <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>Reason: </strong>{view.reason}
            </div>
            {String(view.handover || '').trim() && (
              <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>{view.handover}</div>
            )}
            {String(view.adminNote || '').trim() && (
              <div style={{
                padding: '10px 12px', borderRadius: 10, fontSize: 11.5, lineHeight: 1.55,
                background: 'rgba(0,102,255,0.08)', border: `1px solid rgba(0,102,255,0.3)`, color: C.text,
              }}>
                <strong>Admin:</strong> {view.adminNote}
                {view.reviewedBy ? ` — ${view.reviewedBy}, ${prettyTime(view.reviewedAt)}` : ''}
              </div>
            )}

            <LetterImage file={view.letter} />

            {(view.files || []).filter((f, k) => k > 0).map(f => (
              <div key={f.path || f.name} style={{ fontSize: 11 }}>
                {f.path
                  ? <PrivateFileLink file={f} />
                  : <a href={f.localUrl} target="_blank" rel="noreferrer" style={{ color: C.cyan }}>{f.name}</a>}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setView(null)} style={{ flex: 1, justifyContent: 'center' }}>Close</ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>

      {/* ── Withdraw a Pending application ── */}
      <ERPModal isOpen={!!delTarget} onClose={() => setDelTarget(null)}
        title="Withdraw this application?" width={420}>
        {delTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>{delTarget.type} leave · {delTarget.days} day{delTarget.days === 1 ? '' : 's'}</strong><br />
              {letterDate(delTarget.from)}{delTarget.to && delTarget.to !== delTarget.from ? ` → ${letterDate(delTarget.to)}` : ''}
              · applied {prettyTime(delTarget.createdAt)}
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 11.5, lineHeight: 1.55,
              background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red }}>
              The application and its letter are removed. The admin will not be able to open it.
            </div>

            {delErr && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,185,66,0.1)',
                border: '1px solid rgba(245,185,66,0.35)', fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
                {delErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setDelTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Keep it</ERPBtn>
              <ERPBtn variant="danger" onClick={withdrawLeave} disabled={delBusy} style={{ flex: 1, justifyContent: 'center' }}>
                {delBusy ? 'Withdrawing…' : 'Withdraw'}
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}

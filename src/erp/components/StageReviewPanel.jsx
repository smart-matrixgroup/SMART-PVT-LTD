// ─────────────────────────────────────────────────────────────────
//  Admin — Work Stage review (shared by Staff → Work Progress and
//  Work → Work Stages).
//
//  The staff member writes the stage list for their assigned project and
//  marks each stage Completed with a note. Nothing reaches the client
//  until the admin approves that stage here. Approval is a one-way stamp
//  (accepted / rework) that carries who did it and when, and every change
//  appends to the stage's own history list — never rewrites it.
//
//  Firestore: staffProgress/{itemId} — admin has full write in the rules.
//  Proof files stay staff-private (Storage staff-progress/…, getBytes only).
// ─────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPBtn, ERPModal, ERPTextarea, ERPProgress, C } from '../components/ERPui';
import PrivateFileLink from '../components/PrivateFileLink';
import {
  groupStagesByProject, stageStatusOf, stageReviewOf, stageHistoryEntry, toMs,
  saveDevStages,
} from '../../staff/staffUtils';
import {
  AlertTriangle, CheckCircle2, Clock, FileText, Image as ImageIcon, RotateCcw,
  ShieldCheck, StickyNote, History, Building, ChevronDown, ChevronUp,
} from 'lucide-react';

const STATUS_TONE = {
  'Not Started': { fg: C.muted, bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.32)' },
  'In Progress': { fg: C.amber, bg: 'rgba(245,185,66,0.12)', border: 'rgba(245,185,66,0.35)' },
  'Completed':   { fg: C.green, bg: 'rgba(24,199,122,0.12)', border: 'rgba(24,199,122,0.35)' },
  'On Hold':     { fg: C.red,   bg: 'rgba(240,90,103,0.12)', border: 'rgba(240,90,103,0.35)' },
};
const REVIEW_TONE = {
  accepted: { fg: C.green, bg: 'rgba(24,199,122,0.14)', border: 'rgba(24,199,122,0.4)' },
  rework:   { fg: C.red,   bg: 'rgba(240,90,103,0.14)', border: 'rgba(240,90,103,0.4)' },
  pending:  { fg: C.cyan,  bg: 'rgba(0,102,255,0.14)',  border: 'rgba(0,102,255,0.4)' },
};

const fmtStamp = v => {
  const ms = toMs(v);
  if (!ms) return '';
  return new Date(ms).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export default function StageReviewPanel({
  items, showStaff = false, onPatch, emptyText = 'No work stages added yet.',
}) {
  const { currentUser, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const adminName = currentUser?.displayName || currentUser?.name || currentUser?.email || 'Admin';

  const [reworkTarget, setReworkTarget] = useState(null);
  const [reworkNote, setReworkNote] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [openHistory, setOpenHistory] = useState(null);
  // Dev session only: the review is kept locally (and in the staff preview
  // store) so the approve → client loop can be tried without Firestore.
  const [devPatches, setDevPatches] = useState({});

  const mergedItems = useMemo(
    () => ((live || !Object.keys(devPatches).length)
      ? (items || [])
      : (items || []).map(i => (devPatches[i.id] ? { ...i, ...devPatches[i.id] } : i))),
    [items, devPatches, live],
  );
  const groups = useMemo(() => groupStagesByProject(mergedItems), [mergedItems]);

  const write = async (item, changes, historyText) => {
    setError(null);
    const entry = stageHistoryEntry(adminName, historyText);
    const payload = {
      ...changes,
      reviewedBy: adminName,
      reviewedAt: new Date().toISOString(),
      history: [...(item.history || []), entry],
    };
    setBusyId(item.id);
    try {
      if (!live) {
        const next = { ...payload, updatedAt: Date.now() };
        if (typeof onPatch === 'function') { onPatch(item.id, next); return; }
        setDevPatches(p => ({ ...p, [item.id]: { ...(p[item.id] || {}), ...next } }));
        saveDevStages(mergedItems.map(i => (i.id === item.id ? { ...i, ...next } : i)));
        return;
      }
      await updateDoc(doc(db, 'staffProgress', item.id), { ...payload, updatedAt: serverTimestamp() });
    } catch (e) {
      setError(e?.code === 'permission-denied'
        ? 'Firebase blocked this approval — deploy the latest staffProgress security rules, then try again.'
        : (e?.message || 'Could not record this review.'));
    } finally { setBusyId(null); }
  };

  const accept = item => write(item, { reviewState: 'accepted', reviewNote: '' }, 'Approved by admin — visible to the client');
  const sendRework = () => {
    const item = reworkTarget;
    if (!item) return;
    const note = reworkNote.trim();
    setReworkTarget(null); setReworkNote('');
    write(item, { reviewState: 'rework', reviewNote: note }, note ? `Rework asked: ${note}` : 'Rework asked by admin');
  };

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, fontSize: 12,
        background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red }}>
        <AlertTriangle size={14} /> {error}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 11, color: C.muted,
        border: `1px dashed ${C.border}`, borderRadius: 12 }}>
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map(g => (
        <div key={g.key} style={{ border: `1px solid ${C.border}`, borderRadius: 13, overflow: 'hidden', background: 'rgba(10,24,56,0.35)' }}>
          <div style={{ padding: '11px 13px', background: 'rgba(10,24,56,0.7)', borderBottom: `1px solid ${C.border}20` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 900, color: C.text }}>
                <Building size={12} style={{ color: C.cyan }} />{g.projectTitle}
              </span>
              {!!g.clientName && <span style={{ fontSize: 10, color: C.muted }}>{g.clientName}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: C.subtle }}>
                {g.stats.done}/{g.stats.total} completed
                {g.stats.pendingReview ? <span style={{ color: C.cyan }}> · {g.stats.pendingReview} to review</span> : null}
                {g.stats.accepted ? <span style={{ color: C.green }}> · {g.stats.accepted} approved</span> : null}
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <ERPProgress value={g.stats.clientPct} color={g.stats.clientPct === 100 ? C.green : C.blue} />
            </div>
            <div style={{ fontSize: 9.5, color: C.muted, marginTop: 4 }}>
              {g.stats.clientPct}% of this list is approved and shown to the client
            </div>
          </div>

          {g.items.map((item, i) => {
            const status = stageStatusOf(item);
            const tone = STATUS_TONE[status] || STATUS_TONE['In Progress'];
            const review = stageReviewOf(item);
            const rTone = review.key === 'none' ? null : REVIEW_TONE[review.key];
            const proofs = item.proofs || [];
            const history = item.history || [];
            const busy = busyId === item.id;
            return (
              <div key={item.id} style={{ padding: '13px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}18` }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 10.5, fontWeight: 900, background: tone.bg, color: tone.fg,
                    border: `1px solid ${tone.border}`,
                  }}>{item.stage || i + 1}</span>

                  <div style={{ flex: 1, minWidth: 210 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{item.title || 'Work stage'}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                        background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` }}>{status}</span>
                      {rTone && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: rTone.bg, color: rTone.fg, border: `1px solid ${rTone.border}` }}>
                          {review.key === 'accepted' ? <ShieldCheck size={8} /> : review.key === 'rework' ? <RotateCcw size={8} /> : <Clock size={8} />}
                          {review.label}
                        </span>
                      )}
                      {showStaff && item.staffName && (
                        <span style={{ fontSize: 9.5, color: C.muted }}>· {item.staffName}</span>
                      )}
                    </div>

                    {item.details && (
                      <div style={{ fontSize: 10.5, color: C.subtle, marginTop: 4, lineHeight: 1.5 }}>{item.details}</div>
                    )}
                    {item.completionNote && (
                      <div style={{
                        marginTop: 7, fontSize: 11, color: C.subtle, lineHeight: 1.5, padding: '7px 10px',
                        borderRadius: 8, background: 'rgba(24,199,122,0.07)', border: '1px solid rgba(24,199,122,0.22)',
                      }}>
                        <StickyNote size={9} style={{ color: C.green, display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                        {item.completionNote}
                      </div>
                    )}
                    {review.key === 'rework' && review.note && (
                      <div style={{
                        marginTop: 7, fontSize: 11, color: C.red, lineHeight: 1.5, padding: '7px 10px',
                        borderRadius: 8, background: 'rgba(240,90,103,0.08)', border: '1px solid rgba(240,90,103,0.28)',
                      }}>
                        Rework note: {review.note}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, fontSize: 9.5, color: C.muted }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={9} /> {item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                      {item.completedAt && (
                        <span style={{ color: C.green }}>Completed {fmtStamp(item.completedAt)}</span>
                      )}
                      {review.key !== 'none' && item.reviewedBy && (
                        <span>{review.key === 'accepted' ? 'Approved' : 'Reviewed'} {fmtStamp(item.reviewedAt)} by {item.reviewedBy}</span>
                      )}
                      {history.length > 0 && (
                        <button type="button" onClick={() => setOpenHistory(openHistory === item.id ? null : item.id)}
                          style={{ background: 'transparent', border: 'none', color: C.cyan, cursor: 'pointer', padding: 0,
                            fontSize: 9.5, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <History size={9} /> {history.length} change{history.length === 1 ? '' : 's'}
                          {openHistory === item.id ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                        </button>
                      )}
                    </div>

                    {openHistory === item.id && (
                      <div style={{ marginTop: 7, paddingLeft: 10, borderLeft: `2px solid ${C.border}` }}>
                        {history.map((h, hi) => (
                          <div key={`${h.at}-${hi}`} style={{ fontSize: 9.5, color: C.muted, lineHeight: 1.7 }}>
                            {fmtStamp(h.at)} · {h.by || '—'} — {h.text}
                          </div>
                        ))}
                      </div>
                    )}

                    {proofs.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {proofs.map((f, fi) => (
                          <span key={`${f.path || f.url || f.name}-${fi}`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
                            borderRadius: 7, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                          }}>
                            {(f.type || '').startsWith('image/')
                              ? <ImageIcon size={10} style={{ color: C.cyan }} />
                              : <FileText size={10} style={{ color: C.violet }} />}
                            <PrivateFileLink file={{ name: f.name, path: f.path, url: f.url }} label={f.name || 'Proof'} iconSize={10} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                    {status === 'Completed' && review.key !== 'accepted' && (
                      <ERPBtn size="sm" variant="success" disabled={busy} onClick={() => accept(item)}>
                        <ShieldCheck size={11} /> Approve
                      </ERPBtn>
                    )}
                    {status === 'Completed' && review.key !== 'rework' && (
                      <ERPBtn size="sm" variant="ghost" disabled={busy}
                        onClick={() => { setReworkTarget(item); setReworkNote(review.key === 'rework' ? review.note : ''); }}>
                        <RotateCcw size={11} /> Rework
                      </ERPBtn>
                    )}
                    {review.key === 'accepted' && (
                      <ERPBtn size="sm" variant="ghost" disabled={busy}
                        onClick={() => write(item, { reviewState: 'rework', reviewNote: 'Approval removed' }, 'Approval withdrawn by admin')}>
                        <RotateCcw size={11} /> Withdraw
                      </ERPBtn>
                    )}
                    {status !== 'Completed' && (
                      <span style={{ fontSize: 9.5, color: C.muted, alignSelf: 'center', maxWidth: 120, textAlign: 'right' }}>
                        {item.reviewState === 'rework' ? 'Waiting for the staff to redo it' : 'Not finished yet'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <ERPModal isOpen={!!reworkTarget} onClose={() => setReworkTarget(null)} title="Ask for rework" width={430}>
        {reworkTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>{reworkTarget.title}</strong> goes back to{' '}
              {reworkTarget.staffName || 'the staff member'} — the client will not see it until you approve it again.
            </div>
            <ERPTextarea label="What must change" value={reworkNote} rows={3} autoFocus
              onChange={e => setReworkNote(e.target.value)}
              placeholder="e.g. Totals still mismatch the quotation on page 2" />
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setReworkTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="danger" onClick={sendRework} style={{ flex: 1, justifyContent: 'center' }}>
                <CheckCircle2 size={12} /> Send Back
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}

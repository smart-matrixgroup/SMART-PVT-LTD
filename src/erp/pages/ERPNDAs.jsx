import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, addDoc, doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import {
  Plus, Search, ShieldCheck, Download, Pencil, Trash2, Eye, XCircle,
} from 'lucide-react';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { company } from '../../config/company';
import { rulesNotice } from '../rulesNotice';
import { useStaffDirectory } from '../useStaffDirectory';
import {
  C, ERPPanel, ERPPanelHeader, ERPBtn, ERPInput, ERPTextarea, ERPSelect,
  ERPBadge, ERPModal, ERPEmpty, ERPAvatar,
} from '../components/ERPui';
import {
  EMPTY_NDA, NDA_COLLECTION, NDA_STATUSES, ndaFromStaff, makeNdaRefNo,
  nextNdaSequence, todayIso, prettyDate, ndaProblem, ndaSummary, diffNda,
  resolvedClauses, resolvedPurpose, resolvedOpening, resolvedClosing,
} from '../nda/ndaModel';
import { saveNdaPdf } from '../nda/ndaPdf';
import { loadLogoDataUrl } from '../offerLetters/offerLetterPdf';

const DEV_STAFF = [
  { id: 'dev-s1', staffId: 'SMART-001', name: 'Ashan Rifkan', position: 'Software Engineer', department: 'Software', email: 'ashan@smart.com', phone: '+94 76 202 4545', address: 'Main Street, Kalmunai', joinedDate: '2026-01-05' },
  { id: 'dev-s2', staffId: 'SMART-002', name: 'Kavitha Raj', position: 'Accounts Executive', department: 'Finance', email: 'kavitha@smart.com', phone: '+94 77 120 3399', address: 'Hospital Road, Kalmunai', joinedDate: '2026-03-02' },
  { id: 'dev-s3', staffId: 'SMART-003', name: 'Ruwan Silva', position: 'Digital Marketing Executive', department: 'Marketing', email: 'ruwan@smart.com', phone: '+94 71 553 1188', address: 'Beach Road, Kalmunai', joinedDate: '2026-06-15' },
];

const devNda = (staff, seq, status) => ({
  ...ndaFromStaff(staff, { refNo: makeNdaRefNo(seq, new Date()), date: todayIso() }),
  id: `dev-nda-${seq}`,
  status,
  clauses: [],
  history: [],
});

const DEV_NDAS = [devNda(DEV_STAFF[0], 1, 'Signed'), devNda(DEV_STAFF[1], 2, 'Issued')];

const grid = (cols, gap = 12) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  gap,
});

export default function ERPNDAs() {
  const { isDevSession, currentUser } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const adminName = currentUser?.email || 'admin';
  const { staff } = useStaffDirectory();
  const staffList = live ? staff : DEV_STAFF;

  const [agreements, setAgreements] = useState(live ? [] : DEV_NDAS);
  const [loadErr, setLoadErr] = useState('');
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_NDA);
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const logoRef = useRef('');

  useEffect(() => {
    if (!live) { setAgreements(DEV_NDAS); return undefined; }
    return onSnapshot(collection(db, NDA_COLLECTION),
      snap => {
        setAgreements(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => String(b.createdAt?.seconds || b.date || '')
            .localeCompare(String(a.createdAt?.seconds || a.date || ''))));
        setLoadErr('');
      },
      err => {
        console.error('NDA listener error', err);
        setLoadErr(err.code === 'permission-denied'
          ? rulesNotice('Non-disclosure agreements')
          : (err.message || 'Could not load the agreements.'));
      });
  }, [live]);

  useEffect(() => {
    let alive = true;
    loadLogoDataUrl(company.logos.lightMode).then(d => { if (alive) logoRef.current = d; });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => ({
    All: agreements.length,
    ...Object.fromEntries(NDA_STATUSES.map(s => [s, agreements.filter(a => a.status === s).length])),
  }), [agreements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agreements.filter(a => {
      if (filter !== 'All' && a.status !== filter) return false;
      if (!q) return true;
      return [a.staffName, a.position, a.department, a.refNo]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [agreements, filter, search]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openNew = () => {
    setForm({
      ...EMPTY_NDA,
      refNo: makeNdaRefNo(nextNdaSequence(agreements), new Date()),
      date: todayIso(),
      effectiveDate: todayIso(),
    });
    setFormErr('');
    setEditing({});
  };

  const openEdit = n => {
    setForm({
      ...EMPTY_NDA, ...n,
      clauses: Array.isArray(n.clauses) ? n.clauses : [],
      termYears: String(n.termYears ?? '3'),
    });
    setFormErr('');
    setEditing(n);
  };

  const pickStaff = staffId => {
    const s = staffList.find(x => x.id === staffId || x.staffId === staffId);
    if (!s) { set('staffId', staffId); return; }
    const filled = ndaFromStaff(s, {
      refNo: form.refNo || makeNdaRefNo(nextNdaSequence(agreements), new Date()),
      date: form.date || todayIso(),
    });
    // Keep the text the admin already typed; only the person changes.
    setForm(p => ({
      ...filled,
      purpose: p.purpose,
      opening: p.opening,
      closing: p.closing,
      clauses: p.clauses,
      notes: p.notes,
      status: p.status || 'Draft',
      governingLaw: p.governingLaw || filled.governingLaw,
      jurisdiction: p.jurisdiction || filled.jurisdiction,
      signerTitle: p.signerTitle || filled.signerTitle,
      companySignatory: p.companySignatory || filled.companySignatory,
      termYears: p.termYears || filled.termYears,
    }));
  };

  const handleSave = async ({ pdf = false } = {}) => {
    const problem = ndaProblem(form);
    if (problem) { setFormErr(problem); return; }
    setBusy(true); setFormErr('');
    try {
      const isNew = !editing?.id;
      // Whitelist stored fields — an edit also carries id/history/createdAt.
      const payload = {};
      Object.keys(EMPTY_NDA).forEach(k => { payload[k] = form[k]; });
      payload.termYears = Number(form.termYears) || 3;
      payload.clauses = Array.isArray(form.clauses) ? form.clauses : [];
      payload.updatedAt = serverTimestamp();
      payload.createdAt = isNew ? serverTimestamp() : (editing.createdAt || serverTimestamp());
      payload.createdBy = isNew ? adminName : (editing.createdBy || adminName);
      if (isNew) delete payload.history;

      let saved = { ...payload, id: editing?.id || `dev-nda-${Date.now()}` };
      if (live) {
        if (isNew) {
          const ref = await addDoc(collection(db, NDA_COLLECTION), payload);
          saved = { ...payload, id: ref.id };
          setAgreements(p => [{ ...saved, createdAt: { seconds: Date.now() / 1000 } }, ...p]);
        } else {
          const history = [...(editing.history || []), ...diffNda(editing, payload, adminName)];
          await updateDoc(doc(db, NDA_COLLECTION, editing.id), { ...payload, history });
          saved = { ...editing, ...payload, history };
          setAgreements(p => p.map(n => n.id === editing.id ? saved : n));
        }
      } else {
        setAgreements(p => (isNew ? [saved, ...p] : p.map(n => n.id === editing.id ? saved : n)));
      }

      setNotice({ kind: 'ok', msg: pdf ? 'Saved and the PDF is downloading.' : 'NDA saved.' });
      if (pdf) {
        const logo = logoRef.current || await loadLogoDataUrl(company.logos.lightMode);
        saveNdaPdf(saved, { logoDataUrl: logo });
      }
      setEditing(null);
    } catch (e) {
      console.error(e);
      setFormErr(e.code === 'permission-denied'
        ? rulesNotice('Saving an NDA')
        : (e.message || 'Could not save the agreement.'));
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async n => {
    try {
      const logo = logoRef.current || await loadLogoDataUrl(company.logos.lightMode);
      saveNdaPdf(n, { logoDataUrl: logo });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'bad', msg: 'Could not build the PDF — try again.' });
    }
  };

  const remove = async n => {
    if (!window.confirm(`Delete ${n.staffName}'s NDA (${n.refNo || 'no reference'})? This cannot be undone.`)) return;
    try {
      if (live) await deleteDoc(doc(db, NDA_COLLECTION, n.id));
      setAgreements(p => p.filter(x => x.id !== n.id));
      setNotice({ kind: 'ok', msg: 'Agreement deleted.' });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'bad', msg: e.code === 'permission-denied' ? rulesNotice('Deleting an NDA') : 'Could not delete it.' });
    }
  };

  const clauses = resolvedClauses(form);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {['All', ...NDA_STATUSES].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: filter === f ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.8)',
              color: filter === f ? '#fff' : C.muted,
              boxShadow: filter === f ? '0 4px 14px rgba(0,102,255,0.35)' : 'none',
              border: filter === f ? 'none' : `1px solid ${C.border}`,
            }}>
            {f} {counts[f] > 0 && <span style={{
              marginLeft: 6, padding: '1px 6px', borderRadius: 20, fontSize: 10,
              background: filter === f ? 'rgba(255,255,255,0.2)' : 'rgba(0,102,255,0.15)',
            }}>{counts[f]}</span>}
          </button>
        ))}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, position, ref..."
            style={{
              width: 220, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '7px 12px 7px 28px', color: C.text, fontSize: 12, outline: 'none',
            }} />
        </div>
        <ERPBtn onClick={openNew}><Plus size={13} /> New NDA</ERPBtn>
      </div>

      {loadErr && (
        <div style={{
          display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)',
          fontSize: 11, color: C.red, lineHeight: 1.5,
        }}>
          <XCircle size={14} style={{ flexShrink: 0 }} /> <span>{loadErr}</span>
        </div>
      )}

      {notice && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10,
          background: notice.kind === 'ok' ? 'rgba(24,199,122,0.1)' : 'rgba(240,90,103,0.1)',
          border: `1px solid ${notice.kind === 'ok' ? 'rgba(24,199,122,0.35)' : 'rgba(240,90,103,0.35)'}`,
          fontSize: 11, color: notice.kind === 'ok' ? C.green : C.red,
        }}>
          <span style={{ flex: 1 }}>{notice.msg}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <ERPPanel>
        <ERPPanelHeader
          title={`${filter === 'All' ? '' : `${filter} `}Non-disclosure agreements`}
          icon={<ShieldCheck size={15} />}
          action={!live ? 'sample rows — dev session' : `${agreements.length} saved`}
        />
        {filtered.length === 0 ? (
          <ERPEmpty
            icon={<ShieldCheck size={30} />}
            title={agreements.length ? 'No agreements match this filter' : 'No NDAs yet'}
            sub={agreements.length ? 'Try another status or search.' : 'Pick a staff member — the parties and clauses fill in automatically.'}
            action={<ERPBtn onClick={openNew}><Plus size={13} /> Create the first NDA</ERPBtn>}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  {['Staff', 'Position', 'Reference', 'Date', 'Term', 'Status', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
                      textTransform: 'uppercase', color: C.muted, textAlign: i === 5 ? 'center' : 'left',
                      background: 'rgba(10,24,56,0.5)', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n, i) => (
                  <tr key={n.id} className="erp-table-row" style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ERPAvatar name={n.staffName} size={30} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{n.staffName || '—'}</div>
                          <div style={{ fontSize: 10.5, color: C.muted }}>{n.staffCode || n.email || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11.5, color: C.subtle }}>
                      {n.position || '—'}
                      {n.department && <div style={{ fontSize: 10.5, color: C.muted }}>{n.department}</div>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{n.refNo || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: C.subtle, whiteSpace: 'nowrap' }}>{prettyDate(n.date) || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: C.subtle, whiteSpace: 'nowrap' }}>{ndaSummary(n)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <ERPBadge status={n.status || 'Draft'} />
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <ERPBtn size="sm" variant="ghost" title="Preview" onClick={() => setPreview(n)}><Eye size={12} /></ERPBtn>
                        <ERPBtn size="sm" variant="secondary" title="Download PDF" onClick={() => downloadPdf(n)}><Download size={12} /></ERPBtn>
                        <ERPBtn size="sm" variant="ghost" title="Edit" onClick={() => openEdit(n)}><Pencil size={12} /></ERPBtn>
                        <ERPBtn size="sm" variant="danger" title="Delete" onClick={() => remove(n)}><Trash2 size={12} /></ERPBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ERPPanel>

      {/* ── Create / edit ── */}
      <ERPModal isOpen={!!editing} onClose={() => setEditing(null)}
        title={editing?.id ? `Edit NDA — ${editing.staffName}` : 'New non-disclosure agreement'} width={880}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <ERPSelect
              label="Staff member"
              value={form.staffId}
              onChange={e => pickStaff(e.target.value)}
              placeholder={staffList.length ? 'Choose a staff member to auto-fill' : 'No staff records loaded — type the details below'}
              options={staffList.map(s => ({
                value: s.id,
                label: `${s.name}${s.staffId ? ` — ${s.staffId}` : ''}${s.position ? ` · ${s.position}` : ''}`,
              }))}
            />
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 5 }}>
              The name, position, contact details and effective date come from the staff record. Every field below stays editable.
            </div>
          </div>

          <div style={grid(3)}>
            <ERPInput label="Reference no." value={form.refNo} onChange={e => set('refNo', e.target.value)} placeholder="SMART/HR/NDA/2026/001" />
            <ERPInput label="Agreement date" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
            <ERPInput label="Effective date" type="date" value={form.effectiveDate} onChange={e => set('effectiveDate', e.target.value)} required />
          </div>

          <div style={grid(2)}>
            <ERPInput label="Full name" value={form.staffName} onChange={e => set('staffName', e.target.value)} required />
            <ERPInput label="Staff ID" value={form.staffCode} onChange={e => set('staffCode', e.target.value)} />
          </div>

          <div style={grid(2)}>
            <ERPInput label="Position" value={form.position} onChange={e => set('position', e.target.value)} required />
            <ERPInput label="Department" value={form.department} onChange={e => set('department', e.target.value)} />
          </div>

          <div style={grid(2)}>
            <ERPInput label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            <ERPInput label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>

          <ERPTextarea label="Address" rows={2} value={form.address} onChange={e => set('address', e.target.value)} />

          <div style={grid(3)}>
            <ERPInput label="Confidential for (years)" type="number" min="1" value={form.termYears}
              onChange={e => set('termYears', e.target.value)} required />
            <ERPInput label="Governing law" value={form.governingLaw} onChange={e => set('governingLaw', e.target.value)} />
            <ERPInput label="Courts of" value={form.jurisdiction} onChange={e => set('jurisdiction', e.target.value)} />
          </div>

          <div style={grid(2)}>
            <ERPInput label="Company signatory" value={form.companySignatory} onChange={e => set('companySignatory', e.target.value)} placeholder="Name on the signature line" />
            <ERPInput label="Signatory title" value={form.signerTitle} onChange={e => set('signerTitle', e.target.value)} />
          </div>

          <ERPTextarea label="Purpose (what the employee may access, and why)" rows={3} value={form.purpose}
            onChange={e => set('purpose', e.target.value)}
            placeholder="Leave blank to auto-write from the position." />

          <ERPTextarea label="Opening paragraph" rows={3} value={form.opening}
            onChange={e => set('opening', e.target.value)}
            placeholder="Leave blank to use the standard two-party opening." />

          {/* Clauses editor */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.subtle }}>Agreement clauses</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {form.clauses.length === 0 && (
                  <ERPBtn size="sm" variant="secondary" onClick={() => set('clauses', resolvedClauses(form))}>
                    Edit the standard clauses
                  </ERPBtn>
                )}
                {form.clauses.length > 0 && (
                  <>
                    <ERPBtn size="sm" variant="ghost" onClick={() => set('clauses', resolvedClauses({ ...form, clauses: [] }))}>Reset to standard</ERPBtn>
                    <ERPBtn size="sm" variant="secondary" onClick={() => set('clauses', [...form.clauses, { title: '', text: '' }])}>
                      <Plus size={11} /> Add clause
                    </ERPBtn>
                  </>
                )}
              </div>
            </div>
            {form.clauses.length === 0 ? (
              <div style={{
                fontSize: 11, color: C.muted, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(10,24,56,0.6)', border: `1px solid ${C.border}`,
              }}>
                {clauses.length} standard clauses will be printed (confidential information, obligations, exclusions, return of materials, intellectual property, non-solicitation, term, remedies, governing law).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.clauses.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, color: C.muted, paddingTop: 10, width: 16 }}>{i + 1}.</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input className="erp-field" value={t.title} placeholder="Clause heading"
                        onChange={e => {
                          const next = [...form.clauses];
                          next[i] = { ...next[i], title: e.target.value };
                          set('clauses', next);
                        }}
                        style={{
                          width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                          borderRadius: 9, padding: '7px 11px', color: C.text, fontSize: 11.5, outline: 'none', boxSizing: 'border-box',
                        }} />
                      <textarea className="erp-field" rows={2} value={t.text} placeholder="Clause text"
                        onChange={e => {
                          const next = [...form.clauses];
                          next[i] = { ...next[i], text: e.target.value };
                          set('clauses', next);
                        }}
                        style={{
                          width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                          borderRadius: 9, padding: '7px 11px', color: C.text, fontSize: 11.5, outline: 'none',
                          resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
                        }} />
                    </div>
                    <ERPBtn size="sm" variant="danger" title="Remove clause"
                      onClick={() => set('clauses', form.clauses.filter((_, j) => j !== i))}>
                      <Trash2 size={11} />
                    </ERPBtn>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ERPTextarea label="Closing paragraph" rows={3} value={form.closing}
            onChange={e => set('closing', e.target.value)}
            placeholder="Leave blank to use the standard closing." />

          <ERPTextarea label="Extra note (printed before the signatures)" rows={2} value={form.notes}
            onChange={e => set('notes', e.target.value)} />

          <div style={grid(2)}>
            <ERPSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)} options={NDA_STATUSES} />
          </div>

          {formErr && (
            <div style={{
              padding: '9px 12px', borderRadius: 9, fontSize: 11, color: C.red,
              background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)',
            }}>{formErr}</div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, flexWrap: 'wrap' }}>
            <ERPBtn variant="secondary" onClick={() => setPreview(form)}><Eye size={12} /> Preview</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => setEditing(null)}>Cancel</ERPBtn>
            <ERPBtn variant="secondary" disabled={busy} onClick={() => handleSave({ pdf: false })}>
              {busy ? 'Saving...' : 'Save'}
            </ERPBtn>
            <ERPBtn disabled={busy} onClick={() => handleSave({ pdf: true })}>
              <Download size={12} /> {busy ? 'Working...' : 'Save & PDF'}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── Preview ── */}
      <ERPModal isOpen={!!preview} onClose={() => setPreview(null)}
        title={preview ? `Preview — ${preview.staffName}` : 'Preview'} width={760}>
        {preview && <NdaPreview form={preview} logo={logoRef.current} />}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <ERPBtn variant="secondary" onClick={() => setPreview(null)}>Close</ERPBtn>
          <ERPBtn onClick={() => downloadPdf(preview)}><Download size={12} /> Download PDF</ERPBtn>
        </div>
      </ERPModal>
    </div>
  );
}

/** On-screen paper preview — same order as the PDF. */
function NdaPreview({ form, logo }) {
  return (
    <div style={{
      background: '#fff', color: '#1a202c', borderRadius: 8, padding: '26px 30px',
      fontSize: 10.5, lineHeight: 1.55, boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        {logo
          ? <img src={logo} alt="SMART" style={{ height: 46, objectFit: 'contain' }} />
          : <div style={{ fontSize: 16, fontWeight: 800 }}>SMART [PVT] LTD</div>}
        <div style={{ textAlign: 'right', fontSize: 8.5, color: '#6b7380', lineHeight: 1.5 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1a202c' }}>SMART [PVT] LTD</div>
          <div>{company.contact?.address}</div>
          <div>{company.contact?.phoneDisplay || company.contact?.phone} · {company.contact?.email}</div>
          <div>{company.website}</div>
        </div>
      </div>

      <div style={{ borderTop: '3px solid #0066FF', margin: '12px 0 14px' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6b7380', marginBottom: 12 }}>
        <span><b>REF:</b> <span style={{ color: '#1a202c' }}>{form.refNo || '—'}</span></span>
        <span><b>DATE:</b> <span style={{ color: '#1a202c' }}>{prettyDate(form.date)}</span></span>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 13, letterSpacing: '0.6px', marginBottom: 12 }}>
        NON-DISCLOSURE AGREEMENT
      </div>

      <div style={{ background: '#f4f8ff', borderLeft: '3px solid #0066FF', padding: '8px 12px', fontSize: 9.5 }}>
        <div style={{ fontWeight: 800, fontSize: 8.5, letterSpacing: '0.5px', color: '#0066FF', marginBottom: 4 }}>BETWEEN</div>
        {[['Company', company.fullName || company.name], ['Employee', form.staffName], ['Position', form.position],
          ['Staff ID', form.staffCode], ['Effective', prettyDate(form.effectiveDate)]]
          .map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 10 }}>
              <span style={{ width: 70, color: '#6b7380' }}>{k}</span>
              <span style={{ fontWeight: 700 }}>{v || '—'}</span>
            </div>
          ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {resolvedOpening(form).split(/\n\n+/).map((p, i) => <p key={i} style={{ margin: '0 0 8px' }}>{p}</p>)}
        <p style={{ margin: '0 0 8px' }}>{resolvedPurpose(form)}</p>
      </div>

      <div style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.6px', color: '#0066FF', margin: '12px 0 6px' }}>
        THE PARTIES AGREE AS FOLLOWS
      </div>
      {resolvedClauses(form).map((c, i) => (
        <div key={i} style={{ marginBottom: 7 }}>
          <div style={{ fontWeight: 700 }}>{i + 1}. {c.title}</div>
          <div style={{ color: '#4a5568', paddingLeft: 12 }}>{c.text}</div>
        </div>
      ))}

      {String(form.notes || '').trim() && <p style={{ margin: '8px 0' }}>{form.notes}</p>}

      {resolvedClosing(form).split(/\n\n+/).map((p, i) => <p key={i} style={{ margin: '10px 0' }}>{p}</p>)}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginTop: 18 }}>
        {[['FOR THE COMPANY', form.companySignatory || 'Authorised Signatory', form.signerTitle || 'Managing Director'],
          ['EMPLOYEE', form.staffName, prettyDate(form.date)]].map(([h, n, note]) => (
          <div key={h} style={{ width: '47%' }}>
            <div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.5px', color: '#6b7380' }}>{h}</div>
            <div style={{ borderTop: '1px solid #1a202c', marginTop: 30, paddingTop: 5, fontWeight: 700 }}>{n || '—'}</div>
            <div style={{ fontSize: 8.5, color: '#6b7380' }}>{note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

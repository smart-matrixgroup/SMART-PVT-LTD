import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, addDoc, doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import {
  Plus, Search, FileText, Download, Pencil, Trash2, Eye, XCircle,
  Sparkles,
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
  EMPTY_OFFER, OFFER_COLLECTION, OFFER_STATUSES, EMPLOYMENT_TYPES, EMPLOYMENT_KINDS,
  offerFromStaff, makeRefNo, nextSequence, todayIso, prettyDate, netSalary,
  amountInWords, money, offerProblem, offerSummary, diffOffer,
  resolvedOpening, resolvedClosing, resolvedTerms, salaryRows,
} from '../offerLetters/offerLetterModel';
import { saveOfferLetterPdf, loadLogoDataUrl } from '../offerLetters/offerLetterPdf';

const DEV_STAFF = [
  { id: 'dev-s1', staffId: 'SMART-001', name: 'Ashan Rifkan', position: 'Software Engineer', department: 'Software', email: 'ashan@smart.com', phone: '+94 76 202 4545', address: 'Main Street, Kalmunai', joinedDate: '2026-01-05', basicSalary: '85000', allowances: '15000', deductions: '5000' },
  { id: 'dev-s2', staffId: 'SMART-002', name: 'Kavitha Raj', position: 'Accounts Executive', department: 'Finance', email: 'kavitha@smart.com', phone: '+94 77 120 3399', address: 'Hospital Road, Kalmunai', joinedDate: '2026-03-02', basicSalary: '65000', allowances: '8000', deductions: '4000' },
  { id: 'dev-s3', staffId: 'SMART-003', name: 'Ruwan Silva', position: 'Digital Marketing Executive', department: 'Marketing', email: 'ruwan@smart.com', phone: '+94 71 553 1188', address: 'Beach Road, Kalmunai', joinedDate: '2026-06-15', basicSalary: '55000', allowances: '6000', deductions: '3000' },
];

const devOffer = (staff, seq, status) => ({
  ...offerFromStaff(staff, {
    refNo: makeRefNo(seq, new Date()),
    date: todayIso(),
  }),
  id: `dev-offer-${seq}`,
  status,
  terms: [],
  history: [],
});

const DEV_OFFERS = [devOffer(DEV_STAFF[0], 1, 'Accepted'), devOffer(DEV_STAFF[1], 2, 'Issued')];

const money2 = n => (Number(n) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const grid = (cols, gap = 12) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  gap,
});

export default function ERPOfferLetters() {
  const { isDevSession, currentUser } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const adminName = currentUser?.email || 'admin';
  const { staff } = useStaffDirectory();
  const staffList = live ? staff : DEV_STAFF;

  const [offers, setOffers] = useState(live ? [] : DEV_OFFERS);
  const [loadErr, setLoadErr] = useState('');
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const [editing, setEditing] = useState(null);   // null = closed, {} = new
  const [form, setForm] = useState(EMPTY_OFFER);
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const logoRef = useRef('');

  useEffect(() => {
    if (!live) {
      setOffers(DEV_OFFERS);
      return undefined;
    }
    return onSnapshot(collection(db, OFFER_COLLECTION),
      snap => {
        setOffers(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => String(b.createdAt?.seconds || b.date || '')
            .localeCompare(String(a.createdAt?.seconds || a.date || ''))));
        setLoadErr('');
      },
      err => {
        console.error('Offer letters listener error', err);
        setLoadErr(err.code === 'permission-denied'
          ? rulesNotice('Offer letters')
          : (err.message || 'Could not load the offer letters.'));
      });
  }, [live]);

  // Warm the logo once — every PDF/preview needs it as a data URL.
  useEffect(() => {
    let alive = true;
    loadLogoDataUrl(company.logos.lightMode).then(d => { if (alive) logoRef.current = d; });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => ({
    All: offers.length,
    Draft: offers.filter(o => o.status === 'Draft').length,
    Issued: offers.filter(o => o.status === 'Issued').length,
    Accepted: offers.filter(o => o.status === 'Accepted').length,
    Declined: offers.filter(o => o.status === 'Declined').length,
  }), [offers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offers.filter(o => {
      if (filter !== 'All' && o.status !== filter) return false;
      if (!q) return true;
      return [o.staffName, o.position, o.department, o.refNo]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [offers, filter, search]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openNew = () => {
    const refNo = makeRefNo(nextSequence(offers), new Date());
    setForm({ ...EMPTY_OFFER, refNo, date: todayIso() });
    setFormErr('');
    setEditing({});
  };

  const openEdit = (o) => {
    setForm({
      ...EMPTY_OFFER, ...o,
      terms: Array.isArray(o.terms) ? o.terms : [],
      basicSalary: String(o.basicSalary ?? ''),
      allowances: String(o.allowances ?? ''),
      deductions: String(o.deductions ?? ''),
      probationMonths: String(o.probationMonths ?? '3'),
    });
    setFormErr('');
    setEditing(o);
  };

  const pickStaff = (staffId) => {
    const s = staffList.find(x => x.id === staffId || x.staffId === staffId);
    if (!s) { set('staffId', staffId); return; }
    const filled = offerFromStaff(s, {
      refNo: form.refNo || makeRefNo(nextSequence(offers), new Date()),
      date: form.date || todayIso(),
    });
    // Keep the letter-specific text the admin already typed.
    setForm(p => ({
      ...filled,
      opening: p.opening,
      closing: p.closing,
      terms: p.terms,
      notes: p.notes,
      status: p.status || 'Draft',
      subject: p.subject || filled.subject,
      reportingTo: p.reportingTo || filled.reportingTo,
      probationMonths: p.probationMonths || filled.probationMonths,
      location: p.location || filled.location,
      employmentType: p.employmentType || filled.employmentType,
      employmentKind: p.employmentKind || filled.employmentKind,
      payFrequency: p.payFrequency || filled.payFrequency,
    }));
  };

  const handleSave = async ({ pdf = false } = {}) => {
    const problem = offerProblem(form);
    if (problem) { setFormErr(problem); return; }
    setBusy(true); setFormErr('');
    try {
      const isNew = !editing?.id;
      // Whitelist the stored fields — the edit form also carries id/history/
      // createdAt from the open record, and those must not be rewritten.
      const payload = {};
      Object.keys(EMPTY_OFFER).forEach(k => { payload[k] = form[k]; });
      payload.basicSalary = money(form.basicSalary);
      payload.allowances = money(form.allowances);
      payload.deductions = money(form.deductions);
      payload.probationMonths = money(form.probationMonths);
      payload.terms = Array.isArray(form.terms) ? form.terms : [];
      payload.netSalary = netSalary(form);
      payload.updatedAt = serverTimestamp();
      payload.createdAt = isNew ? serverTimestamp() : (editing.createdAt || serverTimestamp());
      payload.createdBy = isNew ? adminName : (editing.createdBy || adminName);
      if (isNew) delete payload.history;

      let saved = { ...payload, id: editing?.id || `dev-offer-${Date.now()}` };
      if (live) {
        if (isNew) {
          const ref = await addDoc(collection(db, OFFER_COLLECTION), payload);
          saved = { ...payload, id: ref.id };
          setOffers(p => [{ ...saved, createdAt: { seconds: Date.now() / 1000 } }, ...p]);
        } else {
          const history = [...(editing.history || []), ...diffOffer(editing, payload, adminName)];
          await updateDoc(doc(db, OFFER_COLLECTION, editing.id), { ...payload, history });
          saved = { ...editing, ...payload, history };
          setOffers(p => p.map(o => o.id === editing.id ? saved : o));
        }
      } else {
        setOffers(p => (isNew
          ? [saved, ...p]
          : p.map(o => o.id === editing.id ? saved : o)));
      }

      setNotice({ kind: 'ok', msg: pdf ? 'Saved and the PDF is downloading.' : 'Offer letter saved.' });
      if (pdf) {
        const logo = logoRef.current || await loadLogoDataUrl(company.logos.lightMode);
        saveOfferLetterPdf(saved, { logoDataUrl: logo });
      }
      setEditing(null);
    } catch (e) {
      console.error(e);
      setFormErr(
        e.code === 'permission-denied'
          ? rulesNotice('Saving an offer letter')
          : (e.message || 'Could not save the offer letter.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async (o) => {
    try {
      const logo = logoRef.current || await loadLogoDataUrl(company.logos.lightMode);
      saveOfferLetterPdf(o, { logoDataUrl: logo });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'bad', msg: 'Could not build the PDF — try again.' });
    }
  };

  const remove = async (o) => {
    if (!window.confirm(`Delete ${o.staffName}'s offer letter (${o.refNo || 'no reference'})? This cannot be undone.`)) return;
    try {
      if (live) await deleteDoc(doc(db, OFFER_COLLECTION, o.id));
      setOffers(p => p.filter(x => x.id !== o.id));
      setNotice({ kind: 'ok', msg: 'Offer letter deleted.' });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'bad', msg: e.code === 'permission-denied' ? rulesNotice('Deleting an offer letter') : 'Could not delete it.' });
    }
  };

  const net = netSalary(form);
  const terms = resolvedTerms(form);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {['All', ...OFFER_STATUSES].map(f => (
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
            placeholder="Search name, title, ref..."
            style={{
              width: 220, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '7px 12px 7px 28px', color: C.text, fontSize: 12, outline: 'none',
            }} />
        </div>
        <ERPBtn onClick={openNew}><Plus size={13} /> New Offer Letter</ERPBtn>
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
          title={`${filter === 'All' ? '' : `${filter} `}Offer letters`}
          icon={<FileText size={15} />}
          action={!live ? 'sample rows — dev session' : `${offers.length} saved`}
        />
        {filtered.length === 0 ? (
          <ERPEmpty
            icon={<FileText size={30} />}
            title={offers.length ? 'No letters match this filter' : 'No offer letters yet'}
            sub={offers.length ? 'Try another status or search.' : 'Pick a staff member and the letter fills itself from their record.'}
            action={<ERPBtn onClick={openNew}><Plus size={13} /> Create the first letter</ERPBtn>}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  {['Staff', 'Position', 'Reference', 'Date', 'Salary', 'Status', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
                      textTransform: 'uppercase', color: C.muted, textAlign: i === 5 ? 'center' : 'left',
                      background: 'rgba(10,24,56,0.5)', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => (
                  <tr key={o.id} className="erp-table-row" style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ERPAvatar name={o.staffName} size={30} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{o.staffName || '—'}</div>
                          <div style={{ fontSize: 10.5, color: C.muted }}>{o.staffCode || o.email || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11.5, color: C.subtle }}>
                      {o.position || '—'}
                      {o.department && <div style={{ fontSize: 10.5, color: C.muted }}>{o.department}</div>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{o.refNo || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: C.subtle, whiteSpace: 'nowrap' }}>{prettyDate(o.date) || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: C.subtle, whiteSpace: 'nowrap' }}>
                      {offerSummary(o)}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <ERPBadge status={o.status || 'Draft'} />
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <ERPBtn size="sm" variant="ghost" title="Preview" onClick={() => setPreview(o)}><Eye size={12} /></ERPBtn>
                        <ERPBtn size="sm" variant="secondary" title="Download PDF" onClick={() => downloadPdf(o)}><Download size={12} /></ERPBtn>
                        <ERPBtn size="sm" variant="ghost" title="Edit" onClick={() => openEdit(o)}><Pencil size={12} /></ERPBtn>
                        <ERPBtn size="sm" variant="danger" title="Delete" onClick={() => remove(o)}><Trash2 size={12} /></ERPBtn>
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
        title={editing?.id ? `Edit offer letter — ${editing.staffName}` : 'New offer letter'} width={880}>
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
              Picking a name fills position, contact, salary and joining date from the staff record. Every field below stays editable.
            </div>
          </div>

          <div style={grid(2)}>
            <ERPInput label="Reference no." value={form.refNo} onChange={e => set('refNo', e.target.value)} placeholder="SMART/HR/OL/2026/001" />
            <ERPInput label="Letter date" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
          </div>

          <div style={grid(2)}>
            <ERPInput label="Full name" value={form.staffName} onChange={e => set('staffName', e.target.value)} required />
            <ERPInput label="Staff ID" value={form.staffCode} onChange={e => set('staffCode', e.target.value)} />
          </div>

          <div style={grid(2)}>
            <ERPInput label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            <ERPInput label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>

          <ERPTextarea label="Address" rows={2} value={form.address} onChange={e => set('address', e.target.value)} />

          <div style={grid(2)}>
            <ERPInput label="Position offered" value={form.position} onChange={e => set('position', e.target.value)} required />
            <ERPInput label="Department" value={form.department} onChange={e => set('department', e.target.value)} />
          </div>

          <div style={grid(2)}>
            <ERPSelect label="Employment type" value={form.employmentType} onChange={e => set('employmentType', e.target.value)}
              options={EMPLOYMENT_TYPES} />
            <ERPSelect label="Work basis" value={form.employmentKind} onChange={e => set('employmentKind', e.target.value)}
              options={EMPLOYMENT_KINDS} />
          </div>

          <div style={grid(3)}>
            <ERPInput label="Date of joining" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
            <ERPInput label="Probation (months)" type="number" value={form.probationMonths} onChange={e => set('probationMonths', e.target.value)} />
            <ERPInput label="Reporting to" value={form.reportingTo} onChange={e => set('reportingTo', e.target.value)} />
          </div>

          <ERPInput label="Place of work" value={form.location} onChange={e => set('location', e.target.value)} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
            <ERPInput label="Basic salary (LKR)" type="number" value={form.basicSalary} onChange={e => set('basicSalary', e.target.value)} required />
            <ERPInput label="Allowances" type="number" value={form.allowances} onChange={e => set('allowances', e.target.value)} />
            <ERPInput label="Deductions" type="number" value={form.deductions} onChange={e => set('deductions', e.target.value)} />
            <ERPSelect label="Pay frequency" value={form.payFrequency} onChange={e => set('payFrequency', e.target.value)}
              options={['Monthly', 'Bi-weekly', 'Weekly']} />
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(0,102,255,0.08)', border: '1px solid rgba(0,102,255,0.25)',
          }}>
            <Sparkles size={13} color={C.cyan} />
            <span style={{ fontSize: 11, color: C.muted }}>Net monthly salary</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>LKR {money2(net)}</span>
            {net > 0 && <span style={{ fontSize: 10.5, color: C.muted, marginLeft: 'auto' }}>{amountInWords(net)}</span>}
          </div>

          <ERPInput label="Subject line" value={form.subject} onChange={e => set('subject', e.target.value)} />

          <ERPTextarea label="Opening paragraph" rows={4} value={form.opening}
            onChange={e => set('opening', e.target.value)}
            placeholder="Leave blank to auto-write from the name, position and department above." />

          {/* Terms editor */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.subtle }}>Terms of appointment</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {form.terms.length === 0 && (
                  <ERPBtn size="sm" variant="secondary" onClick={() => set('terms', resolvedTerms(form))}>
                    Edit the standard terms
                  </ERPBtn>
                )}
                {form.terms.length > 0 && (
                  <>
                    <ERPBtn size="sm" variant="ghost" onClick={() => set('terms', defaultTermsForForm(form))}>Reset to standard</ERPBtn>
                    <ERPBtn size="sm" variant="secondary" onClick={() => set('terms', [...form.terms, { title: '', text: '' }])}>
                      <Plus size={11} /> Add term
                    </ERPBtn>
                  </>
                )}
              </div>
            </div>
            {form.terms.length === 0 ? (
              <div style={{
                fontSize: 11, color: C.muted, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(10,24,56,0.6)', border: `1px solid ${C.border}`,
              }}>
                {terms.length} standard terms will be printed (probation, hours, salary, leave, confidentiality, conduct, termination).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.terms.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, color: C.muted, paddingTop: 10, width: 16 }}>{i + 1}.</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input className="erp-field" value={t.title} placeholder="Term heading"
                        onChange={e => {
                          const next = [...form.terms];
                          next[i] = { ...next[i], title: e.target.value };
                          set('terms', next);
                        }}
                        style={{
                          width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                          borderRadius: 9, padding: '7px 11px', color: C.text, fontSize: 11.5, outline: 'none', boxSizing: 'border-box',
                        }} />
                      <textarea className="erp-field" rows={2} value={t.text} placeholder="Term text"
                        onChange={e => {
                          const next = [...form.terms];
                          next[i] = { ...next[i], text: e.target.value };
                          set('terms', next);
                        }}
                        style={{
                          width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                          borderRadius: 9, padding: '7px 11px', color: C.text, fontSize: 11.5, outline: 'none',
                          resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
                        }} />
                    </div>
                    <ERPBtn size="sm" variant="danger" title="Remove term"
                      onClick={() => set('terms', form.terms.filter((_, j) => j !== i))}>
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

          <ERPTextarea label="Extra note (printed before the signature)" rows={2} value={form.notes}
            onChange={e => set('notes', e.target.value)} />

          <div style={grid(2)}>
            <ERPSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)} options={OFFER_STATUSES} />
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
        {preview && <LetterPreview form={preview} logo={logoRef.current} />}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <ERPBtn variant="secondary" onClick={() => setPreview(null)}>Close</ERPBtn>
          <ERPBtn onClick={() => downloadPdf(preview)}><Download size={12} /> Download PDF</ERPBtn>
        </div>
      </ERPModal>
    </div>
  );
}

const defaultTermsForForm = form => resolvedTerms({ ...form, terms: [] });

/** On-screen paper preview — same content and order as the PDF. */
function LetterPreview({ form, logo }) {
  const meta = [
    ['Position', form.position],
    ['Department', form.department],
    ['Employment type', [form.employmentType, form.employmentKind].filter(Boolean).join(' · ')],
    ['Date of joining', prettyDate(form.startDate)],
    ['Probation', money(form.probationMonths) ? `${money(form.probationMonths)} month${money(form.probationMonths) === 1 ? '' : 's'}` : '—'],
    ['Place of work', form.location],
    ['Reporting to', form.reportingTo],
  ].filter(([, v]) => String(v || '').trim());
  const rows = salaryRows(form);

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

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6b7380', marginBottom: 14 }}>
        <span><b>REF:</b> <span style={{ color: '#1a202c' }}>{form.refNo || '—'}</span></span>
        <span><b>DATE:</b> <span style={{ color: '#1a202c' }}>{prettyDate(form.date)}</span></span>
      </div>

      <div style={{ fontWeight: 700, fontSize: 11 }}>{form.staffName || '—'}</div>
      <div style={{ fontSize: 9.5, color: '#6b7380', marginBottom: 14 }}>
        {[form.position && `${form.position}${form.department ? `, ${form.department}` : ''}`, form.address,
          [form.phone, form.email].filter(Boolean).join(' · ')].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
      </div>

      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 11, letterSpacing: '0.4px', marginBottom: 14, textTransform: 'uppercase' }}>
        {form.subject || 'Letter of Appointment'}
      </div>

      {resolvedOpening(form).split(/\n\n+/).map((p, i) => (
        <p key={i} style={{ margin: '0 0 9px' }}>{p}</p>
      ))}

      <div style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.6px', color: '#0066FF', margin: '12px 0 6px' }}>APPOINTMENT DETAILS</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, background: '#f4f8ff' }}>
        <tbody>
          {meta.map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: '5px 10px', color: '#6b7380', width: '36%' }}>{k}</td>
              <td style={{ padding: '5px 10px', fontWeight: 700 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.6px', color: '#0066FF', margin: '14px 0 6px' }}>REMUNERATION</div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', padding: '3px 4px',
          fontWeight: r.strong ? 800 : 400, color: r.strong ? '#1a202c' : '#4a5568',
          borderTop: r.strong ? '1px solid #d0d8e6' : 'none', marginTop: r.strong ? 4 : 0,
        }}>
          <span>{r.label}</span>
          <span style={{ color: r.strong ? '#0066FF' : '#1a202c' }}>
            {r.value < 0 ? '-' : ''}LKR {Math.abs(r.value).toLocaleString('en-LK')}
            {form.payFrequency ? ` / ${String(form.payFrequency).toLowerCase()}` : ''}
          </span>
        </div>
      ))}
      {netSalary(form) > 0 && (
        <div style={{ fontSize: 8.5, fontStyle: 'italic', color: '#6b7380', margin: '6px 4px 0' }}>
          In words: {amountInWords(netSalary(form))}.
        </div>
      )}

      <div style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.6px', color: '#0066FF', margin: '14px 0 6px' }}>TERMS OF APPOINTMENT</div>
      {resolvedTerms(form).map((t, i) => (
        <div key={i} style={{ marginBottom: 7 }}>
          <div style={{ fontWeight: 700 }}>{i + 1}. {t.title}</div>
          <div style={{ color: '#4a5568', paddingLeft: 12 }}>{t.text}</div>
        </div>
      ))}

      {String(form.notes || '').trim() && <p style={{ margin: '8px 0' }}>{form.notes}</p>}

      {resolvedClosing(form).split(/\n\n+/).map((p, i) => (
        <p key={i} style={{ margin: '10px 0' }}>{p}</p>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, gap: 16 }}>
        <div>
          <div style={{ borderTop: '1px solid #1a202c', width: 170, paddingTop: 6, fontWeight: 700 }}>Authorised Signatory</div>
          <div style={{ fontSize: 9, color: '#6b7380' }}>Managing Director</div>
        </div>
        <div style={{ border: '1px solid #d0d8e6', padding: '7px 10px', width: 190 }}>
          <div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.5px', color: '#6b7380' }}>ACCEPTED BY</div>
          <div style={{ borderTop: '1px solid #d0d8e6', marginTop: 18, fontSize: 7.5, color: '#6b7380', paddingTop: 3 }}>Signature &amp; date</div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { QUOTATION_TEMPLATE_SEEDS, REQUIREMENT_TEMPLATE_SEEDS, seedId } from '../data/seedTemplates';
import { toInt, formatLKR } from '../money';
import {
  ERPPanel, ERPPanelHeader, ERPBtn, ERPModal, ERPInput, ERPTextarea,
  ERPEmpty, C
} from '../components/ERPui';
import { Plus, Pencil, Trash2, FileText, ClipboardList, Tag } from 'lucide-react';

const uid = () => `c${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const EMPTY_Q = {
  serviceName: '', serviceCode: '', description: '', scope: '',
  professionalFee: '', otherCharges: '', terms: '', paymentTerms: '',
  customFields: [],
};
const EMPTY_R = { serviceName: '', serviceCode: '', checklist: [{ id: uid(), label: '' }] };

const byName = (a, b) => String(a.serviceName || '').localeCompare(String(b.serviceName || ''));

export default function ERPTemplates() {
  const { isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [tab,        setTab]        = useState('quotation'); // 'quotation' | 'requirement'
  const [qRows,      setQRows]      = useState([]);
  const [rRows,      setRRows]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState('');

  const [qModal,     setQModal]     = useState(false);
  const [rModal,     setRModal]     = useState(false);
  const [editQId,    setEditQId]    = useState(null);
  const [editRId,    setEditRId]    = useState(null);
  const [qForm,      setQForm]      = useState(EMPTY_Q);
  const [rForm,      setRForm]      = useState(EMPTY_R);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState('');
  const [delTarget,  setDelTarget]  = useState(null); // { type:'quotation'|'requirement', row }
  const [delBusy,    setDelBusy]    = useState(false);
  const seeded = useRef(false);

  // ── Load (live listeners, or seed data in dev mode) ─────────────
  useEffect(() => {
    if (!live) {
      setQRows(QUOTATION_TEMPLATE_SEEDS.map(s => ({ id: seedId(s.serviceCode), ...s, isDev: true })));
      setRRows(REQUIREMENT_TEMPLATE_SEEDS.map(s => ({ id: seedId(s.serviceCode), ...s, isDev: true })));
      setLoading(false);
      return;
    }
    const un1 = onSnapshot(collection(db, 'quotationTemplates'), snap => {
      setQRows(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byName));
      setLoading(false);
      setLoadError('');
      // Auto-seed once, with deterministic ids so repeats never duplicate.
      if (snap.empty && !seeded.current) {
        seeded.current = true;
        QUOTATION_TEMPLATE_SEEDS.forEach(s => {
          setDoc(doc(db, 'quotationTemplates', seedId(s.serviceCode)),
            { ...s, createdAt: serverTimestamp() }).catch(e => console.error('seed q-template', e));
        });
      }
    }, err => { console.error(err); setLoadError(err.message || 'Failed to load quotation templates.'); setLoading(false); });

    const un2 = onSnapshot(collection(db, 'requirementTemplates'), snap => {
      setRRows(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byName));
      if (snap.empty && !seeded.current) {
        seeded.current = true;
        REQUIREMENT_TEMPLATE_SEEDS.forEach(s => {
          setDoc(doc(db, 'requirementTemplates', seedId(s.serviceCode)),
            { ...s, createdAt: serverTimestamp() }).catch(e => console.error('seed r-template', e));
        });
      }
    }, err => { console.error(err); setLoadError(err.message || 'Failed to load requirement templates.'); setLoading(false); });

    return () => { un1(); un2(); };
  }, [live]);

  // ── Quotation template CRUD ──────────────────────────────────────
  const openQCreate = () => { setEditQId(null); setQForm(EMPTY_Q); setFormError(''); setQModal(true); };
  const openQEdit = (row) => {
    setEditQId(row.id);
    setQForm({
      serviceName:    row.serviceName    || '',
      serviceCode:    row.serviceCode    || '',
      description:    row.description    || '',
      scope:          row.scope          || '',
      professionalFee: row.professionalFee != null ? String(row.professionalFee) : '',
      otherCharges:   row.otherCharges   != null ? String(row.otherCharges)  : '',
      terms:          row.terms          || '',
      paymentTerms:   row.paymentTerms   || '',
      customFields:   (row.customFields || []).map(f => ({ id: f.id || uid(), label: f.label || '', value: f.value || '' })),
    });
    setFormError('');
    setQModal(true);
  };

  const saveQ = async () => {
    if (!qForm.serviceName.trim()) { setFormError('Service name is required.'); return; }
    setFormError('');
    const payload = {
      serviceName:     qForm.serviceName.trim(),
      serviceCode:     qForm.serviceCode.trim(),
      description:     qForm.description.trim(),
      scope:           qForm.scope.trim(),
      professionalFee: toInt(qForm.professionalFee),
      otherCharges:    toInt(qForm.otherCharges),
      terms:           qForm.terms.trim(),
      paymentTerms:    qForm.paymentTerms.trim(),
      // Custom fields — empty-labelled rows are dropped; existing records
      // keep their own copy so later edits here never change quotations.
      customFields:    qForm.customFields
        .map(f => ({ id: f.id || uid(), label: f.label.trim(), value: f.value.trim() }))
        .filter(f => f.label),
    };
    setSaving(true);
    try {
      if (editQId) {
        if (live) await updateDoc(doc(db, 'quotationTemplates', editQId), { ...payload, updatedAt: serverTimestamp() });
        else setQRows(p => p.map(r => r.id === editQId ? { ...r, ...payload } : r));
      } else {
        if (live) await addDoc(collection(db, 'quotationTemplates'), { ...payload, createdAt: serverTimestamp() });
        else setQRows(p => [...p, { id: `local-${Date.now()}`, ...payload, isDev: true }]);
      }
      setQModal(false); setEditQId(null); setQForm(EMPTY_Q);
    } catch (e) {
      console.error(e);
      setFormError(e.message || "Couldn't save the template. Please try again.");
    }
    setSaving(false);
  };

  // ── Requirement template CRUD ────────────────────────────────────
  const openRCreate = () => { setEditRId(null); setRForm(EMPTY_R); setFormError(''); setRModal(true); };
  const openREdit = (row) => {
    setEditRId(row.id);
    setRForm({
      serviceName: row.serviceName || '',
      serviceCode: row.serviceCode || '',
      checklist: (row.checklist || []).length > 0
        ? row.checklist.map(c => ({ id: c.id || uid(), label: c.label || '' }))
        : [{ id: uid(), label: '' }],
    });
    setFormError('');
    setRModal(true);
  };

  const saveR = async () => {
    const items = rForm.checklist.map(c => c.label.trim()).filter(Boolean);
    if (!rForm.serviceName.trim()) { setFormError('Service name is required.'); return; }
    if (items.length === 0) { setFormError('Add at least one checklist document.'); return; }
    setFormError('');
    const payload = {
      serviceName: rForm.serviceName.trim(),
      serviceCode: rForm.serviceCode.trim(),
      checklist: items.map(label => ({ id: uid(), label })),
    };
    setSaving(true);
    try {
      if (editRId) {
        if (live) await updateDoc(doc(db, 'requirementTemplates', editRId), { ...payload, updatedAt: serverTimestamp() });
        else setRRows(p => p.map(r => r.id === editRId ? { ...r, ...payload } : r));
      } else {
        if (live) await addDoc(collection(db, 'requirementTemplates'), { ...payload, createdAt: serverTimestamp() });
        else setRRows(p => [...p, { id: `local-${Date.now()}`, ...payload, isDev: true }]);
      }
      setRModal(false); setEditRId(null); setRForm(EMPTY_R);
    } catch (e) {
      console.error(e);
      setFormError(e.message || "Couldn't save the template. Please try again.");
    }
    setSaving(false);
  };

  // ── Delete (with confirmation; templates are safe — quotations &
  //    requirements keep a copy, so existing records are unaffected) ──
  const confirmDelete = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    const { type, row } = delTarget;
    try {
      if (live) await deleteDoc(doc(db, type === 'quotation' ? 'quotationTemplates' : 'requirementTemplates', row.id));
      if (type === 'quotation') setQRows(p => p.filter(r => r.id !== row.id));
      else setRRows(p => p.filter(r => r.id !== row.id));
      setDelTarget(null);
    } catch (e) {
      console.error(e);
      setFormError(e.message || 'Delete failed.');
      setDelTarget(null);
    }
    setDelBusy(false);
  };

  // ── Checklist item helpers ───────────────────────────────────────
  const addRItem    = () => setRForm(p => ({ ...p, checklist: [...p.checklist, { id: uid(), label: '' }] }));
  const removeRItem = (id)  => setRForm(p => ({ ...p, checklist: p.checklist.filter(c => c.id !== id) }));
  const updateRItem = (id, v) => setRForm(p => ({ ...p, checklist: p.checklist.map(c => c.id === id ? { ...c, label: v } : c) }));

  // ── Quotation template custom field helpers (add / remove / edit) ──
  const addQField    = () => setQForm(p => ({ ...p, customFields: [...p.customFields, { id: uid(), label: '', value: '' }] }));
  const removeQField = (id)  => setQForm(p => ({ ...p, customFields: p.customFields.filter(f => f.id !== id) }));
  const updateQField = (id, key, v) => setQForm(p => ({ ...p, customFields: p.customFields.map(f => f.id === id ? { ...f, [key]: v } : f) }));

  const rows = tab === 'quotation' ? qRows : rRows;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header + tabs */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { id: 'quotation',   label: `Quotation Templates${qRows.length ? ` (${qRows.length})` : ''}` },
          { id: 'requirement', label: `Requirement Templates${rRows.length ? ` (${rRows.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: tab === t.id ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.8)',
            color: tab === t.id ? '#fff' : C.muted,
            border: tab === t.id ? 'none' : `1px solid ${C.border}`,
            boxShadow: tab === t.id ? '0 4px 14px rgba(0,102,255,0.35)' : 'none',
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <ERPBtn onClick={tab === 'quotation' ? openQCreate : openRCreate}>
            <Plus size={13} /> New {tab === 'quotation' ? 'Quotation' : 'Requirement'} Template
          </ERPBtn>
        </div>
      </div>

      {loadError && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(240,90,103,0.12)', border: '1px solid rgba(240,90,103,0.35)', fontSize: 12, color: C.red }}>
          ⚠ {loadError} — check your connection and Firebase rules, then reload.
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.blue, animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : rows.length === 0 ? (
        <ERPPanel>
          <ERPEmpty
            icon={tab === 'quotation' ? '📄' : '📋'}
            title={`No ${tab} templates yet`}
            sub={tab === 'quotation'
              ? 'Create a reusable quotation template per service — new quotations will copy it.'
              : 'Create a document checklist template per service — client requirements will copy it.'}
            action={<ERPBtn onClick={tab === 'quotation' ? openQCreate : openRCreate}><Plus size={13} /> Create the first template</ERPBtn>}
          />
        </ERPPanel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {rows.map(row => (
            <ERPPanel key={row.id} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                  background: 'rgba(0,102,255,0.12)', border: `1px solid ${C.borderHi}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {tab === 'quotation'
                    ? <FileText size={18} color={C.blue} />
                    : <ClipboardList size={18} color={C.blue} />}
                </div>
                {row.serviceCode && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 10, fontWeight: 700, color: C.cyan,
                    background: 'rgba(0,217,255,0.08)', border: '1px solid rgba(0,217,255,0.25)',
                    padding: '2px 8px', borderRadius: 20,
                  }}><Tag size={10} /> {row.serviceCode}</span>
                )}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{row.serviceName}</div>
                {tab === 'quotation' ? (
                  <>
                    {row.description && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                        {row.description.length > 130 ? `${row.description.slice(0, 130)}…` : row.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Professional Fee</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{formatLKR(row.professionalFee)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Other Charges</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.amber }}>{formatLKR(row.otherCharges)}</div>
                      </div>
                    </div>
                    {(row.customFields || []).length > 0 && (
                      <div style={{ fontSize: 10, color: C.violet, marginTop: 6 }}>
                        + {(row.customFields).length} custom field{(row.customFields).length === 1 ? '' : 's'}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      {(row.checklist || []).length} document{(row.checklist || []).length === 1 ? '' : 's'} required
                    </div>
                    <div style={{ fontSize: 10.5, color: C.subtle, marginTop: 6, lineHeight: 1.6 }}>
                      {(row.checklist || []).slice(0, 3).map(c => (
                        <div key={c.id || c.label} style={{ display: 'flex', gap: 6 }}>
                          <span style={{ color: C.green }}>✓</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                        </div>
                      ))}
                      {(row.checklist || []).length > 3 && (
                        <div style={{ color: C.muted }}>+ {(row.checklist || []).length - 3} more…</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                <ERPBtn size="sm" variant="secondary" onClick={() => tab === 'quotation' ? openQEdit(row) : openREdit(row)} style={{ flex: 1, justifyContent: 'center' }}>
                  <Pencil size={11} /> Edit
                </ERPBtn>
                <ERPBtn size="sm" variant="danger" onClick={() => setDelTarget({ type: tab, row })} style={{ flex: 1, justifyContent: 'center' }}>
                  <Trash2 size={11} /> Delete
                </ERPBtn>
              </div>
            </ERPPanel>
          ))}
        </div>
      )}

      {/* ── Quotation template modal ── */}
      <ERPModal isOpen={qModal} onClose={() => setQModal(false)} title={editQId ? 'Edit Quotation Template' : 'New Quotation Template'} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {formError && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,185,66,0.1)', border: '1px solid rgba(245,185,66,0.35)', fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
              ⚠ {formError}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 12 }}>
            <ERPInput label="Service Name" value={qForm.serviceName} required
              onChange={e => setQForm(p => ({ ...p, serviceName: e.target.value }))}
              placeholder="e.g. Website Development" />
            <ERPInput label="Service Code" value={qForm.serviceCode}
              onChange={e => setQForm(p => ({ ...p, serviceCode: e.target.value }))}
              placeholder="e.g. WD-01" />
          </div>
          <ERPTextarea label="Description" value={qForm.description} rows={2}
            onChange={e => setQForm(p => ({ ...p, description: e.target.value }))}
            placeholder="One-line summary shown on the quotation…" />
          <ERPTextarea label="Scope of Work" value={qForm.scope} rows={4}
            onChange={e => setQForm(p => ({ ...p, scope: e.target.value }))}
            placeholder={'• Discovery & requirements\n• Design & development\n• Deployment & support'} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPInput label="Professional Fee (LKR)" value={qForm.professionalFee} type="number" min="0"
              onChange={e => setQForm(p => ({ ...p, professionalFee: e.target.value }))} placeholder="0" />
            <ERPInput label="Other Charges (LKR)" value={qForm.otherCharges} type="number" min="0"
              onChange={e => setQForm(p => ({ ...p, otherCharges: e.target.value }))} placeholder="0" />
          </div>
          <ERPTextarea label="Terms & Conditions" value={qForm.terms} rows={3}
            onChange={e => setQForm(p => ({ ...p, terms: e.target.value }))}
            placeholder="Validity, client responsibilities, revision policy…" />
          <ERPInput label="Payment Terms" value={qForm.paymentTerms}
            onChange={e => setQForm(p => ({ ...p, paymentTerms: e.target.value }))}
            placeholder="e.g. 50% advance, 50% on delivery" />

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.subtle }}>
                Custom Fields <span style={{ fontWeight: 400, color: C.muted }}>(add your own boxes)</span>
              </label>
              <ERPBtn size="sm" variant="secondary" onClick={addQField}><Plus size={11} /> Add Field</ERPBtn>
            </div>
            {qForm.customFields.length === 0 && (
              <div style={{ fontSize: 11, color: C.muted, padding: '8px 10px', borderRadius: 8, background: 'rgba(10,24,56,0.5)', border: `1px dashed ${C.border}`, lineHeight: 1.5 }}>
                No custom fields yet. Click “Add Field” to create extra boxes (e.g. Warranty · 12 months) —
                they are copied into every quotation made from this template.
              </div>
            )}
            {qForm.customFields.map((f, i) => (
              <div key={f.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input value={f.label}
                  onChange={e => updateQField(f.id, 'label', e.target.value)}
                  placeholder={`Field ${i + 1} name — e.g. Warranty`}
                  style={{ flex: 1, minWidth: 0, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', color: C.text, fontSize: 12, outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,102,255,0.5)'}
                  onBlur={e => e.target.style.borderColor = C.border} />
                <input value={f.value}
                  onChange={e => updateQField(f.id, 'value', e.target.value)}
                  placeholder="Value — e.g. 12 months"
                  style={{ flex: 1, minWidth: 0, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', color: C.text, fontSize: 12, outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,102,255,0.5)'}
                  onBlur={e => e.target.style.borderColor = C.border} />
                <button onClick={() => removeQField(f.id)} title="Remove field"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, display: 'flex', flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <ERPBtn variant="secondary" onClick={() => setQModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={saveQ} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? 'Saving…' : editQId ? 'Update Template' : 'Create Template'}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── Requirement template modal ── */}
      <ERPModal isOpen={rModal} onClose={() => setRModal(false)} title={editRId ? 'Edit Requirement Template' : 'New Requirement Template'} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {formError && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,185,66,0.1)', border: '1px solid rgba(245,185,66,0.35)', fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
              ⚠ {formError}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 12 }}>
            <ERPInput label="Service Name" value={rForm.serviceName} required
              onChange={e => setRForm(p => ({ ...p, serviceName: e.target.value }))}
              placeholder="e.g. Website Development" />
            <ERPInput label="Service Code" value={rForm.serviceCode}
              onChange={e => setRForm(p => ({ ...p, serviceCode: e.target.value }))}
              placeholder="e.g. WD-01" />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.subtle }}>
                Document Checklist <span style={{ color: C.red }}>*</span>
              </label>
              <ERPBtn size="sm" variant="secondary" onClick={addRItem}><Plus size={11} /> Add Document</ERPBtn>
            </div>
            {rForm.checklist.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input value={item.label}
                  onChange={e => updateRItem(item.id, e.target.value)}
                  placeholder={`Document ${i + 1} — e.g. Company logo (vector)`}
                  style={{
                    flex: 1, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                    borderRadius: 10, padding: '8px 12px', color: C.text, fontSize: 12, outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,102,255,0.5)'}
                  onBlur={e => e.target.style.borderColor = C.border} />
                <button onClick={() => removeRItem(item.id)} disabled={rForm.checklist.length === 1}
                  style={{ background: 'none', border: 'none', cursor: rForm.checklist.length === 1 ? 'default' : 'pointer', color: rForm.checklist.length === 1 ? C.border : C.red, display: 'flex' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <ERPBtn variant="secondary" onClick={() => setRModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={saveR} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? 'Saving…' : editRId ? 'Update Template' : 'Create Template'}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── Delete confirmation ── */}
      <ERPModal isOpen={!!delTarget} onClose={() => setDelTarget(null)} title="Delete Template?" width={420}>
        {delTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>
              Delete <strong style={{ color: C.text }}>{delTarget.row?.serviceName}</strong>
              {delTarget.type === 'quotation' ? ' quotation template' : ' requirement template'}?
              <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,102,255,0.08)', border: `1px solid ${C.borderHi}`, fontSize: 11, color: C.muted }}>
                Existing quotations and client requirements keep their own copy — they will not change.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setDelTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="danger" onClick={confirmDelete} disabled={delBusy} style={{ flex: 1, justifyContent: 'center' }}>
                {delBusy ? 'Deleting…' : 'Delete Template'}
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}

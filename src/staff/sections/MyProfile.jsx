// ─────────────────────────────────────────────────────────────────
//  Phase 3 B — Staff portal: Profile + secure personal documents.
//  - MyProfile: read-only company record + self-service edit of ONLY
//    phone/address (matches the firestore.rules hasOnly allow-list).
//  - MyDocuments: per-category (kyc / certificate) document manager.
//    Uploads go to staff-docs/{uid}/... (Storage rules enforce
//    image/pdf + 10 MB); downloads use getBytes — files are never
//    exposed as public URLs. No delete here on purpose: document
//    removal stays admin-only (see storage.rules).
// ─────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getBytes } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  C, ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPInput, ERPEmpty,
} from '../../erp/components/ERPui';
import { DOC_CATEGORIES } from '../staffUtils';
import { fmtDate } from '../../erp/money';
import {
  User, Mail, Phone, MapPin, CalendarDays, GraduationCap, Briefcase, Info,
  Save, Upload, FileText, Download, AlertCircle, CheckCircle2,
} from 'lucide-react';

const fmtWhen = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtSize = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((n || 0) / 1024))} KB`);

const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];

// ═════════════════════════════════════════════════════════════════
//  My Profile — read-only fields + phone/address self-service edit
// ═════════════════════════════════════════════════════════════════
export default function MyProfile() {
  const { staffProfile, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [phone, setPhone]     = useState(staffProfile?.phone || '');
  const [address, setAddress] = useState(staffProfile?.address || '');
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const [ok, setOk]           = useState('');

  useEffect(() => {
    setPhone(staffProfile?.phone || '');
    setAddress(staffProfile?.address || '');
  }, [staffProfile?.id]);

  if (!staffProfile) {
    return (
      <ERPEmpty
        icon={User}
        title="Profile not found"
        sub="Your staff record could not be loaded. Please sign in again or contact your administrator."
      />
    );
  }

  const dirty =
    phone.trim() !== (staffProfile.phone || '') ||
    address.trim() !== (staffProfile.address || '');

  const save = async () => {
    setErr(''); setOk('');
    if (!phone.trim()) { setErr('Phone number is required.'); return; }
    setBusy(true);
    try {
      if (live) {
        // Only phone/address/updatedAt — everything else is rejected by
        // the firestore.rules hasOnly allow-list for staff self-edits.
        await updateDoc(doc(db, 'staff', staffProfile.id), {
          phone: phone.trim(),
          address: address.trim(),
          updatedAt: serverTimestamp(),
        });
      }
      setOk(live ? 'Profile updated.' : 'Saved for this session (dev mode — not persisted).');
    } catch (e) {
      setErr(
        e?.code === 'permission-denied'
          ? 'Not allowed — only phone and address can be edited here.'
          : 'Could not save. Please try again.'
      );
    } finally { setBusy(false); }
  };

  const fields = [
    { icon: Mail,          label: 'Email',      value: staffProfile.loginEmail || staffProfile.email || '—' },
    { icon: Phone,         label: 'Phone',      value: staffProfile.phone || '—' },
    { icon: CalendarDays,  label: 'Joined',     value: fmtDate(staffProfile.joinedDate) || '—' },
    { icon: Briefcase,     label: 'Department', value: staffProfile.department || '—' },
    { icon: User,          label: 'Job Role',   value: staffProfile.role || '—' },
    { icon: GraduationCap, label: 'Education',  value: staffProfile.education || '—' },
  ];

  const avColor = AVATAR_COLORS[(staffProfile.name || '').length % AVATAR_COLORS.length];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ERPPanel>
        <ERPPanelHeader title="My Profile" icon={User} />

        {/* Identity header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 16, flexShrink: 0,
            background: avColor, color: '#fff', fontSize: 20, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {(staffProfile.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{staffProfile.name || '—'}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(0,102,255,0.12)', color: C.blue, border: '1px solid rgba(0,102,255,0.3)',
              }}>{staffProfile.staffId || '—'}</span>
              <span style={{ fontSize: 11.5, color: C.muted }}>{staffProfile.role || '—'}</span>
              {staffProfile.status && <ERPBadge status={staffProfile.status} />}
            </div>
          </div>
        </div>

        {/* Read-only record */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
          {fields.map(f => (
            <div key={f.label} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '10px 12px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`,
            }}>
              <f.icon size={14} color={C.blue} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 12.5, color: C.text, marginTop: 2, wordBreak: 'break-word' }}>{f.value}</div>
              </div>
            </div>
          ))}
          {/* Address spans on its own row when space allows */}
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', gridColumn: '1 / -1',
            padding: '10px 12px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`,
          }}>
            <MapPin size={14} color={C.blue} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Address</div>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 2, wordBreak: 'break-word' }}>
                {staffProfile.address || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Self-service edit */}
        <div style={{
          marginTop: 16, padding: 14, borderRadius: 12, background: C.bg,
          border: `1px dashed ${C.border}`, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Edit my contact details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            <ERPInput label="Phone" value={phone} onChange={setPhone} placeholder="+94 77 123 4567" />
            <ERPInput label="Address" value={address} onChange={setAddress} placeholder="Street, city" />
          </div>

          {err && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 10,
              background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)',
              color: C.red, fontSize: 11.5,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {err}
            </div>
          )}
          {ok && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 10,
              background: 'rgba(24,199,122,0.1)', border: '1px solid rgba(24,199,122,0.35)',
              color: C.green, fontSize: 11.5,
            }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {ok}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <ERPBtn variant="primary" disabled={busy || !dirty} onClick={save}>
              <Save size={13} /> {busy ? 'Saving…' : 'Save changes'}
            </ERPBtn>
            <span style={{ fontSize: 10.5, color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Info size={11} /> Only phone and address are editable here — ask an admin for other changes.
            </span>
          </div>
        </div>
      </ERPPanel>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  My Documents — the staff's OWN kyc / certificate files.
//  Same storage layout as the admin uploader in ERPStaff.jsx
//  (staff-docs/{uid}/…) so both sides see the same docs array.
// ═════════════════════════════════════════════════════════════════
export function MyDocuments({ category, icon: HeaderIcon }) {
  const { staffProfile, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const [ok, setOk]     = useState('');

  const uid  = staffProfile?.id;
  const meta = DOC_CATEGORIES.find(c => c.id === category) || { id: category, label: 'Documents' };
  const docs = (staffProfile?.docs || [])
    .filter(d => d.category === category)
    .sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !uid) return;
    setErr(''); setOk('');
    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setErr('Only image files (JPG/PNG) and PDF documents are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErr('File is larger than the 10 MB limit.');
      return;
    }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^\w.\- ]+/g, '_');
      const path = `staff-docs/${uid}/${Date.now()}_${safe}`;
      const snap = await uploadBytes(storageRef(storage, path), file, {
        contentType: file.type || 'application/octet-stream',
      });
      await updateDoc(doc(db, 'staff', uid), {
        docs: arrayUnion({
          id: `${Date.now()}`, category, name: file.name,
          path: snap.ref.fullPath, size: file.size, uploadedAt: new Date().toISOString(),
        }),
        updatedAt: serverTimestamp(),
      });
      setOk(`${file.name} uploaded.`);
    } catch (ex) {
      setErr(
        ex?.code === 'storage/unauthorized' || ex?.code === 'permission-denied'
          ? 'Upload denied — ask your administrator to publish the latest security rules.'
          : 'Upload failed. Please try again.'
      );
    } finally { setBusy(false); }
  };

  const download = async (d) => {
    setErr(''); setOk('');
    if (!live) { setErr('Downloads need the live Firebase backend (not available in dev session).'); return; }
    setBusy(true);
    try {
      const bytes = await getBytes(storageRef(storage, d.path)); // rules-checked read, never a public URL
      const url = URL.createObjectURL(new Blob([bytes]));
      const a = document.createElement('a');
      a.href = url; a.download = d.name || 'document'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr('Could not download this file. It may have been removed by an administrator.');
    } finally { setBusy(false); }
  };

  return (
    <ERPPanel>
      <ERPPanelHeader
        title={meta.label}
        icon={HeaderIcon || FileText}
        action={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={onFile}
            />
            <ERPBtn variant="primary" disabled={busy || !live} onClick={() => fileRef.current?.click()}>
              <Upload size={13} /> {busy ? 'Uploading…' : 'Upload'}
            </ERPBtn>
          </>
        }
      />

      {!live && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', padding: '9px 12px', borderRadius: 10,
          background: 'rgba(245,185,66,0.1)', border: '1px solid rgba(245,185,66,0.35)',
          color: C.amber, fontSize: 11.5, marginBottom: 12,
        }}>
          <Info size={14} style={{ flexShrink: 0 }} /> Dev session — uploads and downloads need the live Firebase backend.
        </div>
      )}

      {err && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)',
          color: C.red, fontSize: 11.5, marginBottom: 12,
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {err}
        </div>
      )}
      {ok && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 10,
          background: 'rgba(24,199,122,0.1)', border: '1px solid rgba(24,199,122,0.35)',
          color: C.green, fontSize: 11.5, marginBottom: 12,
        }}>
          <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {ok}
        </div>
      )}

      {docs.length === 0 ? (
        <ERPEmpty
          icon={FileText}
          title={`No ${meta.label.toLowerCase()} yet`}
          sub={live ? 'Use the Upload button to add your first file (image or PDF, max 10 MB).' : 'Your documents will appear here once uploaded.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map(d => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`,
            }}>
              <FileText size={15} color={C.blue} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.name}
                </div>
                <div style={{ fontSize: 10.5, color: C.muted }}>
                  {fmtSize(d.size)} · uploaded {fmtWhen(d.uploadedAt)}
                </div>
              </div>
              <ERPBtn variant="ghost" disabled={busy} onClick={() => download(d)}>
                <Download size={13} /> Download
              </ERPBtn>
            </div>
          ))}
        </div>
      )}
    </ERPPanel>
  );
}

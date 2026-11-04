import React, { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, getDocs,
  query, where, serverTimestamp
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth, isFirebaseConfigured, createClientAuthAccount } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPInput, ERPSelect, ERPEmpty, ERPAvatar,
  ERPProgress, C
} from '../components/ERPui';
import { rulesMissingBlockNotice, rulesNotAdminNotice } from '../rulesNotice';
import { passwordError, PASSWORD_HINT } from '../passwordPolicy';
import { nextNumber } from '../../staff/staffUtils';
import { CLIENT_KINDS, previewClientCode, allocateClientCode } from '../clientCode';
import { useStaffDirectory } from '../useStaffDirectory';
import StaffAssignPicker from '../components/StaffAssignPicker';
import { saveClientStatementPdf, saveClientsRosterPdf } from '../utils/clientReportPdf';
import {
  Search, Plus, Mail, Phone, Calendar, FolderKanban, FileText, Pencil, Trash2,
  Key, Shield, CheckCircle2, RotateCcw, MapPin, ListChecks, History,
  Link2, Copy, ExternalLink, Inbox, Send, UserPlus, Download, Hash
} from 'lucide-react';

const COLORS = ['#0066FF','#8B5CF6','#18C77A','#F5B942','#F05A67','#00D9FF'];

const DEV_CLIENTS = [
  { id:'C001', name:'John Perera',    company:'Perera Holdings Pvt Ltd', email:'john@pereraholdings.com', phone:'+94 77 123 4567', clientSince:'March 2024',  projects:2, invoices:3, status:'active' },
  { id:'C002', name:'Sarah Fernando', company:'Mehala Restaurant',       email:'sarah@mehala.lk',         phone:'+94 76 987 6543', clientSince:'June 2024',   projects:1, invoices:2, status:'active' },
  { id:'C003', name:'Kumar Arasan',   company:'KA Retail Pvt Ltd',       email:'kumar@karetail.lk',       phone:'+94 75 456 7890', clientSince:'Aug 2024',    projects:1, invoices:1, status:'active' },
  { id:'C004', name:'Priya Nair',     company:'PN Accounting Services',  email:'priya@pnaccounting.lk',   phone:'+94 71 234 5678', clientSince:'Jan 2024',    projects:2, invoices:4, status:'active' },
  { id:'C005', name:'Dilan Perera',   company:'DP Constructions',        email:'dilan@dpcon.lk',          phone:'+94 77 111 2233', clientSince:'Oct 2024',    projects:0, invoices:1, status:'active' },
];

const DEV_PROJECTS = {
  C001: [
    { id:'P001', title:'Corporate Website Redesign', status:'In Progress', completion:65 },
    { id:'P002', title:'SMART ERP Setup',            status:'Completed',   completion:100 },
  ],
  C002: [
    { id:'P003', title:'Restaurant POS System',      status:'advance_paid', completion:40 },
  ],
  C003: [
    { id:'P004', title:'Mobile App Development',     status:'quotation_sent', completion:0 },
  ],
  C004: [
    { id:'P005', title:'Annual Tax Filing 2024',     status:'Completed', completion:100 },
    { id:'P006', title:'Monthly Bookkeeping',        status:'In Progress', completion:70 },
  ],
};

const DEV_WORK = {
  C001: [
    { id:'W101', title:'Home page design — desktop + mobile', project:'Corporate Website Redesign', note:'Hero, services and about sections signed off', status:'done',
      createdAt:'2026-10-02T09:15:00.000Z', createdBy:'Admin', updatedAt:'2026-10-12T11:40:00.000Z', updatedBy:'Admin',
      history:[
        { at:'2026-10-02T09:15:00.000Z', by:'Admin', text:'Added as pending' },
        { at:'2026-10-06T15:05:00.000Z', by:'Admin', text:'Draft layout shared with client' },
        { at:'2026-10-12T11:40:00.000Z', by:'Admin', text:'Marked as done' },
      ] },
    { id:'W102', title:'Contact form + email notification', project:'Corporate Website Redesign', note:'', status:'pending',
      createdAt:'2026-10-13T08:20:00.000Z', createdBy:'Admin', updatedAt:'2026-10-13T08:20:00.000Z', updatedBy:'Admin',
      history:[{ at:'2026-10-13T08:20:00.000Z', by:'Admin', text:'Added as pending' }] },
    { id:'W103', title:'ERP staff module walkthrough', project:'SMART ERP Setup', note:'', status:'done',
      createdAt:'2026-09-20T10:00:00.000Z', createdBy:'Admin', updatedAt:'2026-09-27T16:30:00.000Z', updatedBy:'Admin',
      history:[
        { at:'2026-09-20T10:00:00.000Z', by:'Admin', text:'Added as pending' },
        { at:'2026-09-27T16:30:00.000Z', by:'Admin', text:'Marked as done' },
      ] },
  ],
  C003: [
    { id:'W201', title:'Login + OTP screens', project:'Mobile App Development', note:'', status:'pending',
      createdAt:'2026-10-20T07:45:00.000Z', createdBy:'Admin', updatedAt:'2026-10-20T07:45:00.000Z', updatedBy:'Admin',
      history:[{ at:'2026-10-20T07:45:00.000Z', by:'Admin', text:'Added as pending' }] },
  ],
};

const EMPTY_FORM = { kind:'individual', name:'', company:'', email:'', phone:'', address:'', clientSince:'', createAccount:true, password:'',
  // Optional first project — the client and their project are created together,
  // so a brand-new client is never left with an empty project list.
  projTitle:'', projService:'', projStatus:'requirements_pending' };

const EMPTY_PROJECT = { title:'', serviceType:'', status:'requirements_pending', assignedStaff:[] };
const PROJECT_STATUS = [
  { value:'requirements_pending', label:'Requirements Pending' },
  { value:'quotation_sent',       label:'Quotation Sent' },
  { value:'quotation_accepted',   label:'Quotation Accepted' },
  { value:'advance_paid',         label:'Advance Paid' },
  { value:'In Progress',          label:'In Progress' },
  { value:'Completed',            label:'Completed' },
];

// Portfolio-request link token. 12 random bytes → base36, short enough to read
// out over the phone but not guessable (the link is the only access control
// the public form has).
function newLinkToken() {
  const bytes = new Uint8Array(12);
  try { (window.crypto || window.msCrypto).getRandomValues(bytes); }
  catch { for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256); }
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}
const linkUrl = (token) => `${window.location.origin}/portfolio/${token}`;
// The owner picks the link address themselves (e.g. …/portfolio/lovecake) —
// readable in WhatsApp, and the same address stays theirs on every resend.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
const slugify = (v) => String(v || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
// Where the owner copies/shows the link. They may point their own short link
// (or domain) at the form; the form itself always lives at linkUrl(token).
const shareUrl = (l) => (l?.publicUrl || '').trim() || linkUrl(l?.token || '');
const monthYear = () => new Date().toLocaleDateString('en-GB', { month:'long', year:'numeric' });

async function countWhere(col, field, value) {
  const snap = await getDocs(query(collection(db, col), where(field, '==', value)));
  return snap.size;
}

// History stamps are stored as ISO strings so the trail survives regardless of
// which device wrote it; keep the display short and readable.
function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit',
  });
}

// Firestore rejects `undefined`; build every work entry with all keys present.
function cleanWork(list) {
  return (Array.isArray(list) ? list : []).map(w => ({
    id: w.id || `w${Date.now()}`,
    title: w.title || '',
    project: w.project || '',
    note: w.note || '',
    status: w.status === 'done' ? 'done' : 'pending',
    removed: !!w.removed,
    createdAt: w.createdAt || '',
    createdBy: w.createdBy || '',
    updatedAt: w.updatedAt || '',
    updatedBy: w.updatedBy || '',
    history: (Array.isArray(w.history) ? w.history : []).map(h => ({
      at: h.at || '', by: h.by || '', text: h.text || '',
    })),
  }));
}

export default function ERPClients() {
  const { isDevSession, profile } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const adminName = profile?.name || profile?.email || 'Admin';
  // Sample work items only feed the offline demo — a live client doc either
  // carries its own workLog or has none.
  const workOf = (c) => (Array.isArray(c?.workLog) ? c.workLog : (live ? [] : (DEV_WORK[c?.id] || [])));
  const [clients,   setClients]   = useState(live ? [] : DEV_CLIENTS);
  const [projects,  setProjects]  = useState([]);
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [delError,  setDelError]  = useState('');
  const [delBusy,   setDelBusy]   = useState(false);
  const [saveError, setSaveError] = useState('');
  const [codeBusy,  setCodeBusy]  = useState(false); // back-filling an old client's code
  const [notice,    setNotice]    = useState(null); // { kind:'ok'|'error', msg }
  const [pwModal,   setPwModal]   = useState(null); // { client, password, busy, error }
  // Work tracker: a manual done / pending list per client, with who-marked-what history
  const [workFor,   setWorkFor]   = useState(null); // client whose tracker is open
  const [workForm,  setWorkForm]  = useState({ title:'', project:'', note:'' });
  const [workErr,   setWorkErr]   = useState('');
  const [workBusy,  setWorkBusy]  = useState(false);
  const [workFilter,setWorkFilter]= useState('all');
  const [workOpen,  setWorkOpen]  = useState({});   // itemId -> history expanded
  const [workDraft, setWorkDraft] = useState({});   // itemId -> progress note being typed

  // ── Portfolio request links ───────────────────────────────────────
  // A saved link owns the URL (portfolioLinks/{token}); the public form posts
  // to portfolioRequests, and every submission becomes a client + a Portfolio
  // project here. Links live in their own collection so they survive and can
  // be reused for a second person, and so "this came from the manual link"
  // stays distinguishable from QR / walk-in leads.
  const [links,      setLinks]      = useState([]);
  const [linksOpen,  setLinksOpen]  = useState(false);
  const [linkLabel,  setLinkLabel]  = useState('');
  const [linkSlug,   setLinkSlug]   = useState('');
  const [linkExternal, setLinkExternal] = useState('');
  const [showOwnLink, setShowOwnLink] = useState(false);
  const [linkBusy,   setLinkBusy]   = useState(false);
  const [linkErr,    setLinkErr]    = useState('');
  const [reqs,       setReqs]       = useState([]);
  const [reqView,    setReqView]    = useState(null);
  const [noPortal,   setNoPortal]   = useState(false); // clipboard blocked → show the URL to copy by hand
  // Which first project the client-detail "New Project" button is creating
  const [projOpen,   setProjOpen]   = useState(false);
  const [projForm,   setProjForm]   = useState(EMPTY_PROJECT);
  const [projErr,    setProjErr]    = useState('');
  // Staff directory for the "Assigned Staff" pick on new projects.
  const { staff: staffDir } = useStaffDirectory();
  const converting = useRef(new Set());
  // The auto-conversion effect must not retry a failing request in a loop: if
  // the reset-to-'new' write echoes back, the same id would run again forever.
  const autoTried = useRef(new Set());
  // Did any other admin-only read go through? The Clients list and the
  // portfolio links are guarded by the same isAdmin(), so if clients load,
  // the account is a valid admin and the only thing missing is the
  // portfolioLinks block in the deployed rules.
  const adminReadOk = useRef(false);
  const linkDeniedText = () => (adminReadOk.current
    ? rulesMissingBlockNotice('Saved portfolio links')
    : rulesNotAdminNotice('Saved portfolio links'));

  useEffect(() => {
    if (!live) return;
    const unsubC = onSnapshot(collection(db, 'clients'), snap => {
      adminReadOk.current = true;
      const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .filter(c => c.status !== 'deleted');
      setClients(rows);
      // Keep the open profile / work tracker on the freshest copy of the doc
      // (another tab may have ticked an item).
      setSelected(s => (s ? (rows.find(c => c.id === s.id) || s) : s));
      setWorkFor(w => (w ? (rows.find(c => c.id === w.id) || w) : w));
    }, err => console.error('Clients listener error', err));
    const unsubP = onSnapshot(collection(db, 'projects'), snap => {
      setProjects(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    }, err => console.error('Projects listener error', err));
    const unsubL = onSnapshot(collection(db, 'portfolioLinks'), snap => {
      setLinks(snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a, b) => String(b.createdAt?.seconds || 0).localeCompare(String(a.createdAt?.seconds || 0))));
      setLinkErr('');
    }, err => {
      console.error('Portfolio links listener error', err);
      // The link list lives in its own collection — when the deployed rules
      // don't know portfolioLinks yet, the modal would otherwise show up
      // empty with no reason. Say it once, where the admin is looking.
      if (err.code === 'permission-denied') {
        setLinkErr(linkDeniedText());
      }
    });
    const unsubR = onSnapshot(collection(db, 'portfolioRequests'), snap => {
      setReqs(snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a, b) => String(b.createdAt?.seconds || 0).localeCompare(String(a.createdAt?.seconds || 0))));
    }, err => console.error('Portfolio requests listener error', err));
    return () => { unsubC(); unsubP(); unsubL(); unsubR(); };
  }, [live]);

  const filtered = clients.filter(c =>
    (c.name||'').toLowerCase().includes(search.toLowerCase()) ||
    (c.company||'').toLowerCase().includes(search.toLowerCase()) ||
    (c.email||'').toLowerCase().includes(search.toLowerCase())
  );

  // Live projects all come from the listener, so the count is always the real
  // number of docs — not a stored counter that can drift after a delete.
  const projectsOf = (clientId) => (live
    ? projects.filter(p => p.clientId === clientId)
    : [...(DEV_PROJECTS[clientId] || []), ...projects.filter(p => p.clientId === clientId)]);
  const projectCountOf = (c) => projectsOf(c.id).filter(p => p.status !== 'archived').length;

  const selectedProjects = selected ? projectsOf(selected.id) : [];

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setShowForm(true);
  };

  // Clients recorded before the code series existed get their number here —
  // the same allocator the Add form uses, so a back-filled code can never
  // collide with one already handed out.
  const assignCodeToSelected = async () => {
    if (!selected || codeBusy) return;
    setCodeBusy(true);
    try {
      const kind = selected.kind || (selected.company ? 'company' : 'individual');
      const code = await allocateClientCode(kind, clients);
      const patch = { code, kind, updatedAt: serverTimestamp() };
      setClients(p => p.map(c => c.id === selected.id ? { ...c, ...patch } : c));
      setSelected(s => (s ? { ...s, ...patch } : s));
      if (live) await updateDoc(doc(db, 'clients', selected.id), patch);
      setNotice({ kind: 'ok', msg: `${selected.name} is now ${code}.` });
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', msg: err?.message || "Couldn't assign the code." });
    } finally {
      setCodeBusy(false);
    }
  };

  const openEdit = (c, e) => {
    if (e) e.stopPropagation();
    setEditId(c.id);
    setForm({
      kind: c.kind || (c.company ? 'company' : 'individual'),
      name: c.name || '',
      company: c.company || '',
      email: c.loginEmail || c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      clientSince: c.clientSince || '',
      createAccount: false,
      password: '',
      projTitle: '',
      projService: '',
      projStatus: 'requirements_pending',
    });
    setSaveError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setSaveError('Name is required.');
      return;
    }
    // Either email or phone is enough — never force both.
    if (!form.email.trim() && !form.phone.trim()) {
      setSaveError('Enter an email or a phone number — one of them is enough.');
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setSaveError('That email address doesn\'t look right — please check it.');
      return;
    }
    if (form.phone.trim() && form.phone.replace(/\D/g, '').length < 9) {
      setSaveError('Please enter a valid phone number (at least 9 digits).');
      return;
    }
    // A portal login needs an email; with phone only the client is saved without one.
    const wantsAccount = !editId && form.createAccount && !!form.email.trim();
    if (wantsAccount) {
      const pwErr = passwordError(form.password, form.email.trim());
      if (pwErr) { setSaveError(pwErr); return; }
    }
    setSaveError('');
    setSaving(true);
    const payload = {
      kind: form.kind === 'company' ? 'company' : 'individual',
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      loginEmail: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      clientSince: form.clientSince.trim(),
      status: 'active',
    };
    try {
      // A new client always takes the next number of their series
      // (person SM/2026/111…, company SM/2026/1111…); an edit keeps the
      // code the client already has.
      const code = editId ? null : await allocateClientCode(payload.kind, clients);
      if (code) payload.code = code;
      if (editId) {
        setClients(p => p.map(c => c.id === editId ? { ...c, ...payload } : c));
        if (selected?.id === editId) setSelected(s => ({ ...s, ...payload }));
        if (live) await updateDoc(doc(db, 'clients', editId), { ...payload, updatedAt: serverTimestamp() });
        setNotice({ kind: 'ok', msg: `Client ${form.name} updated.` });
      } else {
        if (live && wantsAccount) {
          // Provision client auth user and store at clients/{uid}
          const uid = await createClientAuthAccount(form.email.trim(), form.password);
          const clientData = {
            id: uid,
            authUid: uid,
            ...payload,
            hasPortalAccount: true,
            projects: form.projTitle.trim() ? 1 : 0,
            invoices: 0,
            createdAt: serverTimestamp(),
          };
          await setDoc(doc(db, 'clients', uid), clientData);
          setClients(p => [clientData, ...p]);
          if (form.projTitle.trim()) {
            await addProjectFor(uid, payload.name, payload.company, form);
          }
          setNotice({ kind: 'ok', msg: `Client ${form.name} (${code}) created with portal login account (${form.email}).${form.projTitle.trim() ? ' Their project was added too.' : ''}` });
        } else {
          const local = { id: `C${Date.now()}`, projects: 0, invoices: 0, hasPortalAccount: false, ...payload };
          if (live) {
            const ref = await addDoc(collection(db, 'clients'), {
              ...payload, hasPortalAccount: false, projects: form.projTitle.trim() ? 1 : 0, invoices: 0, createdAt: serverTimestamp(),
            });
            local.id = ref.id;
            setClients(p => [{ ...local, id: ref.id }, ...p]);
            if (form.projTitle.trim()) {
              await addProjectFor(ref.id, payload.name, payload.company, form);
            }
          } else {
            setClients(p => [local, ...p]);
            if (form.projTitle.trim()) {
              await addProjectFor(local.id, payload.name, payload.company, form);
            }
          }
          setNotice({
            kind: 'ok',
            msg: form.createAccount && !form.email.trim()
              ? `Client ${form.name} (${code}) saved${form.projTitle.trim() ? ` with project "${form.projTitle.trim()}"` : ''} — no portal login yet (add an email later to create one).`
              : `Client ${form.name} (${code}) saved${form.projTitle.trim() ? ` with project "${form.projTitle.trim()}"` : ''}.`,
          });
        }
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditId(null);
    } catch (err) {
      console.error(err);
      const msg = err.code === 'auth/email-already-in-use'
        ? 'That email already has a login account. Use a different email.'
        : err.code === 'auth/weak-password'
        ? `Password is too weak. ${PASSWORD_HINT}`
        : (err.message || "Couldn't save the client. Please try again.");
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSendPasswordReset = async (c, e) => {
    if (e) e.stopPropagation();
    const targetEmail = c.loginEmail || c.email;
    if (!targetEmail) return;
    try {
      if (live) {
        await sendPasswordResetEmail(auth, targetEmail);
      }
      setNotice({ kind: 'ok', msg: `Password reset instructions sent to ${targetEmail}.` });
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', msg: err.message || 'Could not send password reset email.' });
    }
  };

  const handleCreateAccountForClient = async () => {
    if (!pwModal?.client) return;
    const pwErr = passwordError(pwModal.password, pwModal.client?.email || '');
    if (pwErr) { setPwModal(p => ({ ...p, error: pwErr })); return; }
    setPwModal(p => ({ ...p, busy: true, error: '' }));
    try {
      const client = pwModal.client;
      if (live) {
        const uid = await createClientAuthAccount(client.email.trim(), pwModal.password);
        await setDoc(doc(db, 'clients', uid), {
          ...client,
          id: uid,
          authUid: uid,
          loginEmail: client.email.trim(),
          hasPortalAccount: true,
          updatedAt: serverTimestamp(),
        });
        if (client.id !== uid) {
          try { await deleteDoc(doc(db, 'clients', client.id)); } catch (e) {}
        }
      }
      setNotice({ kind: 'ok', msg: `Portal login account activated for ${client.name} (${client.email}).` });
      setPwModal(null);
    } catch (err) {
      console.error(err);
      const isAlreadyInUse = err.code === 'auth/email-already-in-use' || String(err.message).includes('email-already-in-use');
      setPwModal(p => ({
        ...p,
        busy: false,
        error: isAlreadyInUse
          ? `The email "${p.client?.email}" is already registered in Firebase. Use another email or reset their password.`
          : (err.message || 'Account creation failed.')
      }));
    }
  };

  const requestDelete = (c, e) => {
    if (e) e.stopPropagation();
    setDelError('');
    setDelTarget(c);
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    setDelError('');
    try {
      let quotes = 0, projs = 0, pays = 0;
      if (live) {
        [quotes, projs, pays] = await Promise.all([
          countWhere('quotations', 'clientId', delTarget.id),
          countWhere('projects', 'clientId', delTarget.id),
          countWhere('payments', 'clientId', delTarget.id),
        ]);
      } else {
        projs = (DEV_PROJECTS[delTarget.id] || []).length;
        pays = Number(delTarget.invoices || 0);
      }

      // Money is never destroyed: a client with quotations or payments must be
      // archived, because that history is what receipts and invoices point at.
      // Projects carry no money of their own, so they are archived and the
      // client record can go — which is what a test/mistaken client needs.
      if (quotes + pays > 0) {
        setDelError(
          `Cannot permanently delete: this client has ${quotes} quotation(s) and ${pays} payment record(s). Archive instead to keep that money history.`
        );
        setDelBusy(false);
        return;
      }

      if (live && projs > 0) {
        const linked = await getDocs(query(collection(db, 'projects'), where('clientId', '==', delTarget.id)));
        await Promise.all(linked.docs.map(d => updateDoc(d.ref, { status: 'archived', archivedAt: serverTimestamp() })));
        setProjects(p => p.map(pr => pr.clientId === delTarget.id ? { ...pr, status: 'archived' } : pr));
      }

      setClients(p => p.filter(c => c.id !== delTarget.id));
      if (selected?.id === delTarget.id) setSelected(null);
      if (live) await deleteDoc(doc(db, 'clients', delTarget.id));
      setDelTarget(null);
      setNotice({ kind:'ok', msg: projs > 0
        ? `Client deleted. ${projs} project(s) were archived and stay in the Projects page.`
        : 'Client deleted.' });
    } catch (err) {
      console.error(err);
      setDelError(err.message || 'Delete failed.');
    } finally {
      setDelBusy(false);
    }
  };

  const archiveClient = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    try {
      setClients(p => p.map(c => c.id === delTarget.id ? { ...c, status: 'archived' } : c));
      if (selected?.id === delTarget.id) setSelected(s => ({ ...s, status: 'archived' }));
      if (live) await updateDoc(doc(db, 'clients', delTarget.id), { status: 'archived', archivedAt: serverTimestamp() });
      setDelTarget(null);
      setDelError('');
    } catch (err) {
      setDelError(err.message || 'Archive failed.');
    } finally {
      setDelBusy(false);
    }
  };

  // ── Portfolio request links + submissions ───────────────────────
  const createPortfolioLink = async () => {
    if (!live) { setLinkErr('Links need Firebase — connect the project to create a public URL.'); return; }
    const label = linkLabel.trim() || `Portfolio link — ${new Date().toLocaleDateString('en-GB')}`;
    const wantSlug = slugify(linkSlug || linkLabel);
    if (linkSlug.trim() && !SLUG_RE.test(wantSlug)) {
      setLinkErr('Link address must be 3–40 characters: letters, numbers and dashes.');
      return;
    }
    const external = linkExternal.trim();
    if (external && !/^https?:\/\/\S+\.\S+/.test(external)) {
      setLinkErr('Your own link must start with https:// (e.g. https://smart.lk/portfolio).');
      return;
    }
    setLinkBusy(true);
    setLinkErr('');
    const token = wantSlug || newLinkToken();
    try {
      // Never overwrite another link — the address is the whole access control.
      const existing = await getDoc(doc(db, 'portfolioLinks', token));
      if (existing.exists()) {
        setLinkErr(`“${token}” is already used by another link — choose a different address.`);
        setLinkBusy(false);
        return;
      }
      const data = {
        token, label, publicUrl: external, service: 'Portfolio', active: true, submissions: 0,
        createdBy: adminName, createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'portfolioLinks', token), data);
      setLinks(p => [{ ...data, id: token, createdAt: { seconds: Date.now() / 1000 } }, ...p]);
      setLinkLabel(''); setLinkSlug(''); setLinkExternal('');
      setNotice({ kind:'ok', msg:`Portfolio link ready — send it to the client: ${external || linkUrl(token)}` });
    } catch (e) {
      console.error(e);
      setLinkErr(
        e.code === 'permission-denied'
          ? (adminReadOk.current
              ? rulesMissingBlockNotice('Portfolio link creation')
              : rulesNotAdminNotice('Portfolio link creation'))
          : (e.message || 'Could not create the link.')
      );
    } finally {
      setLinkBusy(false);
    }
  };

  const copyLink = async (l) => {
    const url = shareUrl(l);
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ kind:'ok', msg:'Link copied — paste it in WhatsApp or email.' });
    } catch {
      setNoPortal(true);
    }
  };

  const toggleLink = async (link) => {
    const active = !(link.active !== false);
    setLinks(p => p.map(l => l.id === link.id ? { ...l, active } : l));
    if (live) {
      try { await updateDoc(doc(db, 'portfolioLinks', link.id), { active }); }
      catch (e) { console.error(e); setLinkErr('Could not update that link.'); }
    }
  };

  // Turn one submission into a real client + their Portfolio project. Runs
  // automatically for every new request, and again from the inbox button, so a
  // missed run (page closed) is never lost.
  const convertPortfolioRequest = async (r, opts = {}) => {
    if (!r || r.clientId || converting.current.has(r.id)) return;
    converting.current.add(r.id);
    try {
      if (live) await updateDoc(doc(db, 'portfolioRequests', r.id), { status:'converting', updatedAt: serverTimestamp() });
      const kind = r.company ? 'company' : 'individual';
      const clientData = {
        kind,
        // Auto series number, same rule as the Add Client form.
        code: await allocateClientCode(kind, clients),
        name: r.name || 'Client',
        company: r.company || '',
        email: r.email || '',
        loginEmail: r.email || '',
        phone: r.phone || '',
        address: r.address || '',
        clientSince: r.submittedLabel || monthYear(),
        status: 'New',
        hasPortalAccount: false,
        projects: 1,
        invoices: 0,
        intakeSource: 'portfolio-link',
        intakeRequestId: r.id,
        intakeToken: r.token || '',
        intakeLabel: r.linkLabel || '',
        // Every answer from the requirements form (skills, projects, design
        // prefs, hosting, …) is kept on the client record so nothing the
        // client typed is lost after they are added.
        requirements: r.answers || null,
      };
      let clientId = `C${Date.now()}`;
      let projectId = '';
      let existingClient = null;
      if (live) {
        // Same person filling the form twice (or already a client) must not
        // become a duplicate — match their email/phone first and attach the
        // submitted project to the record we already have.
        const email = String(r.email || '').trim().toLowerCase();
        const phoneDigits = String(r.phone || '').replace(/\D/g, '');
        if (email) {
          const byEmail = await getDocs(query(collection(db, 'clients'), where('email', '==', email)));
          if (!byEmail.empty) existingClient = { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
        }
        if (!existingClient && phoneDigits) {
          const byPhone = await getDocs(query(collection(db, 'clients'), where('phone', '==', r.phone)));
          if (!byPhone.empty) existingClient = { id: byPhone.docs[0].id, ...byPhone.docs[0].data() };
        }
      }
      if (live && existingClient) {
        clientId = existingClient.id;
        await updateDoc(doc(db, 'clients', clientId), {
          projects: (Number(existingClient.projects) || 0) + 1,
          intakeRequestId: r.id,
          updatedAt: serverTimestamp(),
        });
        setClients(p => p.map(c => c.id === clientId
          ? { ...c, projects: (Number(c.projects) || 0) + 1, intakeRequestId: r.id } : c));
      } else if (live) {
        const cref = await addDoc(collection(db, 'clients'), { ...clientData, createdAt: serverTimestamp() });
        clientId = cref.id;
        setClients(p => [{ ...clientData, id: cref.id }, ...p]);
      }
      if (live) {
        const projectData = {
          projectCode: await nextNumber('projects', 'PR'),
          clientId,
          clientName: clientData.name,
          clientCompany: clientData.company,
          title: r.projectTitle || 'Portfolio',
          serviceType: 'Portfolio',
          status: 'requirements_pending',
          completion: 0,
          milestones: [],
          description: r.description || '',
          budget: r.budget || '',
          deadline: r.deadline || '',
          intakeRequestId: r.id,
          requirements: r.answers || null,
          createdAt: serverTimestamp(),
        };
        const pref = await addDoc(collection(db, 'projects'), projectData);
        projectId = pref.id;
        await updateDoc(doc(db, 'portfolioRequests', r.id), {
          status: 'added', clientId, projectId, addedAt: serverTimestamp(),
        });
      }
      setReqs(p => p.map(x => x.id === r.id ? { ...x, status:'added', clientId, projectId } : x));
      if (!opts.silent) {
        setNotice({ kind:'ok', msg: existingClient
          ? `${clientData.name} was already a client — the portfolio project was attached to their record.`
          : `${clientData.name} added as a client with a Portfolio project.` });
      }
    } catch (e) {
      console.error('portfolio request → client failed', e);
      if (live) {
        try { await updateDoc(doc(db, 'portfolioRequests', r.id), { status:'new' }); } catch { /* retried on refresh */ }
      }
      setNotice({ kind:'error', msg: e.message || 'Could not add that portfolio request as a client.' });
    } finally {
      converting.current.delete(r.id);
    }
  };

  // A submission waiting for review is turned into a client automatically, so
  // the client module carries everything the person typed without a manual
  // re-entry step. The raw form stays in portfolioRequests for "what did they
  // actually fill in".
  useEffect(() => {
    if (!live) return;
    reqs.filter(r => r.status === 'new' && !r.clientId)
      .forEach(r => {
        if (autoTried.current.has(r.id) || converting.current.has(r.id)) return;
        autoTried.current.add(r.id);
        convertPortfolioRequest(r, { silent: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqs, live]);

  // ── Save the optional first project with a new client ────────────
  const addProjectFor = async (clientId, clientName, clientCompany, src = projForm) => {
    const title = (src.projTitle ?? src.title ?? '').trim();
    if (!title || !clientId) return null;
    // Team picked on the form (ids + the names that go with them, so the
    // project card still reads well if a staff record is later removed).
    const team = Array.isArray(src.assignedStaff) ? src.assignedStaff : [];
    const data = {
      projectCode: live
        ? await nextNumber('projects', 'PR')
        : `PR-${new Date().getFullYear()}-${String((projects?.length || 0) + 1).padStart(4, '0')}`,
      clientId,
      clientName,
      clientCompany,
      title,
      serviceType: (src.projService ?? src.serviceType ?? '').trim(),
      status: src.projStatus ?? src.status ?? 'requirements_pending',
      completion: 0,
      milestones: [],
      assignedStaff: team,
      assignedStaffNames: team.map(id => staffDir.find(s => s.id === id)?.name || id),
      createdAt: serverTimestamp(),
    };
    if (live) {
      const ref = await addDoc(collection(db, 'projects'), data);
      setProjects(p => [{ ...data, id: ref.id }, ...p]);
      return ref.id;
    }
    setProjects(p => [{ ...data, id: `P${Date.now()}`, createdAt: new Date().toISOString() }, ...p]);
    return null;
  };

  const saveProjectForSelected = async () => {
    if (!selected) return;
    if (!projForm.title.trim()) { setProjErr('Project title is required.'); return; }
    setProjErr('');
    const n = projectsOf(selected.id).length + 1;
    try {
      await addProjectFor(selected.id, selected.name, selected.company, projForm);
      // Keep the denormalised counter on the client doc roughly in step; the
      // UI itself counts project docs, so this is only for other screens.
      setClients(p => p.map(c => c.id === selected.id ? { ...c, projects: n } : c));
      setSelected(s => (s && s.id === selected.id ? { ...s, projects: n } : s));
      if (live) updateDoc(doc(db, 'clients', selected.id), { projects: n }).catch(() => {});
      setProjOpen(false);
      setProjForm(EMPTY_PROJECT);
      setNotice({ kind:'ok', msg:`Project "${projForm.title.trim()}" added to ${selected.name}.` });
    } catch (e) {
      console.error(e);
      setProjErr(e.message || 'Could not save the project.');
    }
  };

  // ── Work tracker ───────────────────────────────────────────────
  const openWork = (c) => {
    setWorkForm({ title:'', project:'', note:'' });
    setWorkErr('');
    setWorkFilter('all');
    setWorkOpen({});
    setWorkDraft({});
    setWorkFor(c);
  };

  // Keep the card grid, the profile panel and the open modal in sync before
  // the write resolves, so a slow network never shows a stale tick.
  const applyWorkLog = (clientId, next) => {
    setClients(p => p.map(c => c.id === clientId ? { ...c, workLog: next } : c));
    setSelected(s => (s && s.id === clientId ? { ...s, workLog: next } : s));
    setWorkFor(w => (w && w.id === clientId ? { ...w, workLog: next } : w));
  };

  const persistWorkLog = async (clientId, next) => {
    applyWorkLog(clientId, next);
    if (live) {
      await updateDoc(doc(db, 'clients', clientId), { workLog: next, updatedAt: serverTimestamp() });
    }
  };

  const addWorkItem = async () => {
    if (!workFor || workBusy) return;
    const title = workForm.title.trim();
    if (!title) { setWorkErr('Type the work that needs to be done.'); return; }
    setWorkErr('');
    setWorkBusy(true);
    const now = new Date().toISOString();
    const note = workForm.note.trim();
    const item = {
      id: `w${Date.now()}`,
      title,
      project: workForm.project,
      note,
      status: 'pending',
      removed: false,
      createdAt: now, createdBy: adminName,
      updatedAt: now, updatedBy: adminName,
      history: [{ at: now, by: adminName, text: `Added as pending${note ? ` — ${note}` : ''}` }],
    };
    try {
      await persistWorkLog(workFor.id, cleanWork([item, ...workOf(workFor)]));
      setWorkForm({ title:'', project:'', note:'' });
      setNotice({ kind:'ok', msg:`Work item added to ${workFor.name}.` });
    } catch (err) {
      console.error(err);
      setWorkErr(err.message || 'Could not save that work item.');
    } finally {
      setWorkBusy(false);
    }
  };

  const setWorkStatus = async (item, status) => {
    if (!workFor || item.status === status) return;
    const now = new Date().toISOString();
    const next = cleanWork(workOf(workFor).map(w => w.id === item.id ? {
      ...w, status, updatedAt: now, updatedBy: adminName,
      history: [...(w.history || []), {
        at: now, by: adminName,
        text: status === 'done' ? 'Marked as done' : 'Re-opened — back to pending',
      }],
    } : w));
    try { await persistWorkLog(workFor.id, next); }
    catch (err) { console.error(err); setWorkErr(err.message || 'Could not update that item.'); }
  };

  const addWorkNote = async (item) => {
    if (!workFor) return;
    const text = (workDraft[item.id] || '').trim();
    if (!text) return;
    const now = new Date().toISOString();
    const next = cleanWork(workOf(workFor).map(w => w.id === item.id ? {
      ...w, updatedAt: now, updatedBy: adminName,
      history: [...(w.history || []), { at: now, by: adminName, text }],
    } : w));
    try {
      await persistWorkLog(workFor.id, next);
      setWorkDraft(p => ({ ...p, [item.id]: '' }));
    } catch (err) {
      console.error(err);
      setWorkErr(err.message || 'Could not add that note.');
    }
  };

  // Soft delete: the item leaves the list but its trail stays in Firestore, so
  // "what was removed and by whom" is never lost.
  const removeWorkItem = async (item) => {
    if (!workFor) return;
    const now = new Date().toISOString();
    const next = cleanWork(workOf(workFor).map(w => w.id === item.id ? {
      ...w, removed: true, updatedAt: now, updatedBy: adminName,
      history: [...(w.history || []), { at: now, by: adminName, text: 'Removed from the tracker' }],
    } : w));
    try {
      await persistWorkLog(workFor.id, next);
      setNotice({ kind:'ok', msg:`"${item.title}" removed from ${workFor.name}'s tracker.` });
    } catch (err) {
      console.error(err);
      setWorkErr(err.message || 'Could not remove that item.');
    }
  };

  // Client report exports — a statement for the opened client and one roster
  // sheet for all clients. Both write a real PDF file, not a print dialog.
  const clientReportPdf = () => {
    if (!selected) return;
    try {
      saveClientStatementPdf({
        client: selected,
        projects: selectedProjects,
        work: workOf(selected).filter(w => !w.removed),
        adminName,
      });
      setNotice({ kind: 'ok', msg: `Client report for ${selected.name} saved as a PDF.` });
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', msg: err.message || 'Could not build that PDF.' });
    }
  };
  const clientsRosterPdf = () => {
    try {
      saveClientsRosterPdf({ clients: filtered, projectCountOf, workOf, adminName });
      setNotice({ kind: 'ok', msg: `Clients report saved as a PDF (${filtered.length} clients).` });
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', msg: err.message || 'Could not build that PDF.' });
    }
  };

  // Derived values for the profile summary + the tracker modal.
  const selWork       = workOf(selected).filter(w => !w.removed);
  const selWorkDone   = selWork.filter(w => w.status === 'done').length;
  const selWorkNext   = selWork.find(w => w.status !== 'done');
  const selWorkPct    = selWork.length ? Math.round((selWorkDone / selWork.length) * 100) : 0;
  const modalWork     = workOf(workFor).filter(w => !w.removed);
  const modalDone     = modalWork.filter(w => w.status === 'done').length;
  const modalPending  = modalWork.length - modalDone;
  const modalShown    = modalWork
    .filter(w => workFilter === 'all' ? true : workFilter === 'done' ? w.status === 'done' : w.status !== 'done')
    .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0)
      || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const workProjects  = workFor
    ? (live ? projects.filter(p => p.clientId === workFor.id) : (DEV_PROJECTS[workFor.id] || []))
    : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {notice && (
        <div style={{
          padding:'10px 14px', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'space-between',
          background: notice.kind==='ok' ? 'rgba(24,199,122,0.12)' : 'rgba(240,90,103,0.12)',
          border: `1px solid ${notice.kind==='ok' ? 'rgba(24,199,122,0.35)' : 'rgba(240,90,103,0.35)'}`,
          color: notice.kind==='ok' ? C.green : C.red, fontSize:12, fontWeight:600,
        }}>
          <span>{notice.msg}</span>
          <button onClick={()=>setNotice(null)} style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', fontSize:14 }}>✕</button>
        </div>
      )}

      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, maxWidth:320 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:C.muted }} />
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search clients..."
            style={{
              width:'100%', background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`,
              borderRadius:10, padding:'8px 14px 8px 30px', color:C.text, fontSize:12,
              outline:'none', boxSizing:'border-box',
            }}
            onFocus={e=>e.target.style.borderColor='rgba(0,102,255,0.5)'}
            onBlur={e=>e.target.style.borderColor=C.border}
          />
        </div>
        <ERPBtn variant="primary" onClick={openAdd}>
          <Plus size={13} /> Add Client
        </ERPBtn>
        <ERPBtn variant="secondary" onClick={() => { setLinkErr(''); setLinksOpen(true); }}>
          <Link2 size={13} /> Portfolio Link
        </ERPBtn>
        <ERPBtn variant="secondary" onClick={clientsRosterPdf} disabled={!filtered.length}>
          <Download size={13} /> Clients Report PDF
        </ERPBtn>
        <div style={{ marginLeft:'auto', fontSize:12, color:C.muted }}>
          {filtered.length} client{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Portfolio requests — what clients filled in via the saved link ── */}
      {reqs.length > 0 && (
        <ERPPanel>
          <ERPPanelHeader title="Portfolio Requests" icon={<Inbox size={15} style={{ color:C.cyan }} />}
            action={<span style={{ fontSize:10, color:C.muted }}>
              {reqs.filter(r => !r.clientId).length} waiting · link submissions
            </span>} />
          <div style={{ display:'flex', flexDirection:'column' }}>
            {reqs.slice(0, 6).map((r, i) => (
              <div key={r.id} style={{
                display:'flex', alignItems:'center', gap:12, padding:'11px 16px', flexWrap:'wrap',
                borderTop: i > 0 ? `1px solid ${C.border}25` : 'none',
              }}>
                <ERPAvatar name={r.name || 'Client'} color={COLORS[i % COLORS.length]} size={30} />
                <div style={{ flex:1, minWidth:140 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:C.text }}>
                    {r.name} {r.company ? <span style={{ fontWeight:600, color:C.muted }}>· {r.company}</span> : null}
                  </div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
                    {r.projectTitle || 'Portfolio'} · {r.linkLabel || (r.token ? `link ${r.token.slice(0, 6)}…` : 'manual link')}
                    {r.createdAt?.toDate ? ` · ${r.createdAt.toDate().toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}` : ''}
                  </div>
                </div>
                <ERPBadge status={r.clientId ? 'Completed' : 'New'} label={r.clientId ? 'Added' : 'New'} />
                <ERPBtn size="sm" variant="secondary" onClick={() => setReqView(r)}>
                  <FileText size={11} /> View form
                </ERPBtn>
                {!r.clientId && (
                  <ERPBtn size="sm" variant="primary" onClick={() => convertPortfolioRequest(r)}>
                    <UserPlus size={11} /> Add as client
                  </ERPBtn>
                )}
              </div>
            ))}
            {reqs.length > 6 && (
              <div style={{ padding:'9px 16px', fontSize:10, color:C.muted }}>+{reqs.length - 6} older request(s)</div>
            )}
          </div>
        </ERPPanel>
      )}

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 380px' : 'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>

        {!selected && filtered.map((c, i) => (
          <div key={c.id}
            onClick={() => setSelected(c)}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius:16, padding:'18px', cursor:'pointer',
              transition:'all 0.2s', backdropFilter:'blur(12px)',
              position:'relative', overflow:'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = C.borderHi;
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${COLORS[i%COLORS.length]}50,transparent)` }} />

            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <ERPAvatar name={c.name} color={COLORS[i%COLORS.length]} size={40} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{c.name}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{c.company}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                <ERPBadge status={c.status || 'active'} />
                {(c.hasPortalAccount || c.authUid) ? (
                  <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:5, background:'rgba(24,199,122,0.15)', color:C.green, border:'1px solid rgba(24,199,122,0.3)', display:'inline-flex', alignItems:'center', gap:3 }}>
                    <CheckCircle2 size={9} /> Portal Active
                  </span>
                ) : (
                  <span style={{ fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:5, background:'rgba(255,255,255,0.05)', color:C.muted }}>
                    No Portal
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:5 }}>
              <div style={{ fontSize:11, color:C.muted, display:'flex', gap:6 }}>
                <Mail size={11} style={{ color:C.cyan, flexShrink:0, marginTop:1 }} />{c.loginEmail || c.email}
              </div>
              <div style={{ fontSize:11, color:C.muted, display:'flex', gap:6 }}>
                <Phone size={11} style={{ color:C.green, flexShrink:0, marginTop:1 }} />{c.phone}
              </div>
            </div>

            <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}30`, display:'flex', gap:16 }}>
              {[
                { icon:'📁', label:'Projects', val:projectCountOf(c) },
                { icon:'🧾', label:'Invoices', val:c.invoices||0 },
                { icon:'📅', label:'Since', val:c.clientSince },
              ].map(({ icon, label, val }) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{val}</div>
                  <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop:12, display:'flex', gap:6, flexWrap:'wrap' }} onClick={e=>e.stopPropagation()}>
              <ERPBtn size="sm" variant="secondary" onClick={(e)=>openEdit(c,e)}><Pencil size={11}/> Edit</ERPBtn>
              <ERPBtn size="sm" variant="secondary" onClick={(e)=>handleSendPasswordReset(c,e)} title="Send Password Reset Email"><Key size={11}/> Reset PW</ERPBtn>
              {!(c.hasPortalAccount || c.authUid) && (
                <ERPBtn size="sm" variant="primary" onClick={(e)=>{ e.stopPropagation(); setPwModal({ client:c, password:'', busy:false, error:'' }); }}><Shield size={11}/> Create Login</ERPBtn>
              )}
              <ERPBtn size="sm" variant="danger" onClick={(e)=>requestDelete(c,e)}><Trash2 size={11}/> Delete</ERPBtn>
            </div>
          </div>
        ))}

        {selected && (
          <ERPPanel>
            <ERPPanelHeader title="All Clients" icon="👥" />
            {filtered.map((c, i) => (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                  borderTop: i>0 ? `1px solid ${C.border}25` : 'none',
                  cursor:'pointer', transition:'background 0.1s',
                  background: selected?.id===c.id ? 'rgba(0,102,255,0.07)' : 'transparent',
                  borderLeft: selected?.id===c.id ? '3px solid #0066FF' : '3px solid transparent',
                }}
                onMouseEnter={e=>{ if(selected?.id!==c.id) e.currentTarget.style.background='rgba(0,102,255,0.04)'; }}
                onMouseLeave={e=>{ if(selected?.id!==c.id) e.currentTarget.style.background='transparent'; }}>
                <ERPAvatar name={c.name} color={COLORS[i%COLORS.length]} size={32} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                    {c.code && (
                      <span style={{ fontSize:9.5, fontFamily:'monospace', color:C.violet, flexShrink:0 }}>{c.code}</span>
                    )}
                    <span style={{ fontSize:10, color:C.muted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.company}</span>
                  </div>
                </div>
                <ERPBadge status={c.status||'active'} size="sm" />
              </div>
            ))}
          </ERPPanel>
        )}

        {selected && (
          <ERPPanel style={{ alignSelf:'flex-start' }}>
            <ERPPanelHeader title="Client Profile" icon="👤"
              action={<span style={{cursor:'pointer'}} onClick={()=>setSelected(null)}>✕</span>} />
            <div style={{ padding:18, display:'flex', flexDirection:'column', gap:16 }}>

              <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                <ERPAvatar name={selected.name} color={C.blue} size={50} />
                <div>
                  <div style={{ fontSize:16, fontWeight:900, color:C.text }}>{selected.name}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{selected.company}</div>
                  <ERPBadge status={selected.status||'active'} />
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { icon:<Hash size={12}/>,     label:'Code',    val:selected.code,       color:C.violet },
                  { icon:<Mail size={12}/>,     label:'Email',   val:selected.email,      color:C.cyan  },
                  { icon:<Phone size={12}/>,    label:'Phone',   val:selected.phone,      color:C.green },
                  { icon:<Calendar size={12}/>, label:'Client since', val:selected.clientSince, color:C.muted },
                ].filter(r => r.val).map(({ icon, label, val, color }) => (
                  <div key={label} style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <span style={{ color, flexShrink:0 }}>{icon}</span>
                    <span style={{ fontSize:11, color:C.muted, width:80, flexShrink:0 }}>{label}</span>
                    <span style={{ fontSize:11, color:C.subtle, fontWeight:600, fontFamily: label === 'Code' ? 'monospace' : undefined }}>{val}</span>
                  </div>
                ))}
                {!selected.code && (
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:2 }}>
                    <ERPBtn size="sm" variant="secondary" onClick={assignCodeToSelected} disabled={codeBusy}>
                      <Hash size={11} /> {codeBusy ? 'Assigning…' : 'Assign client code'}
                    </ERPBtn>
                    <span style={{ fontSize:10.5, color:C.muted }}>
                      Next free: {previewClientCode(selected.kind || (selected.company ? 'company' : 'individual'), clients)}
                    </span>
                  </div>
                )}
              </div>

              {selected.address && (
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ color:C.amber, flexShrink:0, marginTop:1 }}><MapPin size={12}/></span>
                  <span style={{ fontSize:11, color:C.muted, width:80, flexShrink:0 }}>Address</span>
                  <span style={{ fontSize:11, color:C.subtle, fontWeight:600, lineHeight:1.5 }}>{selected.address}</span>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {[
                  { label:'Projects', val:projectCountOf(selected), color:'#0066FF' },
                  { label:'Invoices', val:selected.invoices||0, color:'#18C77A' },
                  { label:'Messages', val:'—', color:'#8B5CF6' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{
                    padding:'10px', borderRadius:10, textAlign:'center',
                    background:'rgba(10,24,56,0.6)', border:`1px solid ${C.border}30`,
                  }}>
                    <div style={{ fontSize:18, fontWeight:900, color }}>{val}</div>
                    <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px', marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.8px' }}>Projects</div>
                  <span style={{ fontSize:10, fontWeight:700, color:C.muted }}>{selectedProjects.length}</span>
                </div>
                {selectedProjects.length === 0 ? (
                  <div style={{
                    padding:'12px 14px', borderRadius:10, textAlign:'center',
                    background:'rgba(10,24,56,0.6)', border:`1px dashed ${C.border}`, fontSize:11, color:C.muted, lineHeight:1.6,
                  }}>
                    No projects yet for this client.
                    <div style={{ marginTop:8 }}>
                      <ERPBtn size="sm" variant="primary" onClick={() => { setProjForm(EMPTY_PROJECT); setProjErr(''); setProjOpen(true); }}>
                        <Plus size={11} /> Add their first project
                      </ERPBtn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {selectedProjects.map(p => (
                      <div key={p.id} style={{
                        padding:'10px 12px', borderRadius:10,
                        background:'rgba(10,24,56,0.6)', border:`1px solid ${C.border}30`,
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:C.text }}>
                            {p.title}
                            {p.projectCode && (
                              <span style={{ fontSize:9.5, color:C.cyan, fontFamily:'monospace', marginLeft:6 }}>{p.projectCode}</span>
                            )}
                          </span>
                          <ERPBadge status={p.status} size="sm" />
                        </div>
                        <ERPProgress value={p.completion} />
                        <div style={{ fontSize:10, color:C.cyan, marginTop:4, textAlign:'right' }}>{p.completion}%</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Where this client came from — a portfolio-link submission is
                  labelled so it is never confused with a walk-in or QR lead. */}
              {selected.intakeSource === 'portfolio-link' && (
                <div style={{
                  padding:'10px 12px', borderRadius:10,
                  background:'rgba(0,217,255,0.06)', border:`1px solid ${C.cyan}30`,
                  fontSize:10.5, color:C.subtle, lineHeight:1.6,
                }}>
                  <span style={{ fontWeight:800, color:C.cyan }}>From portfolio link</span>
                  {selected.intakeLabel ? ` · ${selected.intakeLabel}` : ''}
                  {selected.intakeToken ? <span style={{ color:C.muted }}> · {selected.intakeToken.slice(0, 6)}…</span> : null}
                </div>
              )}

              {/* Work tracker — what has been done vs what is still pending,
                  marked by the admin. History lives on the client doc. */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.8px' }}>Work Tracker</div>
                  <span style={{ fontSize:10, fontWeight:800, color: selWorkDone === selWork.length && selWork.length > 0 ? C.green : C.muted }}>
                    {selWorkDone}/{selWork.length} done
                  </span>
                </div>
                <div style={{
                  padding:'12px 14px', borderRadius:12,
                  background:'rgba(139,92,246,0.06)', border:`1px solid ${C.violet}30`,
                  display:'flex', flexDirection:'column', gap:8,
                }}>
                  <ERPProgress value={selWorkPct} color={C.violet} />
                  <div style={{ fontSize:11, color:C.muted, lineHeight:1.5 }}>
                    {selWork.length === 0
                      ? 'No work items yet — add what is done and what is still to be done.'
                      : selWorkNext
                        ? <>Next up: <strong style={{ color:C.text }}>{selWorkNext.title}</strong></>
                        : <span style={{ color:C.green, fontWeight:700 }}>All work items are marked done.</span>}
                  </div>
                  <ERPBtn size="sm" variant="primary" onClick={()=>openWork(selected)} style={{ justifyContent:'center' }}>
                    <ListChecks size={12} /> Open Work Tracker
                  </ERPBtn>
                </div>
              </div>

              {/* Portal Login Account Card */}
              <div style={{
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(0,102,255,0.06)', border: `1px solid ${C.blue}30`,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={13} style={{ color: C.cyan }} /> Portal Access
                  </span>
                  {(selected.hasPortalAccount || selected.authUid) ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.green, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={11} /> Active
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.amber }}>
                      Not Provisioned
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  Login: <strong style={{ color: C.text }}>{selected.loginEmail || selected.email}</strong>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <ERPBtn size="sm" variant="secondary" onClick={(e) => handleSendPasswordReset(selected, e)} style={{ flex: 1, justifyContent: 'center' }}>
                    <Key size={12} /> Reset PW
                  </ERPBtn>
                  {!(selected.hasPortalAccount || selected.authUid) && (
                    <ERPBtn size="sm" variant="primary" onClick={() => setPwModal({ client: selected, password: '', busy: false, error: '' })} style={{ flex: 1, justifyContent: 'center' }}>
                      <Shield size={12} /> Create Login
                    </ERPBtn>
                  )}
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <ERPBtn variant="secondary" onClick={()=>openEdit(selected)} style={{ justifyContent:'center' }}>
                  <Pencil size={13} /> Edit Client
                </ERPBtn>
                <ERPBtn variant="danger" onClick={()=>requestDelete(selected)} style={{ justifyContent:'center' }}>
                  <Trash2 size={13} /> Delete Client
                </ERPBtn>
                <ERPBtn variant="primary" onClick={() => { setProjForm(EMPTY_PROJECT); setProjErr(''); setProjOpen(true); }} style={{ justifyContent:'center' }}>
                  <FolderKanban size={13} /> New Project
                </ERPBtn>
                <ERPBtn variant="secondary" onClick={clientReportPdf} style={{ justifyContent:'center' }}>
                  <Download size={13} /> Client Report PDF
                </ERPBtn>
                <ERPBtn variant="secondary" style={{ justifyContent:'center' }}>
                  <FileText size={13} /> Create Invoice
                </ERPBtn>
                <a href={`https://wa.me/${(selected.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(`Hi ${selected.name}, this is SMART Pvt Ltd. How can we help you today?`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    padding:'8px', borderRadius:10, textDecoration:'none',
                    background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.3)',
                    color:'#25D366', fontSize:12, fontWeight:700,
                  }}>
                  💬 WhatsApp Client
                </a>
              </div>
            </div>
          </ERPPanel>
        )}

        {filtered.length === 0 && !selected && (
          <div style={{ gridColumn:'1/-1' }}>
            <ERPEmpty icon="👥" title="No clients found" sub="Try a different search or add a new client." />
          </div>
        )}
      </div>

      <ERPModal isOpen={showForm} onClose={()=>{setShowForm(false);setEditId(null);}} title={editId ? 'Update Client' : 'Add New Client'} width={460}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={{ fontSize:10.5, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.6px' }}>Client type</span>
            <div style={{ display:'flex', gap:8 }}>
              {CLIENT_KINDS.map(k => {
                const on = form.kind === k.value;
                return (
                  <button key={k.value} type="button" onClick={()=>setForm(p=>({...p,kind:k.value}))} style={{
                    flex:1, padding:'9px 10px', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:700,
                    color: on ? C.text : C.muted,
                    background: on ? 'rgba(0,102,255,0.14)' : 'transparent',
                    border: `1px solid ${on ? C.cyan : C.border}`,
                  }}>{k.label}</button>
                );
              })}
            </div>
            <div style={{
              display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:9,
              background:'rgba(0,217,255,0.06)', border:`1px solid ${C.border}`,
            }}>
              <span style={{ fontSize:10.5, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.6px' }}>Client code</span>
              <span style={{ fontSize:12.5, fontWeight:800, color:C.cyan, fontFamily:'monospace', marginLeft:'auto' }}>
                {editId
                  ? (clients.find(c => c.id === editId)?.code || '—')
                  : previewClientCode(form.kind, clients)}
              </span>
            </div>
          </div>
          <ERPInput label="Full Name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required placeholder="e.g. John Perera" />
          <ERPInput label="Company" value={form.company} onChange={e=>setForm(p=>({...p,company:e.target.value}))} placeholder="e.g. Perera Holdings Pvt Ltd" />
          <ERPInput label="Email" value={form.email} type="email" onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="john@company.com" />
          <ERPInput label="Phone / WhatsApp" value={form.phone} type="tel" onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="+94 77 000 0000" />
          <div style={{ fontSize:10.5, color:C.muted, marginTop:-6 }}>
            Email or phone — at least one is required, both are not needed.
          </div>
          <ERPInput label="Address" value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))} placeholder="No, street, city" />
          <ERPInput label="Client since" value={form.clientSince} onChange={e=>setForm(p=>({...p,clientSince:e.target.value}))} placeholder="e.g. March 2024" />

          {!editId && (
            <div style={{
              padding:'12px 14px', borderRadius:10,
              background:'rgba(139,92,246,0.07)', border:`1px solid ${C.violet}35`,
              display:'flex', flexDirection:'column', gap:10,
            }}>
              <div style={{ fontSize:11, fontWeight:800, color:C.text, display:'flex', alignItems:'center', gap:6 }}>
                <FolderKanban size={13} style={{ color:C.violet }} /> First project (optional)
              </div>
              <div style={{ fontSize:10.5, color:C.muted, marginTop:-4, lineHeight:1.5 }}>
                Fill this and the project is created with the client, so their profile never
                starts with an empty Projects section.
              </div>
              <ERPInput label="Project title" value={form.projTitle}
                onChange={e=>setForm(p=>({...p,projTitle:e.target.value}))}
                placeholder="e.g. Portfolio Website" />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <ERPInput label="Service" value={form.projService}
                  onChange={e=>setForm(p=>({...p,projService:e.target.value}))}
                  placeholder="e.g. Portfolio" />
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <span style={{ fontSize:10.5, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.6px' }}>Status</span>
                  <select value={form.projStatus} onChange={e=>setForm(p=>({...p,projStatus:e.target.value}))}
                    style={{ background:'rgba(10,24,56,0.9)', border:`1px solid ${C.border}`, borderRadius:10,
                      padding:'9px 10px', color:C.text, fontSize:12, outline:'none', width:'100%' }}>
                    {PROJECT_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {!editId && (
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(0,102,255,0.06)', border: `1px solid ${C.blue}35`,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: C.text, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.createAccount && !!form.email.trim()}
                  disabled={!form.email.trim()}
                  onChange={e => setForm(p => ({ ...p, createAccount: e.target.checked }))}
                />
                <span style={{ opacity: form.email.trim() ? 1 : 0.55 }}>
                  Create Client Portal Login Account{!form.email.trim() ? ' (needs an email)' : ''}
                </span>
              </label>

              {form.createAccount && form.email.trim() && (
                <ERPInput
                  label="Initial Password"
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Min 8, caps + small + number + symbol (e.g. Client@1234)"
                  required
                />
              )}
            </div>
          )}

          {saveError && (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,185,66,0.1)', border:'1px solid rgba(245,185,66,0.35)', fontSize:11, color:C.amber, lineHeight:1.5 }}>
              {saveError}
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            <ERPBtn variant="secondary" onClick={()=>{setShowForm(false);setEditId(null);}} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={handleSave} disabled={saving} style={{flex:1,justifyContent:'center'}}>
              {saving ? 'Saving...' : (editId ? 'Update Client' : 'Add Client')}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      <ERPModal isOpen={!!delTarget} onClose={()=>{setDelTarget(null);setDelError('');}} title="Delete Client?" width={460}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>
            Permanently delete <strong style={{color:C.text}}>{delTarget?.name}</strong>? Their projects
            are archived and stay on the Projects page. If this client has quotations or payment
            records, deletion is blocked — archive them instead so the money history is kept.
          </div>
          {delError && (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,185,66,0.1)', border:'1px solid rgba(245,185,66,0.35)', fontSize:11, color:C.amber, lineHeight:1.5 }}>
              {delError}
            </div>
          )}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <ERPBtn variant="secondary" onClick={()=>{setDelTarget(null);setDelError('');}} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            {delError ? (
              <ERPBtn variant="secondary" onClick={archiveClient} disabled={delBusy} style={{flex:1,justifyContent:'center'}}>
                {delBusy ? 'Saving...' : 'Archive instead'}
              </ERPBtn>
            ) : (
              <ERPBtn variant="danger" onClick={confirmDelete} disabled={delBusy} style={{flex:1,justifyContent:'center'}}>
                {delBusy ? 'Checking...' : 'Confirm Delete'}
              </ERPBtn>
            )}
          </div>
        </div>
      </ERPModal>

      {/* ── New project for the selected client ─────────────────── */}
      <ERPModal isOpen={projOpen} onClose={() => setProjOpen(false)} title={`New Project — ${selected?.name || ''}`} width={460}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <ERPInput label="Project title" value={projForm.title} required
            onChange={e=>setProjForm(p=>({ ...p, title:e.target.value }))}
            placeholder="e.g. Portfolio Website" />
          <ERPInput label="Service type" value={projForm.serviceType}
            onChange={e=>setProjForm(p=>({ ...p, serviceType:e.target.value }))}
            placeholder="e.g. Portfolio" />
          <ERPSelect label="Status" value={projForm.status}
            onChange={e=>setProjForm(p=>({ ...p, status:e.target.value }))}
            options={PROJECT_STATUS} />
          <StaffAssignPicker
            staff={staffDir}
            value={projForm.assignedStaff}
            onChange={ids=>setProjForm(p=>({ ...p, assignedStaff: ids }))} />
          {projErr && (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,185,66,0.1)', border:'1px solid rgba(245,185,66,0.35)', fontSize:11, color:C.amber, lineHeight:1.5 }}>
              {projErr}
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            <ERPBtn variant="secondary" onClick={() => setProjOpen(false)} style={{ flex:1, justifyContent:'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={saveProjectForSelected} style={{ flex:1, justifyContent:'center' }}>
              <Plus size={12} /> Add Project
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── Portfolio request links (saved separately) ───────────── */}
      <ERPModal isOpen={linksOpen} onClose={() => setLinksOpen(false)} title="Portfolio Request Links" width={640}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <ERPInput label="Link name" value={linkLabel} required
              onChange={e=>{ setLinkLabel(e.target.value); if (!linkSlug) setLinkSlug(slugify(e.target.value)); }}
              placeholder="e.g. For Nimal — Portfolio" />
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ fontSize:10.5, fontWeight:700, color:C.subtle }}>
                Web address <span style={{ fontWeight:500, color:C.muted }}>(auto from the name)</span>
              </span>
              <div style={{ display:'flex', alignItems:'center', background:'rgba(10,24,56,0.8)',
                border:`1px solid ${C.border}`, borderRadius:10, padding:'0 10px', overflow:'hidden' }}>
                <span style={{ fontSize:10.5, color:C.muted, whiteSpace:'nowrap' }}>
                  {window.location.origin}/portfolio/
                </span>
                <input value={linkSlug} onChange={e=>setLinkSlug(slugify(e.target.value))}
                  placeholder={slugify(linkLabel) || 'lovecake'}
                  style={{ flex:1, minWidth:80, background:'none', border:'none', outline:'none',
                    color:C.cyan, fontSize:11.5, padding:'9px 2px' }} />
              </div>
              <div style={{ fontSize:10, color:C.muted, lineHeight:1.5, wordBreak:'break-all' }}>
                Client will open: <b style={{ color:C.cyan, fontFamily:'monospace' }}>
                  {slugify(linkSlug || linkLabel)
                    ? linkUrl(slugify(linkSlug || linkLabel))
                    : `${window.location.origin}/portfolio/<your-name>`}
                </b>
              </div>
            </div>
            <button type="button" onClick={() => setShowOwnLink(v => !v)}
              style={{ alignSelf:'flex-start', background:'none', border:'none', padding:0,
                cursor:'pointer', fontSize:10.5, fontWeight:700, color:C.cyan }}>
              {showOwnLink ? '− Hide my own web address' : '+ Send my own web address instead (optional)'}
            </button>
            {showOwnLink && (
              <ERPInput label="My own link (optional)" value={linkExternal}
                onChange={e=>setLinkExternal(e.target.value)}
                placeholder="https://smart.lk/lovecake" />
            )}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <ERPBtn variant="primary" onClick={createPortfolioLink} disabled={linkBusy || !linkLabel.trim()}>
              <Link2 size={13} /> {linkBusy ? 'Creating…' : 'Create link'}
            </ERPBtn>
          </div>

          {linkErr && (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,185,66,0.1)', border:'1px solid rgba(245,185,66,0.35)', fontSize:11, color:C.amber, lineHeight:1.5 }}>
              {linkErr}
            </div>
          )}

          {noPortal && (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(0,102,255,0.08)', border:`1px solid ${C.blue}40`, fontSize:11, color:C.subtle, lineHeight:1.6 }}>
              Clipboard is blocked in this browser — select and copy the link below by hand.
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {links.length === 0 && (
              <div style={{ padding:'16px 14px', borderRadius:12, textAlign:'center', background:'rgba(10,24,56,0.5)', border:`1px dashed ${C.border}`, fontSize:11.5, color:C.muted }}>
                No links yet — create the first one above.
              </div>
            )}
            {links.map(l => {
              const used = reqs.filter(r => r.token === l.token).length;
              const url = shareUrl(l);
              return (
                <div key={l.id} style={{
                  padding:'11px 12px', borderRadius:12, background:'rgba(10,24,56,0.75)',
                  border:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:8,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:12, fontWeight:800, color:C.text }}>{l.label || 'Portfolio link'}</span>
                    <ERPBadge status={l.active !== false ? 'active' : 'inactive'} label={l.active !== false ? 'Active' : 'Off'} />
                    <span style={{ fontSize:10, color:C.muted, marginLeft:'auto' }}>
                      {used} submission{used === 1 ? '' : 's'}
                    </span>
                  </div>
                  <input readOnly value={url} onFocus={e => e.target.select()}
                    style={{ width:'100%', background:'rgba(4,13,31,0.9)', border:`1px solid ${C.border}`,
                      borderRadius:8, padding:'7px 10px', color:C.cyan, fontSize:10.5, outline:'none', boxSizing:'border-box' }} />
                  <a href={linkUrl(l.token)} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:9.5, color:C.muted, fontVariantNumeric:'tabular-nums', wordBreak:'break-all' }}>
                    Form: {linkUrl(l.token)}
                  </a>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <ERPBtn size="sm" variant="secondary" onClick={() => copyLink(l)}><Copy size={11} /> Copy</ERPBtn>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Hi, please fill in your project details here: ${url}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:8,
                        textDecoration:'none', fontSize:10.5, fontWeight:700, color:'#25D366',
                        background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.3)' }}>
                      <Send size={11} /> WhatsApp
                    </a>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:8,
                        textDecoration:'none', fontSize:10.5, fontWeight:700, color:'#8CC2FF',
                        background:'rgba(0,102,255,0.14)', border:'1px solid rgba(0,102,255,0.45)' }}>
                      <ExternalLink size={11} /> Open
                    </a>
                    <button onClick={() => toggleLink(l)}
                      style={{ marginLeft:'auto', background:'none', border:`1px solid ${C.border}`, borderRadius:8,
                        padding:'5px 10px', color:C.muted, fontSize:10.5, fontWeight:700, cursor:'pointer' }}>
                      {l.active !== false ? 'Turn off' : 'Turn on'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <ERPBtn size="sm" variant="secondary" onClick={() => setLinksOpen(false)}>Close</ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── The filled form, exactly as the client sent it ───────── */}
      <ERPModal isOpen={!!reqView} onClose={() => setReqView(null)} title={`Portfolio request — ${reqView?.name || ''}`} width={700}>
        {reqView && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <ERPBadge status={reqView.clientId ? 'Completed' : 'New'} label={reqView.clientId ? 'Added as client' : 'Waiting'} />
              <span style={{ fontSize:10, color:C.muted }}>
                {reqView.linkLabel || 'Portfolio link'}{reqView.token ? ` · ${reqView.token}` : ''}
              </span>
            </div>
            {reqView.answers && Object.keys(reqView.answers).length ? (
              <div style={{ display:'flex', flexDirection:'column', gap:9,
                padding:'12px 14px', borderRadius:10, background:'rgba(4,13,31,0.45)',
                border:'1px solid rgba(32,52,93,0.8)' }}>
                {Object.entries(reqView.answers)
                  .filter(([, v]) => v && String(v).trim())
                  .map(([label, v]) => (
                    <div key={label} style={{ display:'flex', gap:12, fontSize:11.5, lineHeight:1.55 }}>
                      <span style={{ width:132, flexShrink:0, color:C.muted }}>{label}</span>
                      <span style={{ flex:1, color:C.subtle, fontWeight:600, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{v}</span>
                    </div>
                  ))}
              </div>
            ) : (
              [
                ['Name', reqView.name],
                ['Company', reqView.company],
                ['Phone / WhatsApp', reqView.phone],
                ['Email', reqView.email],
                ['Address', reqView.address],
                ['Project title', reqView.projectTitle],
                ['Budget', reqView.budget],
                ['Deadline', reqView.deadline],
                ['Reference links', reqView.links],
                ['Their message', reqView.description],
              ].filter(([, v]) => v).map(([label, v]) => (
                <div key={label} style={{ display:'flex', gap:12, fontSize:11.5, lineHeight:1.55 }}>
                  <span style={{ width:130, flexShrink:0, color:C.muted }}>{label}</span>
                  <span style={{ flex:1, color:C.subtle, fontWeight:600, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{v}</span>
                </div>
              ))
            )}
            <div style={{ fontSize:10, color:C.muted }}>
              Submitted through the saved portfolio link — this is the raw form, kept even after the client is added.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <ERPBtn variant="secondary" onClick={() => setReqView(null)} style={{ flex:1, justifyContent:'center' }}>Close</ERPBtn>
              {!reqView.clientId && (
                <ERPBtn variant="primary" onClick={() => { convertPortfolioRequest(reqView); setReqView(null); }} style={{ flex:1, justifyContent:'center' }}>
                  <UserPlus size={13} /> Add as client
                </ERPBtn>
              )}
            </div>
          </div>
        )}
      </ERPModal>

      {/* Create Login Account Modal for existing client */}
      <ERPModal isOpen={!!pwModal} onClose={()=>setPwModal(null)} title="Create Portal Login Account" width={440}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>
            Create a Client Portal account for <strong style={{color:C.text}}>{pwModal?.client?.name}</strong> using email <strong style={{color:C.cyan}}>{pwModal?.client?.email}</strong>.
          </div>

          <ERPInput
            label="Initial Password"
            type="password"
            value={pwModal?.password || ''}
            onChange={e => setPwModal(p => ({ ...p, password: e.target.value }))}
            placeholder="Min 8, caps + small + number + symbol (e.g. Client@1234)"
            required
          />

          {pwModal?.error && (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,185,66,0.1)', border:'1px solid rgba(245,185,66,0.35)', fontSize:11, color:C.amber, lineHeight:1.5 }}>
              {pwModal.error}
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <ERPBtn variant="secondary" onClick={()=>setPwModal(null)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={handleCreateAccountForClient} disabled={pwModal?.busy} style={{flex:1,justifyContent:'center'}}>
              {pwModal?.busy ? 'Creating...' : 'Activate Portal Account'}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── Work tracker ──────────────────────────────────────────── */}
      <ERPModal isOpen={!!workFor} onClose={()=>setWorkFor(null)} title={`Work Tracker — ${workFor?.name || ''}`} width={760}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          <div style={{ fontSize:11.5, color:C.muted, lineHeight:1.55 }}>
            Tick a work item when it is finished. Every tick, re-open, progress note and
            removal is saved in that item's history with the admin name and the exact time.
          </div>

          {/* Add a work item */}
          <div style={{
            padding:'12px 14px', borderRadius:12,
            background:'rgba(0,102,255,0.06)', border:`1px solid ${C.blue}30`,
            display:'flex', flexDirection:'column', gap:10,
          }}>
            <ERPInput
              label="Work to be done"
              value={workForm.title}
              onChange={e=>setWorkForm(p=>({ ...p, title:e.target.value }))}
              placeholder="e.g. Home page design — desktop + mobile"
            />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <span style={{ fontSize:10.5, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.6px' }}>Project</span>
                <select
                  value={workForm.project}
                  onChange={e=>setWorkForm(p=>({ ...p, project:e.target.value }))}
                  style={{
                    background:'rgba(10,24,56,0.9)', border:`1px solid ${C.border}`,
                    borderRadius:10, padding:'9px 10px', color:C.text, fontSize:12,
                    outline:'none', width:'100%',
                  }}>
                  <option value="">General / no project</option>
                  {workProjects.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                </select>
              </div>
              <ERPInput
                label="Note (optional)"
                value={workForm.note}
                onChange={e=>setWorkForm(p=>({ ...p, note:e.target.value }))}
                placeholder="Anything worth remembering"
              />
            </div>

            {workErr && (
              <div style={{ padding:'9px 11px', borderRadius:9, background:'rgba(245,185,66,0.1)', border:'1px solid rgba(245,185,66,0.35)', fontSize:11, color:C.amber, lineHeight:1.5 }}>
                {workErr}
              </div>
            )}

            <ERPBtn variant="primary" onClick={addWorkItem} disabled={workBusy} style={{ justifyContent:'center' }}>
              <Plus size={12} /> {workBusy ? 'Saving…' : 'Add Work Item'}
            </ERPBtn>
          </div>

          {/* Counts + filter */}
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            {[
              { key:'all',     label:`All ${modalWork.length}`,  color:C.blue   },
              { key:'pending', label:`Pending ${modalPending}`,  color:C.amber  },
              { key:'done',    label:`Done ${modalDone}`,        color:C.green  },
            ].map(f => (
              <button key={f.key} onClick={()=>setWorkFilter(f.key)} style={{
                cursor:'pointer', padding:'5px 11px', borderRadius:20, fontSize:10.5, fontWeight:800,
                background: workFilter === f.key ? `${f.color}26` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${workFilter === f.key ? `${f.color}66` : C.border}`,
                color: workFilter === f.key ? f.color : C.muted,
              }}>{f.label}</button>
            ))}
            <span style={{ marginLeft:'auto', fontSize:10, color:C.muted }}>
              Marking as <strong style={{ color:C.subtle }}>{adminName}</strong>
            </span>
          </div>

          {/* Items */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {modalShown.length === 0 && (
              <div style={{ padding:'18px 14px', borderRadius:12, textAlign:'center', background:'rgba(10,24,56,0.5)', border:`1px dashed ${C.border}`, fontSize:11.5, color:C.muted }}>
                {modalWork.length === 0 ? 'No work items yet — add the first one above.' : 'Nothing in this filter.'}
              </div>
            )}

            {modalShown.map(item => {
              const open = !!workOpen[item.id];
              const isDone = item.status === 'done';
              const hist = item.history || [];
              return (
                <div key={item.id} style={{
                  borderRadius:12, padding:'11px 12px',
                  background:'rgba(10,24,56,0.75)',
                  border:`1px solid ${isDone ? 'rgba(24,199,122,0.3)' : C.border}`,
                  display:'flex', flexDirection:'column', gap:8,
                }}>
                  <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <button
                      onClick={()=>setWorkStatus(item, isDone ? 'pending' : 'done')}
                      title={isDone ? 'Re-open — back to pending' : 'Mark as done'}
                      style={{
                        width:21, height:21, borderRadius:6, flexShrink:0, marginTop:1, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background: isDone ? 'rgba(24,199,122,0.18)' : 'rgba(255,255,255,0.04)',
                        border:`1px solid ${isDone ? 'rgba(24,199,122,0.55)' : C.border}`,
                        color: C.green,
                      }}>
                      {isDone && <CheckCircle2 size={13} />}
                    </button>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontSize:12, fontWeight:700,
                        color: isDone ? C.muted : C.text,
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}>{item.title}</div>
                      <div style={{ fontSize:9.5, color:C.muted, marginTop:2 }}>
                        {(item.project ? `${item.project} · ` : '')}
                        <span style={{ color: isDone ? C.green : C.amber, fontWeight:700 }}>
                          {isDone ? 'Done' : 'Pending'}
                        </span>
                        {item.updatedBy ? ` · ${item.updatedBy}` : ''}
                        {item.updatedAt ? ` · ${fmtWhen(item.updatedAt)}` : ''}
                      </div>
                      {item.note && <div style={{ fontSize:10, color:C.subtle, marginTop:3 }}>{item.note}</div>}
                    </div>

                    <ERPBtn size="sm" variant="secondary" onClick={()=>setWorkOpen(p=>({ ...p, [item.id]:!p[item.id] }))}>
                      <History size={11} /> {open ? 'Hide' : `History ${hist.length}`}
                    </ERPBtn>
                    <ERPBtn size="sm" variant="danger" onClick={()=>removeWorkItem(item)} title="Remove item (history is kept)">
                      <Trash2 size={11} />
                    </ERPBtn>
                  </div>

                  {open && (
                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                      {hist.length === 0 && <div style={{ fontSize:10, color:C.muted }}>No history yet.</div>}
                      {hist.map((h, i) => (
                        <div key={i} style={{ display:'flex', gap:8, fontSize:10, lineHeight:1.45 }}>
                          <span style={{ color:C.cyan, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{fmtWhen(h.at)}</span>
                          <span style={{ color:C.subtle, flex:1 }}>{h.text}</span>
                          {h.by && <span style={{ color:C.muted, flexShrink:0 }}>{h.by}</span>}
                        </div>
                      ))}
                      <div style={{ display:'flex', gap:6, marginTop:2 }}>
                        <input
                          value={workDraft[item.id] || ''}
                          onChange={e=>setWorkDraft(p=>({ ...p, [item.id]:e.target.value }))}
                          onKeyDown={e=>{ if (e.key === 'Enter') addWorkNote(item); }}
                          placeholder="Add a progress note — what was done today…"
                          style={{
                            flex:1, background:'rgba(10,24,56,0.9)', border:`1px solid ${C.border}`,
                            borderRadius:9, padding:'7px 10px', color:C.text, fontSize:11, outline:'none',
                          }}
                        />
                        <ERPBtn size="sm" variant="success" onClick={()=>addWorkNote(item)}>
                          <Plus size={11} /> Note
                        </ERPBtn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
            <span style={{ fontSize:10, color:C.muted }}>
              Progress {modalWork.length ? Math.round((modalDone / modalWork.length) * 100) : 0}%
            </span>
            <ERPBtn size="sm" variant="secondary" onClick={()=>setWorkFor(null)}>Close</ERPBtn>
          </div>
        </div>
      </ERPModal>
    </div>
  );
}

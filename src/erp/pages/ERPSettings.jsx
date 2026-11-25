import React, { useState, useEffect } from 'react';
import { ERPPanel, ERPPanelHeader, ERPBtn, ERPInput, ERPTextarea, C } from '../components/ERPui';
import {
  Save, Shield, Bell, Building, User, Lock, ShieldCheck, Landmark,
  Key, Copy, Check, Eye, EyeOff, RefreshCw, Code, CheckCircle2
} from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { company } from '../../config/company';
import ERPAccessRules from './ERPAccessRules';
import ERPRulesStatus from './ERPRulesStatus';
import { passwordError, PASSWORD_HINT } from '../passwordPolicy';

const SECTIONS = [
  {id:'company',  label:'Company Info',     icon:<Building size={14}/> },
  {id:'admin',    label:'Admin Profile',    icon:<User size={14}/>     },
  {id:'security', label:'Security',         icon:<Lock size={14}/>     },
  {id:'api',      label:'Boss & Manager API Key', icon:<Key size={14}/> },
  {id:'bank',     label:'Bank Details',     icon:<Landmark size={14}/> },
  {id:'rules',    label:'Access Rules',     icon:<ShieldCheck size={14}/> },
  {id:'deploy',   label:'Rules Status',     icon:<Shield size={14}/>   },
  {id:'notify',   label:'Notifications',    icon:<Bell size={14}/>     },
];

const EMPTY_BANK = {
  bankName:'', accountName:'', accountNumber:'', branch:'', accountType:'', swiftCode:'', instructions:'',
};

export default function ERPSettings() {
  const { currentUser } = useAuth();
  const [section, setSection] = useState('company');
  const [saved,   setSaved]   = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savingSection, setSavingSection] = useState(null);

  const [compForm, setCompForm] = useState({
    name:    company.name,
    tagline: company.tagline,
    phone:   company.contact.phone,
    whatsapp:company.contact.whatsapp,
    email:   company.contact.email,
    address: company.contact.address,
    hours:   company.contact.businessHours,
    facebook:company.social.facebook,
    linkedin:company.social.linkedin,
  });

  const [adminForm, setAdminForm] = useState({name:'SMART Admin',email:'admin@smartpvtltd.com',phone:''});
  const [passForm,  setPassForm]  = useState({current:'',newPass:'',confirm:''});
  const [notifs, setNotifs] = useState({
    newLeads:true,quotationAccepted:true,advancePaid:true,
    projectUpdates:true,messages:true,staffSalary:false,
  });

  // ── Boss & Manager API Key (Executive Portal Connection) ──
  const [apiKey, setApiKey] = useState('smart_live_sec_7a9f82d14b8e3c6a501e4d92bf7301c8');
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [apiSaved, setApiSaved] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);

  // ── Bank details (persisted to Firestore settings/bankDetails) ──
  const [bankForm,   setBankForm]   = useState(EMPTY_BANK);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [bankSaved,  setBankSaved]  = useState(false);
  const [bankError,  setBankError]  = useState('');
  const [bankBusy,   setBankBusy]   = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    getDoc(doc(db,'settings','bankDetails'))
      .then(snap=>{
        if (snap.exists()) setBankForm(p=>({...p,...snap.data()}));
        setBankLoaded(true);
      })
      .catch(()=>setBankLoaded(true));
  }, []);

  // Load the other settings sections from Firestore so edits persist.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    Promise.all([
      getDoc(doc(db, 'settings', 'companyInfo')),
      getDoc(doc(db, 'settings', 'adminProfile')),
      getDoc(doc(db, 'settings', 'notifications')),
      getDoc(doc(db, 'settings', 'apiConfig')),
    ]).then(([comp, admin, notif, apiSnap]) => {
      if (comp.exists()) setCompForm(p => ({ ...p, ...comp.data() }));
      if (admin.exists()) setAdminForm(p => ({ ...p, ...admin.data() }));
      if (notif.exists()) setNotifs(p => ({ ...p, ...notif.data() }));
      if (apiSnap.exists() && apiSnap.data()?.key) setApiKey(apiSnap.data().key);
    }).catch(err => console.error('Settings load error', err));
  }, []);

  const handleGenerateApiKey = async () => {
    setApiBusy(true);
    const chars = 'abcdef0123456789';
    let rand = '';
    for (let i = 0; i < 32; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    const newKey = `smart_live_sec_${rand}`;
    setApiKey(newKey);
    try {
      if (isFirebaseConfigured) {
        await setDoc(doc(db, 'settings', 'apiConfig'), {
          key: newKey,
          name: 'Boss & Manager Executive Portal',
          status: 'active',
          updatedAt: serverTimestamp(),
        }, { merge: true });
        await setDoc(doc(db, 'apiKeys', 'boss_manager_key'), {
          key: newKey,
          name: 'Boss & Manager Executive Portal',
          status: 'active',
          scopes: ['read:staff', 'read:attendance', 'write:attendance', 'read:salary', 'read:dailyUpdates', 'read:assignedWork', 'write:approvals'],
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setApiSaved(true);
      setTimeout(() => setApiSaved(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setApiBusy(false);
    }
  };

  const handleCopyApiKey = () => {
    navigator.clipboard?.writeText(apiKey).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2500);
    });
  };

  const handleSaveBank = async () => {
    setBankError('');
    if (!bankForm.bankName.trim() || !bankForm.accountNumber.trim()) {
      setBankError('Bank Name and Account Number are required.');
      return;
    }
    setBankBusy(true);
    try {
      // The quotations' PAYMENT DETAILS card starts from these rows on every
      // new quotation, so saving here also refreshes that default.
      const payRows = [
        ['Account Name', bankForm.accountName], ['Bank', bankForm.bankName],
        ['Branch', bankForm.branch], ['Account No', bankForm.accountNumber],
        ['Account Type', bankForm.accountType],
      ].map(([label, value]) => ({ label, value: String(value || '').trim() }))
        .filter(r => r.value);
      try { window.localStorage.setItem('smart.payRows.v1', JSON.stringify(payRows)); }
      catch { /* private mode — Firestore copy still applies */ }
      await setDoc(doc(db,'settings','bankDetails'), {
        ...bankForm, payRows, updatedAt: serverTimestamp(),
      }, { merge:true });
      setBankSaved(true);
      setTimeout(()=>setBankSaved(false),2500);
    } catch(e) {
      setBankError(e.message || 'Could not save bank details.');
    } finally {
      setBankBusy(false);
    }
  };

  // Persist a settings section to Firestore (settings/<doc>).
  const persistSection = async (docId, data, sectionKey) => {
    setSaveError('');
    if (!isFirebaseConfigured) {
      setSaveError('Firebase is not configured — settings can only be saved in the live app.');
      return;
    }
    setSavingSection(sectionKey);
    try {
      await setDoc(doc(db, 'settings', docId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2600);
    } catch (e) {
      console.error('Settings save failed', e);
      setSaveError(e.message || 'Could not save settings. Please try again.');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveCompany = () => persistSection('companyInfo', compForm, 'company');
  const handleSaveAdmin   = () => persistSection('adminProfile', adminForm, 'admin');
  const handleSaveNotifs  = () => persistSection('notifications', notifs, 'notify');

  const handleUpdatePassword = async () => {
    setSaveError('');
    if (!passForm.current || !passForm.newPass || !passForm.confirm) {
      setSaveError('Enter your current password, the new password and the confirmation.');
      return;
    }
    const pwErr = passwordError(passForm.newPass, currentUser?.email || '');
    if (pwErr) {
      setSaveError(pwErr);
      return;
    }
    if (passForm.newPass !== passForm.confirm) {
      setSaveError('New password and confirmation do not match.');
      return;
    }
    if (!isFirebaseConfigured || !currentUser?.email) {
      setSaveError('Firebase is not configured — password can only be changed in the live app.');
      return;
    }
    setSavingSection('security');
    try {
      const cred = EmailAuthProvider.credential(currentUser.email, passForm.current);
      await reauthenticateWithCredential(currentUser, cred);
      await updatePassword(currentUser, passForm.newPass);
      setPassForm({ current: '', newPass: '', confirm: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2600);
    } catch (e) {
      console.error('Password update failed', e);
      const msg = e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
        ? 'Current password is incorrect.'
        : e.code === 'auth/weak-password'
        ? `New password is too weak. ${PASSWORD_HINT}`
        : e.message || 'Could not update the password.';
      setSaveError(msg);
    } finally {
      setSavingSection(null);
    }
  };

  return (
    <div style={{display:'flex',gap:16}}>

      {/* Section nav */}
      <div style={{width:200,flexShrink:0}}>
        <ERPPanel style={{padding:'8px'}}>
          {SECTIONS.map((s,i)=>(
            <button key={s.id} onClick={()=>setSection(s.id)} style={{
              width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
              borderRadius:10,border:'none',cursor:'pointer',transition:'all 0.15s',textAlign:'left',
              background:section===s.id?'linear-gradient(135deg,rgba(0,102,255,0.2),rgba(0,217,255,0.08))':'transparent',
              color:section===s.id?C.text:C.muted,
              borderLeft:section===s.id?`3px solid ${C.blue}`:'3px solid transparent',
              marginBottom:2,
            }}>
              <span style={{color:section===s.id?C.cyan:C.muted}}>{s.icon}</span>
              <span style={{fontSize:12,fontWeight:section===s.id?700:500}}>{s.label}</span>
            </button>
          ))}
        </ERPPanel>
      </div>

      {/* Content */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:14}}>

        {/* Save success / error */}
        {saved && (
          <div style={{padding:'10px 16px',borderRadius:10,background:'rgba(24,199,122,0.1)',border:'1px solid rgba(24,199,122,0.3)',fontSize:12,color:C.green,fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
            ✅ Settings saved successfully — stored in Firestore, synced across devices.
          </div>
        )}
        {saveError && (
          <div style={{padding:'10px 16px',borderRadius:10,background:'rgba(240,90,103,0.1)',border:'1px solid rgba(240,90,103,0.3)',fontSize:12,color:C.red,fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
            ⚠ {saveError}
          </div>
        )}

        {/* ── Company Info ── */}
        {section==='company' && (
          <ERPPanel>
            <ERPPanelHeader title="Company Information" icon="🏢"/>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <ERPInput label="Company Name" value={compForm.name} onChange={e=>setCompForm(p=>({...p,name:e.target.value}))} />
                <ERPInput label="Tagline" value={compForm.tagline} onChange={e=>setCompForm(p=>({...p,tagline:e.target.value}))} />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <ERPInput label="Phone" value={compForm.phone} onChange={e=>setCompForm(p=>({...p,phone:e.target.value}))} />
                <ERPInput label="WhatsApp" value={compForm.whatsapp} onChange={e=>setCompForm(p=>({...p,whatsapp:e.target.value}))} />
              </div>
              <ERPInput label="Official Email" value={compForm.email} type="email" onChange={e=>setCompForm(p=>({...p,email:e.target.value}))} />
              <ERPTextarea label="Address" value={compForm.address} rows={2} onChange={e=>setCompForm(p=>({...p,address:e.target.value}))} />
              <ERPInput label="Business Hours" value={compForm.hours} onChange={e=>setCompForm(p=>({...p,hours:e.target.value}))} />
              <div style={{paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:10}}>Social Media</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <ERPInput label="Facebook" value={compForm.facebook} onChange={e=>setCompForm(p=>({...p,facebook:e.target.value}))} placeholder="https://facebook.com/..." />
                  <ERPInput label="LinkedIn" value={compForm.linkedin} onChange={e=>setCompForm(p=>({...p,linkedin:e.target.value}))} placeholder="https://linkedin.com/..." />
                </div>
              </div>
              <ERPBtn variant="primary" onClick={handleSaveCompany} disabled={savingSection === 'company'} style={{alignSelf:'flex-end',gap:6}}>
                <Save size={13}/> {savingSection === 'company' ? 'Saving…' : 'Save Changes'}
              </ERPBtn>
            </div>
          </ERPPanel>
        )}

        {/* ── Admin Profile ── */}
        {section==='admin' && (
          <ERPPanel>
            <ERPPanelHeader title="Admin Profile" icon="👤"/>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
              {/* Avatar */}
              <div style={{display:'flex',gap:16,alignItems:'center',padding:'16px',borderRadius:12,background:'rgba(0,102,255,0.08)',border:`1px solid ${C.borderHi}`}}>
                <div style={{width:64,height:64,borderRadius:16,background:'linear-gradient(135deg,#0066FF,#00D9FF)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:26,fontWeight:900,boxShadow:'0 6px 20px rgba(0,102,255,0.4)',flexShrink:0}}>A</div>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:C.text}}>SMART Admin</div>
                  <div style={{fontSize:11,color:C.cyan}}>Super Administrator</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>admin@smartpvtltd.com</div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <ERPInput label="Display Name" value={adminForm.name} onChange={e=>setAdminForm(p=>({...p,name:e.target.value}))} />
                <ERPInput label="Email" value={adminForm.email} type="email" onChange={e=>setAdminForm(p=>({...p,email:e.target.value}))} />
              </div>
              <ERPInput label="Phone" value={adminForm.phone} onChange={e=>setAdminForm(p=>({...p,phone:e.target.value}))} placeholder="+94 77 000 0000" />
              <ERPBtn variant="primary" onClick={handleSaveAdmin} disabled={savingSection === 'admin'} style={{alignSelf:'flex-end'}}>
                <Save size={13}/> {savingSection === 'admin' ? 'Saving…' : 'Save Profile'}
              </ERPBtn>
            </div>
          </ERPPanel>
        )}

        {/* ── Security ── */}
        {section==='security' && (
          <ERPPanel>
            <ERPPanelHeader title="Security Settings" icon="🔒"/>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'12px 16px',borderRadius:10,background:'rgba(0,102,255,0.06)',border:`1px solid ${C.borderHi}`,fontSize:11,color:C.subtle,lineHeight:1.6}}>
                🔐 Admin ID: <strong style={{color:C.text}}>SMART-ADMIN</strong><br/>
                Change your ERP admin password below. {PASSWORD_HINT}
              </div>
              <ERPInput label="Current Password" value={passForm.current} type="password" onChange={e=>setPassForm(p=>({...p,current:e.target.value}))} placeholder="••••••••" />
              <ERPInput label="New Password" value={passForm.newPass} type="password" onChange={e=>setPassForm(p=>({...p,newPass:e.target.value}))} placeholder="Min 8, caps + small + number + symbol" />
              <ERPInput label="Confirm New Password" value={passForm.confirm} type="password" onChange={e=>setPassForm(p=>({...p,confirm:e.target.value}))} placeholder="Repeat new password" />
              <ERPBtn variant="primary" onClick={handleUpdatePassword} disabled={savingSection === 'security'} style={{alignSelf:'flex-end'}}>
                <Lock size={13}/> {savingSection === 'security' ? 'Updating…' : 'Update Password'}
              </ERPBtn>
            </div>
          </ERPPanel>
        )}

        {/* ── Boss & Manager API Key (Executive Portal) ── */}
        {section==='api' && (
          <ERPPanel>
            <ERPPanelHeader title="Boss & Manager Webpage Connection API" icon="🔑" />
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
              <div style={{padding:'12px 16px',borderRadius:12,background:'rgba(0,102,255,0.07)',border:`1px solid ${C.borderHi}`,fontSize:11.5,color:C.subtle,lineHeight:1.65}}>
                🌐 <strong>Boss & Manager Executive Portal Connection Key</strong><br/>
                Use this secure API Key to connect your SMART ERP to the executive Boss & Manager webpage.
                Any updates made by staff or admin (profile, attendance, salary, daily updates, assigned work)
                will seamlessly sync to the external dashboard, and approvals submitted by the Boss & Manager
                will write straight back into the ERP.
              </div>

              {apiSaved && (
                <div style={{padding:'10px 16px',borderRadius:10,background:'rgba(24,199,122,0.1)',border:'1px solid rgba(24,199,122,0.3)',fontSize:12,color:C.green,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                  <CheckCircle2 size={15}/> API Key generated and activated successfully!
                </div>
              )}

              {/* API Key Box */}
              <div style={{
                background:'rgba(4,13,31,0.7)',border:`1px solid ${C.border}`,borderRadius:12,padding:14,
                display:'flex',flexDirection:'column',gap:10,
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <label style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:'uppercase',letterSpacing:0.6}}>
                    Active Connection API Key
                  </label>
                  <span style={{
                    fontSize:10,fontWeight:800,color:C.green,background:'rgba(24,199,122,0.12)',
                    border:'1px solid rgba(24,199,122,0.3)',padding:'2px 8px',borderRadius:10,
                  }}>
                    ● ACTIVE
                  </span>
                </div>

                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{
                    flex:1,padding:'11px 14px',borderRadius:10,background:'#020612',
                    border:`1px solid ${C.border}`,fontFamily:'monospace',fontSize:12,
                    color:'#A5B4FC',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',letterSpacing:0.8,
                  }}>
                    {keyVisible ? apiKey : apiKey.slice(0, 15) + '••••••••••••••••••••••••••••••'}
                  </div>
                  <button
                    onClick={()=>setKeyVisible(!keyVisible)}
                    title={keyVisible ? 'Hide API Key' : 'Reveal API Key'}
                    style={{
                      background:'rgba(255,255,255,0.05)',border:`1px solid ${C.border}`,borderRadius:10,
                      padding:'10px 12px',color:C.subtle,cursor:'pointer',display:'flex',alignItems:'center',
                    }}
                  >
                    {keyVisible ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                  <ERPBtn
                    variant="primary"
                    onClick={handleCopyApiKey}
                    style={{padding:'10px 14px',gap:6}}
                  >
                    {keyCopied ? <Check size={14} style={{color:C.green}}/> : <Copy size={14}/>}
                    {keyCopied ? 'Copied' : 'Copy Key'}
                  </ERPBtn>
                </div>

                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4,fontSize:10.5,color:C.muted}}>
                  <span>Send in HTTP Header: <code>x-api-key: {keyVisible ? apiKey : 'YOUR_KEY'}</code></span>
                  <button
                    onClick={handleGenerateApiKey}
                    disabled={apiBusy}
                    style={{
                      background:'none',border:'none',color:C.blue,fontSize:11,
                      fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4,
                    }}
                  >
                    <RefreshCw size={11}/> {apiBusy ? 'Generating…' : 'Regenerate New Key'}
                  </button>
                </div>
              </div>

              {/* Endpoint Base URL */}
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:C.subtle,marginBottom:5}}>
                  Connection API Base URL (Asia / Colombo Region)
                </label>
                <div style={{
                  padding:'10px 12px',borderRadius:10,background:'rgba(255,255,255,0.03)',
                  border:`1px solid ${C.border}`,fontSize:12,fontFamily:'monospace',color:C.cyan,
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                }}>
                  <span>https://asia-south1-smart-pvt-ltd-website.cloudfunctions.net/api/v1</span>
                  <button
                    onClick={()=>navigator.clipboard?.writeText('https://asia-south1-smart-pvt-ltd-website.cloudfunctions.net/api/v1')}
                    style={{background:'none',border:'none',color:C.muted,cursor:'pointer'}}
                  >
                    <Copy size={13}/>
                  </button>
                </div>
              </div>

              {/* Included Capabilities / Scopes */}
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:C.subtle,marginBottom:8}}>
                  Connected Modules & Capabilities
                </label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    {name:'Staff Profiles',scope:'read:staff',desc:'View staff info, department, role, status'},
                    {name:'Staff Attendance',scope:'read:attendance, write:attendance',desc:'Live punches, monochrome selfie photos, out-office breaks'},
                    {name:'Staff Salary & Payslips',scope:'read:salary',desc:'Monthly salary breakdown, payment status & receipts'},
                    {name:'Daily Work Updates',scope:'read:dailyUpdates',desc:'Task logs, hours worked, descriptions & tomorrow plans'},
                    {name:'Assigned Work / Projects',scope:'read:assignedWork',desc:'Assigned stages, client project status & reviews'},
                    {name:'Boss & Manager Approvals',scope:'write:approvals',desc:'One-click approvals for leave, tasks & salary payments'},
                  ].map(m=>(
                    <div key={m.name} style={{
                      padding:'9px 12px',borderRadius:10,background:'rgba(255,255,255,0.02)',
                      border:`1px solid ${C.border}20`,display:'flex',flexDirection:'column',gap:2,
                    }}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <strong style={{fontSize:11.5,color:C.text}}>{m.name}</strong>
                        <span style={{fontSize:9,color:C.blue,fontFamily:'monospace'}}>{m.scope}</span>
                      </div>
                      <span style={{fontSize:10,color:C.muted}}>{m.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Code for Developer */}
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:C.subtle,marginBottom:5}}>
                  Quick Connection Example (JavaScript / Webpage)
                </label>
                <pre style={{
                  fontSize:10.5,background:'#020612',color:'#CBD5E1',padding:12,
                  borderRadius:10,border:`1px solid ${C.border}`,margin:0,overflowX:'auto',lineHeight:1.6,
                }}>
{`// Example: Fetch Staff Attendance & Profiles for Boss Dashboard
const res = await fetch("https://asia-south1-smart-pvt-ltd-website.cloudfunctions.net/api/v1/attendance?date=today", {
  headers: {
    "x-api-key": "${apiKey}",
    "Content-Type": "application/json"
  }
});
const { ok, data } = await res.json();
console.log("Live ERP Attendance:", data);`}
                </pre>
              </div>
            </div>
          </ERPPanel>
        )}

        {/* ── Access Rules & Restrictions ── */}
        {section==='rules' && (
          <ERPAccessRules />
        )}

        {/* ── Rules Status (one list of everything still to deploy) ── */}
        {section==='deploy' && (
          <ERPRulesStatus />
        )}

        {/* ── Bank Details ── */}
        {section==='bank' && (
          <ERPPanel>
            <ERPPanelHeader title="Company Bank Details" icon="🏦"/>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'12px 16px',borderRadius:10,background:'rgba(0,102,255,0.06)',border:`1px solid ${C.borderHi}`,fontSize:11,color:C.subtle,lineHeight:1.6}}>
                🏦 These details appear on the client portal next to every quotation with an advance payment.
                Clients transfer the advance, upload the receipt photo, and you verify it in ERP → Quotations before starting work.
              </div>

              {!isFirebaseConfigured && (
                <div style={{padding:'10px 16px',borderRadius:10,background:'rgba(240,90,103,0.1)',border:'1px solid rgba(240,90,103,0.3)',fontSize:11,color:'#F05A67',fontWeight:600}}>
                  ⚠ Firebase is not configured — bank details can only be saved in the live app.
                </div>
              )}
              {isFirebaseConfigured && !bankLoaded && (
                <div style={{fontSize:11,color:C.muted}}>Loading saved bank details…</div>
              )}
              {bankSaved && (
                <div style={{padding:'10px 16px',borderRadius:10,background:'rgba(24,199,122,0.1)',border:'1px solid rgba(24,199,122,0.3)',fontSize:12,color:C.green,fontWeight:600}}>
                  ✅ Bank details saved — clients will see them immediately on their quotations.
                </div>
              )}
              {bankError && (
                <div style={{padding:'10px 16px',borderRadius:10,background:'rgba(240,90,103,0.1)',border:'1px solid rgba(240,90,103,0.3)',fontSize:12,color:'#F05A67',fontWeight:600}}>
                  {bankError}
                </div>
              )}

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <ERPInput label="Bank Name *" value={bankForm.bankName} onChange={e=>setBankForm(p=>({...p,bankName:e.target.value}))} placeholder="Bank of Ceylon" />
                <ERPInput label="Account Name *" value={bankForm.accountName} onChange={e=>setBankForm(p=>({...p,accountName:e.target.value}))} placeholder="SMART [PVT] LTD" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <ERPInput label="Account Number *" value={bankForm.accountNumber} onChange={e=>setBankForm(p=>({...p,accountNumber:e.target.value}))} placeholder="1234567890" />
                <ERPInput label="Branch" value={bankForm.branch} onChange={e=>setBankForm(p=>({...p,branch:e.target.value}))} placeholder="Colombo Main Branch" />
              </div>
              <ERPInput label="SWIFT / BIC Code (optional)" value={bankForm.swiftCode} onChange={e=>setBankForm(p=>({...p,swiftCode:e.target.value}))} placeholder="BCEYLYLX" />
              <ERPInput label="Account Type" value={bankForm.accountType || ''} onChange={e=>setBankForm(p=>({...p,accountType:e.target.value}))} placeholder="Savings / Current" />
              <ERPTextarea label="Payment Instructions (shown to clients)" value={bankForm.instructions} rows={3} onChange={e=>setBankForm(p=>({...p,instructions:e.target.value}))} placeholder={'Transfer the advance to the account above.\nUse your project name as the payment reference.\nUpload a photo of the receipt/screenshot below.'} />
              <ERPBtn variant="primary" onClick={handleSaveBank} style={{alignSelf:'flex-end',gap:6,opacity:bankBusy?0.6:1}}>
                <Save size={13}/> {bankBusy?'Saving…':'Save Bank Details'}
              </ERPBtn>
            </div>
          </ERPPanel>
        )}

        {/* ── Notifications ── */}
        {section==='notify' && (
          <ERPPanel>
            <ERPPanelHeader title="Notification Settings" icon="🔔"/>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:4}}>
              {[
                {key:'newLeads',        label:'New Lead / Client Request',   desc:'Alert when someone submits Get Started or Quote form'},
                {key:'quotationAccepted',label:'Quotation Accepted',         desc:'When client accepts a quotation'},
                {key:'advancePaid',     label:'Advance Payment Confirmed',   desc:'When client confirms advance payment'},
                {key:'projectUpdates',  label:'Project Status Updates',      desc:'When milestone or project status changes'},
                {key:'messages',        label:'New Client Messages',         desc:'When client sends a message in any project'},
                {key:'staffSalary',     label:'Salary Due Reminders',        desc:'Monthly reminder for pending staff salaries'},
              ].map(n=>(
                <div key={n.key} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 0',borderBottom:`1px solid ${C.border}20`}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.text}}>{n.label}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{n.desc}</div>
                  </div>
                  <div onClick={()=>setNotifs(p=>({...p,[n.key]:!p[n.key]}))}
                    style={{
                      width:44,height:24,borderRadius:12,cursor:'pointer',transition:'all 0.2s',flexShrink:0,position:'relative',
                      background:notifs[n.key]?'linear-gradient(135deg,#0066FF,#00D9FF)':'rgba(32,52,93,0.6)',
                      border:`1px solid ${notifs[n.key]?C.borderHi:C.border}`,
                    }}>
                    <div style={{
                      position:'absolute',top:2,width:18,height:18,borderRadius:'50%',background:'#fff',
                      transition:'all 0.2s',left:notifs[n.key]?'calc(100% - 20px)':2,
                      boxShadow:'0 2px 6px rgba(0,0,0,0.3)',
                    }}/>
                  </div>
                </div>
              ))}
              <ERPBtn variant="primary" onClick={handleSaveNotifs} disabled={savingSection === 'notify'} style={{alignSelf:'flex-end',marginTop:8}}>
                <Save size={13}/> {savingSection === 'notify' ? 'Saving…' : 'Save Preferences'}
              </ERPBtn>
            </div>
          </ERPPanel>
        )}
      </div>
    </div>
  );
}

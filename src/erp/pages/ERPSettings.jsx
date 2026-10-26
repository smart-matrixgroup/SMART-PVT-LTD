import React, { useState, useEffect } from 'react';
import { ERPPanel, ERPPanelHeader, ERPBtn, ERPInput, ERPTextarea, C } from '../components/ERPui';
import { Save, Shield, Bell, Building, User, Lock, ShieldCheck, Landmark } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { company } from '../../config/company';
import ERPAccessRules from './ERPAccessRules';

const SECTIONS = [
  {id:'company',  label:'Company Info',     icon:<Building size={14}/> },
  {id:'admin',    label:'Admin Profile',    icon:<User size={14}/>     },
  {id:'security', label:'Security',         icon:<Lock size={14}/>     },
  {id:'bank',     label:'Bank Details',     icon:<Landmark size={14}/> },
  {id:'rules',    label:'Access Rules',     icon:<ShieldCheck size={14}/> },
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
    ]).then(([comp, admin, notif]) => {
      if (comp.exists()) setCompForm(p => ({ ...p, ...comp.data() }));
      if (admin.exists()) setAdminForm(p => ({ ...p, ...admin.data() }));
      if (notif.exists()) setNotifs(p => ({ ...p, ...notif.data() }));
    }).catch(err => console.error('Settings load error', err));
  }, []);

  const handleSaveBank = async () => {
    setBankError('');
    if (!bankForm.bankName.trim() || !bankForm.accountNumber.trim()) {
      setBankError('Bank Name and Account Number are required.');
      return;
    }
    setBankBusy(true);
    try {
      await setDoc(doc(db,'settings','bankDetails'), {
        ...bankForm, updatedAt: serverTimestamp(),
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
    if (passForm.newPass.length < 8) {
      setSaveError('New password must be at least 8 characters.');
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
        ? 'New password is too weak — use 8+ characters with letters and numbers.'
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
                Change your ERP admin password below. Use a strong password with uppercase, numbers and symbols.
              </div>
              <ERPInput label="Current Password" value={passForm.current} type="password" onChange={e=>setPassForm(p=>({...p,current:e.target.value}))} placeholder="••••••••" />
              <ERPInput label="New Password" value={passForm.newPass} type="password" onChange={e=>setPassForm(p=>({...p,newPass:e.target.value}))} placeholder="Min 8 characters" />
              <ERPInput label="Confirm New Password" value={passForm.confirm} type="password" onChange={e=>setPassForm(p=>({...p,confirm:e.target.value}))} placeholder="Repeat new password" />
              <ERPBtn variant="primary" onClick={handleUpdatePassword} disabled={savingSection === 'security'} style={{alignSelf:'flex-end'}}>
                <Lock size={13}/> {savingSection === 'security' ? 'Updating…' : 'Update Password'}
              </ERPBtn>
            </div>
          </ERPPanel>
        )}

        {/* ── Access Rules & Restrictions ── */}
        {section==='rules' && (
          <ERPAccessRules />
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

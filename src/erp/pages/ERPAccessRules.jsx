// ─────────────────────────────────────────────────────────────────
//  ERP Access Control Rules & Permissions Module.
//  Admin configures page access, view restrictions, and role permissions
//  for Staff and Client portals (including Staff access to Client pages).
//  Stored in Firestore at settings/accessRules.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBtn, ERPEmpty, ERPAvatar, C } from '../components/ERPui';
import {
  DEFAULT_ACCESS_RULES,
  STAFF_PERMISSION_DEFINITIONS,
  CLIENT_PERMISSION_DEFINITIONS
} from '../../config/accessRules';
import {
  ShieldCheck, ShieldAlert, Lock, Unlock, Users, FolderKanban,
  CheckCircle2, AlertTriangle, Save, RefreshCw, KeyRound, Eye, EyeOff,
  UserCheck, Briefcase
} from 'lucide-react';

export default function ERPAccessRules() {
  const { isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'client' | 'members'
  const [rules, setRules] = useState(DEFAULT_ACCESS_RULES);
  const [staffList, setStaffList] = useState([]);
  const [clientsList, setClientsList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Load rules & members from Firestore / local fallback
  useEffect(() => {
    // Local fallback first
    try {
      const cached = localStorage.getItem('smart_access_rules');
      if (cached) setRules(p => ({ ...p, ...JSON.parse(cached) }));
    } catch { /* ignore */ }

    if (!live) {
      setStaffList([
        { id: 'dev-staff-001', name: 'Ashan Perera', role: 'Full Stack Developer', email: 'staff@smart.com', status: 'active' },
        { id: 'dev-staff-002', name: 'Nimali Silva', role: 'UI/UX Designer', email: 'nimali@smartpvtltd.com', status: 'active' },
      ]);
      setClientsList([
        { id: 'dev-client-001', name: 'Test Client', company: 'Test Company Pvt Ltd', email: 'testclient@smart.com', status: 'active' },
      ]);
      setLoading(false);
      return;
    }

    // Real Firestore listeners
    const unsubs = [
      onSnapshot(
        doc(db, 'settings', 'accessRules'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setRules(prev => ({ ...prev, ...data }));
            localStorage.setItem('smart_access_rules', JSON.stringify(data));
          }
          setLoading(false);
        },
        (err) => {
          console.warn('Access rules listener notice:', err);
          setLoading(false);
        }
      ),
      onSnapshot(collection(db, 'staff'), snap => {
        setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted));
      }, () => {}),
      onSnapshot(collection(db, 'clients'), snap => {
        setClientsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, () => {}),
    ];

    return () => unsubs.forEach(u => u());
  }, [live]);

  const handleToggleRule = (key) => {
    setRules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleMemberOverride = (memberId, ruleKey, defaultValue) => {
    setRules(prev => {
      const overrides = prev.memberOverrides || {};
      const currentMemberOverrides = overrides[memberId] || {};
      const currentVal = currentMemberOverrides[ruleKey] !== undefined ? currentMemberOverrides[ruleKey] : defaultValue;
      return {
        ...prev,
        memberOverrides: {
          ...overrides,
          [memberId]: {
            ...currentMemberOverrides,
            [ruleKey]: !currentVal,
          }
        }
      };
    });
  };

  const handleSaveRules = async () => {
    setSaving(true);
    setSaveError('');
    setSavedSuccess(false);
    try {
      const payload = {
        ...rules,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
        updatedBy: 'admin@smart.com',
      };

      localStorage.setItem('smart_access_rules', JSON.stringify({ ...rules, updatedAt: Date.now() }));

      if (live) {
        await setDoc(doc(db, 'settings', 'accessRules'), payload, { merge: true });
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.error(err);
      setSaveError(err.message || 'Failed to save access rules.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading access control rules…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top Banner / Hero */}
      <div style={{
        padding: '18px 22px', borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(0,102,255,0.12), rgba(0,217,255,0.05))',
        border: `1px solid ${C.borderHi}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0066FF, #00D9FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 14px rgba(0,102,255,0.4)'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              Access Control & Permission Rules
            </div>
            <div style={{ fontSize: 11.5, color: C.subtle, marginTop: 2 }}>
              Configure viewing permissions, feature restrictions, and client page access for Staff & Client portals.
            </div>
          </div>
        </div>

        <ERPBtn
          variant="primary"
          disabled={saving}
          onClick={handleSaveRules}
          style={{ minWidth: 150, justifyContent: 'center' }}
        >
          <Save size={13} /> {saving ? 'Saving...' : 'Save & Apply Rules'}
        </ERPBtn>
      </div>

      {savedSuccess && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(24,199,122,0.12)', border: '1px solid rgba(24,199,122,0.35)', color: C.green, fontSize: 12, fontWeight: 700
        }}>
          <CheckCircle2 size={15} /> Access control rules saved and published successfully! Changes apply immediately.
        </div>
      )}

      {saveError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12
        }}>
          <AlertTriangle size={15} /> {saveError}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 4 }}>
        {[
          { id: 'staff',   label: 'Staff Portal Permissions', icon: <UserCheck size={13} /> },
          { id: 'client',  label: 'Client Portal Permissions', icon: <FolderKanban size={13} /> },
          { id: 'members', label: 'Member-Specific Overrides', icon: <Users size={13} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '9px 16px', borderRadius: '10px 10px 0 0', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              background: activeTab === t.id ? 'rgba(0,102,255,0.18)' : 'transparent',
              color: activeTab === t.id ? C.cyan : C.muted,
              borderBottom: activeTab === t.id ? `2px solid ${C.cyan}` : '2px solid transparent',
              border: 'none', transition: 'all 0.15s'
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: STAFF PERMISSIONS ──────────────────────────────── */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Highlighted Key Rule: Staff Access to Client Projects Page */}
          <div style={{
            padding: '16px 20px', borderRadius: 14,
            background: rules.allowStaffClientProjects ? 'rgba(24,199,122,0.06)' : 'rgba(240,90,103,0.06)',
            border: `1px solid ${rules.allowStaffClientProjects ? 'rgba(24,199,122,0.3)' : 'rgba(240,90,103,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: rules.allowStaffClientProjects ? 'rgba(24,199,122,0.2)' : 'rgba(240,90,103,0.2)',
                color: rules.allowStaffClientProjects ? C.green : C.red,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {rules.allowStaffClientProjects ? <Unlock size={20} /> : <Lock size={20} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                    Staff Access to Client & Projects Page
                  </span>
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: rules.allowStaffClientProjects ? 'rgba(24,199,122,0.15)' : 'rgba(240,90,103,0.15)',
                    color: rules.allowStaffClientProjects ? C.green : C.red
                  }}>
                    {rules.allowStaffClientProjects ? '✓ Accepted by Admin' : '🚫 Restricted / Blocked'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.subtle, marginTop: 3, lineHeight: 1.5 }}>
                  When accepted by admin, staff members can view the Client Projects directory, client company details, and project requirements.
                  If restricted, the Client Projects page is locked for staff.
                </div>
              </div>
            </div>

            <button
              onClick={() => handleToggleRule('allowStaffClientProjects')}
              style={{
                padding: '9px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: rules.allowStaffClientProjects ? 'rgba(24,199,122,0.2)' : 'rgba(240,90,103,0.2)',
                color: rules.allowStaffClientProjects ? C.green : C.red,
                border: `1px solid ${rules.allowStaffClientProjects ? 'rgba(24,199,122,0.4)' : 'rgba(240,90,103,0.4)'}`,
                display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
              }}
            >
              {rules.allowStaffClientProjects ? <Eye size={13} /> : <EyeOff size={13} />}
              {rules.allowStaffClientProjects ? 'Accept / Allow Client Page' : 'Restrict Client Page'}
            </button>
          </div>

          {/* Other Staff Rules Grid */}
          <ERPPanel>
            <ERPPanelHeader title="Staff Feature Permissions & Restrictions" icon="🔒" />
            <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column' }}>
              {STAFF_PERMISSION_DEFINITIONS.filter(def => def.key !== 'allowStaffClientProjects').map((def, idx) => {
                const isAllowed = Boolean(rules[def.key]);
                return (
                  <div
                    key={def.key}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '15px 0', borderTop: idx > 0 ? `1px solid ${C.border}20` : 'none',
                      gap: 14, flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{def.label}</span>
                        <span style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(10,24,56,0.8)',
                          color: C.muted, border: `1px solid ${C.border}`
                        }}>
                          {def.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: C.subtle, marginTop: 3 }}>
                        {def.description}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isAllowed ? C.green : C.red }}>
                        {isAllowed ? 'Allowed' : 'Restricted'}
                      </span>
                      <div
                        onClick={() => handleToggleRule(def.key)}
                        style={{
                          width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                          position: 'relative', flexShrink: 0,
                          background: isAllowed ? 'linear-gradient(135deg, #0066FF, #00D9FF)' : 'rgba(32,52,93,0.6)',
                          border: `1px solid ${isAllowed ? C.borderHi : C.border}`
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff',
                          transition: 'all 0.2s', left: isAllowed ? 'calc(100% - 20px)' : 2,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ERPPanel>
        </div>
      )}

      {/* ── TAB 2: CLIENT PERMISSIONS ─────────────────────────────── */}
      {activeTab === 'client' && (
        <ERPPanel>
          <ERPPanelHeader title="Client Portal Permissions & Feature Restrictions" icon="🔒" />
          <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column' }}>
            {CLIENT_PERMISSION_DEFINITIONS.map((def, idx) => {
              const isAllowed = Boolean(rules[def.key]);
              return (
                <div
                  key={def.key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '15px 0', borderTop: idx > 0 ? `1px solid ${C.border}20` : 'none',
                    gap: 14, flexWrap: 'wrap'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{def.label}</span>
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(10,24,56,0.8)',
                        color: C.muted, border: `1px solid ${C.border}`
                      }}>
                        {def.category}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.subtle, marginTop: 3 }}>
                      {def.description}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: isAllowed ? C.green : C.red }}>
                      {isAllowed ? 'Allowed' : 'Restricted'}
                    </span>
                    <div
                      onClick={() => handleToggleRule(def.key)}
                      style={{
                        width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                        position: 'relative', flexShrink: 0,
                        background: isAllowed ? 'linear-gradient(135deg, #0066FF, #00D9FF)' : 'rgba(32,52,93,0.6)',
                        border: `1px solid ${isAllowed ? C.borderHi : C.border}`
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        transition: 'all 0.2s', left: isAllowed ? 'calc(100% - 20px)' : 2,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ERPPanel>
      )}

      {/* ── TAB 3: MEMBER-SPECIFIC OVERRIDES ──────────────────────── */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Staff Members List */}
          <ERPPanel>
            <ERPPanelHeader
              title="Staff Members — Client Page Access & Individual Rules"
              icon="👥"
              action={<span style={{ fontSize: 11, color: C.muted }}>{staffList.length} staff</span>}
            />
            {staffList.length === 0 ? (
              <ERPEmpty icon="👥" title="No staff members registered" sub="Create staff members in ERP → Staff." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {staffList.map((s, idx) => {
                  const staffOverride = rules.memberOverrides?.[s.id] || {};
                  const canViewClientProjects = staffOverride.allowStaffClientProjects !== undefined
                    ? staffOverride.allowStaffClientProjects
                    : rules.allowStaffClientProjects;

                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 20px', borderTop: idx > 0 ? `1px solid ${C.border}20` : 'none',
                        gap: 12, flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ERPAvatar name={s.name} size={32} />
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>{s.name}</div>
                          <div style={{ fontSize: 10.5, color: C.muted }}>
                            {s.role || 'Staff'} • {s.loginEmail || s.email}
                          </div>
                        </div>
                      </div>

                      {/* Individual Client Page Access Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: C.subtle }}>Client Page Access:</span>
                        <button
                          onClick={() => handleToggleMemberOverride(s.id, 'allowStaffClientProjects', rules.allowStaffClientProjects)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: canViewClientProjects ? 'rgba(24,199,122,0.15)' : 'rgba(240,90,103,0.15)',
                            color: canViewClientProjects ? C.green : C.red,
                            border: `1px solid ${canViewClientProjects ? 'rgba(24,199,122,0.3)' : 'rgba(240,90,103,0.3)'}`,
                            display: 'flex', alignItems: 'center', gap: 5
                          }}
                        >
                          {canViewClientProjects ? <CheckCircle2 size={11} /> : <Lock size={11} />}
                          {canViewClientProjects ? 'Accepted (Allowed)' : 'Restricted (Blocked)'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ERPPanel>

          {/* Client Members List */}
          <ERPPanel>
            <ERPPanelHeader
              title="Client Accounts — Access Status"
              icon="🏢"
              action={<span style={{ fontSize: 11, color: C.muted }}>{clientsList.length} clients</span>}
            />
            {clientsList.length === 0 ? (
              <ERPEmpty icon="🏢" title="No active clients found" sub="Onboard clients via Leads or Clients module." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {clientsList.map((c, idx) => {
                  const clientOverride = rules.memberOverrides?.[c.id] || {};
                  const isSuspended = clientOverride.suspended;

                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 20px', borderTop: idx > 0 ? `1px solid ${C.border}20` : 'none',
                        gap: 12, flexWrap: 'wrap'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>{c.name}</div>
                        <div style={{ fontSize: 10.5, color: C.muted }}>
                          {c.company || 'Individual Client'} • {c.email}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: C.subtle }}>Portal Access:</span>
                        <button
                          onClick={() => handleToggleMemberOverride(c.id, 'suspended', false)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: !isSuspended ? 'rgba(24,199,122,0.15)' : 'rgba(240,90,103,0.15)',
                            color: !isSuspended ? C.green : C.red,
                            border: `1px solid ${!isSuspended ? 'rgba(24,199,122,0.3)' : 'rgba(240,90,103,0.3)'}`,
                            display: 'flex', alignItems: 'center', gap: 5
                          }}
                        >
                          {!isSuspended ? <CheckCircle2 size={11} /> : <Lock size={11} />}
                          {!isSuspended ? 'Active' : 'Suspended'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ERPPanel>
        </div>
      )}

      {/* Bottom Save Bar */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 0',
        borderTop: `1px solid ${C.border}`
      }}>
        <ERPBtn
          variant="primary"
          disabled={saving}
          onClick={handleSaveRules}
          style={{ minWidth: 180, justifyContent: 'center' }}
        >
          <Save size={13} /> {saving ? 'Saving...' : 'Save & Apply Rules'}
        </ERPBtn>
      </div>

    </div>
  );
}

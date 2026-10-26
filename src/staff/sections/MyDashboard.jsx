// ─────────────────────────────────────────────────────────────────
//  Phase 3 B — Staff portal: Dashboard.
//  Everything here is scoped to the signed-in staff member: own work
//  assignments (authUid), today's attendance record and own daily
//  updates. Mirrors the queries the security rules allow.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  C, ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPProgress,
} from '../../erp/components/ERPui';
import NotificationAlert from '../../components/NotificationAlert';
import StaffEmpty from '../components/StaffEmpty';
import {
  toMs, todayKey, fmtTime, fmtHours, minutesBetween,
} from '../staffUtils';
import { fmtDate } from '../../erp/money';
import {
  Briefcase, AlertTriangle, Clock, CheckCircle2, ClipboardList,
  ArrowRight, CalendarDays, Play, FileText, ShieldCheck,
} from 'lucide-react';

const inDays = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// Dev-mode fixtures (never written to the DB).
const DEV_ASSIGNMENTS = [
  { id: 'da1', title: 'Payment gateway integration', projectTitle: 'FinTrack Mobile App', status: 'In Progress', progress: 45, startDate: inDays(-4), deadline: inDays(3), priority: 'High' },
  { id: 'da2', title: 'Landing page build', projectTitle: 'Aurora Website', status: 'Assigned', progress: 0, startDate: inDays(-1), deadline: inDays(9), priority: 'Medium' },
  { id: 'da3', title: 'API documentation revamp', projectTitle: 'FinTrack Mobile App', status: 'Completed', progress: 100, startDate: inDays(-20), deadline: inDays(-6), priority: 'Low' },
];
const DEV_UPDATES = [
  { id: 'du1', date: todayKey(), items: ['Fixed checkout rounding bug', 'Updated REST API docs'], notes: '', submittedAt: { toMillis: () => Date.now() - 36e5 } },
];

const TONES = {
  blue: { bg: 'rgba(0,102,255,0.12)',  fg: '#4D94FF' },
  green:{ bg: 'rgba(24,199,122,0.12)', fg: '#2FD98F' },
  amber:{ bg: 'rgba(245,185,66,0.12)', fg: '#F5B942' },
  red:  { bg: 'rgba(240,90,103,0.12)', fg: '#F05A67' },
};

function Stat({ icon: Icon, label, value, tone = 'blue', riseDelay = 0 }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div className="erp-hover sp-rise" style={{
      position: 'relative', overflow: 'hidden',
      flex: '1 1 160px', display: 'flex', gap: 12, alignItems: 'center',
      padding: '14px 16px', borderRadius: 14,
      background: `linear-gradient(135deg, ${t.bg}, ${C.surface} 62%)`,
      border: `1px solid ${C.border}`,
      animationDelay: `${riseDelay}s`,
    }}>
      {/* colourful moving accent along the top edge */}
      <span className="sp-sheen" style={{
        position: 'absolute', top: 0, left: 0, width: 70, height: 2,
        background: `linear-gradient(90deg, transparent, ${t.fg}, transparent)`,
      }} />
      <div style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${t.fg}44`, boxShadow: `0 4px 12px -4px ${t.fg}`,
      }}>
        <Icon size={17} color={t.fg} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
export default function MyDashboard({ onNavigate = () => {} }) {
  const { staffProfile, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id;

  const [assignments, setAssignments] = useState([]);
  const [todayRec, setTodayRec]       = useState(null);
  const [updates, setUpdates]         = useState([]);
  const [pendingSheets, setPendingSheets] = useState(0);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!live || !uid) {
      setAssignments(DEV_ASSIGNMENTS);
      setUpdates(DEV_UPDATES);
      setTodayRec(null);
      setPendingSheets(0);
      setLoading(false);
      return;
    }
    const un1 = onSnapshot(
      query(collection(db, 'workAssignments'), where('authUid', '==', uid)),
      s => setAssignments(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setLoading(false),
    );
    const un2 = onSnapshot(
      query(collection(db, 'attendance'), where('authUid', '==', uid), where('date', '==', todayKey()), limit(1)),
      s => { setTodayRec(s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }); setLoading(false); },
      () => setLoading(false),
    );
    const un3 = onSnapshot(
      query(collection(db, 'dailyUpdates'), where('authUid', '==', uid), limit(30)),
      s => { setUpdates(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false),
    );
    const un4 = onSnapshot(
      query(collection(db, 'reportRequests'), where('staffUid', '==', uid), where('status', '==', 'Requested')),
      s => setPendingSheets(s.size),
      () => {}, // non-fatal: alerts just won't show
    );
    return () => { un1(); un2(); un3(); un4(); };
  }, [live, uid]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading your dashboard…</div>;
  }

  const today    = todayKey();
  const open     = assignments.filter(a => a.status !== 'Completed');
  const overdue  = open.filter(a => a.deadline && a.deadline < today);
  const dueSoon  = open.filter(a => a.deadline && a.deadline >= today && a.deadline <= inDays(7));
  const inProg   = open.filter(a => a.status === 'In Progress').length;
  const upcoming = [...open]
    .sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')))
    .slice(0, 5);
  const lastUpdate = [...updates]
    .sort((a, b) => toMs(b.submittedAt || b.createdAt) - toMs(a.submittedAt || a.createdAt))[0];

  // KYC / certificate documents (live profile via AuthContext)
  const allDocs = staffProfile?.docs || [];
  const myDocs = [...allDocs]
    .sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')))
    .slice(0, 4);
  const pendingDocs = allDocs.filter(d => d.status !== 'Verified').length;

  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const greetEmoji = h < 12 ? '🌅' : h < 17 ? '☀️' : '🌙';
  const firstName = (staffProfile?.name || '').split(' ')[0] || 'there';

  const staffAlerts = [
    pendingSheets > 0 && {
      id: 'sheets', icon: '📄', accent: '#00D9FF', count: pendingSheets,
      title: 'Work sheet waiting for you',
      body: 'Download, fill and send it back to admin',
      actionLabel: 'Open sheets', onAction: () => onNavigate('sheets'),
    },
    !todayRec && {
      id: 'attend', icon: '🕒', accent: '#18C77A', pulse: true,
      title: "You're not checked in yet",
      body: 'Log your attendance to start the day',
      actionLabel: 'Check in now', onAction: () => onNavigate('checkout'),
    },
    overdue.length > 0 && {
      id: 'overdue', icon: '⚠️', accent: '#F05A67', count: overdue.length,
      title: 'Overdue tasks',
      body: 'Past deadline — update the progress',
      actionLabel: 'View work', onAction: () => onNavigate('work'),
    },
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Greeting banner */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        padding: '18px 20px', borderRadius: 18,
        background: 'linear-gradient(120deg, rgba(0,102,255,0.32), rgba(139,92,246,0.22) 55%, rgba(0,217,255,0.14))',
        border: '1px solid rgba(0,217,255,0.3)',
        boxShadow: '0 14px 40px -18px rgba(0,120,255,0.6)',
      }}>
        <span style={{ position: 'absolute', right: -30, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(0,217,255,0.18)', filter: 'blur(46px)' }} />
        <span style={{ position: 'absolute', left: -20, bottom: -50, width: 150, height: 150, borderRadius: '50%', background: 'rgba(139,92,246,0.18)', filter: 'blur(46px)' }} />
        <span className="sp-sheen" style={{ position: 'absolute', top: 0, bottom: 0, width: 90, left: '-40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="sp-float" style={{
            flexShrink: 0, width: 52, height: 52, borderRadius: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 26,
            background: 'linear-gradient(135deg,#0066FF,#8B5CF6)',
            boxShadow: '0 8px 22px -6px rgba(80,80,255,0.7), inset 0 1px 0 rgba(255,255,255,0.4)',
          }}>{greetEmoji}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{greet}, {firstName} 👋</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>
              Here's your work at a glance for {fmtDate(today)}.
            </div>
          </div>
        </div>
      </div>

      <div className="sp-rise" style={{ animationDelay: '0.05s' }}>
        <NotificationAlert heading="Needs your attention" sub="Tap a card to jump straight to it." items={staffAlerts} />
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat icon={Briefcase}     label="Open assignments"   value={open.length} tone="blue"   riseDelay={0.12} />
        <Stat icon={Play}          label="In progress"        value={inProg} tone="green"       riseDelay={0.18} />
        <Stat icon={AlertTriangle} label="Overdue"            value={overdue.length} tone={overdue.length ? 'red' : 'blue'} riseDelay={0.24} />
        <Stat icon={CalendarDays}  label="Due within 7 days"  value={dueSoon.length} tone={dueSoon.length ? 'amber' : 'blue'} riseDelay={0.30} />
      </div>

      {/* My KYC / certificate documents — same list the admin reviews */}
      <ERPPanel className="sp-rise" style={{ animationDelay: '0.33s' }}>
        <ERPPanelHeader
          title="My documents (KYC & certificates)"
          icon={FileText}
          action={
            <ERPBtn size="sm" variant="secondary" onClick={() => onNavigate('kyc')}>
              Manage <ArrowRight size={12} />
            </ERPBtn>
          }
        />
        {myDocs.length === 0 ? (
          <div style={{ padding: '18px 14px', textAlign: 'center', fontSize: 12, color: C.muted }}>
            No documents uploaded yet. Go to <strong style={{ color: C.text }}>KYC Documents</strong> or{' '}
            <strong style={{ color: C.text }}>Certificates</strong> in the menu to upload.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myDocs.map(d => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`,
              }}>
                <FileText size={15} style={{ color: C.blue, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: C.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{d.name}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>
                    {d.category === 'certificate' ? 'Certificate' : 'KYC'} · uploaded {fmtDate(d.uploadedAt?.slice(0, 10))}
                  </div>
                </div>
                <span style={{
                  fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, flexShrink: 0,
                  background: d.status === 'Verified' ? 'rgba(24,199,122,0.14)' : 'rgba(245,185,66,0.14)',
                  color: d.status === 'Verified' ? C.green : C.amber,
                  border: `1px solid ${d.status === 'Verified' ? 'rgba(24,199,122,0.4)' : 'rgba(245,185,66,0.4)'}`,
                }}>
                  {d.status === 'Verified' ? '✓ Verified' : 'Pending'}
                </span>
              </div>
            ))}
            {pendingDocs > 0 && (
              <div style={{ fontSize: 10.5, color: C.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={11} /> {pendingDocs} document{pendingDocs > 1 ? 's' : ''} waiting for admin review.
              </div>
            )}
          </div>
        )}
      </ERPPanel>

      {/* Upcoming deadlines */}
      <ERPPanel className="sp-rise" style={{ animationDelay: '0.36s' }}>
        <ERPPanelHeader title="Upcoming deadlines" icon={AlertTriangle} />
        {upcoming.length === 0 ? (
          <StaffEmpty
            icon={CheckCircle2} from="#00D9FF" to="#8B5CF6"
            title="No open work"
            sub="Nothing assigned right now — new assignments appear here automatically."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map(a => {
              const isOverdue = a.deadline && a.deadline < today;
              const isSoon = !isOverdue && a.deadline && a.deadline <= inDays(7);
              return (
                <div key={a.id} onClick={() => onNavigate('work')} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`,
                  cursor: 'pointer', flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{a.title}</div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
                      {a.clientName ? `${a.clientName}${a.clientCompany ? ` — ${a.clientCompany}` : ''}` : (a.projectTitle || '—')}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                    background: isOverdue ? 'rgba(240,90,103,0.12)' : isSoon ? 'rgba(245,185,66,0.12)' : 'rgba(0,102,255,0.12)',
                    color: isOverdue ? C.red : isSoon ? C.amber : C.blue,
                    border: `1px solid ${isOverdue ? 'rgba(240,90,103,0.35)' : isSoon ? 'rgba(245,185,66,0.35)' : 'rgba(0,102,255,0.3)'}`,
                  }}>
                    {a.deadline ? (isOverdue ? `Overdue · ${fmtDate(a.deadline)}` : `Due ${fmtDate(a.deadline)}`) : 'No deadline'}
                  </span>
                  <div style={{ width: 110 }}>
                    <ERPProgress value={a.progress || 0} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>

        {/* Today's attendance */}
        <ERPPanel className="sp-rise" style={{ animationDelay: '0.44s' }}>
          <ERPPanelHeader title="Today's attendance" icon={Clock} />
          {todayRec ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, color: C.muted }}>Status</span>
                <ERPBadge status={todayRec.status} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, color: C.muted }}>Check in</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{fmtTime(todayRec.checkInMs)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, color: C.muted }}>Check out</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
                  {todayRec.checkOutMs ? fmtTime(todayRec.checkOutMs) : 'Still in'}
                </span>
              </div>
              {!todayRec.checkOutMs && todayRec.checkInMs && (
                <div style={{ fontSize: 11, color: C.blue }}>
                  Elapsed: {fmtHours(minutesBetween(todayRec.checkInMs, Date.now()))}
                </div>
              )}
              <ERPBtn variant="secondary" onClick={() => onNavigate('checkout')}>
                <Clock size={13} /> Go to check-in / check-out
              </ERPBtn>
            </div>
          ) : (
            <StaffEmpty
              icon={Clock} from="#18C77A" to="#00D9FF"
              title="Not checked in today"
              sub="Check in from the portal to record your attendance."
              action={
                <ERPBtn variant="primary" onClick={() => onNavigate('checkout')}>
                  Check in <ArrowRight size={13} />
                </ERPBtn>
              }
            />
          )}
        </ERPPanel>

        {/* Latest daily update */}
        <ERPPanel className="sp-rise" style={{ animationDelay: '0.52s' }}>
          <ERPPanelHeader title="Latest daily update" icon={ClipboardList} />
          {lastUpdate ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
                {fmtDate(lastUpdate.date || today)}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(lastUpdate.items || []).slice(0, 4).map((it, i) => (
                  <li key={i} style={{ fontSize: 11.5, color: C.muted }}>{it}</li>
                ))}
              </ul>
              {(lastUpdate.items || []).length > 4 && (
                <div style={{ fontSize: 10.5, color: C.muted }}>
                  +{(lastUpdate.items || []).length - 4} more item(s)
                </div>
              )}
              <ERPBtn variant="secondary" onClick={() => onNavigate('daily')}>
                <ClipboardList size={13} /> Submit today's update
              </ERPBtn>
            </div>
          ) : (
            <StaffEmpty
              icon={ClipboardList} from="#0066FF" to="#8B5CF6"
              title="No updates yet"
              sub="Submit your first daily work update."
              action={
                <ERPBtn variant="primary" onClick={() => onNavigate('daily')}>
                  Daily update <ArrowRight size={13} />
                </ERPBtn>
              }
            />
          )}
        </ERPPanel>
      </div>
    </div>
  );
}

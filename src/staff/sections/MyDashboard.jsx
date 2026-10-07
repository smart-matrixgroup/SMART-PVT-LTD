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
  C, ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPEmpty, ERPProgress,
} from '../../erp/components/ERPui';
import {
  toMs, todayKey, fmtTime, fmtHours, minutesBetween,
} from '../staffUtils';
import { fmtDate } from '../../erp/money';
import {
  Briefcase, AlertTriangle, Clock, CheckCircle2, ClipboardList,
  ArrowRight, CalendarDays, Play,
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

function Stat({ icon: Icon, label, value, tone = 'blue' }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div style={{
      flex: '1 1 160px', display: 'flex', gap: 12, alignItems: 'center',
      padding: '14px 16px', borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!live || !uid) {
      setAssignments(DEV_ASSIGNMENTS);
      setUpdates(DEV_UPDATES);
      setTodayRec(null);
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
    return () => { un1(); un2(); un3(); };
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

  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (staffProfile?.name || '').split(' ')[0] || 'there';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Greeting banner */}
      <div style={{
        padding: '18px 20px', borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(0,102,255,0.18), rgba(0,217,255,0.06))',
        border: '1px solid rgba(0,102,255,0.25)',
      }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>{greet}, {firstName}</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
          Here's your work at a glance for {fmtDate(today)}.
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat icon={Briefcase}     label="Open assignments"   value={open.length} tone="blue" />
        <Stat icon={Play}          label="In progress"        value={inProg} tone="green" />
        <Stat icon={AlertTriangle} label="Overdue"            value={overdue.length} tone={overdue.length ? 'red' : 'blue'} />
        <Stat icon={CalendarDays}  label="Due within 7 days"  value={dueSoon.length} tone={dueSoon.length ? 'amber' : 'blue'} />
      </div>

      {/* Upcoming deadlines */}
      <ERPPanel>
        <ERPPanelHeader title="Upcoming deadlines" icon={AlertTriangle} />
        {upcoming.length === 0 ? (
          <ERPEmpty
            icon={CheckCircle2}
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
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{a.projectTitle || '—'}</div>
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
        <ERPPanel>
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
            <ERPEmpty
              icon={Clock}
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
        <ERPPanel>
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
            <ERPEmpty
              icon={ClipboardList}
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

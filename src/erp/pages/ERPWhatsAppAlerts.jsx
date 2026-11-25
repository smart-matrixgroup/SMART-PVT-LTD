// ─────────────────────────────────────────────────────────────────
//  Admin → WhatsApp alerts.
//
//  Two scheduled messages are configured here:
//    · 15:30 every working day — each staff member whose check-in is
//      already recorded gets a confirmation on the number saved in their
//      staff profile.
//    · 12th and 14th of every month — the owner's number (076 210 0778)
//      gets one alert listing everyone whose salary is still not marked.
//
//  The page shows exactly who is due, the exact text, and a one-tap
//  wa.me button per person, so it works even before the Cloud API is
//  configured. The scheduled run itself lives in functions/index.js.
// ─────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, query, where, setDoc, serverTimestamp, limit, orderBy,
} from 'firebase/firestore';
import {
  MessageCircle, Send, RefreshCw, AlertTriangle, Clock, Wallet, Settings2,
} from 'lucide-react';
import { db, isFirebaseConfigured, functionsApp } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useStaffDirectory } from '../useStaffDirectory';
import { rulesNotice } from '../rulesNotice';
import {
  C, ERPPanel, ERPPanelHeader, ERPBtn, ERPInput, ERPSelect, ERPEmpty, ERPAvatar,
} from '../components/ERPui';
import {
  OWNER_PHONE, DEFAULT_START_MONTH, todayKeyColombo, thisMonthKey,
  normalizePhone, waLink, monthLabel, checkinConfirmation, salaryPendingMessage,
  salaryWindow, afterStartMonth, checkedInStaff, unpaidStaff,
} from '../whatsapp/alertText';

const DEV_STAFF = [
  { id: 'dev-s1', name: 'Ashan Rifkan', role: 'Software Engineer', phone: '076 202 4545' },
  { id: 'dev-s2', name: 'Kavitha Raj', role: 'Accounts Executive', phone: '077 120 3399' },
  { id: 'dev-s3', name: 'Ruwan Silva', role: 'Digital Marketing Executive', phone: '071 553 1188' },
];

const STATUS_STYLE = {
  sent: { color: C.green, label: 'Sent' },
  manual: { color: C.amber, label: 'Send by hand' },
  failed: { color: C.red, label: 'Failed' },
};

const fmtWhen = v => {
  if (!v) return '—';
  const ms = typeof v?.toDate === 'function' ? v.toDate().getTime()
    : (typeof v === 'number' ? v : Date.parse(v));
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

function callableProblem(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || err || '');
  if (/not-found|unavailable|internal/i.test(code) || /not exist|not deployed|failed to fetch/i.test(msg)) {
    return 'The WhatsApp function is not reachable. Deploy it once with: npx firebase deploy --only functions';
  }
  return msg || 'The run did not finish. Check the Functions logs in the Firebase console.';
}

export default function ERPWhatsAppAlerts() {
  const { isDevSession, isFirebaseConfigured: fb } = useAuth();
  const live = Boolean(fb) && !isDevSession;
  const { staff } = useStaffDirectory();
  const roster = live ? staff : DEV_STAFF;

  const today = todayKeyColombo();
  const month = thisMonthKey();
  const payrollWindow = salaryWindow(today);

  const [config, setConfig] = useState({
    enabled: true,
    ownerPhone: OWNER_PHONE,
    startMonth: DEFAULT_START_MONTH,
    templateCheckin: '',
    templateSalary: '',
    language: 'en',
  });
  const [configBusy, setConfigBusy] = useState(false);
  const [todayRecords, setTodayRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loadErr, setLoadErr] = useState('');
  const [runBusy, setRunBusy] = useState('');
  const [notice, setNotice] = useState(null);

  // ── settings (non-secret; the API token lives in functions/.env) ──
  useEffect(() => {
    if (!live) return undefined;
    return onSnapshot(doc(db, 'whatsappConfig', 'main'),
      snap => { if (snap.exists()) setConfig(p => ({ ...p, ...snap.data() })); },
      () => {});
  }, [live]);

  // ── staff whose check-in is already recorded today ───────────────
  useEffect(() => {
    if (!live) { setTodayRecords([]); return undefined; }
    return onSnapshot(query(collection(db, 'attendance'), where('date', '==', today)),
      snap => setTodayRecords(snap.docs.map(d => d.data())),
      err => {
        console.error('attendance for whatsapp page', err);
        if (err.code === 'permission-denied') setLoadErr(rulesNotice('Attendance'));
      });
  }, [live, today]);

  // ── this month's payslips ────────────────────────────────────────
  useEffect(() => {
    if (!live) { setPayments([]); return undefined; }
    return onSnapshot(query(collection(db, 'salaryPayments'), where('month', '==', month)),
      snap => setPayments(snap.docs.map(d => d.data())),
      () => {});
  }, [live, month]);

  // ── the alert ledger ─────────────────────────────────────────────
  useEffect(() => {
    if (!live) { setAlerts([]); return undefined; }
    return onSnapshot(query(collection(db, 'whatsappAlerts'), orderBy('updatedAt', 'desc'), limit(60)),
      snap => setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => {
        console.error('whatsapp ledger', err);
        if (err.code === 'permission-denied') setLoadErr(rulesNotice('WhatsApp alert log'));
      });
  }, [live]);

  const checkedInToday = useMemo(
    () => checkedInStaff(roster.map(s => ({ ...s, phone: s.phone || '' })), todayRecords),
    [roster, todayRecords],
  );
  const pendingSalary = useMemo(() => unpaidStaff(roster, payments), [roster, payments]);
  const salaryActive = Boolean(payrollWindow) && afterStartMonth(payrollWindow, config.startMonth);
  const salaryNames = pendingSalary.map(s => `${s.name}${s.role ? ` (${s.role})` : ''}`);
  const salaryText = salaryPendingMessage(payrollWindow || month, salaryNames);
  const sentThisMonth = alerts.filter(a => a.status === 'sent'
    && String(a.date || '').startsWith(today.slice(0, 7))).length;

  const saveConfig = async () => {
    if (!live) { setNotice({ kind: 'ok', msg: 'Saved locally (dev session).' }); return; }
    setConfigBusy(true);
    try {
      await setDoc(doc(db, 'whatsappConfig', 'main'), {
        ...config,
        ownerPhone: normalizePhone(config.ownerPhone) || OWNER_PHONE,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setNotice({ kind: 'ok', msg: 'Alert settings saved. The scheduled runs pick them up on the next tick.' });
    } catch (e) {
      setNotice({ kind: 'bad', msg: e.code === 'permission-denied' ? rulesNotice('Saving WhatsApp settings') : e.message });
    } finally {
      setConfigBusy(false);
    }
  };

  const runNow = async kind => {
    setRunBusy(kind); setNotice(null);
    try {
      const { httpsCallable } = await import('firebase/functions');
      const fn = kind === 'checkin' ? 'runWhatsAppCheckinNow' : 'runWhatsAppSalaryNow';
      const call = httpsCallable(functionsApp(), fn);
      const res = await call({ dayKey: today });
      const d = res?.data || {};
      if (kind === 'checkin') {
        setNotice({ kind: 'ok', msg: `Run finished — ${d.sent || 0} sent, ${d.manual || 0} kept for one-tap sending, ${d.failed || 0} failed, ${d.skipped || 0} already sent.` });
      } else {
        setNotice({ kind: 'ok', msg: d.reason ? `Run finished — ${d.reason}.` : `Alert finished — ${d.status}.` });
      }
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'bad', msg: callableProblem(e) });
    } finally {
      setRunBusy('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── status row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
        {[
          ['15:30 check-in confirmation', `${checkedInToday.length} to message`, checkedInToday.length ? C.blue : C.muted, <Clock size={16} />],
          ['Payroll check (12th & 14th)', salaryActive ? `${pendingSalary.length} not marked` : 'outside window', salaryActive ? C.amber : C.muted, <Wallet size={16} />],
          ['Alerts sent this month', String(sentThisMonth), C.green, <MessageCircle size={16} />],
          ['Automatic sending', config.enabled ? 'On' : 'Off', config.enabled ? C.green : C.red, <Send size={16} />],
        ].map(([label, value, color, icon]) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px',
            background: 'rgba(10,24,56,0.75)', border: `1px solid ${C.border}`, borderRadius: 12,
          }}>
            <span style={{ color, display: 'flex' }}>{icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color }}>{value}</div>
              <div style={{ fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {loadErr && (
        <div style={{
          display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 10, fontSize: 11,
          color: C.red, background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)',
        }}>
          <AlertTriangle size={14} /> <span>{loadErr}</span>
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

      {/* ── 15:30 check-in confirmations ── */}
      <ERPPanel>
        <ERPPanelHeader title={`15:30 check-in confirmation — ${today}`} icon={<Clock size={15} />}
          action={(
            <div style={{ display: 'flex', gap: 6 }}>
              <ERPBtn size="sm" variant="secondary" disabled={runBusy === 'checkin'} onClick={() => runNow('checkin')}>
                <RefreshCw size={12} /> {runBusy === 'checkin' ? 'Running...' : 'Run now'}
              </ERPBtn>
            </div>
          )} />
        {checkedInToday.length === 0 ? (
          <ERPEmpty icon={<Clock size={28} />} title="No check-in recorded yet"
            sub="The 15:30 message goes to every staff member who has checked in today." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              fontSize: 10.5, color: C.muted, padding: '9px 18px',
              borderBottom: `1px solid ${C.border}20`, lineHeight: 1.6,
            }}>
              Automatic runs every working day at 15:30 (Asia/Colombo) — one message per staff member
              whose check-in is recorded, nobody has to send it. Until the Cloud API is configured
              (functions/.env → WHATSAPP_TOKEN, WHATSAPP_PHONE_ID), each row stays here with a one-tap link.
            </div>
            {checkedInToday.map((s, i) => {
              const text = checkinConfirmation(s.name, today, s.attendance?.checkInMs);
              const link = waLink(s.phone, text);
              const saved = alerts.find(a => a.id === `checkin_${today}_${s.id}`);
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', flexWrap: 'wrap',
                  borderTop: i > 0 ? `1px solid ${C.border}20` : 'none',
                }}>
                  <ERPAvatar name={s.name} size={30} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.name}</div>
                    <div style={{ fontSize: 10.5, color: C.muted }}>
                      {s.role || 'Staff'} · {s.phone || 'no number on profile'}
                    </div>
                  </div>
                  {saved && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_STYLE[saved.status]?.color || C.muted }}>
                      {STATUS_STYLE[saved.status]?.label || saved.status}
                    </span>
                  )}
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                        padding: '6px 12px', borderRadius: 9, fontSize: 11, fontWeight: 700,
                        color: C.green, background: 'rgba(24,199,122,0.12)', border: '1px solid rgba(24,199,122,0.4)',
                      }}>
                      <MessageCircle size={12} /> Send WhatsApp
                    </a>
                  ) : (
                    <span style={{ fontSize: 10.5, color: C.amber }}>Add a phone number in Staff</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>

      {/* ── payroll alert ── */}
      <ERPPanel>
        <ERPPanelHeader title={`Salary check — ${monthLabel(payrollWindow || month)}`} icon={<Wallet size={15} />}
          action={(
            <ERPBtn size="sm" variant="secondary" disabled={runBusy === 'salary'} onClick={() => runNow('salary')}>
              <RefreshCw size={12} /> {runBusy === 'salary' ? 'Running...' : 'Run now'}
            </ERPBtn>
          )} />
        <div style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
              {salaryActive
                ? (pendingSalary.length
                  ? `${pendingSalary.length} staff member${pendingSalary.length === 1 ? '' : 's'} still not marked`
                  : 'Every salary is marked')
                : `Alerts on the 12th and 14th — next ${monthLabel(payrollWindow || month)}`}
            </div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>
              Sent to {config.ownerPhone || OWNER_PHONE} at 09:00 on the 12th and 14th.
              Alerts start from {monthLabel(config.startMonth || DEFAULT_START_MONTH)}. If every
              salary is already marked, no message goes out.
            </div>
            {pendingSalary.length > 0 && (
              <div style={{ fontSize: 10.5, color: C.subtle, marginTop: 6 }}>
                {salaryNames.join(', ')}
              </div>
            )}
          </div>
          <a href={waLink(config.ownerPhone || OWNER_PHONE, salaryText)} target="_blank" rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
              padding: '8px 14px', borderRadius: 10, fontSize: 11.5, fontWeight: 700,
              color: C.green, background: 'rgba(24,199,122,0.12)', border: '1px solid rgba(24,199,122,0.4)',
            }}>
            <MessageCircle size={13} /> Send payroll alert
          </a>
        </div>
      </ERPPanel>

      {/* ── settings ── */}
      <ERPPanel>
        <ERPPanelHeader title="Alert settings" icon={<Settings2 size={15} />} />
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 12 }}>
            <ERPSelect label="Automatic sending" value={config.enabled ? 'on' : 'off'}
              onChange={e => setConfig(p => ({ ...p, enabled: e.target.value === 'on' }))}
              options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
            <ERPInput label="Owner WhatsApp number" value={config.ownerPhone}
              onChange={e => setConfig(p => ({ ...p, ownerPhone: e.target.value }))} placeholder="076 210 0778" />
            <ERPInput label="Start alerting from" type="month" value={config.startMonth}
              onChange={e => setConfig(p => ({ ...p, startMonth: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 12 }}>
            <ERPInput label="Check-in template name (optional)" value={config.templateCheckin}
              onChange={e => setConfig(p => ({ ...p, templateCheckin: e.target.value }))} placeholder="checkin_confirmation" />
            <ERPInput label="Salary template name (optional)" value={config.templateSalary}
              onChange={e => setConfig(p => ({ ...p, templateSalary: e.target.value }))} placeholder="salary_pending" />
            <ERPSelect label="Template language" value={config.language}
              onChange={e => setConfig(p => ({ ...p, language: e.target.value }))}
              options={['en', 'en_US', 'si', 'ta']} />
          </div>
          <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.65 }}>
            Meta only accepts business-initiated messages as approved templates outside an open chat.
            With both template fields blank, the scheduled run keeps every message here for one-tap sending.
            The API token and phone-number id go in functions/.env — never in this form.
          </div>
          <div>
            <ERPBtn disabled={configBusy} onClick={saveConfig}>{configBusy ? 'Saving...' : 'Save settings'}</ERPBtn>
          </div>
        </div>
      </ERPPanel>

      {/* ── log ── */}
      <ERPPanel>
        <ERPPanelHeader title="Alert log" icon={<MessageCircle size={15} />}
          action={!live ? 'dev session — nothing is sent' : `${alerts.length} recent`} />
        {alerts.length === 0 ? (
          <ERPEmpty icon={<MessageCircle size={28} />} title="No alerts yet"
            sub="Each scheduled run writes one row per person it tried to reach." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 660 }}>
              <thead>
                <tr>
                  {['When', 'Type', 'To', 'Status', 'Note', ''].map((h, i) => (
                    <th key={h} style={{
                      padding: '9px 14px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.8px',
                      textTransform: 'uppercase', color: C.muted, textAlign: 'left',
                      background: 'rgba(10,24,56,0.5)', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11, color: C.subtle, whiteSpace: 'nowrap' }}>
                      {fmtWhen(a.updatedAt || a.sentAt)}
                    </td>
                    <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11, color: C.subtle }}>
                      {a.kind === 'salary' ? 'Payroll' : 'Check-in'}
                      {a.month ? ` · ${monthLabel(a.month)}` : ''}
                    </td>
                    <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11, color: C.subtle }}>
                      {a.staffName || '—'}
                      <div style={{ fontSize: 10, color: C.muted }}>{a.phone || ''}</div>
                    </td>
                    <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 10.5, fontWeight: 700, color: STATUS_STYLE[a.status]?.color || C.muted }}>
                      {STATUS_STYLE[a.status]?.label || a.status || '—'}
                    </td>
                    <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 10.5, color: C.muted, maxWidth: 240 }}>
                      {a.error || ''}
                    </td>
                    <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {a.waLink && (
                          <a href={a.waLink} target="_blank" rel="noreferrer" title="Open in WhatsApp"
                            style={{ color: C.green, display: 'flex', alignItems: 'center' }}>
                            <MessageCircle size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ERPPanel>
    </div>
  );
}

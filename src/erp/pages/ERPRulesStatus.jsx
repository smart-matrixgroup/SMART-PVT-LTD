// ─────────────────────────────────────────────────────────────────
//  Settings → Rules Status
//
//  One board that answers "which security rules are still not deployed?"
//  instead of twelve different banners. Every collection the ERP listens
//  to is probed with a real one-document read as the signed-in admin:
//  Firestore rejects a collection query when the DEPLOYED rules have no
//  block for it, so a red row means the owner has to run the deploy
//  command once. Green means that part of the app is safe to use.
// ─────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from 'react';
import { ERPPanel, ERPPanelHeader, ERPBtn, C } from '../components/ERPui';
import { isFirebaseConfigured } from '../../config/firebase';
import { ShieldCheck, RefreshCw, Copy, Check, AlertTriangle } from 'lucide-react';
import { RULES_BLOCKS, DEPLOY_COMMAND, pendingBlocks, changedBlocks, RULES_REVISION } from '../rulesChecklist';

const STATE_UI = {
  live:    { label: 'Live',          color: C.green, bg: 'rgba(24,199,122,0.12)' },
  blocked: { label: 'Not deployed',  color: C.red,   bg: 'rgba(240,90,103,0.12)' },
  error:   { label: 'Blocked',       color: C.red,   bg: 'rgba(240,90,103,0.12)' },
  offline: { label: 'Offline',       color: C.amber, bg: 'rgba(245,185,66,0.12)' },
  pending: { label: 'Checking…',     color: C.muted, bg: 'rgba(148,163,184,0.12)' },
  // For a block whose rule TEXT was rewritten: the read probe passes on the
  // older deployed wording, so green here still means "run the command".
  changed: { label: 'Deploy again',  color: C.amber, bg: 'rgba(245,185,66,0.12)' },
};

const chip = (s, i) => (
  <span key={s} onClick={() => i && navigator.clipboard?.writeText(i).catch(() => {})}
    title={i ? 'Click to copy' : undefined}
    style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
      color: STATE_UI[s].color, background: STATE_UI[s].bg,
      border: `1px solid ${STATE_UI[s].color}55`, cursor: i ? 'pointer' : 'default',
    }}>{STATE_UI[s].label}</span>
);

const pill = (label, color, bg) => (
  <span style={{
    padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
    color, background: bg, border: `1px solid ${color}55`,
  }}>{label}</span>
);

export default function ERPRulesStatus() {
  const [states, setStates] = useState({});
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState('');
  // Which rules revision the admin has already deployed. The probe can see
  // whether a collection is allowed, but not whether a REWRITTEN rule text
  // went live — so the reminder clears only when the admin says they ran the
  // command for this revision, and returns on the next rewrite.
  const ACK_KEY = 'erp.rulesDeployedRevision';
  const [acked, setAcked] = useState(() => {
    try { return localStorage.getItem(ACK_KEY) || ''; } catch { return ''; }
  });
  const markDeployed = () => {
    try { localStorage.setItem(ACK_KEY, RULES_REVISION); } catch { /* private mode */ }
    setAcked(RULES_REVISION);
  };

  const check = useCallback(async () => {
    if (!isFirebaseConfigured) { setDone(true); return; }
    setRunning(true);
    setDone(false);
    const seed = {};
    RULES_BLOCKS.forEach(b => { seed[b.coll] = 'pending'; });
    setStates(seed);
    const { probeRulesBlocks } = await import('../rulesChecklist');
    await probeRulesBlocks((coll, state) => setStates(p => ({ ...p, [coll]: state })));
    setRunning(false);
    setDone(true);
  }, []);

  useEffect(() => { check(); }, [check]);

  const copy = (key, text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    }).catch(() => {});
  };

  const list = done ? pendingBlocks(states) : [];
  const liveCount = RULES_BLOCKS.filter(b => states[b.coll] === 'live').length;
  // Rule TEXT was rewritten for these collections. A read probe passes on the
  // older deployed rule, so they need the command run once even while the row
  // shows green — without this line the list would lie about the staff email
  // change (the old rule rejects it silently, it does not look "blocked").
  const rewritten = done && acked !== RULES_REVISION ? changedBlocks : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ERPPanel>
        <ERPPanelHeader title="Security Rules Status" icon={<ShieldCheck size={15} style={{ color: C.cyan }} />}
          action={<ERPBtn size="sm" variant="secondary" onClick={check} disabled={running}>
            <RefreshCw size={12} /> {running ? 'Checking…' : 'Check now'}
          </ERPBtn>} />

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isFirebaseConfigured && (
            <div style={{ fontSize: 11, color: C.amber }}>
              Firebase is not configured in this build, so the live rules cannot be checked.
            </div>
          )}

          {isFirebaseConfigured && !running && !done && (
            <div style={{ fontSize: 11, color: C.muted }}>Preparing check…</div>
          )}

          {done && (
            <div style={{
              padding: '12px 14px', borderRadius: 10, fontSize: 12, lineHeight: 1.6,
              background: list.length ? 'rgba(240,90,103,0.08)'
                : rewritten.length ? 'rgba(245,185,66,0.08)' : 'rgba(24,199,122,0.08)',
              border: `1px solid ${list.length ? 'rgba(240,90,103,0.3)' : rewritten.length ? `${C.amber}44` : 'rgba(24,199,122,0.3)'}`,
              color: list.length ? C.red : rewritten.length ? C.amber : C.green, fontWeight: 700,
            }}>
              {list.length
                ? <><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {list.length} of {RULES_BLOCKS.length} collections are still not allowed by the deployed rules: {list.map(b => b.name).join(', ')}. Run the command below once, then press “Check now”.</>
                : rewritten.length
                  ? `All ${RULES_BLOCKS.length} collections are allowed, but ${rewritten.length} rule was rewritten after the last deploy: ${rewritten.map(b => b.name).join(', ')}. Run the command below once so the new wording goes live.`
                  : `All ${RULES_BLOCKS.length} collections are allowed by the deployed rules — nothing to deploy.`}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: C.muted }}>{liveCount}/{RULES_BLOCKS.length} live</span>
            <span onClick={() => copy('cmd', DEPLOY_COMMAND)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                padding: '7px 12px', borderRadius: 8, fontFamily: 'ui-monospace, monospace', fontSize: 11,
                color: copied === 'cmd' ? C.green : C.cyan, background: 'rgba(0,102,255,0.07)',
                border: `1px dashed ${C.cyan}66`,
              }}>
              {copied === 'cmd' ? <Check size={12} /> : <Copy size={12} />}
              {DEPLOY_COMMAND}
            </span>
            {list.length > 0 && (
              <ERPBtn size="sm" variant="secondary" onClick={() => copy('list', list.map(b => `- ${b.name}  (${b.coll})`).join('\n'))}>
                {copied === 'list' ? <Check size={12} /> : <Copy size={12} />} Copy pending list
              </ERPBtn>
            )}
            {!list.length && rewritten.length > 0 && (
              <>
                <ERPBtn size="sm" variant="secondary" onClick={() => copy('list', rewritten.map(b => `- ${b.name}  (${b.coll}) — rule rewritten`).join('\n'))}>
                  {copied === 'list' ? <Check size={12} /> : <Copy size={12} />} Copy what needs deploying
                </ERPBtn>
                <ERPBtn size="sm" variant="success" onClick={markDeployed}>
                  <Check size={12} /> I ran the command
                </ERPBtn>
              </>
            )}
          </div>
        </div>
      </ERPPanel>

      <ERPPanel>
        <ERPPanelHeader title="Every collection the ERP uses" icon="🗂"
          action={<span style={{ fontSize: 10, color: C.muted }}>checked as the signed-in admin</span>} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {RULES_BLOCKS.map((b, i) => (
            <div key={b.coll} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '11px 18px', flexWrap: 'wrap',
              borderTop: i > 0 ? `1px solid ${C.border}25` : 'none',
            }}>
              <div style={{ flex: '1 1 240px', minWidth: 200 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>{b.name}</div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{b.page}</div>
                {b.changed && (
                  <div style={{ fontSize: 10.5, color: C.amber, marginTop: 3, maxWidth: 520 }}>{b.changed}</div>
                )}
              </div>
              <code style={{ fontSize: 10.5, color: C.subtle, flex: '0 0 auto' }}>{b.coll}</code>
              {chip(states[b.coll] || 'pending', b.coll)}
              {b.changed && chip('changed')}
            </div>
          ))}
        </div>
      </ERPPanel>
    </div>
  );
}

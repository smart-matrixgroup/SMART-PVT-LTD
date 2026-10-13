// ─────────────────────────────────────────────────────────────────
//  Phase 4 A — Staff Portal Messaging (contact list + threads).
//  A staff member can message:
//    · SMART Admin & Management (always available), and
//    · the CLIENTS they have assigned work for — each client thread is
//      the same conversation the client uses in their portal (and the
//      admin sees in ERP → Messages), so replies flow back naturally.
//  Access to client threads is granted by the admin's assignment
//  (conversations/<id>.assignedStaffUids — see firestore.rules).
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, C } from '../../erp/components/ERPui';
import { sendChatMessage, markConversationAsRead, getConversationId } from '../../erp/messagingUtils';
import { Send, MessageSquare, ShieldCheck, Building2, Briefcase } from 'lucide-react';

const DEV_STAFF_MESSAGES = [
  { id: 'sm1', senderId: 'admin', senderRole: 'admin', senderName: 'SMART Admin', text: 'Welcome to the SMART Staff Portal! Please submit your daily updates by 5:30 PM.', createdAt: new Date(Date.now() - 86400000) },
  { id: 'sm2', senderId: 'dev-staff-001', senderRole: 'staff', senderName: 'Ashan Perera', text: 'Understood, thank you! I am currently working on the new milestone deliverables.', createdAt: new Date(Date.now() - 43200000) },
  { id: 'sm3', senderId: 'admin', senderRole: 'admin', senderName: 'SMART Admin', text: 'Great progress. Let me know if you require any assets or client specifications.', createdAt: new Date(Date.now() - 14400000) },
];

const DEV_WORKS = [
  { id: 'dw1', clientId: 'C001', clientName: 'John Perera', clientCompany: 'Perera Holdings', serviceType: 'Corporate Website', projectTitle: 'Corporate Website Redesign' },
  { id: 'dw2', clientId: 'C002', clientName: 'Sarah Fernando', clientCompany: 'Mehala Restaurant', serviceType: 'ERP & POS System', projectTitle: 'Restaurant POS System' },
];

const ADMIN_CONTACT = {
  key: 'admin', type: 'admin',
  name: 'SMART Admin & Management',
  sub: 'Reports · Approvals · Support',
};

export default function StaffMessages() {
  const { staffProfile, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || 'dev-staff-001';
  const staffName = staffProfile?.name || 'Staff Member';

  const [works, setWorks] = useState([]);
  const [active, setActive] = useState(ADMIN_CONTACT);   // contact object
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const msgEndRef = useRef(null);

  const activeConvId = active.type === 'admin'
    ? getConversationId('staff', uid)
    : getConversationId('client', active.clientId);

  // 1. Assigned clients → chat contacts (deduped by clientId)
  useEffect(() => {
    if (!live) { setWorks(DEV_WORKS); return; }
    const unsub = onSnapshot(
      query(collection(db, 'workAssignments'), where('authUid', '==', uid)),
      snap => setWorks(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Staff works error:', err)
    );
    return unsub;
  }, [live, uid]);

  const clientContacts = useMemo(() => {
    const map = {};
    works.forEach(w => {
      if (!w.clientId) return;
      if (!map[w.clientId]) {
        map[w.clientId] = {
          key: `client_${w.clientId}`, type: 'client', clientId: w.clientId,
          name: w.clientName || w.clientCompany || 'Client',
          company: w.clientCompany || '',
          serviceType: w.serviceType || '',
          works: [],
        };
      }
      map[w.clientId].works.push(w.title || w.projectTitle || 'Work');
    });
    return Object.values(map).map(c => ({
      ...c,
      sub: [c.serviceType, c.works.length > 1 ? `${c.works.length} works` : c.works[0]]
        .filter(Boolean).join(' • ') || 'Assigned work',
    }));
  }, [works]);

  const contacts = [ADMIN_CONTACT, ...clientContacts];

  // 2. Listen to the active thread
  useEffect(() => {
    setSendError('');
    if (!live) {
      setMessages(active.type === 'admin' ? DEV_STAFF_MESSAGES : []);
      return;
    }
    if (active.type === 'admin') markConversationAsRead(activeConvId, 'staff', live);

    const q = query(
      collection(db, 'conversations', activeConvId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q,
      snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => {
        console.error('Staff thread error:', err);
        setSendError(active.type === 'client'
          ? 'Cannot open this client thread — ask the admin to assign the work and use "Sync Chat Access" in ERP → Staff → Work.'
          : `Thread error — ${err.message}`);
      });
    return unsub;
  }, [activeConvId, active.type, live]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Send
  const handleSend = async (e) => {
    e?.preventDefault();
    if (!msgText.trim() || sending) return;
    setSending(true);
    setSendError('');
    const textToSend = msgText.trim();
    setMsgText('');
    try {
      const common = {
        conversationId: activeConvId,
        senderId: uid, senderRole: 'staff', senderName: staffName,
        text: textToSend, isLive: live,
      };
      const sent = active.type === 'admin'
        ? await sendChatMessage({
            ...common, type: 'staff',
            participantUid: uid, participantName: staffName,
            participantRole: 'staff',
            participantEmail: staffProfile?.email || staffProfile?.loginEmail || '',
            receiverId: 'admin', receiverRole: 'admin', receiverName: 'SMART Admin',
          })
        : await sendChatMessage({
            ...common, type: 'client',
            participantUid: active.clientId, participantName: active.name,
            participantRole: 'client', participantEmail: '',
            receiverId: active.clientId, receiverRole: 'client', receiverName: active.name,
          });
      if (!live && sent) setMessages(p => [...p, sent]);
    } catch (err) {
      console.error('Send error:', err);
      setSendError(active.type === 'client'
        ? 'Not allowed to message this client yet — the admin must assign you work and Sync Chat Access.'
        : `Send failed — ${err.message || err}`);
      setMsgText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const ContactRow = ({ c }) => {
    const isActive = c.key === active.key;
    return (
      <button
        onClick={() => setActive(c)}
        className="sp-nav"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
          padding: '11px 14px', cursor: 'pointer', border: 'none', borderBottom: `1px solid ${C.border}20`,
          background: isActive ? 'rgba(0,102,255,0.10)' : 'transparent',
          borderLeft: `3px solid ${isActive ? C.cyan : 'transparent'}`,
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: c.type === 'admin'
            ? 'linear-gradient(135deg,#0066FF,#00D9FF)'
            : 'linear-gradient(135deg,#8B5CF6,#F05A67)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 800,
          boxShadow: isActive ? '0 0 12px rgba(0,102,255,0.35)' : 'none',
        }}>
          {c.type === 'admin' ? <ShieldCheck size={16} /> : (c.name[0] || '?').toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: isActive ? C.cyan : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.name}
          </div>
          <div style={{ fontSize: 10, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.sub}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>

      {/* ── Contacts (profiles) ── */}
      <div style={{
        width: 250, flexShrink: 0, borderRadius: 14, overflow: 'hidden',
        border: `1px solid ${C.border}`, background: 'rgba(10,24,56,0.55)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '12px 14px', borderBottom: `1px solid ${C.border}`,
          fontSize: 11, fontWeight: 900, color: C.subtle, textTransform: 'uppercase', letterSpacing: 0.6,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <MessageSquare size={13} style={{ color: C.cyan }} /> Chats
        </div>
        {contacts.map(c => <ContactRow key={c.key} c={c} />)}
        {clientContacts.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
            Client chats appear here automatically once the admin assigns you work for that client.
          </div>
        )}
      </div>

      {/* ── Thread ── */}
      <ERPPanel style={{ flex: 1, minWidth: 320, height: 'calc(100vh - 140px)', minHeight: 520, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Thread header = the contact's profile */}
        <div style={{
          padding: '12px 18px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: active.type === 'admin'
              ? 'linear-gradient(135deg,#0066FF,#00D9FF)'
              : 'linear-gradient(135deg,#8B5CF6,#F05A67)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 15,
            boxShadow: '0 4px 14px rgba(0,102,255,0.3)',
          }}>
            {active.type === 'admin' ? <ShieldCheck size={18} /> : (active.name[0] || '?').toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: C.text }}>{active.name}</div>
            <div style={{ fontSize: 10.5, color: C.muted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {active.type === 'admin' ? (
                <span>{staffProfile?.role ? `${staffProfile.role} • ` : ''}Management channel</span>
              ) : (
                <>
                  {active.company && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Building2 size={10} /> {active.company}</span>}
                  {active.serviceType && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Briefcase size={10} /> {active.serviceType}</span>}
                </>
              )}
            </div>
          </div>
          <span style={{ fontSize: 11, color: active.type === 'admin' ? C.green : C.cyan, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: active.type === 'admin' ? C.green : C.cyan,
              boxShadow: `0 0 6px ${active.type === 'admin' ? C.green : C.cyan}`,
            }} />
            {active.type === 'admin' ? 'Admin Connected' : 'Client Thread'}
          </span>
        </div>

        {active.type === 'client' && (
          <div style={{
            padding: '7px 16px', fontSize: 10.5, color: C.subtle,
            background: 'rgba(139,92,246,0.07)', borderBottom: `1px solid ${C.border}30`,
          }}>
            Messages here go to <strong>{active.name}</strong> in their client portal — SMART Admin also sees this thread.
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <MessageSquare size={36} color={C.muted} style={{ opacity: 0.5 }} />
              <span style={{ fontSize: 13, color: C.muted, textAlign: 'center', maxWidth: 340 }}>
                {active.type === 'admin'
                  ? 'No messages yet. Send a message to contact your administrator.'
                  : `Say hello to ${active.name} — start the project conversation.`}
              </span>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.senderId === uid || (active.type === 'admin' && msg.senderRole === 'staff');
              const dateObj = msg.createdAt?.toDate ? msg.createdAt.toDate() : (msg.createdAt ? new Date(msg.createdAt) : new Date());
              const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const otherLabel = msg.senderName || (active.type === 'admin' ? 'SMART Management' : 'Client');

              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                  {!isMe && (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: msg.senderRole === 'admin'
                        ? 'linear-gradient(135deg,#0066FF,#00D9FF)'
                        : 'linear-gradient(135deg,#8B5CF6,#F05A67)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 11, fontWeight: 800,
                    }}>
                      {msg.senderRole === 'admin' ? 'S' : (otherLabel[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <div style={{
                    maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: 3,
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                  }}>
                    {!isMe && (
                      <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, paddingLeft: 2 }}>
                        {otherLabel}
                      </span>
                    )}
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      fontSize: 13, lineHeight: 1.5,
                      background: isMe ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.85)',
                      color: isMe ? '#fff' : C.text,
                      border: isMe ? 'none' : `1px solid ${C.border}`,
                      boxShadow: isMe ? '0 4px 12px rgba(0,102,255,0.3)' : 'none',
                      wordBreak: 'break-word',
                    }}>
                      {msg.text}
                    </div>
                    <span style={{ fontSize: 9.5, color: C.muted, paddingRight: 2 }}>{time}</span>
                  </div>
                  {isMe && (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: '#18C77A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 11, fontWeight: 800,
                    }}>
                      {staffName[0].toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={msgEndRef} />
        </div>

        {sendError && (
          <div style={{
            padding: '8px 16px', fontSize: 11, color: C.red,
            background: 'rgba(240,90,103,0.08)', borderTop: `1px solid rgba(240,90,103,0.25)`,
          }}>
            {sendError}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSend} style={{
          padding: '14px 18px', borderTop: `1px solid ${C.border}`,
          display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0,
        }}>
          <input
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            placeholder={active.type === 'admin'
              ? 'Type message to management... (Press Enter to send)'
              : `Type message to ${active.name}... (Press Enter to send)`}
            autoComplete="off"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            style={{
              flex: 1, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
              borderRadius: 12, padding: '11px 16px', color: C.text, fontSize: 13, outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(0,102,255,0.5)'}
            onBlur={e => e.target.style.borderColor = C.border}
          />
          <button
            type="submit"
            disabled={!msgText.trim() || sending}
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg,#0066FF,#1787FF)', border: 'none',
              cursor: msgText.trim() && !sending ? 'pointer' : 'not-allowed',
              opacity: msgText.trim() && !sending ? 1 : 0.4,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'all 0.15s', boxShadow: '0 4px 12px rgba(0,102,255,0.4)',
            }}
          >
            <Send size={16} color="#fff" />
          </button>
        </form>
      </ERPPanel>
    </div>
  );
}

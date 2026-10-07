// ─────────────────────────────────────────────────────────────────
//  Phase 4 A — Staff Portal Messaging
//  Direct 1-on-1 messaging thread between Staff and SMART Admin.
//  Staff can reply to Admin only. Enter to send, auto-scroll.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, C } from '../../erp/components/ERPui';
import { sendChatMessage, markConversationAsRead, getConversationId } from '../../erp/messagingUtils';
import { Send, MessageSquare, ShieldCheck, Clock } from 'lucide-react';

const DEV_STAFF_MESSAGES = [
  { id: 'sm1', senderId: 'admin', senderRole: 'admin', senderName: 'SMART Admin', text: 'Welcome to the SMART Staff Portal! Please submit your daily updates by 5:30 PM.', createdAt: new Date(Date.now() - 86400000) },
  { id: 'sm2', senderId: 'dev-staff-001', senderRole: 'staff', senderName: 'Ashan Perera', text: 'Understood, thank you! I am currently working on the new milestone deliverables.', createdAt: new Date(Date.now() - 43200000) },
  { id: 'sm3', senderId: 'admin', senderRole: 'admin', senderName: 'SMART Admin', text: 'Great progress. Let me know if you require any assets or client specifications.', createdAt: new Date(Date.now() - 14400000) },
];

export default function StaffMessages() {
  const { staffProfile, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || 'dev-staff-001';
  const staffName = staffProfile?.name || 'Staff Member';

  const convId = getConversationId('staff', uid);

  const [messages, setMessages] = useState([]);
  const [msgText,  setMsgText]  = useState('');
  const [sending,  setSending]  = useState(false);
  const msgEndRef = useRef(null);

  // 1. Listen to messages in this staff's thread with admin
  useEffect(() => {
    if (!live) {
      setMessages([]);
      return;
    }

    // Mark as read for participant
    markConversationAsRead(convId, 'staff', live);

    const q = query(
      collection(db, 'conversations', convId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Staff messages error:', err));

    return unsub;
  }, [convId, live]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 2. Send message to Admin
  const handleSend = async (e) => {
    e.preventDefault();
    if (!msgText.trim() || sending) return;

    setSending(true);
    const textToSend = msgText.trim();
    setMsgText('');

    try {
      const sent = await sendChatMessage({
        conversationId: convId,
        type: 'staff',
        participantUid: uid,
        participantName: staffName,
        participantRole: 'staff',
        participantEmail: staffProfile?.email || staffProfile?.loginEmail || '',
        senderId: uid,
        senderRole: 'staff',
        senderName: staffName,
        receiverId: 'admin',
        receiverRole: 'admin',
        receiverName: 'SMART Admin',
        text: textToSend,
        isLive: live,
      });

      if (!live && sent) {
        setMessages(p => [...p, sent]);
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <ERPPanel style={{ height: 'calc(100vh - 140px)', minHeight: 520, display: 'flex', flexDirection: 'column' }}>
      <ERPPanelHeader
        title="Direct Messages with SMART Admin & Management"
        icon={MessageSquare}
        action={
          <span style={{ fontSize: 11, color: C.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            Admin Connected
          </span>
        }
      />

      {/* Messages Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <MessageSquare size={36} color={C.muted} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: 13, color: C.muted }}>No messages yet. Send a message to contact your administrator.</span>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderRole === 'staff' || msg.senderId === uid;
            const dateObj = msg.createdAt?.toDate ? msg.createdAt.toDate() : (msg.createdAt ? new Date(msg.createdAt) : new Date());
            const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-end', gap: 8,
                }}
              >
                {!isMe && (
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#0066FF,#00D9FF)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0,
                  }}>
                    S
                  </div>
                )}
                <div style={{
                  maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: 3,
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                }}>
                  {!isMe && (
                    <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, paddingLeft: 2 }}>
                      SMART Management
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
                  <span style={{ fontSize: 9.5, color: C.muted, paddingRight: 2 }}>
                    {time}
                  </span>
                </div>
                {isMe && (
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: '#18C77A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0,
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

      {/* Input */}
      <form onSubmit={handleSend} style={{
        padding: '14px 18px', borderTop: `1px solid ${C.border}`,
        display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0,
      }}>
        <input
          value={msgText}
          onChange={e => setMsgText(e.target.value)}
          placeholder="Type message to management... (Press Enter to send)"
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
  );
}

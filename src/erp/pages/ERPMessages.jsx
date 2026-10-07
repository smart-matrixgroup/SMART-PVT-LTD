// ─────────────────────────────────────────────────────────────────
//  Phase 4 A — Admin Central Messaging Cockpit (ERP)
//  Admin <-> Staff and Admin <-> Client
//  Conversations list, unread indicators, mark as read, Enter to send,
//  and "Start Conversation" with any staff or client.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, orderBy, onSnapshot, doc, getDocs
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPBadge, ERPBtn, ERPModal, C } from '../components/ERPui';
import { sendChatMessage, markConversationAsRead, getConversationId } from '../messagingUtils';
import { Send, MessageCircle, Search, Plus, User, Briefcase, Users, CheckCheck } from 'lucide-react';

const DEV_CONVERSATIONS = [
  {
    id: 'admin_client_C001',
    type: 'client',
    participantUid: 'C001',
    participantName: 'John Perera',
    participantRole: 'client',
    participantEmail: 'john@pereraholdings.com',
    lastMessage: 'Can we change the hero section color to blue?',
    lastMessageAt: new Date(Date.now() - 3600000),
    unreadForAdmin: 1,
    color: '#0066FF',
  },
  {
    id: 'admin_staff_dev-staff-001',
    type: 'staff',
    participantUid: 'dev-staff-001',
    participantName: 'Ashan Perera',
    participantRole: 'staff',
    participantEmail: 'staff@smart.com',
    lastMessage: 'I have pushed the latest updates for the ERP staff attendance module.',
    lastMessageAt: new Date(Date.now() - 7200000),
    unreadForAdmin: 0,
    color: '#18C77A',
  },
  {
    id: 'admin_client_C002',
    type: 'client',
    participantUid: 'C002',
    participantName: 'Sarah Fernando (Mehala Restaurant)',
    participantRole: 'client',
    participantEmail: 'sarah@mehala.lk',
    lastMessage: 'The POS billing module works perfectly! Our staff loves it.',
    lastMessageAt: new Date(Date.now() - 86400000),
    unreadForAdmin: 0,
    color: '#8B5CF6',
  },
];

const DEV_SEED_MESSAGES = {
  admin_client_C001: [
    { id: 'm1', senderId: 'C001', senderName: 'John Perera', senderRole: 'client', receiverId: 'admin', receiverRole: 'admin', text: 'Hi! I reviewed the homepage design. It looks really clean!', createdAt: new Date(Date.now() - 7200000) },
    { id: 'm2', senderId: 'admin', senderName: 'SMART Admin', senderRole: 'admin', receiverId: 'C001', receiverRole: 'client', text: 'Thank you! We spent extra time on the responsive layout.', createdAt: new Date(Date.now() - 6800000) },
    { id: 'm3', senderId: 'C001', senderName: 'John Perera', senderRole: 'client', receiverId: 'admin', receiverRole: 'admin', text: 'Can we change the hero section color to blue?', createdAt: new Date(Date.now() - 3600000) },
  ],
  'admin_staff_dev-staff-001': [
    { id: 'ms1', senderId: 'admin', senderName: 'SMART Admin', senderRole: 'admin', receiverId: 'dev-staff-001', receiverRole: 'staff', text: 'Hi Ashan, please test the attendance checkout auto-close logic.', createdAt: new Date(Date.now() - 14400000) },
    { id: 'ms2', senderId: 'dev-staff-001', senderName: 'Ashan Perera', senderRole: 'staff', receiverId: 'admin', receiverRole: 'admin', text: 'I have pushed the latest updates for the ERP staff attendance module.', createdAt: new Date(Date.now() - 7200000) },
  ],
  admin_client_C002: [
    { id: 'm4', senderId: 'C002', senderName: 'Sarah Fernando', senderRole: 'client', receiverId: 'admin', receiverRole: 'admin', text: 'The POS billing module works perfectly! Our staff loves it.', createdAt: new Date(Date.now() - 86400000) },
  ],
};

export default function ERPMessages() {
  const { isDevSession, currentUser } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [conversations, setConversations] = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [msgText,       setMsgText]       = useState('');
  const [sending,       setSending]       = useState(false);
  const [search,        setSearch]        = useState('');
  const [filterType,    setFilterType]    = useState('all'); // 'all' | 'staff' | 'client'
  const [showNewModal,  setShowNewModal]  = useState(false);
  const [contactList,   setContactList]   = useState({ staff: [], clients: [] });
  const [loadingContacts, setLoadingContacts] = useState(false);

  const msgEndRef = useRef(null);

  // ── 1. Listen to all conversations ──────────────────────────────────
  useEffect(() => {
    if (!live) {
      setConversations(DEV_CONVERSATIONS);
      return;
    }
    const q = query(collection(db, 'conversations'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(d => ({
        id: d.id,
        color: d.data().type === 'staff' ? '#18C77A' : '#0066FF',
        ...d.data(),
      }));
      setConversations(rows);
      if (rows.length > 0 && !selected) {
        setSelected(rows[0]);
      }
    }, (err) => console.error('Conversations error:', err));
    return unsub;
  }, [live]);

  // ── 2. Listen to messages in selected conversation ──────────────────
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }

    if (!live) {
      setMessages(DEV_SEED_MESSAGES[selected.id] || []);
      return;
    }

    // Mark as read for admin
    markConversationAsRead(selected.id, 'admin', live);

    const q = query(
      collection(db, 'conversations', selected.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Messages stream error:', err));

    return unsub;
  }, [selected?.id, live]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── 3. Load contacts for "New Conversation" modal ───────────────────
  const openNewChatModal = async () => {
    setShowNewModal(true);
    setLoadingContacts(true);
    if (!live) {
      setContactList({
        staff: [
          { id: 'dev-staff-001', name: 'Ashan Perera', role: 'Full Stack Developer', email: 'staff@smart.com' },
          { id: 'dev-staff-002', name: 'Nimali Silva', role: 'UI/UX Designer', email: 'nimali@smartpvtltd.com' },
          { id: 'dev-staff-003', name: 'Ruwan Jayasuriya', role: 'Accountant', email: 'ruwan@smartpvtltd.com' },
        ],
        clients: [
          { id: 'C001', name: 'John Perera', company: 'Perera Holdings', email: 'john@pereraholdings.com' },
          { id: 'C002', name: 'Sarah Fernando', company: 'Mehala Restaurant', email: 'sarah@mehala.lk' },
          { id: 'C003', name: 'Kumar Arasan', company: 'KA Retail', email: 'kumar@karetail.lk' },
          { id: 'C004', name: 'Priya Nair', company: 'PN Accounting', email: 'priya@pnaccounting.lk' },
        ],
      });
      setLoadingContacts(false);
      return;
    }

    try {
      const [staffSnap, clientSnap] = await Promise.all([
        getDocs(collection(db, 'staff')),
        getDocs(collection(db, 'clients')),
      ]);
      setContactList({
        staff: staffSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted),
        clients: clientSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.status !== 'deleted'),
      });
    } catch (e) {
      console.error('Error fetching contacts:', e);
    } finally {
      setLoadingContacts(false);
    }
  };

  const startConversationWith = (contact, type) => {
    const convId = getConversationId(type, contact.id);
    const existing = conversations.find(c => c.id === convId);
    if (existing) {
      setSelected(existing);
    } else {
      const newConv = {
        id: convId,
        type,
        participantUid: contact.id,
        participantName: contact.name + (contact.company ? ` (${contact.company})` : ''),
        participantRole: type,
        participantEmail: contact.email || contact.loginEmail || '',
        lastMessage: 'Conversation started',
        lastMessageAt: new Date(),
        unreadForAdmin: 0,
        unreadForParticipant: 0,
        color: type === 'staff' ? '#18C77A' : '#0066FF',
      };
      setConversations(p => [newConv, ...p]);
      setSelected(newConv);
    }
    setShowNewModal(false);
  };

  // ── 4. Sending message ──────────────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    if (!msgText.trim() || !selected || sending) return;

    setSending(true);
    const textToSend = msgText.trim();
    setMsgText('');

    try {
      const sent = await sendChatMessage({
        conversationId: selected.id,
        type: selected.type || 'client',
        participantUid: selected.participantUid,
        participantName: selected.participantName,
        participantRole: selected.participantRole || selected.type,
        participantEmail: selected.participantEmail || '',
        senderId: currentUser?.uid || 'admin',
        senderRole: 'admin',
        senderName: 'SMART Admin',
        receiverId: selected.participantUid,
        receiverRole: selected.type,
        receiverName: selected.participantName,
        text: textToSend,
        isLive: live,
      });

      if (!live && sent) {
        setMessages(p => [...p, sent]);
        setConversations(p => p.map(c => c.id === selected.id ? { ...c, lastMessage: textToSend, lastMessageAt: new Date() } : c));
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  // Filter conversations
  const filteredConvs = conversations.filter(c => {
    if (filterType !== 'all' && c.type !== filterType) return false;
    const q = search.toLowerCase();
    return (
      (c.participantName || '').toLowerCase().includes(q) ||
      (c.participantEmail || '').toLowerCase().includes(q) ||
      (c.lastMessage || '').toLowerCase().includes(q)
    );
  });

  const totalUnread = conversations.reduce((acc, c) => acc + (Number(c.unreadForAdmin) || 0), 0);

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 120px)', minHeight: 560 }}>

      {/* ── Left Sidebar (Conversations) ───────────────────────────── */}
      <div style={{
        width: 320, flexShrink: 0,
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
        backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Messages</span>
              {totalUnread > 0 && (
                <span style={{
                  background: 'linear-gradient(135deg,#0066FF,#00D9FF)', color: '#fff',
                  fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                }}>
                  {totalUnread} new
                </span>
              )}
            </div>
            <button
              onClick={openNewChatModal}
              title="Start New Conversation"
              style={{
                background: 'rgba(0,102,255,0.15)', border: '1px solid rgba(0,102,255,0.3)',
                color: C.cyan, borderRadius: 8, padding: '5px 8px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Plus size={13} /> New
            </button>
          </div>

          {/* Type filters */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: 'rgba(4,13,31,0.5)', padding: 3, borderRadius: 8 }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'staff', label: 'Staff' },
              { id: 'client', label: 'Clients' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                style={{
                  flex: 1, padding: '5px 0', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer',
                  background: filterType === tab.id ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'transparent',
                  color: filterType === tab.id ? '#fff' : C.muted,
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages..."
              style={{
                width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                borderRadius: 9, padding: '7px 10px 7px 27px', color: C.text, fontSize: 11, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Conversation List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConvs.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>
              No conversations found. Click "+ New" to message a team member or client.
            </div>
          ) : (
            filteredConvs.map((conv, i) => {
              const isActive = selected?.id === conv.id;
              const isStaff = conv.type === 'staff';
              const unread = Number(conv.unreadForAdmin) || 0;
              const avatarBg = isStaff ? 'linear-gradient(135deg,#18C77A,#00D9FF)' : 'linear-gradient(135deg,#0066FF,#8B5CF6)';

              return (
                <div
                  key={conv.id}
                  onClick={() => { setSelected(conv); markConversationAsRead(conv.id, 'admin', live); }}
                  style={{
                    padding: '12px 14px', cursor: 'pointer', transition: 'background 0.1s',
                    borderTop: i > 0 ? `1px solid ${C.border}20` : 'none',
                    background: isActive ? 'rgba(0,102,255,0.12)' : 'transparent',
                    borderLeft: isActive ? `3px solid ${isStaff ? C.green : C.blue}` : '3px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,102,255,0.04)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 800, fontSize: 13,
                    }}>
                      {(conv.participantName || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {conv.participantName}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, marginLeft: 6,
                          background: isStaff ? 'rgba(24,199,122,0.12)' : 'rgba(0,102,255,0.12)',
                          color: isStaff ? C.green : C.blue, border: `1px solid ${isStaff ? 'rgba(24,199,122,0.3)' : 'rgba(0,102,255,0.3)'}`,
                        }}>
                          {isStaff ? 'Staff' : 'Client'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conv.lastMessage || 'No messages yet'}
                      </div>
                    </div>
                    {unread > 0 && (
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'linear-gradient(135deg,#0066FF,#00D9FF)', color: '#fff',
                        fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 2,
                      }}>
                        {unread}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Column (Active Chat Thread) ──────────────────────── */}
      <div style={{
        flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
        backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
      }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <MessageCircle size={40} style={{ color: C.border, opacity: 0.5 }} />
            <span style={{ fontSize: 13, color: C.muted }}>Select a conversation to start messaging</span>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{
              padding: '12px 18px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                background: selected.type === 'staff' ? 'linear-gradient(135deg,#18C77A,#00D9FF)' : 'linear-gradient(135deg,#0066FF,#8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0,
              }}>
                {(selected.participantName || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selected.participantName}
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 12,
                    background: selected.type === 'staff' ? 'rgba(24,199,122,0.12)' : 'rgba(0,102,255,0.12)',
                    color: selected.type === 'staff' ? C.green : C.blue,
                  }}>
                    {selected.type === 'staff' ? 'Team Member' : 'Corporate Client'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {selected.participantEmail || selected.participantUid}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
                <span style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>Connected</span>
              </div>
            </div>

            {/* Messages Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                  <MessageCircle size={32} style={{ color: C.border, opacity: 0.5 }} />
                  <span style={{ fontSize: 12, color: C.muted }}>No messages yet. Send a message to start!</span>
                </div>
              ) : (
                messages.map(msg => {
                  const isAdmin = msg.senderRole === 'admin' || msg.senderId === 'admin';
                  const dateObj = msg.createdAt?.toDate ? msg.createdAt.toDate() : (msg.createdAt ? new Date(msg.createdAt) : new Date());
                  const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end', gap: 8,
                      }}
                    >
                      {!isAdmin && (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: selected.type === 'staff' ? '#18C77A' : '#0066FF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0,
                        }}>
                          {(msg.senderName || selected.participantName || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div style={{
                        maxWidth: '68%', display: 'flex', flexDirection: 'column', gap: 3,
                        alignItems: isAdmin ? 'flex-end' : 'flex-start',
                      }}>
                        {!isAdmin && (
                          <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, paddingLeft: 2 }}>
                            {msg.senderName || selected.participantName}
                          </span>
                        )}
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isAdmin ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          fontSize: 12.5, lineHeight: 1.5,
                          background: isAdmin ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.85)',
                          color: isAdmin ? '#fff' : C.text,
                          border: isAdmin ? 'none' : `1px solid ${C.border}50`,
                          boxShadow: isAdmin ? '0 4px 12px rgba(0,102,255,0.3)' : 'none',
                          wordBreak: 'break-word',
                        }}>
                          {msg.text}
                        </div>
                        <span style={{ fontSize: 9.5, color: C.muted, paddingRight: 2 }}>
                          {time}
                        </span>
                      </div>
                      {isAdmin && (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'linear-gradient(135deg,#0066FF,#00D9FF)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 10, fontWeight: 800, flexShrink: 0,
                        }}>
                          S
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={msgEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} style={{
              padding: '12px 16px', borderTop: `1px solid ${C.border}`,
              display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0,
            }}>
              <input
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder={`Type a message to ${selected.participantName}... (Enter to send)`}
                autoComplete="off"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                style={{
                  flex: 1, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: '10px 16px', color: C.text, fontSize: 13, outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(0,102,255,0.5)'}
                onBlur={e => e.target.style.borderColor = C.border}
              />
              <button
                type="submit"
                disabled={!msgText.trim() || sending}
                style={{
                  width: 42, height: 42, borderRadius: 12,
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
          </>
        )}
      </div>

      {/* ── Start New Conversation Modal ────────────────────────────── */}
      <ERPModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Start New Conversation"
        width={540}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, color: C.muted }}>
            Select a Staff Member or Client to start a direct 1-on-1 message thread:
          </div>

          {loadingContacts ? (
            <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>
              Loading members...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 400, overflowY: 'auto' }}>
              {/* Staff Section */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Briefcase size={12} /> Team & Staff ({contactList.staff.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {contactList.staff.map(s => (
                    <div
                      key={s.id}
                      onClick={() => startConversationWith(s, 'staff')}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`,
                        cursor: 'pointer', transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = C.green}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                    >
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{s.name}</div>
                        <div style={{ fontSize: 10.5, color: C.muted }}>{s.role} · {s.department || 'Staff'}</div>
                      </div>
                      <span style={{ fontSize: 10, color: C.cyan, fontWeight: 700 }}>Chat →</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Client Section */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.blue, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={12} /> Clients ({contactList.clients.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {contactList.clients.map(c => (
                    <div
                      key={c.id}
                      onClick={() => startConversationWith(c, 'client')}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`,
                        cursor: 'pointer', transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = C.blue}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                    >
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{c.name}</div>
                        <div style={{ fontSize: 10.5, color: C.muted }}>{c.company || c.email}</div>
                      </div>
                      <span style={{ fontSize: 10, color: C.cyan, fontWeight: 700 }}>Chat →</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </ERPModal>
    </div>
  );
}

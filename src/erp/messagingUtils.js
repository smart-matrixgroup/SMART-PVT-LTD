// ─────────────────────────────────────────────────────────────────
//  Phase 4 — SMART Unified Messaging System (Firestore + Dev Mock)
//  Admin <-> Staff and Admin <-> Client
//  Conversations are 1-on-1 between Admin and each Staff/Client.
// ─────────────────────────────────────────────────────────────────
import {
  collection, doc, getDoc, setDoc, addDoc, updateDoc,
  serverTimestamp, increment, query, orderBy, onSnapshot, getDocs, where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

export const getConversationId = (type, uid) => `admin_${type}_${uid}`;

export async function sendChatMessage({
  conversationId,
  type = 'client', // 'staff' | 'client'
  participantUid,
  participantName = 'Participant',
  participantRole = 'client',
  participantEmail = '',
  senderId,
  senderRole, // 'admin' | 'staff' | 'client'
  senderName,
  receiverId,
  receiverRole,
  receiverName,
  text,
  isLive = true,
}) {
  const cleanText = text.trim();
  if (!cleanText) return null;

  const now = new Date();
  const fallbackMessage = {
    id: `m_${Date.now()}`,
    conversationId,
    senderId,
    senderRole,
    senderName,
    receiverId,
    receiverRole,
    receiverName,
    text: cleanText,
    read: false,
    createdAt: now,
  };

  if (!isLive) {
    return fallbackMessage;
  }

  // 1. Update or create the parent conversation document
  const convRef = doc(db, 'conversations', conversationId);
  const convUpdate = {
    id: conversationId,
    type,
    participantUid,
    participantName,
    participantRole,
    participantEmail: participantEmail || '',
    lastMessage: cleanText,
    lastMessageAt: serverTimestamp(),
    lastSenderRole: senderRole,
    updatedAt: serverTimestamp(),
  };

  if (senderRole === 'admin') {
    convUpdate.unreadForParticipant = increment(1);
    convUpdate.unreadForAdmin = 0;
  } else {
    convUpdate.unreadForAdmin = increment(1);
    convUpdate.unreadForParticipant = 0;
  }

  await setDoc(convRef, convUpdate, { merge: true });

  // 2. Add message to the subcollection
  const msgRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    conversationId,
    senderId,
    senderRole,
    senderName,
    receiverId,
    receiverRole,
    receiverName,
    text: cleanText,
    read: false,
    createdAt: serverTimestamp(),
  });

  return { id: msgRef.id, ...fallbackMessage };
}

export async function markConversationAsRead(conversationId, currentRole, isLive = true) {
  if (!isLive || !conversationId) return;
  try {
    const convRef = doc(db, 'conversations', conversationId);
    if (currentRole === 'admin') {
      await updateDoc(convRef, { unreadForAdmin: 0, updatedAt: serverTimestamp() });
    } else {
      await updateDoc(convRef, { unreadForParticipant: 0, updatedAt: serverTimestamp() });
    }
  } catch (err) {
    // Ignore permissions/offline errors during read sync
  }
}

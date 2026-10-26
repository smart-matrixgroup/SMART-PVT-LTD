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

  // Unread badge follows the RECEIVER of the message: admin threads use
  // unreadForAdmin, client/staff participant threads use unreadForParticipant.
  if (receiverRole === 'admin') {
    convUpdate.unreadForAdmin = increment(1);
    convUpdate.unreadForParticipant = 0;
  } else {
    convUpdate.unreadForParticipant = increment(1);
    convUpdate.unreadForAdmin = 0;
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

// ── Sync Chat Access ──────────────────────────────────────────────
// Pre-creates / updates conversation documents for every client that has
// work assignments, stamping `assignedStaffUids` so the assigned staff
// members can read the thread and post messages (firestore.rules check).
// Returns the number of conversations synced.
export async function syncChatAccessForAllClients() {
  // 1. Fetch all work assignments
  const assignSnap = await getDocs(collection(db, 'workAssignments'));
  const assignments = assignSnap.docs.map(d => d.data());

  // 2. Group by clientId → Set of staff UIDs
  const byClient = {};
  assignments.forEach(a => {
    if (!a.clientId) return;
    if (!byClient[a.clientId]) {
      byClient[a.clientId] = {
        staffUids: new Set(),
        clientName: a.clientName || a.clientCompany || 'Client',
        clientEmail: a.clientEmail || '',
      };
    }
    if (a.authUid) byClient[a.clientId].staffUids.add(a.authUid);
  });

  // 3. For each client, upsert the conversation document
  let count = 0;
  for (const [clientId, info] of Object.entries(byClient)) {
    const convId = getConversationId('client', clientId);
    const convRef = doc(db, 'conversations', convId);
    const existing = await getDoc(convRef);
    const staffUids = Array.from(info.staffUids);

    if (existing.exists()) {
      // Merge assignedStaffUids (keep any already there)
      const prev = existing.data().assignedStaffUids || [];
      const merged = Array.from(new Set([...prev, ...staffUids]));
      await updateDoc(convRef, { assignedStaffUids: merged, updatedAt: serverTimestamp() });
    } else {
      // Create the conversation document
      await setDoc(convRef, {
        id: convId,
        type: 'client',
        participantUid: clientId,
        participantName: info.clientName,
        participantRole: 'client',
        participantEmail: info.clientEmail,
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastSenderRole: '',
        unreadForAdmin: 0,
        unreadForParticipant: 0,
        assignedStaffUids: staffUids,
      });
    }
    count++;
  }
  return count;
}

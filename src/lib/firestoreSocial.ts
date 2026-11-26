import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  CallType,
  ReceiptAiVerdict,
  UserProfile,
  VipBillingCycle,
} from '../types/social';

export const VIP_SUBSCRIPTION_DAYS = 30;
export const VIP_SUBSCRIPTION_MS = VIP_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;

export interface VoiceNotePayload {
  audioData: string;
  duration: number;
  fallbackText: string;
}

export function formatFirestoreTime(ts: unknown): {
  label: string;
  ms: number;
} {
  if (ts instanceof Timestamp) {
    const date = ts.toDate();
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return { label: 'Just now', ms: date.getTime() };
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return { label: `${diffMin}m ago`, ms: date.getTime() };
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return { label: `${diffHr}h ago`, ms: date.getTime() };
    return {
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ms: date.getTime(),
    };
  }
  return { label: 'Just now', ms: Date.now() };
}

function buildHandle(
  displayName: string | null,
  email: string | null,
  phoneNumber: string | null,
  uid: string,
): string {
  const phoneDigits = phoneNumber ? phoneNumber.replace(/\D/g, '') : '';
  const baseSource =
    displayName ||
    email?.split('@')[0] ||
    (phoneDigits ? `member_${phoneDigits.slice(-4)}` : 'member');
  const cleaned = baseSource
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const prefix = cleaned.slice(0, 20) || 'member';
  const suffix = uid.slice(0, 4).replace(/[^a-zA-Z0-9_]/g, '0');
  return `@${prefix}_${suffix}`.slice(0, 40);
}

function isTransientOfflineError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (code === 'unavailable') return true;
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return (
    msg.includes('client is offline') ||
    msg.includes('could not reach cloud firestore')
  );
}

async function retryOnOffline<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientOfflineError(error) || i === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500 * (i + 1)));
    }
  }
  throw lastError;
}

export async function ensureUserProfile(user: User): Promise<boolean> {
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await retryOnOffline(() => getDoc(userRef));

    if (!snap.exists()) {
      const displayName = (
        user.displayName ||
        user.email?.split('@')[0] ||
        'World Connection Member'
      )
        .trim()
        .slice(0, 80);

      await setDoc(userRef, {
        uid: user.uid,
        name: displayName || 'Member',
        handle: buildHandle(
          user.displayName,
          user.email,
          user.phoneNumber,
          user.uid,
        ),
        bio: 'My Social Profile',
        avatarUrl: (user.photoURL || '').slice(0, 160000),
        isPublic: true,
        isOnline: true,
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (
      user.displayName &&
      user.displayName.trim() &&
      (snap.data().name === 'Al Amana Member' ||
        snap.data().name === 'World Connection Member')
    ) {
      await updateDoc(userRef, {
        name: user.displayName.trim().slice(0, 80),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    if (isTransientOfflineError(error)) {
      return false;
    }
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const privateRef = doc(db, 'users', user.uid, 'private', 'info');
    const privateSnap = await retryOnOffline(() => getDoc(privateRef));
    if (!privateSnap.exists()) {
      const privatePayload: Record<string, unknown> = {
        uid: user.uid,
        updatedAt: serverTimestamp(),
      };
      if (user.email && user.email.trim().length >= 3) {
        privatePayload.email = user.email.trim().slice(0, 254);
      }
      if (user.phoneNumber && user.phoneNumber.trim().length >= 5) {
        privatePayload.phoneNumber = user.phoneNumber.trim().slice(0, 32);
      }
      if (!('email' in privatePayload) && !('phoneNumber' in privatePayload)) {
        privatePayload.email = 'member@example.com';
      }
      await setDoc(privateRef, privatePayload);
    }
  } catch (error) {
    if (isTransientOfflineError(error)) {
      return false;
    }
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }

  return true;
}

export async function syncUserDisplayName(
  uid: string,
  displayName: string,
): Promise<void> {
  const cleanName = displayName.trim().slice(0, 80);
  if (!cleanName) return;
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await retryOnOffline(() => getDoc(userRef));
    if (snap.exists() && snap.data().name !== cleanName) {
      await updateDoc(userRef, {
        name: cleanName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    if (isTransientOfflineError(error)) return;
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPresence(
  uid: string,
  isOnline: boolean,
): Promise<void> {
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      isOnline,
      lastActiveAt: serverTimestamp(),
    });
  } catch {
    // Ignore transient offline or signed-out presence update errors
  }
}

export async function compressAvatarImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a JPEG, PNG, or WebP image.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the selected image.'));
      el.src = objectUrl;
    });

    const side = Math.max(1, Math.min(img.width, img.height));
    const sx = Math.floor((img.width - side) / 2);
    const sy = Math.floor((img.height - side) / 2);

    const targetSize = 224;
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas is unavailable for image compression.');
    }
    ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);

    for (const quality of [0.8, 0.65, 0.5, 0.35]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= 150000) {
        return dataUrl;
      }
    }

    canvas.width = 144;
    canvas.height = 144;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, 144, 144);
    const smallUrl = canvas.toDataURL('image/jpeg', 0.45);
    if (smallUrl.length > 155000) {
      throw new Error('Selected image is too large. Please try a smaller photo.');
    }
    return smallUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function createFirestorePost(
  author: UserProfile,
  text: string,
): Promise<void> {
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return;

  const postRef = doc(collection(db, 'posts'));
  const path = `posts/${postRef.id}`;
  const safeAvatar =
    author.avatarUrl && author.avatarUrl.length <= 160000 ? author.avatarUrl : '';

  try {
    await setDoc(postRef, {
      authorId: author.id,
      authorName: author.name.slice(0, 80),
      authorHandle: author.handle.slice(0, 40),
      authorAvatarUrl: safeAvatar,
      text: trimmed,
      likesCount: 0,
      commentsCount: 0,
      visibility: 'public',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleFirestoreLike(params: {
  postId: string;
  userId: string;
  actorName: string;
  postAuthorId: string;
  currentlyLiked: boolean;
}): Promise<void> {
  const { postId, userId, actorName, postAuthorId, currentlyLiked } = params;
  const postRef = doc(db, 'posts', postId);
  const likeRef = doc(db, 'posts', postId, 'likes', userId);
  const path = `posts/${postId}`;

  try {
    const batch = writeBatch(db);
    if (currentlyLiked) {
      batch.delete(likeRef);
      batch.update(postRef, { likesCount: increment(-1) });
    } else {
      batch.set(likeRef, {
        userId,
        createdAt: serverTimestamp(),
      });
      batch.update(postRef, { likesCount: increment(1) });
    }
    await batch.commit();

    if (!currentlyLiked && postAuthorId !== userId) {
      await createNotification({
        recipientId: postAuthorId,
        actorId: userId,
        actorName,
        type: 'like',
        message: 'liked your post',
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addFirestoreComment(params: {
  postId: string;
  author: UserProfile;
  postAuthorId: string;
  text: string;
}): Promise<void> {
  const { postId, author, postAuthorId, text } = params;
  const trimmed = text.trim().slice(0, 1000);
  if (!trimmed) return;

  const postRef = doc(db, 'posts', postId);
  const commentRef = doc(collection(db, 'posts', postId, 'comments'));
  const path = `posts/${postId}/comments/${commentRef.id}`;

  try {
    const batch = writeBatch(db);
    batch.set(commentRef, {
      postId,
      authorId: author.id,
      authorName: author.name.slice(0, 80),
      authorHandle: author.handle.slice(0, 40),
      text: trimmed,
      createdAt: serverTimestamp(),
    });
    batch.update(postRef, { commentsCount: increment(1) });
    await batch.commit();

    if (postAuthorId !== author.id) {
      await createNotification({
        recipientId: postAuthorId,
        actorId: author.id,
        actorName: author.name,
        type: 'comment',
        message: 'commented on your post',
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveFirestorePostAnalysis(
  postId: string,
  analysis: string,
): Promise<void> {
  const path = `posts/${postId}`;
  try {
    await updateDoc(doc(db, 'posts', postId), {
      analysis: analysis.slice(0, 6000),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleFirestoreFollow(params: {
  currentUserId: string;
  currentUserName: string;
  targetUserId: string;
  currentlyFollowing: boolean;
}): Promise<void> {
  const { currentUserId, currentUserName, targetUserId, currentlyFollowing } =
    params;
  if (currentUserId === targetUserId) return;

  const followId = `${currentUserId}_${targetUserId}`;
  const followRef = doc(db, 'follows', followId);
  const path = `follows/${followId}`;

  try {
    if (currentlyFollowing) {
      await deleteDoc(followRef);
    } else {
      await setDoc(followRef, {
        followerId: currentUserId,
        targetId: targetUserId,
        createdAt: serverTimestamp(),
      });
      await createNotification({
        recipientId: targetUserId,
        actorId: currentUserId,
        actorName: currentUserName,
        type: 'follow',
        message: 'followed you',
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateFirestoreProfile(
  uid: string,
  name: string,
  bio: string,
  avatarUrl?: string,
): Promise<void> {
  const path = `users/${uid}`;
  const payload: Record<string, unknown> = {
    name: name.trim().slice(0, 80),
    bio: bio.trim().slice(0, 280),
    updatedAt: serverTimestamp(),
  };
  if (avatarUrl !== undefined) {
    const cleanAvatar = avatarUrl.trim();
    if (
      cleanAvatar === '' ||
      ((/^https?:\/\//i.test(cleanAvatar) ||
        /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(cleanAvatar)) &&
        cleanAvatar.length <= 160000)
    ) {
      payload.avatarUrl = cleanAvatar;
    }
  }
  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function sendFirestoreDirectMessage(params: {
  senderId: string;
  recipientId: string;
  text: string;
  voice?: VoiceNotePayload;
}): Promise<void> {
  const { senderId, recipientId, text, voice } = params;
  const effectiveText = (voice ? voice.fallbackText : text).trim().slice(0, 2000);
  if (!effectiveText || senderId === recipientId) return;
  if (
    voice &&
    (!voice.audioData.startsWith('data:audio/') ||
      voice.audioData.length > 350000)
  ) {
    throw new Error('Voice message exceeds size limit.');
  }

  const sorted = [senderId, recipientId].sort();
  const threadId = `${sorted[0]}_${sorted[1]}`;
  const threadRef = doc(db, 'chats', threadId);
  const messageRef = doc(collection(db, 'chats', threadId, 'messages'));
  const threadPath = `chats/${threadId}`;
  const messagePath = `chats/${threadId}/messages/${messageRef.id}`;

  let currentOp: OperationType = OperationType.GET;
  let currentPath = threadPath;

  try {
    const threadSnap = await retryOnOffline(() => getDoc(threadRef));
    if (!threadSnap.exists()) {
      currentOp = OperationType.CREATE;
      await setDoc(threadRef, {
        participantA: sorted[0],
        participantB: sorted[1],
        lastMessage: effectiveText.slice(0, 1000),
        lastSenderId: senderId,
        unreadCountA: senderId === sorted[0] ? 0 : 1,
        unreadCountB: senderId === sorted[1] ? 0 : 1,
        updatedAt: serverTimestamp(),
      });
    } else {
      currentOp = OperationType.UPDATE;
      await updateDoc(threadRef, {
        lastMessage: effectiveText.slice(0, 1000),
        lastSenderId: senderId,
        unreadCountA: senderId === sorted[0] ? 0 : increment(1),
        unreadCountB: senderId === sorted[1] ? 0 : increment(1),
        updatedAt: serverTimestamp(),
      });
    }

    currentOp = OperationType.CREATE;
    currentPath = messagePath;
    const payload: Record<string, unknown> = {
      senderId,
      recipientId,
      text: effectiveText,
      read: false,
      createdAt: serverTimestamp(),
    };
    if (voice) {
      payload.messageType = 'voice';
      payload.audioData = voice.audioData;
      payload.audioDuration = Math.max(
        0,
        Math.min(120, Math.round(voice.duration)),
      );
    }
    await setDoc(messageRef, payload);
  } catch (error) {
    handleFirestoreError(error, currentOp, currentPath);
  }
}

export async function markDirectMessagesRead(params: {
  threadId: string;
  currentUserId: string;
  unreadMessageIds: string[];
  shouldClearThreadBadge: boolean;
}): Promise<void> {
  const { threadId, currentUserId, unreadMessageIds, shouldClearThreadBadge } =
    params;
  if (unreadMessageIds.length === 0 && !shouldClearThreadBadge) return;
  const parts = threadId.split('_');
  if (parts.length !== 2) return;

  try {
    const batch = writeBatch(db);
    for (const msgId of unreadMessageIds.slice(0, 400)) {
      batch.update(doc(db, 'chats', threadId, 'messages', msgId), {
        read: true,
      });
    }
    if (shouldClearThreadBadge) {
      const isA = parts[0] === currentUserId;
      batch.update(
        doc(db, 'chats', threadId),
        isA ? { unreadCountA: 0 } : { unreadCountB: 0 },
      );
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${threadId}`);
  }
}

async function createNotification(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  type: 'like' | 'follow' | 'comment';
  message: string;
}): Promise<void> {
  const notifRef = doc(collection(db, 'notifications'));
  const path = `notifications/${notifRef.id}`;
  try {
    await setDoc(notifRef, {
      recipientId: params.recipientId,
      actorId: params.actorId,
      actorName: params.actorName.slice(0, 80),
      type: params.type,
      message: params.message.slice(0, 240),
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markFirestoreNotificationRead(
  notifId: string,
): Promise<void> {
  const path = `notifications/${notifId}`;
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllFirestoreNotificationsRead(
  unreadIds: string[],
): Promise<void> {
  if (unreadIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of unreadIds) {
      batch.update(doc(db, 'notifications', id), { read: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

export async function createFirestoreGroup(params: {
  creatorId: string;
  name: string;
  description: string;
  memberIds: string[];
}): Promise<string> {
  const cleanName = params.name.trim().slice(0, 80);
  if (!cleanName) {
    throw new Error('Group name is required.');
  }
  const uniqueMembers = Array.from(
    new Set([params.creatorId, ...params.memberIds]),
  ).slice(0, 50);

  const groupRef = doc(collection(db, 'groups'));
  const path = `groups/${groupRef.id}`;
  try {
    await setDoc(groupRef, {
      creatorId: params.creatorId,
      name: cleanName,
      description: params.description.trim().slice(0, 280),
      memberIds: uniqueMembers,
      lastMessage: '',
      lastSenderId: params.creatorId,
      messageSeq: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return groupRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFirestoreGroupMembers(params: {
  groupId: string;
  creatorId: string;
  memberIds: string[];
}): Promise<void> {
  const uniqueMembers = Array.from(
    new Set([params.creatorId, ...params.memberIds]),
  ).slice(0, 50);
  const path = `groups/${params.groupId}`;
  try {
    await updateDoc(doc(db, 'groups', params.groupId), {
      memberIds: uniqueMembers,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function sendFirestoreGroupMessage(params: {
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  voice?: VoiceNotePayload;
}): Promise<void> {
  const effectiveText = (
    params.voice ? params.voice.fallbackText : params.text
  )
    .trim()
    .slice(0, 2000);
  if (!effectiveText) return;
  if (
    params.voice &&
    (!params.voice.audioData.startsWith('data:audio/') ||
      params.voice.audioData.length > 350000)
  ) {
    throw new Error('Voice message exceeds size limit.');
  }

  const groupRef = doc(db, 'groups', params.groupId);
  const msgRef = doc(collection(db, 'groups', params.groupId, 'messages'));
  const readStateRef = doc(
    db,
    'users',
    params.senderId,
    'readStates',
    `group_${params.groupId}`,
  );
  const receiptRef = doc(
    db,
    'groups',
    params.groupId,
    'readReceipts',
    params.senderId,
  );
  const path = `groups/${params.groupId}/messages/${msgRef.id}`;

  try {
    const groupSnap = await retryOnOffline(() => getDoc(groupRef));
    if (!groupSnap.exists()) return;
    const rawMembers = groupSnap.data().memberIds;
    const visibleTo = Array.isArray(rawMembers)
      ? rawMembers.filter((id): id is string => typeof id === 'string').slice(0, 50)
      : [params.senderId];
    const nextSeq = Math.max(0, Number(groupSnap.data().messageSeq ?? 0)) + 1;

    const batch = writeBatch(db);
    const msgPayload: Record<string, unknown> = {
      groupId: params.groupId,
      senderId: params.senderId,
      senderName: params.senderName.trim().slice(0, 80) || 'Member',
      visibleTo,
      text: effectiveText,
      seq: nextSeq,
      createdAt: serverTimestamp(),
    };
    if (params.voice) {
      msgPayload.messageType = 'voice';
      msgPayload.audioData = params.voice.audioData;
      msgPayload.audioDuration = Math.max(
        0,
        Math.min(120, Math.round(params.voice.duration)),
      );
    }
    batch.set(msgRef, msgPayload);
    batch.update(groupRef, {
      lastMessage: `${params.senderName.trim().slice(0, 24)}: ${effectiveText}`.slice(0, 1000),
      lastSenderId: params.senderId,
      messageSeq: increment(1),
      updatedAt: serverTimestamp(),
    });
    batch.set(readStateRef, {
      userId: params.senderId,
      roomId: `group_${params.groupId}`,
      lastReadSeq: nextSeq,
      updatedAt: serverTimestamp(),
    });
    batch.set(receiptRef, {
      userId: params.senderId,
      groupId: params.groupId,
      visibleTo,
      lastReadAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markRoomReadCursor(params: {
  userId: string;
  roomKey: string;
  seq: number;
}): Promise<void> {
  if (!params.userId || !params.roomKey || params.seq < 0) return;
  const path = `users/${params.userId}/readStates/${params.roomKey}`;
  try {
    await setDoc(doc(db, 'users', params.userId, 'readStates', params.roomKey), {
      userId: params.userId,
      roomId: params.roomKey,
      lastReadSeq: Math.max(0, Math.round(params.seq)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertGroupReadReceipt(params: {
  groupId: string;
  userId: string;
  visibleTo: string[];
}): Promise<void> {
  if (!params.groupId || !params.userId || params.visibleTo.length === 0) return;
  const path = `groups/${params.groupId}/readReceipts/${params.userId}`;
  try {
    await setDoc(doc(db, 'groups', params.groupId, 'readReceipts', params.userId), {
      userId: params.userId,
      groupId: params.groupId,
      visibleTo: params.visibleTo.slice(0, 50),
      lastReadAt: serverTimestamp(),
    });
  } catch {
    // Ignore transient membership sync lag on receipt update
  }
}

export async function createFirestoreChannel(params: {
  creatorId: string;
  creatorName: string;
  name: string;
  description: string;
  isVip?: boolean;
  vipBillingCycle?: VipBillingCycle;
  vipPriceLabel?: string;
  vipPaymentInfo?: string;
}): Promise<string> {
  const cleanName = params.name.trim().slice(0, 80);
  if (!cleanName) {
    throw new Error('Channel name is required.');
  }

  const isVip = Boolean(params.isVip);
  const billingCycle: VipBillingCycle =
    params.vipBillingCycle === 'once' ? 'once' : 'monthly';
  const channelRef = doc(collection(db, 'channels'));
  const path = `channels/${channelRef.id}`;
  const payload: Record<string, unknown> = {
    creatorId: params.creatorId,
    creatorName: params.creatorName.trim().slice(0, 80) || 'Member',
    name: cleanName,
    description: params.description.trim().slice(0, 280),
    followersCount: 0,
    lastMessage: isVip ? 'VIP Channel · Membobin VIP kaɗai' : '',
    messageSeq: 0,
    visibility: 'public',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (isVip) {
    payload.isVip = true;
    payload.vipBillingCycle = billingCycle;
    payload.vipPriceLabel = (params.vipPriceLabel ?? '').trim().slice(0, 60);
    payload.vipPaymentInfo = (params.vipPaymentInfo ?? '').trim().slice(0, 500);
    payload.vipMemberIds = [params.creatorId];
  }

  try {
    await setDoc(channelRef, payload);
    return channelRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFirestoreChannelVipSettings(params: {
  channelId: string;
  creatorId: string;
  vipBillingCycle: VipBillingCycle;
  vipPriceLabel: string;
  vipPaymentInfo: string;
}): Promise<void> {
  const channelRef = doc(db, 'channels', params.channelId);
  const path = `channels/${params.channelId}`;
  try {
    const snap = await retryOnOffline(() => getDoc(channelRef));
    if (!snap.exists()) return;
    const rawVip = snap.data().vipMemberIds;
    const existingIds = Array.isArray(rawVip)
      ? rawVip.filter((id): id is string => typeof id === 'string')
      : [];
    const nextVipIds = Array.from(
      new Set([params.creatorId, ...existingIds]),
    ).slice(0, 50);

    await updateDoc(channelRef, {
      isVip: true,
      vipBillingCycle: params.vipBillingCycle === 'once' ? 'once' : 'monthly',
      vipPriceLabel: params.vipPriceLabel.trim().slice(0, 60),
      vipPaymentInfo: params.vipPaymentInfo.trim().slice(0, 500),
      vipMemberIds: nextVipIds,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function grantChannelVipAccess(params: {
  channelId: string;
  creatorId: string;
  userId: string;
}): Promise<void> {
  if (!params.userId || params.userId === params.creatorId) return;
  const channelRef = doc(db, 'channels', params.channelId);
  const memberRef = doc(
    db,
    'channels',
    params.channelId,
    'vipMembers',
    params.userId,
  );
  const path = `channels/${params.channelId}/vipMembers/${params.userId}`;

  try {
    const [channelSnap, memberSnap] = await Promise.all([
      retryOnOffline(() => getDoc(channelRef)),
      retryOnOffline(() => getDoc(memberRef)),
    ]);
    if (!channelSnap.exists()) return;
    const rawVip = channelSnap.data().vipMemberIds;
    const existingIds = Array.isArray(rawVip)
      ? rawVip.filter((id): id is string => typeof id === 'string')
      : [];
    const nextVipIds = Array.from(
      new Set([params.creatorId, ...existingIds, params.userId]),
    ).slice(0, 50);

    const postsSnap = await getDocs(
      query(
        collection(db, 'channels', params.channelId, 'posts'),
        where('channelId', '==', params.channelId),
        where('visibility', '==', 'vip'),
      ),
    );

    const isOneTime = channelSnap.data().vipBillingCycle === 'once';
    const existingExpires = memberSnap.exists()
      ? memberSnap.data().expiresAt
      : null;
    const nowMs = Date.now();
    const baseMs =
      existingExpires instanceof Timestamp && existingExpires.toMillis() > nowMs
        ? existingExpires.toMillis()
        : nowMs;
    const nextExpiresAt = Timestamp.fromMillis(baseMs + VIP_SUBSCRIPTION_MS);

    const batch = writeBatch(db);
    if (memberSnap.exists()) {
      if (isOneTime) {
        batch.update(memberRef, {
          grantedBy: params.creatorId,
          accessMode: 'lifetime',
          expiresAt: deleteField(),
          durationDays: deleteField(),
        });
      } else {
        batch.update(memberRef, {
          grantedBy: params.creatorId,
          accessMode: 'monthly',
          expiresAt: nextExpiresAt,
          durationDays: VIP_SUBSCRIPTION_DAYS,
        });
      }
    } else if (isOneTime) {
      batch.set(memberRef, {
        userId: params.userId,
        channelId: params.channelId,
        grantedBy: params.creatorId,
        accessMode: 'lifetime',
        createdAt: serverTimestamp(),
      });
    } else {
      batch.set(memberRef, {
        userId: params.userId,
        channelId: params.channelId,
        grantedBy: params.creatorId,
        accessMode: 'monthly',
        expiresAt: nextExpiresAt,
        durationDays: VIP_SUBSCRIPTION_DAYS,
        createdAt: serverTimestamp(),
      });
    }
    batch.update(channelRef, {
      isVip: true,
      vipMemberIds: nextVipIds,
      updatedAt: serverTimestamp(),
    });
    for (const postDoc of postsSnap.docs) {
      batch.update(postDoc.ref, { visibleTo: nextVipIds });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function revokeChannelVipAccess(params: {
  channelId: string;
  creatorId: string;
  userId: string;
}): Promise<void> {
  if (!params.userId || params.userId === params.creatorId) return;
  const channelRef = doc(db, 'channels', params.channelId);
  const memberRef = doc(
    db,
    'channels',
    params.channelId,
    'vipMembers',
    params.userId,
  );
  const path = `channels/${params.channelId}/vipMembers/${params.userId}`;

  try {
    const channelSnap = await retryOnOffline(() => getDoc(channelRef));
    if (!channelSnap.exists()) return;
    const rawVip = channelSnap.data().vipMemberIds;
    const existingIds = Array.isArray(rawVip)
      ? rawVip.filter(
          (id): id is string => typeof id === 'string' && id !== params.userId,
        )
      : [];
    const nextVipIds = Array.from(
      new Set([params.creatorId, ...existingIds]),
    ).slice(0, 50);

    const postsSnap = await getDocs(
      query(
        collection(db, 'channels', params.channelId, 'posts'),
        where('channelId', '==', params.channelId),
        where('visibility', '==', 'vip'),
      ),
    );

    const batch = writeBatch(db);
    batch.delete(memberRef);
    batch.update(channelRef, {
      vipMemberIds: nextVipIds,
      updatedAt: serverTimestamp(),
    });
    for (const postDoc of postsSnap.docs) {
      batch.update(postDoc.ref, { visibleTo: nextVipIds });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function pruneExpiredChannelVipMembers(params: {
  channelId: string;
  creatorId: string;
}): Promise<number> {
  const channelRef = doc(db, 'channels', params.channelId);
  const path = `channels/${params.channelId}`;
  try {
    const [channelSnap, membersSnap] = await Promise.all([
      retryOnOffline(() => getDoc(channelRef)),
      getDocs(
        query(
          collection(db, 'channels', params.channelId, 'vipMembers'),
          where('grantedBy', '==', params.creatorId),
        ),
      ),
    ]);
    if (!channelSnap.exists()) return 0;
    if (channelSnap.data().vipBillingCycle === 'once') return 0;

    const nowMs = Date.now();
    const expiredIds = new Set<string>();
    for (const d of membersSnap.docs) {
      const data = d.data();
      if (data.accessMode === 'lifetime') continue;
      const expiresAt = data.expiresAt;
      if (expiresAt instanceof Timestamp && expiresAt.toMillis() <= nowMs) {
        expiredIds.add(d.id);
      }
    }

    const rawVip = channelSnap.data().vipMemberIds;
    const existingIds = Array.isArray(rawVip)
      ? rawVip.filter((id): id is string => typeof id === 'string')
      : [];
    const removedCount = existingIds.filter(
      (id) => id !== params.creatorId && expiredIds.has(id),
    ).length;
    if (removedCount === 0) return 0;

    const nextVipIds = Array.from(
      new Set([
        params.creatorId,
        ...existingIds.filter((id) => !expiredIds.has(id)),
      ]),
    ).slice(0, 50);

    const postsSnap = await getDocs(
      query(
        collection(db, 'channels', params.channelId, 'posts'),
        where('channelId', '==', params.channelId),
        where('visibility', '==', 'vip'),
      ),
    );

    const batch = writeBatch(db);
    batch.update(channelRef, {
      vipMemberIds: nextVipIds,
      updatedAt: serverTimestamp(),
    });
    for (const postDoc of postsSnap.docs) {
      batch.update(postDoc.ref, { visibleTo: nextVipIds });
    }
    await batch.commit();
    return removedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function compressReceiptImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Zaɓi hoton rasit (JPEG ko PNG) kaɗai.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Ba a iya karanta wannan hoton ba.'));
      el.src = objectUrl;
    });

    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height, 1));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas is unavailable for image compression.');
    }
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of [0.72, 0.58, 0.45, 0.35]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= 290000) {
        return dataUrl;
      }
    }

    // Fallback smaller scale if still over 290KB
    canvas.width = Math.max(1, Math.round(width * 0.65));
    canvas.height = Math.max(1, Math.round(height * 0.65));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const smallUrl = canvas.toDataURL('image/jpeg', 0.5);
    if (smallUrl.length > 340000) {
      throw new Error('Hoton rasit ya yi girma sosai. Gwada ɗaukar ƙaramin screenshot.');
    }
    return smallUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function verifyReceiptWithAi(params: {
  amountText: string;
  referenceText: string;
  note: string;
  receiptImage?: string;
  vipPriceLabel?: string;
  vipPaymentInfo?: string;
  channelName?: string;
  language?: 'ha' | 'en';
}): Promise<{ verdict: ReceiptAiVerdict; summary: string }> {
  try {
    const res = await fetch('/api/verify-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountText: params.amountText,
        referenceText: params.referenceText,
        note: params.note,
        receiptImage: params.receiptImage,
        vipPriceLabel: params.vipPriceLabel,
        vipPaymentInfo: params.vipPaymentInfo,
        channelName: params.channelName,
      }),
    });
    if (!res.ok) {
      return {
        verdict: 'unavailable',
        summary:
          params.language === 'en'
            ? 'Automated check unavailable; creator will confirm bank alert manually.'
            : 'Ba a sami tantancewa ta atomatik ba; mai channel zai duba alert da kansa.',
      };
    }
    const data = (await res.json()) as {
      verdict?: unknown;
      summaryHa?: unknown;
      summaryEn?: unknown;
    };
    const verdict: ReceiptAiVerdict =
      data.verdict === 'match' ||
      data.verdict === 'review' ||
      data.verdict === 'mismatch'
        ? data.verdict
        : 'review';
    const rawSummary =
      params.language === 'en' ? data.summaryEn : data.summaryHa;
    const summary =
      typeof rawSummary === 'string' && rawSummary.trim()
        ? rawSummary.trim().slice(0, 950)
        : params.language === 'en'
          ? 'Receipt screened; creator should confirm bank alert.'
          : 'An duba rasit; mai channel ya tabbatar da alert.';
    return { verdict, summary };
  } catch {
    return {
      verdict: 'unavailable',
      summary:
        params.language === 'en'
          ? 'Automated check unavailable; creator will confirm bank alert manually.'
          : 'Ba a sami tantancewa ta atomatik ba; mai channel zai duba alert da kansa.',
    };
  }
}

export async function submitChannelVipReceipt(params: {
  channelId: string;
  creatorId: string;
  channelName: string;
  vipPriceLabel?: string;
  vipPaymentInfo?: string;
  user: UserProfile;
  amountText: string;
  referenceText: string;
  note: string;
  receiptImage?: string;
  language?: 'ha' | 'en';
}): Promise<{ id: string; verdict: ReceiptAiVerdict; summary: string }> {
  const cleanAmount = params.amountText.trim().slice(0, 60);
  const cleanRef = params.referenceText.trim().slice(0, 120);
  const cleanNote = params.note.trim().slice(0, 500);
  const cleanImage = params.receiptImage?.trim() || '';

  if (!cleanAmount && !cleanImage) {
    throw new Error('Amount paid or receipt screenshot is required.');
  }

  const effectiveAmount = cleanAmount || params.vipPriceLabel?.trim().slice(0, 60) || 'VIP Payment';

  const screening = await verifyReceiptWithAi({
    amountText: effectiveAmount,
    referenceText: cleanRef,
    note: cleanNote,
    receiptImage: cleanImage || undefined,
    vipPriceLabel: params.vipPriceLabel,
    vipPaymentInfo: params.vipPaymentInfo,
    channelName: params.channelName,
    language: params.language,
  });

  const receiptRef = doc(
    collection(db, 'channels', params.channelId, 'vipReceipts'),
  );
  const path = `channels/${params.channelId}/vipReceipts/${receiptRef.id}`;

  const payload: Record<string, unknown> = {
    channelId: params.channelId,
    creatorId: params.creatorId,
    userId: params.user.id,
    userName: params.user.name.trim().slice(0, 80) || 'Member',
    userHandle: params.user.handle.trim().slice(0, 40) || '@member',
    amountText: effectiveAmount,
    referenceText: cleanRef,
    note: cleanNote,
    status: 'pending',
    aiVerdict: screening.verdict,
    aiSummary: screening.summary.slice(0, 1000),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (
    cleanImage &&
    cleanImage.length >= 10 &&
    cleanImage.length <= 350000 &&
    /^data:image\/(jpeg|jpg|png|webp);base64,/.test(cleanImage)
  ) {
    payload.receiptImage = cleanImage;
  }

  try {
    await setDoc(receiptRef, payload);
    return {
      id: receiptRef.id,
      verdict: screening.verdict,
      summary: screening.summary,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function approveChannelVipReceipt(params: {
  channelId: string;
  receiptId: string;
  creatorId: string;
  subscriberId: string;
}): Promise<void> {
  const receiptRef = doc(
    db,
    'channels',
    params.channelId,
    'vipReceipts',
    params.receiptId,
  );
  const channelRef = doc(db, 'channels', params.channelId);
  const memberRef = doc(
    db,
    'channels',
    params.channelId,
    'vipMembers',
    params.subscriberId,
  );
  const path = `channels/${params.channelId}/vipReceipts/${params.receiptId}`;

  try {
    const [channelSnap, memberSnap] = await Promise.all([
      retryOnOffline(() => getDoc(channelRef)),
      retryOnOffline(() => getDoc(memberRef)),
    ]);
    if (!channelSnap.exists()) return;

    const rawVip = channelSnap.data().vipMemberIds;
    const existingIds = Array.isArray(rawVip)
      ? rawVip.filter((id): id is string => typeof id === 'string')
      : [];
    const nextVipIds = Array.from(
      new Set([params.creatorId, ...existingIds, params.subscriberId]),
    ).slice(0, 50);

    const postsSnap = await getDocs(
      query(
        collection(db, 'channels', params.channelId, 'posts'),
        where('channelId', '==', params.channelId),
        where('visibility', '==', 'vip'),
      ),
    );

    const isOneTime = channelSnap.data().vipBillingCycle === 'once';
    const existingExpires = memberSnap.exists()
      ? memberSnap.data().expiresAt
      : null;
    const nowMs = Date.now();
    const baseMs =
      existingExpires instanceof Timestamp && existingExpires.toMillis() > nowMs
        ? existingExpires.toMillis()
        : nowMs;
    const nextExpiresAt = Timestamp.fromMillis(baseMs + VIP_SUBSCRIPTION_MS);

    const batch = writeBatch(db);
    batch.update(receiptRef, {
      status: 'approved',
      reviewedBy: params.creatorId,
      updatedAt: serverTimestamp(),
    });
    if (memberSnap.exists()) {
      if (isOneTime) {
        batch.update(memberRef, {
          grantedBy: params.creatorId,
          accessMode: 'lifetime',
          expiresAt: deleteField(),
          durationDays: deleteField(),
        });
      } else {
        batch.update(memberRef, {
          grantedBy: params.creatorId,
          accessMode: 'monthly',
          expiresAt: nextExpiresAt,
          durationDays: VIP_SUBSCRIPTION_DAYS,
        });
      }
    } else if (isOneTime) {
      batch.set(memberRef, {
        userId: params.subscriberId,
        channelId: params.channelId,
        grantedBy: params.creatorId,
        accessMode: 'lifetime',
        createdAt: serverTimestamp(),
      });
    } else {
      batch.set(memberRef, {
        userId: params.subscriberId,
        channelId: params.channelId,
        grantedBy: params.creatorId,
        accessMode: 'monthly',
        expiresAt: nextExpiresAt,
        durationDays: VIP_SUBSCRIPTION_DAYS,
        createdAt: serverTimestamp(),
      });
    }
    batch.update(channelRef, {
      isVip: true,
      vipMemberIds: nextVipIds,
      updatedAt: serverTimestamp(),
    });
    for (const postDoc of postsSnap.docs) {
      batch.update(postDoc.ref, { visibleTo: nextVipIds });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function rejectChannelVipReceipt(params: {
  channelId: string;
  receiptId: string;
  creatorId: string;
}): Promise<void> {
  const path = `channels/${params.channelId}/vipReceipts/${params.receiptId}`;
  try {
    await updateDoc(
      doc(db, 'channels', params.channelId, 'vipReceipts', params.receiptId),
      {
        status: 'rejected',
        reviewedBy: params.creatorId,
        updatedAt: serverTimestamp(),
      },
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleFirestoreChannelFollow(params: {
  channelId: string;
  userId: string;
  currentlyFollowing: boolean;
}): Promise<void> {
  const channelRef = doc(db, 'channels', params.channelId);
  const followerRef = doc(
    db,
    'channels',
    params.channelId,
    'followers',
    params.userId,
  );
  const path = `channels/${params.channelId}`;

  try {
    const batch = writeBatch(db);
    if (params.currentlyFollowing) {
      batch.delete(followerRef);
      batch.update(channelRef, { followersCount: increment(-1) });
    } else {
      batch.set(followerRef, {
        userId: params.userId,
        createdAt: serverTimestamp(),
      });
      batch.update(channelRef, { followersCount: increment(1) });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function publishFirestoreChannelPost(params: {
  channelId: string;
  authorId: string;
  authorName: string;
  text: string;
  voice?: VoiceNotePayload;
}): Promise<void> {
  const effectiveText = (
    params.voice ? params.voice.fallbackText : params.text
  )
    .trim()
    .slice(0, 2000);
  if (!effectiveText) return;
  if (
    params.voice &&
    (!params.voice.audioData.startsWith('data:audio/') ||
      params.voice.audioData.length > 350000)
  ) {
    throw new Error('Voice message exceeds size limit.');
  }

  const channelRef = doc(db, 'channels', params.channelId);
  const postRef = doc(collection(db, 'channels', params.channelId, 'posts'));
  const path = `channels/${params.channelId}/posts/${postRef.id}`;

  try {
    const channelSnap = await retryOnOffline(() => getDoc(channelRef));
    if (!channelSnap.exists()) return;
    const channelData = channelSnap.data();
    const isVip = Boolean(channelData.isVip);

    const batch = writeBatch(db);
    const postPayload: Record<string, unknown> = {
      channelId: params.channelId,
      authorId: params.authorId,
      authorName: params.authorName.trim().slice(0, 80) || 'Member',
      text: effectiveText,
      visibility: isVip ? 'vip' : 'public',
      createdAt: serverTimestamp(),
    };

    if (isVip) {
      const rawVip = channelData.vipMemberIds;
      const existingVip = Array.isArray(rawVip)
        ? rawVip.filter((id): id is string => typeof id === 'string')
        : [];
      postPayload.visibleTo = Array.from(
        new Set([params.authorId, ...existingVip]),
      ).slice(0, 50);
    }

    if (params.voice) {
      postPayload.messageType = 'voice';
      postPayload.audioData = params.voice.audioData;
      postPayload.audioDuration = Math.max(
        0,
        Math.min(120, Math.round(params.voice.duration)),
      );
    }
    const nextSeq = Math.max(0, Number(channelData.messageSeq ?? 0)) + 1;
    const readStateRef = doc(
      db,
      'users',
      params.authorId,
      'readStates',
      `channel_${params.channelId}`,
    );

    batch.set(postRef, postPayload);
    batch.update(channelRef, {
      lastMessage: isVip
        ? 'VIP Broadcast · Membobin VIP kaɗai'
        : effectiveText.slice(0, 1000),
      messageSeq: increment(1),
      updatedAt: serverTimestamp(),
    });
    batch.set(readStateRef, {
      userId: params.authorId,
      roomId: `channel_${params.channelId}`,
      lastReadSeq: nextSeq,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createSponsoredPost(params: {
  authorId: string;
  businessName: string;
  headline: string;
  text: string;
  ctaLabel: string;
  actionUrl: string;
}): Promise<string> {
  const cleanBiz = params.businessName.trim().slice(0, 80);
  const cleanHeadline = params.headline.trim().slice(0, 120);
  const cleanText = params.text.trim().slice(0, 2000);
  const cleanCta = params.ctaLabel.trim().slice(0, 40) || 'Duba Yanzu';
  const cleanUrl = params.actionUrl.trim().slice(0, 512);

  if (!cleanBiz || !cleanHeadline || !cleanText) {
    throw new Error('Business name, headline, and details are required.');
  }
  if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
    throw new Error('Action URL must start with https:// or http://');
  }

  const adRef = doc(collection(db, 'sponsored_posts'));
  const path = `sponsored_posts/${adRef.id}`;
  try {
    await setDoc(adRef, {
      authorId: params.authorId,
      businessName: cleanBiz,
      headline: cleanHeadline,
      text: cleanText,
      ctaLabel: cleanCta,
      actionUrl: cleanUrl,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return adRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleSponsoredPostStatus(params: {
  adId: string;
  nextStatus: 'active' | 'paused';
}): Promise<void> {
  const path = `sponsored_posts/${params.adId}`;
  try {
    await updateDoc(doc(db, 'sponsored_posts', params.adId), {
      status: params.nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSponsoredPost(adId: string): Promise<void> {
  const path = `sponsored_posts/${adId}`;
  try {
    await deleteDoc(doc(db, 'sponsored_posts', adId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createFirestoreCallSession(params: {
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  callType: CallType;
  offerSdp: string;
}): Promise<string> {
  const callRef = doc(collection(db, 'calls'));
  const path = `calls/${callRef.id}`;
  try {
    await setDoc(callRef, {
      callerId: params.callerId,
      callerName: params.callerName.trim().slice(0, 80) || 'Member',
      calleeId: params.calleeId,
      calleeName: params.calleeName.trim().slice(0, 80) || 'Member',
      callType: params.callType,
      status: 'ringing',
      offerSdp: params.offerSdp.slice(0, 20000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return callRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function answerFirestoreCallSession(params: {
  callId: string;
  answerSdp: string;
}): Promise<void> {
  const path = `calls/${params.callId}`;
  try {
    await updateDoc(doc(db, 'calls', params.callId), {
      answerSdp: params.answerSdp.slice(0, 20000),
      status: 'active',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateFirestoreCallStatus(params: {
  callId: string;
  status: 'ended' | 'declined';
}): Promise<void> {
  const path = `calls/${params.callId}`;
  try {
    await updateDoc(doc(db, 'calls', params.callId), {
      status: params.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // Ignore permission error if the call already transitioned to terminal state ('ended'/'declined')
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('permission')) return;
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addFirestoreCallCandidate(params: {
  callId: string;
  role: 'caller' | 'callee';
  senderId: string;
  recipientId: string;
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
}): Promise<void> {
  const sub = params.role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
  const candRef = doc(collection(db, 'calls', params.callId, sub));
  const path = `calls/${params.callId}/${sub}/${candRef.id}`;
  try {
    await setDoc(candRef, {
      senderId: params.senderId,
      recipientId: params.recipientId,
      candidate: params.candidate.slice(0, 2000),
      sdpMid: params.sdpMid.slice(0, 64),
      sdpMLineIndex: Math.max(0, Math.min(32, Math.round(params.sdpMLineIndex))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function joinFirestoreGroupByInvite(params: {
  groupId: string;
  userId: string;
}): Promise<{ name: string; alreadyMember: boolean; full: boolean }> {
  const cleanGroupId = params.groupId.trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanGroupId)) {
    throw new Error('Invalid group invite link.');
  }
  const groupRef = doc(db, 'groups', cleanGroupId);
  const path = `groups/${cleanGroupId}`;
  try {
    const snap = await retryOnOffline(() => getDoc(groupRef));
    if (!snap.exists()) {
      throw new Error('Group not found.');
    }
    const data = snap.data();
    const name = String(data.name ?? 'Group');
    const rawMembers = Array.isArray(data.memberIds)
      ? data.memberIds.filter((id): id is string => typeof id === 'string')
      : [];
    if (rawMembers.includes(params.userId)) {
      return { name, alreadyMember: true, full: false };
    }
    if (rawMembers.length >= 50) {
      return { name, alreadyMember: false, full: true };
    }
    const nextMembers = [...rawMembers, params.userId];
    await updateDoc(groupRef, {
      memberIds: nextMembers,
      updatedAt: serverTimestamp(),
    });
    return { name, alreadyMember: false, full: false };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function resolveChannelInvite(params: {
  channelId: string;
  userId: string;
}): Promise<{ name: string; isVip: boolean; isOwner: boolean }> {
  const cleanChannelId = params.channelId.trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanChannelId)) {
    throw new Error('Invalid channel invite link.');
  }
  const channelRef = doc(db, 'channels', cleanChannelId);
  const followerRef = doc(
    db,
    'channels',
    cleanChannelId,
    'followers',
    params.userId,
  );
  const path = `channels/${cleanChannelId}`;
  try {
    const snap = await retryOnOffline(() => getDoc(channelRef));
    if (!snap.exists()) {
      throw new Error('Channel not found.');
    }
    const data = snap.data();
    const name = String(data.name ?? 'Channel');
    const isVip = Boolean(data.isVip);
    const isOwner = String(data.creatorId ?? '') === params.userId;

    if (!isVip && !isOwner) {
      const followSnap = await retryOnOffline(() => getDoc(followerRef));
      if (!followSnap.exists()) {
        const batch = writeBatch(db);
        batch.set(followerRef, {
          userId: params.userId,
          createdAt: serverTimestamp(),
        });
        batch.update(channelRef, { followersCount: increment(1) });
        await batch.commit();
      }
    }

    return { name, isVip, isOwner };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}



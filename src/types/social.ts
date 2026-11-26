export type TabId = 'chat' | 'updates' | 'communities' | 'notifications' | 'profile';

export type ActiveConversation =
  | { kind: 'deep_think' }
  | { kind: 'dm'; userId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'channel'; channelId: string };

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  following: boolean;
  followersCount: number;
  followingCount: number;
  isOnline?: boolean;
  lastActiveAtMs?: number;
}

export interface CommentItem {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  user: string;
  handle: string;
  authorAvatarUrl?: string;
  text: string;
  likes: number;
  liked: boolean;
  commentsCount: number;
  comments: CommentItem[];
  createdAt: string;
  createdAtMs: number;
  analysis?: string;
  mediaId?: string;
  mediaType?: 'image' | 'video';
  mediaMimeType?: string;
  mediaPoster?: string;
  mediaDuration?: number;
  mediaWidth?: number;
  mediaHeight?: number;
}

export type CallType = 'audio' | 'video';

export type CallStatus = 'ringing' | 'active' | 'ended' | 'declined';

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  callType: CallType;
  status: CallStatus;
  offerSdp: string;
  answerSdp?: string;
  createdAtMs: number;
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'them';
  text: string;
  messageType?: 'text' | 'voice';
  audioData?: string;
  audioDuration?: number;
  timestamp: string;
  read?: boolean;
  error?: string;
}

export interface ChatThreadSummary {
  id: string;
  peerId: string;
  lastMessage: string;
  lastSenderId?: string;
  unreadCount: number;
  updatedAt: string;
  updatedAtMs: number;
}

export interface GroupRoom {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  memberIds: string[];
  lastMessage: string;
  lastSenderId?: string;
  messageSeq: number;
  updatedAt: string;
  updatedAtMs: number;
}

export interface GroupMessageItem {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  messageType?: 'text' | 'voice';
  audioData?: string;
  audioDuration?: number;
  seq?: number;
  timestamp: string;
  ms: number;
}

export type VipBillingCycle = 'monthly' | 'once';

export interface ChannelRoom {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  description: string;
  followersCount: number;
  lastMessage: string;
  messageSeq: number;
  isVip?: boolean;
  vipBillingCycle?: VipBillingCycle;
  vipPriceLabel?: string;
  vipPaymentInfo?: string;
  vipMemberIds?: string[];
  updatedAt: string;
  updatedAtMs: number;
}

export interface ChannelPostItem {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  text: string;
  messageType?: 'text' | 'voice';
  audioData?: string;
  audioDuration?: number;
  visibility?: 'public' | 'vip';
  timestamp: string;
  ms: number;
}

export type ReceiptAiVerdict = 'match' | 'review' | 'mismatch' | 'unavailable';
export type ReceiptStatus = 'pending' | 'approved' | 'rejected';

export interface ChannelVipMemberItem {
  userId: string;
  channelId: string;
  grantedBy: string;
  accessMode: 'monthly' | 'lifetime';
  expiresAtMs: number | null;
  durationDays: number;
  createdAtMs: number;
}

export interface ChannelVipReceipt {
  id: string;
  channelId: string;
  creatorId: string;
  userId: string;
  userName: string;
  userHandle: string;
  amountText: string;
  referenceText: string;
  note: string;
  receiptImage?: string;
  status: ReceiptStatus;
  aiVerdict: ReceiptAiVerdict;
  aiSummary: string;
  reviewedBy?: string;
  createdAt: string;
  createdAtMs: number;
}

export interface SponsoredPost {
  id: string;
  authorId: string;
  businessName: string;
  headline: string;
  text: string;
  ctaLabel: string;
  actionUrl: string;
  status: 'active' | 'paused';
  createdAt: string;
  createdAtMs: number;
}

export interface NotificationItem {
  id: string;
  type: 'like' | 'follow' | 'comment';
  actor: string;
  message: string;
  time: string;
  createdAtMs: number;
  read: boolean;
}

export interface AppSettings {
  darkMode: boolean;
  language: 'ha' | 'en';
}

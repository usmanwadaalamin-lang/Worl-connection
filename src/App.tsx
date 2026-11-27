import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  Bell,
  CircleDot,
  Loader2,
  LogOut,
  MessageSquare,
  Plus,
  Tv,
  User as UserIcon,
  Users,
} from 'lucide-react';
import {
  ActiveConversation,
  AppSettings,
  CallSession,
  ChannelRoom,
  ChatMessage,
  ChatThreadSummary,
  GroupRoom,
  NotificationItem,
  Post,
  SponsoredPost,
  TabId,
  UserProfile,
} from './types/social';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import {
  addFirestoreComment,
  createFirestoreChannel,
  createFirestoreGroup,
  createFirestorePost,
  createSponsoredPost,
  deleteFirestorePost,
  deleteSponsoredPost,
  ensureUserProfile,
  formatFirestoreTime,
  grantChannelVipAccess,
  joinFirestoreGroupByInvite,
  markAllFirestoreNotificationsRead,
  markFirestoreNotificationRead,
  markRoomReadCursor,
  PostMediaAttachment,
  resolveChannelInvite,
  revokeChannelVipAccess,
  saveFirestorePostAnalysis,
  toggleFirestoreChannelFollow,
  toggleFirestoreFollow,
  toggleFirestoreLike,
  toggleSponsoredPostStatus,
  updateFirestoreChannelVipSettings,
  updateFirestoreGroupMembers,
  updateFirestoreProfile,
  updateUserPresence,
} from './lib/firestoreSocial';
import {
  parsePendingRoomInviteFromUrl,
  PendingRoomInvite,
} from './lib/inviteLinks';
import { getTranslations, Language } from './lib/i18n';
import { usePWAInstall } from './lib/usePWAInstall';
import { useWebNotifications } from './lib/useWebNotifications';
import { Avatar } from './components/Avatar';
import { AuthPage } from './components/AuthPage';
import { CreatePostModal } from './components/CreatePostModal';
import { CreateRoomModal, RoomModalMode } from './components/CreateRoomModal';
import { SponsoredPostModal } from './components/SponsoredPostModal';
import { VipChannelModal } from './components/VipChannelModal';
import { CallOverlay, OutgoingCallDraft } from './components/CallOverlay';
import { ChatView } from './components/ChatView';
import { UpdatesView } from './components/UpdatesView';
import { CommunitiesView } from './components/CommunitiesView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { DeepThinkPanel } from './components/DeepThinkPanel';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { LegalDocKind, LegalPage } from './components/LegalPage';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { NotificationPromptBanner } from './components/NotificationPromptBanner';

const SETTINGS_STORAGE_KEY = 'al_amana_settings_v2';

function loadSettings(): AppSettings {
  try {
    const raw =
      localStorage.getItem(SETTINGS_STORAGE_KEY) ||
      localStorage.getItem('al_amana_settings_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<
        AppSettings & { hausaLabels?: boolean }
      >;
      const lang: Language =
        parsed.language === 'en' || parsed.language === 'ha'
          ? parsed.language
          : parsed.hausaLabels === false
            ? 'en'
            : 'ha';
      return {
        darkMode: Boolean(parsed.darkMode),
        language: lang,
      };
    }
  } catch {
    // Ignore storage errors
  }
  return { darkMode: false, language: 'ha' };
}

function computeIsVerified(user: User | null): boolean {
  if (!user) return false;
  if (user.emailVerified) return true;
  if (user.phoneNumber && user.phoneNumber.trim().length >= 5) return true;
  return user.providerData.some(
    (p) => p.providerId === 'google.com' || p.providerId === 'phone',
  );
}

function getLegalKindFromPath(pathname: string): LegalDocKind | null {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/privacy') return 'privacy';
  if (clean === '/terms') return 'terms';
  return null;
}

export default function App() {
  const [legalPage, setLegalPage] = useState<LegalDocKind | null>(() =>
    typeof window !== 'undefined'
      ? getLegalKindFromPath(window.location.pathname)
      : null,
  );
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const [tab, setTab] = useState<TabId>('chat');
  const [updatesSubTab, setUpdatesSubTab] = useState<'community' | 'youtube'>('community');
  const [rawUsers, setRawUsers] = useState<
    Array<Omit<UserProfile, 'following' | 'followersCount' | 'followingCount'>>
  >([]);
  const [sentFollowIds, setSentFollowIds] = useState<Set<string>>(new Set());
  const [followerCounts, setFollowerCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [followingCounts, setFollowingCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [sponsoredPosts, setSponsoredPosts] = useState<SponsoredPost[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dmThreads, setDmThreads] = useState<ChatThreadSummary[]>([]);
  const [groups, setGroups] = useState<GroupRoom[]>([]);
  const [channels, setChannels] = useState<ChannelRoom[]>([]);
  const [followedChannelIds, setFollowedChannelIds] = useState<Set<string>>(
    new Set(),
  );
  const [readSeqByRoom, setReadSeqByRoom] = useState<Map<string, number>>(
    new Map(),
  );
  const [presenceNowMs, setPresenceNowMs] = useState<number>(() => Date.now());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  const t = useMemo(() => getTranslations(settings.language), [settings.language]);

  const [deepThinkMessages, setDeepThinkMessages] = useState<ChatMessage[]>(
    () => [
      {
        id: 'dt-welcome',
        sender: 'them',
        text: getTranslations(loadSettings().language).deepThinkWelcome,
        timestamp: 'Just now',
      },
    ],
  );
  const [activeConversation, setActiveConversation] =
    useState<ActiveConversation>({ kind: 'deep_think' });
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMediaPick, setComposerMediaPick] = useState<
    'image' | 'video' | null
  >(null);
  const [sponsoredModalOpen, setSponsoredModalOpen] = useState(false);
  const [vipManagingChannelId, setVipManagingChannelId] = useState<
    string | null
  >(null);
  const [roomModalMode, setRoomModalMode] = useState<RoomModalMode | null>(
    null,
  );
  const [editingGroup, setEditingGroup] = useState<GroupRoom | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallDraft | null>(
    null,
  );
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [pendingInvite, setPendingInvite] = useState<PendingRoomInvite | null>(
    () => parsePendingRoomInviteFromUrl(),
  );
  const processingInviteRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const pwa = usePWAInstall();
  const webNotif = useWebNotifications();

  const [dmSyncTick, setDmSyncTick] = useState(0);
  const [groupsSyncTick, setGroupsSyncTick] = useState(0);
  const [channelsSyncTick, setChannelsSyncTick] = useState(0);
  const [notifSyncTick, setNotifSyncTick] = useState(0);

  const dmAlertBaselineRef = useRef<Map<string, number> | null>(null);
  const groupAlertBaselineRef = useRef<Map<string, number> | null>(null);
  const channelAlertBaselineRef = useRef<Map<string, number> | null>(null);
  const notifAlertBaselineRef = useRef<Set<string> | null>(null);
  const lastAlertedCallIdRef = useRef<string | null>(null);
  const pendingOpenChatRef = useRef<string | null>(
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('openChat')
      : null,
  );

  const isOwnerAdmin = Boolean(
    authUser?.email &&
      authUser.email.toLowerCase() === 'usmanwadaalamin@gmail.com' &&
      authUser.emailVerified,
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
    document.documentElement.lang = settings.language;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const verified = computeIsVerified(user);
      setAuthUser(user);
      setIsEmailVerified(verified);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser || !isEmailVerified) return;
    let active = true;
    let retryTimer: number | null = null;

    const attemptEnsure = () => {
      ensureUserProfile(authUser)
        .then((ok) => {
          if (!active) return;
          if (!ok) {
            retryTimer = window.setTimeout(attemptEnsure, 5000);
          }
        })
        .catch((err) => {
          console.error(err);
        });
    };

    attemptEnsure();
    const handleOnline = () => {
      if (active) attemptEnsure();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      active = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnline);
    };
  }, [authUser, isEmailVerified]);

  useEffect(() => {
    if (!authUser || !isEmailVerified || !pendingInvite) return;
    if (processingInviteRef.current) return;
    processingInviteRef.current = true;
    const invite = pendingInvite;
    const uid = authUser.uid;
    setToast(t.joiningViaLinkToast);

    const runInvite = async () => {
      try {
        if (invite.kind === 'group') {
          const result = await joinFirestoreGroupByInvite({
            groupId: invite.id,
            userId: uid,
          });
          if (result.full) {
            setToast(t.groupFullErr);
            return;
          }
          setActiveConversation({ kind: 'group', groupId: invite.id });
          setMobileThreadOpen(true);
          setTab('chat');
          setToast(`${t.joinedGroupToast} (${result.name})`);
        } else {
          const result = await resolveChannelInvite({
            channelId: invite.id,
            userId: uid,
          });
          setActiveConversation({ kind: 'channel', channelId: invite.id });
          setMobileThreadOpen(true);
          setTab('chat');
          setToast(`${t.joinedChannelToast} (${result.name})`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('not found') || msg.includes('invalid')) {
          setToast(t.inviteNotFoundErr);
        } else {
          setToast(err instanceof Error ? err.message : t.inviteNotFoundErr);
        }
      } finally {
        setPendingInvite(null);
        processingInviteRef.current = false;
      }
    };

    void runInvite();
  }, [authUser, isEmailVerified, pendingInvite, t]);

  useEffect(() => {
    const timer = window.setInterval(() => setPresenceNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authUser || !isEmailVerified) return;
    const uid = authUser.uid;
    let lastBeatMs = 0;

    const sendHeartbeat = (online: boolean, force = false) => {
      const now = Date.now();
      if (online && !force && now - lastBeatMs < 15000) return;
      lastBeatMs = now;
      void updateUserPresence(uid, online);
    };

    sendHeartbeat(
      typeof document === 'undefined' || document.visibilityState === 'visible',
      true,
    );

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat(true, true);
      }
    }, 90000);

    const onVisibility = () => {
      sendHeartbeat(document.visibilityState === 'visible', true);
    };

    const onPageHide = () => {
      void updateUserPresence(uid, false);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [authUser, isEmailVerified]);

  useEffect(() => {
    if (!authUser || !isEmailVerified) {
      dmAlertBaselineRef.current = null;
      groupAlertBaselineRef.current = null;
      channelAlertBaselineRef.current = null;
      notifAlertBaselineRef.current = null;
      lastAlertedCallIdRef.current = null;
      setDmSyncTick(0);
      setGroupsSyncTick(0);
      setChannelsSyncTick(0);
      setNotifSyncTick(0);
      return;
    }
    const uid = authUser.uid;
    dmAlertBaselineRef.current = null;
    groupAlertBaselineRef.current = null;
    channelAlertBaselineRef.current = null;
    notifAlertBaselineRef.current = null;
    lastAlertedCallIdRef.current = null;
    setDmSyncTick(0);
    setGroupsSyncTick(0);
    setChannelsSyncTick(0);
    setNotifSyncTick(0);

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('isPublic', '==', true)),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          const lastActiveAtMs =
            data.lastActiveAt instanceof Timestamp
              ? data.lastActiveAt.toMillis()
              : 0;
          return {
            id: d.id,
            name: String(data.name ?? 'Member'),
            handle: String(data.handle ?? '@member'),
            bio: String(data.bio ?? ''),
            avatarUrl: String(data.avatarUrl ?? ''),
            isOnline: Boolean(data.isOnline),
            lastActiveAtMs,
          };
        });
        setRawUsers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      },
    );

    const unsubFollowing = onSnapshot(
      query(collection(db, 'follows'), where('followerId', '==', uid)),
      (snap) => {
        const nextSet = new Set<string>();
        for (const d of snap.docs) {
          const targetId = d.data().targetId;
          if (typeof targetId === 'string') nextSet.add(targetId);
        }
        setSentFollowIds(nextSet);
        setFollowingCounts((prev) => {
          const next = new Map(prev);
          next.set(uid, nextSet.size);
          return next;
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'follows');
      },
    );

    const unsubFollowers = onSnapshot(
      query(collection(db, 'follows'), where('targetId', '==', uid)),
      (snap) => {
        setFollowerCounts((prev) => {
          const next = new Map(prev);
          next.set(uid, snap.size);
          return next;
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'follows');
      },
    );

    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('visibility', '==', 'public')),
      (snap) => {
        const list: Post[] = snap.docs.map((d) => {
          const data = d.data();
          const { label, ms } = formatFirestoreTime(data.createdAt);
          return {
            id: d.id,
            authorId: String(data.authorId ?? ''),
            user: String(data.authorName ?? 'Member'),
            handle: String(data.authorHandle ?? '@member'),
            authorAvatarUrl: String(data.authorAvatarUrl ?? ''),
            text: String(data.text ?? ''),
            likes: Number(data.likesCount ?? 0),
            liked: false,
            commentsCount: Number(data.commentsCount ?? 0),
            comments: [],
            createdAt: label,
            createdAtMs: ms,
            analysis:
              typeof data.analysis === 'string' ? data.analysis : undefined,
            mediaId:
              typeof data.mediaId === 'string' ? data.mediaId : undefined,
            mediaType:
              data.mediaType === 'image' || data.mediaType === 'video'
                ? data.mediaType
                : undefined,
            mediaMimeType:
              typeof data.mediaMimeType === 'string'
                ? data.mediaMimeType
                : undefined,
            mediaPoster:
              typeof data.mediaPoster === 'string'
                ? data.mediaPoster
                : undefined,
            mediaDuration:
              typeof data.mediaDuration === 'number'
                ? data.mediaDuration
                : undefined,
            mediaWidth:
              typeof data.mediaWidth === 'number' ? data.mediaWidth : undefined,
            mediaHeight:
              typeof data.mediaHeight === 'number'
                ? data.mediaHeight
                : undefined,
          };
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setPosts(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      },
    );

    const unsubNotifications = onSnapshot(
      query(collection(db, 'notifications'), where('recipientId', '==', uid)),
      (snap) => {
        const list: NotificationItem[] = snap.docs.map((d) => {
          const data = d.data();
          const { label, ms } = formatFirestoreTime(data.createdAt);
          return {
            id: d.id,
            type: (data.type as NotificationItem['type']) ?? 'like',
            actor: String(data.actorName ?? 'Someone'),
            message: String(data.message ?? ''),
            time: label,
            createdAtMs: ms,
            read: Boolean(data.read),
          };
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setNotifications(list);
        setNotifSyncTick((tick) => tick + 1);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      },
    );

    let threadsAMap = new Map<string, ChatThreadSummary>();
    let threadsBMap = new Map<string, ChatThreadSummary>();
    let readyChatsA = false;
    let readyChatsB = false;

    const syncThreads = () => {
      if (!readyChatsA || !readyChatsB) return;
      const merged = new Map<string, ChatThreadSummary>([
        ...threadsAMap,
        ...threadsBMap,
      ]);
      const list = Array.from(merged.values()).sort(
        (a, b) => b.updatedAtMs - a.updatedAtMs,
      );
      setDmThreads(list);
      setDmSyncTick((tick) => tick + 1);
    };

    const parseThread = (
      id: string,
      data: Record<string, unknown>,
    ): ChatThreadSummary => {
      const partA = String(data.participantA ?? '');
      const partB = String(data.participantB ?? '');
      const isA = partA === uid;
      const unreadRaw = isA ? data.unreadCountA : data.unreadCountB;
      const { label, ms } = formatFirestoreTime(data.updatedAt);
      return {
        id,
        peerId: isA ? partB : partA,
        lastMessage: String(data.lastMessage ?? ''),
        lastSenderId:
          typeof data.lastSenderId === 'string' ? data.lastSenderId : undefined,
        unreadCount:
          typeof unreadRaw === 'number' && Number.isFinite(unreadRaw)
            ? Math.max(0, Math.round(unreadRaw))
            : 0,
        updatedAt: label,
        updatedAtMs: ms,
      };
    };

    const unsubChatsA = onSnapshot(
      query(collection(db, 'chats'), where('participantA', '==', uid)),
      (snap) => {
        const next = new Map<string, ChatThreadSummary>();
        for (const d of snap.docs) {
          next.set(d.id, parseThread(d.id, d.data()));
        }
        threadsAMap = next;
        readyChatsA = true;
        syncThreads();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
      },
    );

    const unsubChatsB = onSnapshot(
      query(collection(db, 'chats'), where('participantB', '==', uid)),
      (snap) => {
        const next = new Map<string, ChatThreadSummary>();
        for (const d of snap.docs) {
          next.set(d.id, parseThread(d.id, d.data()));
        }
        threadsBMap = next;
        readyChatsB = true;
        syncThreads();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
      },
    );

    const unsubGroups = onSnapshot(
      query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)),
      (snap) => {
        const list: GroupRoom[] = snap.docs.map((d) => {
          const data = d.data();
          const { label, ms } = formatFirestoreTime(data.updatedAt);
          const rawMembers = Array.isArray(data.memberIds)
            ? data.memberIds.filter((id): id is string => typeof id === 'string')
            : [];
          return {
            id: d.id,
            creatorId: String(data.creatorId ?? ''),
            name: String(data.name ?? 'Group'),
            description: String(data.description ?? ''),
            memberIds: rawMembers,
            lastMessage: String(data.lastMessage ?? ''),
            lastSenderId:
              typeof data.lastSenderId === 'string'
                ? data.lastSenderId
                : undefined,
            messageSeq: Math.max(0, Number(data.messageSeq ?? 0)),
            updatedAt: label,
            updatedAtMs: ms,
          };
        });
        list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setGroups(list);
        setGroupsSyncTick((tick) => tick + 1);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'groups');
      },
    );

    const unsubChannels = onSnapshot(
      query(collection(db, 'channels'), where('visibility', '==', 'public')),
      (snap) => {
        const list: ChannelRoom[] = snap.docs.map((d) => {
          const data = d.data();
          const { label, ms } = formatFirestoreTime(data.updatedAt);
          const rawVipIds = Array.isArray(data.vipMemberIds)
            ? data.vipMemberIds.filter(
                (id): id is string => typeof id === 'string',
              )
            : undefined;
          return {
            id: d.id,
            creatorId: String(data.creatorId ?? ''),
            creatorName: String(data.creatorName ?? 'Creator'),
            name: String(data.name ?? 'Channel'),
            description: String(data.description ?? ''),
            followersCount: Number(data.followersCount ?? 0),
            lastMessage: String(data.lastMessage ?? ''),
            messageSeq: Math.max(0, Number(data.messageSeq ?? 0)),
            isVip: Boolean(data.isVip),
            vipBillingCycle:
              data.vipBillingCycle === 'once' ? 'once' : 'monthly',
            vipPriceLabel:
              typeof data.vipPriceLabel === 'string'
                ? data.vipPriceLabel
                : undefined,
            vipPaymentInfo:
              typeof data.vipPaymentInfo === 'string'
                ? data.vipPaymentInfo
                : undefined,
            vipMemberIds: rawVipIds,
            updatedAt: label,
            updatedAtMs: ms,
          };
        });
        list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setChannels(list);
        setChannelsSyncTick((tick) => tick + 1);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'channels');
      },
    );

    const unsubReadStates = onSnapshot(
      query(collection(db, 'users', uid, 'readStates'), where('userId', '==', uid)),
      (snap) => {
        const next = new Map<string, number>();
        for (const d of snap.docs) {
          const data = d.data();
          const roomId = typeof data.roomId === 'string' ? data.roomId : d.id;
          next.set(roomId, Math.max(0, Number(data.lastReadSeq ?? 0)));
        }
        setReadSeqByRoom(next);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `users/${uid}/readStates`,
        );
      },
    );

    const sponsoredQuery = isOwnerAdmin
      ? collection(db, 'sponsored_posts')
      : query(
          collection(db, 'sponsored_posts'),
          where('status', '==', 'active'),
        );

    const unsubSponsored = onSnapshot(
      sponsoredQuery,
      (snap) => {
        const list: SponsoredPost[] = snap.docs.map((d) => {
          const data = d.data();
          const { label, ms } = formatFirestoreTime(data.createdAt);
          return {
            id: d.id,
            authorId: String(data.authorId ?? ''),
            businessName: String(data.businessName ?? ''),
            headline: String(data.headline ?? ''),
            text: String(data.text ?? ''),
            ctaLabel: String(data.ctaLabel ?? 'Duba Yanzu'),
            actionUrl: String(data.actionUrl ?? ''),
            status: data.status === 'paused' ? 'paused' : 'active',
            createdAt: label,
            createdAtMs: ms,
          };
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setSponsoredPosts(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'sponsored_posts');
      },
    );

    return () => {
      unsubUsers();
      unsubFollowing();
      unsubFollowers();
      unsubPosts();
      unsubNotifications();
      unsubChatsA();
      unsubChatsB();
      unsubGroups();
      unsubChannels();
      unsubReadStates();
      unsubSponsored();
    };
  }, [authUser, isEmailVerified, isOwnerAdmin]);

  useEffect(() => {
    if (!authUser || !isEmailVerified) {
      setIncomingCall(null);
      return;
    }
    const uid = authUser.uid;
    const unsubCalls = onSnapshot(
      query(collection(db, 'calls'), where('calleeId', '==', uid)),
      (snap) => {
        const ringing: CallSession[] = [];
        for (const d of snap.docs) {
          const data = d.data();
          if (data.status !== 'ringing') continue;
          const { ms } = formatFirestoreTime(data.createdAt);
          ringing.push({
            id: d.id,
            callerId: String(data.callerId ?? ''),
            callerName: String(data.callerName ?? 'Member'),
            calleeId: String(data.calleeId ?? ''),
            calleeName: String(data.calleeName ?? ''),
            callType: data.callType === 'video' ? 'video' : 'audio',
            status: 'ringing',
            offerSdp: String(data.offerSdp ?? ''),
            answerSdp:
              typeof data.answerSdp === 'string' ? data.answerSdp : undefined,
            createdAtMs: ms,
          });
        }
        ringing.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setIncomingCall(ringing[0] ?? null);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'calls');
      },
    );

    return () => unsubCalls();
  }, [authUser, isEmailVerified]);

  const channelIdsKey = useMemo(
    () =>
      channels
        .map((c) => c.id)
        .sort()
        .join(','),
    [channels],
  );

  useEffect(() => {
    if (!authUser || !isEmailVerified || !channelIdsKey) {
      setFollowedChannelIds(new Set());
      return;
    }
    const uid = authUser.uid;
    const ids = channelIdsKey.split(',').filter(Boolean);
    const unsubs: Array<() => void> = [];

    for (const channelId of ids) {
      const followerRef = doc(db, 'channels', channelId, 'followers', uid);
      const unsub = onSnapshot(
        followerRef,
        (snap) => {
          setFollowedChannelIds((prev) => {
            const next = new Set(prev);
            if (snap.exists()) {
              next.add(channelId);
            } else {
              next.delete(channelId);
            }
            return next;
          });
        },
        (error) => {
          handleFirestoreError(
            error,
            OperationType.GET,
            `channels/${channelId}/followers/${uid}`,
          );
        },
      );
      unsubs.push(unsub);
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [authUser, isEmailVerified, channelIdsKey]);

  const users: UserProfile[] = useMemo(() => {
    const ONLINE_TTL_MS = 3 * 60 * 1000;
    return rawUsers.map((u) => {
      const isSelf = u.id === authUser?.uid;
      const isActiveOnline =
        isSelf ||
        (Boolean(u.isOnline) &&
          typeof u.lastActiveAtMs === 'number' &&
          u.lastActiveAtMs > 0 &&
          presenceNowMs - u.lastActiveAtMs < ONLINE_TTL_MS);
      return {
        ...u,
        isOnline: isActiveOnline,
        following: sentFollowIds.has(u.id),
        followersCount: followerCounts.get(u.id) ?? 0,
        followingCount: followingCounts.get(u.id) ?? 0,
      };
    });
  }, [
    rawUsers,
    authUser?.uid,
    presenceNowMs,
    sentFollowIds,
    followerCounts,
    followingCounts,
  ]);

  const currentUser: UserProfile = useMemo(() => {
    const found = users.find((u) => u.id === authUser?.uid);
    if (found) return found;
    return {
      id: authUser?.uid ?? '',
      name:
        authUser?.displayName ||
        authUser?.email?.split('@')[0] ||
        authUser?.phoneNumber ||
        'Member',
      handle: '@member',
      bio: 'My Social Profile',
      avatarUrl: authUser?.photoURL || '',
      following: false,
      followersCount: 0,
      followingCount: 0,
      isOnline: true,
    };
  }, [users, authUser]);

  const usersRef = useRef(users);
  usersRef.current = users;
  const dmThreadsRef = useRef(dmThreads);
  dmThreadsRef.current = dmThreads;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const followedChannelIdsRef = useRef(followedChannelIds);
  followedChannelIdsRef.current = followedChannelIds;
  const webNotifRef = useRef(webNotif);
  webNotifRef.current = webNotif;
  const tRef = useRef(t);
  tRef.current = t;
  const activeUiRef = useRef({ tab, activeConversation, mobileThreadOpen });
  activeUiRef.current = { tab, activeConversation, mobileThreadOpen };

  const openChatTarget = useCallback((target: string) => {
    if (!target) return;
    if (target === 'notifications') {
      setMobileThreadOpen(false);
      setTab('notifications');
      return;
    }
    if (target.startsWith('dm:')) {
      const peerId = target.slice(3);
      if (peerId) {
        setActiveConversation({ kind: 'dm', userId: peerId });
        setMobileThreadOpen(true);
        setTab('chat');
      }
      return;
    }
    if (target.startsWith('group:')) {
      const groupId = target.slice(6);
      if (groupId) {
        setActiveConversation({ kind: 'group', groupId });
        setMobileThreadOpen(true);
        setTab('chat');
      }
      return;
    }
    if (target.startsWith('channel:')) {
      const channelId = target.slice(8);
      if (channelId) {
        setActiveConversation({ kind: 'channel', channelId });
        setMobileThreadOpen(true);
        setTab('chat');
      }
    }
  }, []);

  useEffect(() => {
    if (!authUser || !isEmailVerified) return;
    const target = pendingOpenChatRef.current;
    if (target) {
      pendingOpenChatRef.current = null;
      openChatTarget(target);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('openChat');
        window.history.replaceState(
          {},
          '',
          `${url.pathname}${url.search}${url.hash}`,
        );
      } catch {
        // Ignore history errors
      }
    }

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; chatTarget?: string } | null;
      if (data?.type === 'OPEN_CHAT_TARGET' && typeof data.chatTarget === 'string') {
        openChatTarget(data.chatTarget);
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
    };
  }, [authUser, isEmailVerified, openChatTarget]);

  // Real-time DM alerts (skips initial snapshot baseline)
  useEffect(() => {
    if (!authUser?.uid || dmSyncTick === 0) return;
    const list = dmThreadsRef.current;
    const prev = dmAlertBaselineRef.current;
    if (!prev) {
      const initial = new Map<string, number>();
      for (const th of list) initial.set(th.id, th.unreadCount);
      dmAlertBaselineRef.current = initial;
      return;
    }

    const next = new Map<string, number>();
    let latestIncoming: ChatThreadSummary | null = null;
    for (const th of list) {
      next.set(th.id, th.unreadCount);
      const prevUnread = prev.get(th.id) ?? 0;
      if (
        th.unreadCount > prevUnread &&
        th.lastSenderId &&
        th.lastSenderId !== authUser.uid
      ) {
        if (!latestIncoming || th.updatedAtMs >= latestIncoming.updatedAtMs) {
          latestIncoming = th;
        }
      }
    }
    dmAlertBaselineRef.current = next;

    if (latestIncoming) {
      const peer = usersRef.current.find((u) => u.id === latestIncoming!.peerId);
      const peerName = peer?.name || tRef.current.appName;
      const isVisible =
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible';
      const isDesktop =
        typeof window !== 'undefined' && window.innerWidth >= 1024;
      const ui = activeUiRef.current;
      const viewingThisDm =
        isVisible &&
        ui.tab === 'chat' &&
        ui.activeConversation.kind === 'dm' &&
        ui.activeConversation.userId === latestIncoming.peerId &&
        (ui.mobileThreadOpen || isDesktop);

      const target = `dm:${latestIncoming.peerId}`;
      webNotifRef.current.triggerAlert({
        title: `${tRef.current.notifNewMessageFromPrefix} ${peerName}`,
        body: latestIncoming.lastMessage || 'New message',
        tag: target,
        chatTarget: target,
        suppressTrayBanner: viewingThisDm,
        onForegroundClick: () => openChatTarget(target),
      });
    }
  }, [dmSyncTick, authUser?.uid, openChatTarget]);

  // Real-time Group message alerts (skips initial snapshot baseline)
  useEffect(() => {
    if (!authUser?.uid || groupsSyncTick === 0) return;
    const list = groupsRef.current;
    const prev = groupAlertBaselineRef.current;
    if (!prev) {
      const initial = new Map<string, number>();
      for (const grp of list) initial.set(grp.id, grp.messageSeq);
      groupAlertBaselineRef.current = initial;
      return;
    }

    const next = new Map<string, number>();
    let latestIncoming: GroupRoom | null = null;
    for (const grp of list) {
      next.set(grp.id, grp.messageSeq);
      const prevSeq = prev.get(grp.id);
      if (
        typeof prevSeq === 'number' &&
        grp.messageSeq > prevSeq &&
        grp.lastSenderId &&
        grp.lastSenderId !== authUser.uid
      ) {
        if (!latestIncoming || grp.updatedAtMs >= latestIncoming.updatedAtMs) {
          latestIncoming = grp;
        }
      }
    }
    groupAlertBaselineRef.current = next;

    if (latestIncoming) {
      const isVisible =
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible';
      const isDesktop =
        typeof window !== 'undefined' && window.innerWidth >= 1024;
      const ui = activeUiRef.current;
      const viewingThisGroup =
        isVisible &&
        ui.tab === 'chat' &&
        ui.activeConversation.kind === 'group' &&
        ui.activeConversation.groupId === latestIncoming.id &&
        (ui.mobileThreadOpen || isDesktop);

      const target = `group:${latestIncoming.id}`;
      webNotifRef.current.triggerAlert({
        title: latestIncoming.name,
        body: latestIncoming.lastMessage || 'New group message',
        tag: target,
        chatTarget: target,
        suppressTrayBanner: viewingThisGroup,
        onForegroundClick: () => openChatTarget(target),
      });
    }
  }, [groupsSyncTick, authUser?.uid, openChatTarget]);

  // Real-time Followed Channel broadcast alerts (skips initial snapshot baseline)
  useEffect(() => {
    if (!authUser?.uid || channelsSyncTick === 0) return;
    const list = channelsRef.current;
    const prev = channelAlertBaselineRef.current;
    if (!prev) {
      const initial = new Map<string, number>();
      for (const ch of list) initial.set(ch.id, ch.messageSeq);
      channelAlertBaselineRef.current = initial;
      return;
    }

    const next = new Map<string, number>();
    let latestIncoming: ChannelRoom | null = null;
    for (const ch of list) {
      next.set(ch.id, ch.messageSeq);
      const prevSeq = prev.get(ch.id);
      if (
        typeof prevSeq === 'number' &&
        ch.messageSeq > prevSeq &&
        ch.creatorId !== authUser.uid &&
        followedChannelIdsRef.current.has(ch.id)
      ) {
        if (!latestIncoming || ch.updatedAtMs >= latestIncoming.updatedAtMs) {
          latestIncoming = ch;
        }
      }
    }
    channelAlertBaselineRef.current = next;

    if (latestIncoming) {
      const isVisible =
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible';
      const isDesktop =
        typeof window !== 'undefined' && window.innerWidth >= 1024;
      const ui = activeUiRef.current;
      const viewingThisChannel =
        isVisible &&
        ui.tab === 'chat' &&
        ui.activeConversation.kind === 'channel' &&
        ui.activeConversation.channelId === latestIncoming.id &&
        (ui.mobileThreadOpen || isDesktop);

      const target = `channel:${latestIncoming.id}`;
      webNotifRef.current.triggerAlert({
        title: `${tRef.current.notifNewChannelPostPrefix} ${latestIncoming.name}`,
        body: latestIncoming.lastMessage || 'New channel update',
        tag: target,
        chatTarget: target,
        suppressTrayBanner: viewingThisChannel,
        onForegroundClick: () => openChatTarget(target),
      });
    }
  }, [channelsSyncTick, authUser?.uid, openChatTarget]);

  // Real-time Activity Notification alerts (likes, comments, follows)
  useEffect(() => {
    if (!authUser?.uid || notifSyncTick === 0) return;
    const list = notificationsRef.current;
    const prev = notifAlertBaselineRef.current;
    if (!prev) {
      notifAlertBaselineRef.current = new Set(list.map((n) => n.id));
      return;
    }

    let newestUnread: NotificationItem | null = null;
    const next = new Set<string>();
    for (const n of list) {
      next.add(n.id);
      if (!prev.has(n.id) && !n.read && !newestUnread) {
        newestUnread = n;
      }
    }
    notifAlertBaselineRef.current = next;

    if (newestUnread) {
      const isVisible =
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible';
      const viewingNotifs =
        isVisible && activeUiRef.current.tab === 'notifications';
      webNotifRef.current.triggerAlert({
        title: newestUnread.actor || tRef.current.appName,
        body: newestUnread.message || tRef.current.navNotifications,
        tag: `notif-${newestUnread.id}`,
        chatTarget: 'notifications',
        suppressTrayBanner: viewingNotifs,
        onForegroundClick: () => openChatTarget('notifications'),
      });
    }
  }, [notifSyncTick, authUser?.uid, openChatTarget]);

  // Real-time Incoming Call alerts
  useEffect(() => {
    if (!incomingCall) return;
    if (lastAlertedCallIdRef.current === incomingCall.id) return;
    lastAlertedCallIdRef.current = incomingCall.id;

    const isVisible =
      typeof document !== 'undefined' && document.visibilityState === 'visible';
    webNotifRef.current.triggerAlert({
      title: incomingCall.callerName || tRef.current.appName,
      body:
        incomingCall.callType === 'video'
          ? tRef.current.incomingVideoCall
          : tRef.current.incomingAudioCall,
      tag: `call-${incomingCall.id}`,
      chatTarget: `dm:${incomingCall.callerId}`,
      suppressTrayBanner: isVisible && !outgoingCall,
    });
  }, [incomingCall, outgoingCall]);

  const handleChangeLanguage = (lang: Language) => {
    setSettings((prev) => ({ ...prev, language: lang }));
    const nextT = getTranslations(lang);
    setDeepThinkMessages((prev) =>
      prev.map((m) =>
        m.id === 'dt-welcome' ? { ...m, text: nextT.deepThinkWelcome } : m,
      ),
    );
    setToast(nextT.toastLanguageChanged);
  };

  useEffect(() => {
    const onPopState = () => {
      setLegalPage(getLegalKindFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openLegalPage = (kind: LegalDocKind) => {
    const nextPath = kind === 'privacy' ? '/privacy' : '/terms';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setLegalPage(kind);
  };

  const closeLegalPage = () => {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setLegalPage(null);
  };

  if (legalPage) {
    return (
      <LegalPage
        kind={legalPage}
        language={settings.language}
        onChangeLanguage={handleChangeLanguage}
        onNavigateKind={openLegalPage}
        onBack={closeLegalPage}
      />
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          <span>{t.connectingApp}</span>
        </div>
      </div>
    );
  }

  if (!authUser || !isEmailVerified) {
    return (
      <AuthPage
        unverifiedUser={authUser && !isEmailVerified ? authUser : null}
        language={settings.language}
        t={t}
        pwa={pwa}
        onChangeLanguage={handleChangeLanguage}
        onOpenLegal={openLegalPage}
        onVerifiedRefresh={async () => {
          const user = auth.currentUser;
          if (!user) return false;
          try {
            await user.reload();
            const refreshedUser = auth.currentUser;
            if (!refreshedUser) return false;
            const verified = computeIsVerified(refreshedUser);
            if (verified) {
              await refreshedUser.getIdToken(true);
              setIsEmailVerified(true);
              setAuthUser(refreshedUser);
            }
            return verified;
          } catch {
            return false;
          }
        }}
      />
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadDmCount = dmThreads.reduce((sum, th) => sum + th.unreadCount, 0);
  const unreadGroupCount = groups.reduce((sum, grp) => {
    if (grp.lastSenderId === currentUser.id) return sum;
    const readSeq = readSeqByRoom.get(`group_${grp.id}`) ?? 0;
    return sum + Math.max(0, grp.messageSeq - readSeq);
  }, 0);
  const unreadChannelCount = channels.reduce((sum, ch) => {
    if (ch.creatorId === currentUser.id || !followedChannelIds.has(ch.id)) {
      return sum;
    }
    const readSeq = readSeqByRoom.get(`channel_${ch.id}`) ?? 0;
    return sum + Math.max(0, ch.messageSeq - readSeq);
  }, 0);
  const unreadChatsCount = unreadDmCount + unreadGroupCount + unreadChannelCount;
  const userPosts = posts.filter((p) => p.authorId === currentUser.id);

  const handlePublishPost = async (
    text: string,
    media?: PostMediaAttachment,
  ) => {
    await createFirestorePost(currentUser, text, media);
    setToast(t.toastPostPublished);
  };

  const handleDeletePost = async (post: Post) => {
    await deleteFirestorePost(post.id, post.mediaId);
    setToast(t.toastPostDeleted);
  };

  const handleToggleLike = async (post: Post, currentlyLiked: boolean) => {
    await toggleFirestoreLike({
      postId: post.id,
      userId: currentUser.id,
      actorName: currentUser.name,
      postAuthorId: post.authorId,
      currentlyLiked,
    });
  };

  const handleAddComment = async (post: Post, text: string) => {
    await addFirestoreComment({
      postId: post.id,
      author: currentUser,
      postAuthorId: post.authorId,
      text,
    });
  };

  const handleSaveAnalysis = async (postId: string, analysis: string) => {
    await saveFirestorePostAnalysis(postId, analysis);
  };

  const handleShare = (post: Post) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(`${post.user}: ${post.text}`).catch(() => {});
    }
    setToast(`${t.toastCopiedPrefix} ${post.user}`);
  };

  const handleToggleFollow = async (targetUserId: string) => {
    const target = users.find((u) => u.id === targetUserId);
    await toggleFirestoreFollow({
      currentUserId: currentUser.id,
      currentUserName: currentUser.name,
      targetUserId,
      currentlyFollowing: Boolean(target?.following),
    });
  };

  const handleToggleFollowChannel = async (
    channelId: string,
    currentlyFollowing: boolean,
  ) => {
    await toggleFirestoreChannelFollow({
      channelId,
      userId: currentUser.id,
      currentlyFollowing,
    });
    if (!currentlyFollowing) {
      const ch = channels.find((item) => item.id === channelId);
      if (ch && ch.messageSeq > 0) {
        await markRoomReadCursor({
          userId: currentUser.id,
          roomKey: `channel_${channelId}`,
          seq: ch.messageSeq,
        });
      }
    }
  };

  const handleUpdateProfile = async (
    name: string,
    bio: string,
    avatarUrl?: string,
  ) => {
    await updateFirestoreProfile(currentUser.id, name, bio, avatarUrl);
    setToast(t.toastProfileSaved);
  };

  const handleSignOut = async () => {
    if (authUser?.uid) {
      await updateUserPresence(authUser.uid, false);
    }
    await signOut(auth);
  };

  const openPrivateChat = (userId: string) => {
    setActiveConversation({ kind: 'dm', userId });
    setMobileThreadOpen(true);
    setTab('chat');
  };

  const navItems: Array<{
    id: TabId;
    label: string;
    icon: typeof MessageSquare;
    badge?: number;
  }> = [
    {
      id: 'chat',
      label: t.navChat,
      icon: MessageSquare,
      badge: unreadChatsCount,
    },
    { id: 'updates', label: t.navUpdates, icon: CircleDot },
    { id: 'communities', label: t.navCommunities, icon: Users },
    {
      id: 'notifications',
      label: t.navNotifications,
      icon: Bell,
      badge: unreadCount,
    },
    { id: 'profile', label: t.navProfile, icon: UserIcon },
  ];

  const isMobileChatThread = tab === 'chat' && mobileThreadOpen;

  return (
    <div className="min-h-screen bg-white lg:bg-slate-50 dark:bg-slate-900 lg:dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* WhatsApp-Style Mobile Compact Sticky Top Bar (hidden inside active chat thread for full-screen chat) */}
      {!isMobileChatThread && (
        <header className="lg:hidden sticky top-0 z-30 h-13 px-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setMobileThreadOpen(false);
              setTab('chat');
            }}
            className="font-display text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0"
          >
            {t.appName}
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setUpdatesSubTab('youtube');
                setMobileThreadOpen(false);
                setTab('updates');
              }}
              aria-label={t.youtubeVideosSubTab}
              className={`min-h-[38px] px-3 rounded-full text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors border ${
                tab === 'updates' && updatesSubTab === 'youtube'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70 hover:bg-rose-100 dark:hover:bg-rose-900/50'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>YouTube</span>
            </button>

            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              aria-label={t.newPost}
              className="min-h-[38px] px-3 rounded-full bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{t.newPost}</span>
            </button>
          </div>
        </header>
      )}

      {/* Full-Width Responsive Shell (Edge-to-edge on mobile, wide 2-or-3 column workspace on desktop) */}
      <div
        className={`w-full max-w-[1600px] mx-auto grid grid-cols-1 items-start ${
          tab === 'chat'
            ? 'lg:grid-cols-[232px_minmax(0,1fr)]'
            : 'lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)_300px]'
        } ${
          isMobileChatThread
            ? 'px-0 py-0 lg:px-6 lg:py-4 gap-0 lg:gap-5'
            : tab === 'chat'
              ? 'px-0 py-0 pb-15 lg:px-6 lg:py-4 lg:pb-4 gap-0 lg:gap-5'
              : 'px-3 sm:px-6 lg:px-6 py-3 lg:py-4 pb-20 lg:pb-8 gap-5'
        }`}
      >
        {/* Desktop Left Navigation Rail */}
        <aside className="hidden lg:flex flex-col justify-between sticky top-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 h-[calc(100dvh-2rem)] min-h-[540px]">
          <div>
            <button
              type="button"
              onClick={() => setTab('chat')}
              className="px-3 py-2 text-left font-display text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 whitespace-nowrap block w-full"
            >
              {t.appName}
            </button>

            <nav aria-label="Primary Navigation" className="mt-5 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-3">
                      <Icon className="w-[18px] h-[18px]" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold inline-flex items-center justify-center tabular-nums">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="mt-6 w-full min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{t.createPost}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUpdatesSubTab('youtube');
                setTab('updates');
              }}
              className={`mt-2 w-full min-h-[42px] px-4 rounded-xl text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap border ${
                tab === 'updates' && updatesSubTab === 'youtube'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/50'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>{t.youtubeVideosSubTab}</span>
            </button>

            <div className="mt-4">
              <LanguageSwitcher
                language={settings.language}
                onChange={handleChangeLanguage}
              />
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setTab('profile')}
              className="flex items-center gap-3 text-left min-w-0 hover:opacity-80 transition-opacity"
            >
              <Avatar
                name={currentUser.name}
                src={currentUser.avatarUrl}
                size="sm"
                online
              />
              <div className="min-w-0">
                <p className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {currentUser.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {currentUser.handle}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              aria-label={t.signOut}
              title={t.signOut}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* Center Viewport */}
        <main className="min-w-0 space-y-4">
          {!isMobileChatThread && <PWAInstallBanner pwa={pwa} t={t} />}
          {!isMobileChatThread && !pwa.showInstallBanner && (
            <NotificationPromptBanner
              notif={webNotif}
              t={t}
              onShowToast={(msg) => setToast(msg)}
            />
          )}
          {tab === 'chat' && (
            <ChatView
              users={users}
              currentUser={currentUser}
              currentUserId={currentUser.id}
              currentUserName={currentUser.name}
              language={settings.language}
              dmThreads={dmThreads}
              groups={groups}
              channels={channels}
              followedChannelIds={followedChannelIds}
              readSeqByRoom={readSeqByRoom}
              activeConversation={activeConversation}
              mobileThreadOpen={mobileThreadOpen}
              deepThinkMessages={deepThinkMessages}
              t={t}
              onSelectConversation={(conv, openMobile) => {
                setActiveConversation(conv);
                if (openMobile) setMobileThreadOpen(true);
              }}
              onCloseMobileThread={() => setMobileThreadOpen(false)}
              onAddDeepThinkMessage={(msg) =>
                setDeepThinkMessages((prev) => [...prev, msg])
              }
              onOpenRoomModal={(mode, group) => {
                setEditingGroup(group ?? null);
                setRoomModalMode(mode);
              }}
              onOpenVipManager={(channel) => {
                setVipManagingChannelId(channel.id);
              }}
              onToggleFollowChannel={(channelId, currentlyFollowing) =>
                void handleToggleFollowChannel(channelId, currentlyFollowing)
              }
              onStartCall={(peer, callType) => {
                setOutgoingCall({ peer, callType });
              }}
              onShowToast={(msg) => setToast(msg)}
            />
          )}

          {tab === 'updates' && (
            <UpdatesView
              channels={channels}
              followedChannelIds={followedChannelIds}
              posts={posts}
              sponsoredPosts={sponsoredPosts}
              isAdmin={isOwnerAdmin}
              users={users}
              currentUser={currentUser}
              t={t}
              onOpenCreateChannel={() => {
                setEditingGroup(null);
                setRoomModalMode('channel');
              }}
              onOpenSponsoredModal={() => setSponsoredModalOpen(true)}
              onOpenChannel={(channelId) => {
                setActiveConversation({ kind: 'channel', channelId });
                setMobileThreadOpen(true);
                setTab('chat');
              }}
              onToggleFollowChannel={(channelId, currentlyFollowing) =>
                void handleToggleFollowChannel(channelId, currentlyFollowing)
              }
              onOpenPostComposer={(initialPick) => {
                setComposerMediaPick(initialPick ?? null);
                setComposerOpen(true);
              }}
              onToggleLike={handleToggleLike}
              onAddComment={handleAddComment}
              onSaveAnalysis={handleSaveAnalysis}
              onShare={handleShare}
              onDeletePost={handleDeletePost}
              subTab={updatesSubTab}
              onSubTabChange={setUpdatesSubTab}
            />
          )}

          {tab === 'communities' && (
            <CommunitiesView
              groups={groups}
              users={users}
              currentUserId={currentUser.id}
              t={t}
              onOpenCreateGroup={() => {
                setEditingGroup(null);
                setRoomModalMode('group');
              }}
              onOpenGroup={(groupId) => {
                setActiveConversation({ kind: 'group', groupId });
                setMobileThreadOpen(true);
                setTab('chat');
              }}
              onOpenPrivateChat={openPrivateChat}
              onToggleFollow={(id) => void handleToggleFollow(id)}
            />
          )}

          {tab === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              users={users}
              t={t}
              onMarkAllRead={() =>
                void markAllFirestoreNotificationsRead(
                  notifications.filter((n) => !n.read).map((n) => n.id),
                )
              }
              onMarkRead={(id) => void markFirestoreNotificationRead(id)}
            />
          )}

          {tab === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              userContact={authUser.email || authUser.phoneNumber || null}
              userPosts={userPosts}
              isAdmin={isOwnerAdmin}
              onOpenSponsoredModal={() => setSponsoredModalOpen(true)}
              settings={settings}
              t={t}
              onUpdateProfile={handleUpdateProfile}
              onUpdateSettings={(next) =>
                setSettings((prev) => ({ ...prev, ...next }))
              }
              onChangeLanguage={handleChangeLanguage}
              onSignOut={handleSignOut}
              onToggleLike={handleToggleLike}
              onAddComment={handleAddComment}
              onSaveAnalysis={handleSaveAnalysis}
              onShare={handleShare}
              onDeletePost={handleDeletePost}
              pwa={pwa}
              notif={webNotif}
              onShowToast={(msg) => setToast(msg)}
            />
          )}
        </main>

        {/* Desktop Right Rail (shown on feed/communities/notifications/profile tabs so ChatView stays ultra-wide) */}
        {tab !== 'chat' && (
          <DeepThinkPanel
            users={users}
            currentUserId={currentUser.id}
            t={t}
            onToggleFollow={(id) => void handleToggleFollow(id)}
            onOpenDeepThinkChat={() => {
              setActiveConversation({ kind: 'deep_think' });
              setMobileThreadOpen(true);
              setTab('chat');
            }}
          />
        )}
      </div>

      {/* WhatsApp-Style Mobile Fixed Bottom Navigation Bar (hidden inside active chat thread) */}
      {!isMobileChatThread && (
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-15 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 grid grid-cols-5 items-center"
        >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'chat' && tab === 'chat') {
                  setMobileThreadOpen(false);
                }
                setTab(item.id);
              }}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors relative ${
                active
                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <div
                className={`relative px-3.5 py-1 rounded-full transition-colors ${
                  active
                    ? 'bg-emerald-100/90 dark:bg-emerald-950/70'
                    : 'bg-transparent'
                }`}
              >
                <Icon className="w-5 h-5" />
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute -top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[74px] text-[10px]">
                {item.label}
              </span>
            </button>
          );
        })}
        </nav>
      )}

      {/* Sabon Post Modal */}
      <CreatePostModal
        isOpen={composerOpen}
        authorId={currentUser.id}
        authorName={currentUser.name}
        initialMediaPick={composerMediaPick}
        t={t}
        onClose={() => {
          setComposerOpen(false);
          setComposerMediaPick(null);
        }}
        onPublish={handlePublishPost}
      />

      {/* Create Group / Channel / Private Chat / Manage Members Modal */}
      <CreateRoomModal
        mode={roomModalMode}
        users={users}
        currentUserId={currentUser.id}
        existingGroup={editingGroup}
        t={t}
        onClose={() => {
          setRoomModalMode(null);
          setEditingGroup(null);
        }}
        onCreateGroup={async ({ name, description, memberIds }) => {
          const groupId = await createFirestoreGroup({
            creatorId: currentUser.id,
            name,
            description,
            memberIds,
          });
          setActiveConversation({ kind: 'group', groupId });
          setMobileThreadOpen(true);
          setTab('chat');
          setToast(t.toastGroupCreated);
          return groupId;
        }}
        onUpdateGroupMembers={async ({ groupId, memberIds }) => {
          await updateFirestoreGroupMembers({
            groupId,
            creatorId: currentUser.id,
            memberIds,
          });
          setToast(t.toastProfileSaved);
        }}
        onCreateChannel={async ({
          name,
          description,
          isVip,
          vipBillingCycle,
          vipPriceLabel,
          vipPaymentInfo,
        }) => {
          const channelId = await createFirestoreChannel({
            creatorId: currentUser.id,
            creatorName: currentUser.name,
            name,
            description,
            isVip,
            vipBillingCycle,
            vipPriceLabel,
            vipPaymentInfo,
          });
          setActiveConversation({ kind: 'channel', channelId });
          setMobileThreadOpen(true);
          setTab('chat');
          setToast(t.toastChannelCreated);
          return channelId;
        }}
        onStartPrivateChat={openPrivateChat}
        onOpenCreatedRoom={(kind, roomId) => {
          if (kind === 'group') {
            setActiveConversation({ kind: 'group', groupId: roomId });
          } else {
            setActiveConversation({ kind: 'channel', channelId: roomId });
          }
          setMobileThreadOpen(true);
          setTab('chat');
        }}
      />

      {/* Admin Sponsored Posts Modal */}
      {isOwnerAdmin && (
        <SponsoredPostModal
          isOpen={sponsoredModalOpen}
          ads={sponsoredPosts}
          t={t}
          onClose={() => setSponsoredModalOpen(false)}
          onCreateAd={async (params) => {
            await createSponsoredPost({
              authorId: currentUser.id,
              ...params,
            });
            setToast(t.toastAdPublished);
          }}
          onToggleStatus={async (adId, nextStatus) => {
            await toggleSponsoredPostStatus({ adId, nextStatus });
          }}
          onDeleteAd={async (adId) => {
            await deleteSponsoredPost(adId);
          }}
        />
      )}

      {/* VIP Channel Creator Management Modal */}
      <VipChannelModal
        channel={
          vipManagingChannelId
            ? channels.find((c) => c.id === vipManagingChannelId) ?? null
            : null
        }
        users={users}
        currentUserId={currentUser.id}
        t={t}
        onClose={() => setVipManagingChannelId(null)}
        onSaveSettings={async ({
          channelId,
          vipBillingCycle,
          vipPriceLabel,
          vipPaymentInfo,
        }) => {
          await updateFirestoreChannelVipSettings({
            channelId,
            creatorId: currentUser.id,
            vipBillingCycle,
            vipPriceLabel,
            vipPaymentInfo,
          });
          setToast(t.vipSettingsSaved);
        }}
        onGrantVip={async (channelId, userId) => {
          await grantChannelVipAccess({
            channelId,
            creatorId: currentUser.id,
            userId,
          });
          setToast(t.vipActiveBadge);
        }}
        onRevokeVip={async (channelId, userId) => {
          await revokeChannelVipAccess({
            channelId,
            creatorId: currentUser.id,
            userId,
          });
        }}
        onToast={(msg) => setToast(msg)}
      />

      {/* Real-Time Audio / Video Call Overlay */}
      {(outgoingCall || incomingCall) && (
        <CallOverlay
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          outgoingCall={outgoingCall}
          incomingCall={outgoingCall ? null : incomingCall}
          users={users}
          t={t}
          onClose={(statusMessage) => {
            setOutgoingCall(null);
            setIncomingCall(null);
            if (statusMessage) setToast(statusMessage);
          }}
        />
      )}

      {/* Non-blocking Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium shadow-lg whitespace-nowrap"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

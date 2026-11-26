import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  Link2,
  Loader2,
  Lock,
  Megaphone,
  Search,
  Share2,
  Users,
  X,
} from 'lucide-react';
import { GroupRoom, UserProfile, VipBillingCycle } from '../types/social';
import { Translations } from '../lib/i18n';
import {
  buildRoomInviteLink,
  copyTextToClipboard,
  getCachedShortInviteLink,
  RoomInviteKind,
  shareOrCopyInviteLink,
  shortenRoomInviteLink,
} from '../lib/inviteLinks';
import { Avatar } from './Avatar';

export type RoomModalMode = 'group' | 'channel' | 'private' | 'group_members';

interface CreateRoomModalProps {
  mode: RoomModalMode | null;
  users: UserProfile[];
  currentUserId: string;
  existingGroup?: GroupRoom | null;
  t: Translations;
  onClose: () => void;
  onCreateGroup: (params: {
    name: string;
    description: string;
    memberIds: string[];
  }) => Promise<string | void>;
  onUpdateGroupMembers?: (params: {
    groupId: string;
    memberIds: string[];
  }) => Promise<void>;
  onCreateChannel: (params: {
    name: string;
    description: string;
    isVip?: boolean;
    vipBillingCycle?: VipBillingCycle;
    vipPriceLabel?: string;
    vipPaymentInfo?: string;
  }) => Promise<string | void>;
  onStartPrivateChat: (userId: string) => void;
  onOpenCreatedRoom?: (kind: RoomInviteKind, roomId: string) => void;
}

export function CreateRoomModal({
  mode,
  users,
  currentUserId,
  existingGroup,
  t,
  onClose,
  onCreateGroup,
  onUpdateGroupMembers,
  onCreateChannel,
  onStartPrivateChat,
  onOpenCreatedRoom,
}: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isVipChannel, setIsVipChannel] = useState(false);
  const [vipBillingCycle, setVipBillingCycle] =
    useState<VipBillingCycle>('monthly');
  const [vipPriceLabel, setVipPriceLabel] = useState('');
  const [vipPaymentInfo, setVipPaymentInfo] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{
    kind: RoomInviteKind;
    id: string;
    name: string;
    url: string;
  } | null>(null);
  const [shorteningInvite, setShorteningInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    if (!mode) {
      setCreatedInvite(null);
      setShorteningInvite(false);
      setInviteCopied(false);
      return;
    }
    setName('');
    setDescription('');
    setIsVipChannel(false);
    setVipBillingCycle('monthly');
    setVipPriceLabel('');
    setVipPaymentInfo('');
    setMemberSearch('');
    setError(null);
    setCreatedInvite(null);
    setShorteningInvite(false);
    setInviteCopied(false);
    if (mode === 'group_members' && existingGroup) {
      setSelectedIds(
        existingGroup.memberIds.filter((id) => id !== currentUserId),
      );
    } else {
      setSelectedIds([]);
    }
  }, [mode, existingGroup, currentUserId]);

  const createdKind = createdInvite?.kind ?? null;
  const createdId = createdInvite?.id ?? null;

  useEffect(() => {
    if (!createdKind || !createdId) return;
    const cached = getCachedShortInviteLink(createdKind, createdId);
    if (cached) {
      setCreatedInvite((prev) =>
        prev && prev.id === createdId && prev.kind === createdKind
          ? { ...prev, url: cached }
          : prev,
      );
      return;
    }
    let active = true;
    setShorteningInvite(true);
    void shortenRoomInviteLink(createdKind, createdId)
      .then((res) => {
        if (!active) return;
        setCreatedInvite((prev) =>
          prev && prev.id === createdId && prev.kind === createdKind
            ? { ...prev, url: res.url }
            : prev,
        );
      })
      .finally(() => {
        if (active) setShorteningInvite(false);
      });
    return () => {
      active = false;
    };
  }, [createdKind, createdId]);

  if (!mode) return null;

  const peers = users.filter((u) => u.id !== currentUserId);
  const q = memberSearch.trim().toLowerCase();
  const filteredPeers = q
    ? peers.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q),
      )
    : peers;

  const toggleMember = (uid: string) => {
    setSelectedIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (mode === 'group_members' && existingGroup && onUpdateGroupMembers) {
      setSubmitting(true);
      try {
        await onUpdateGroupMembers({
          groupId: existingGroup.id,
          memberIds: selectedIds,
        });
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to update members.',
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!name.trim()) {
      setError(
        mode === 'group' ? t.groupNameLabel : t.channelNameLabel,
      );
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'group') {
        const cleanName = name.trim();
        const createdId = await onCreateGroup({
          name: cleanName,
          description: description.trim(),
          memberIds: selectedIds,
        });
        if (typeof createdId === 'string' && createdId) {
          setCreatedInvite({
            kind: 'group',
            id: createdId,
            name: cleanName,
            url: buildRoomInviteLink('group', createdId),
          });
          return;
        }
      } else if (mode === 'channel') {
        const cleanName = name.trim();
        const createdId = await onCreateChannel({
          name: cleanName,
          description: description.trim(),
          isVip: isVipChannel,
          vipBillingCycle: isVipChannel ? vipBillingCycle : undefined,
          vipPriceLabel: isVipChannel ? vipPriceLabel.trim() : undefined,
          vipPaymentInfo: isVipChannel ? vipPaymentInfo.trim() : undefined,
        });
        if (typeof createdId === 'string' && createdId) {
          setCreatedInvite({
            kind: 'channel',
            id: createdId,
            name: cleanName,
            url: buildRoomInviteLink('channel', createdId),
          });
          return;
        }
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to complete action.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const title = createdInvite
    ? createdInvite.kind === 'group'
      ? t.groupInviteReadyTitle
      : t.channelInviteReadyTitle
    : mode === 'private'
      ? t.newPrivateChat
      : mode === 'group'
        ? t.createGroup
        : mode === 'group_members'
          ? `${t.manageMembersBtn} · ${existingGroup?.name ?? ''}`
          : t.createChannel;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[88vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              {createdInvite ? (
                <Link2 className="w-4 h-4" />
              ) : mode === 'private' ? (
                <Lock className="w-4 h-4" />
              ) : mode === 'channel' ? (
                <Megaphone className="w-4 h-4" />
              ) : (
                <Users className="w-4 h-4" />
              )}
            </div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.cancel}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdInvite ? (
          <div className="p-5 space-y-4 overflow-y-auto">
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/35 p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {createdInvite.name}
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    {t.inviteLinkDesc}
                  </p>
                </div>
              </div>

              <input
                type="text"
                readOnly
                value={createdInvite.url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t.inviteLinkTitle}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-100 select-all focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />

              {shorteningInvite && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{t.shorteningLinkLabel}</span>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyTextToClipboard(createdInvite.url);
                    if (ok) {
                      setInviteCopied(true);
                      window.setTimeout(() => setInviteCopied(false), 2200);
                    }
                  }}
                  className="min-h-[42px] px-4 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  {inviteCopied ? (
                    <Check className="w-4 h-4 shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {inviteCopied ? t.linkCopiedToast : t.copyInviteLinkBtn}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const outcome = await shareOrCopyInviteLink({
                      title: createdInvite.name,
                      text: `${t.inviteLinkTitle}: ${createdInvite.name}`,
                      url: createdInvite.url,
                    });
                    if (outcome === 'copied') {
                      setInviteCopied(true);
                      window.setTimeout(() => setInviteCopied(false), 2200);
                    }
                  }}
                  className="min-h-[42px] px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>{t.shareInviteLinkBtn}</span>
                </button>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onOpenCreatedRoom) {
                    onOpenCreatedRoom(createdInvite.kind, createdInvite.id);
                  }
                  onClose();
                }}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                {t.openRoomBtn}
              </button>
            </div>
          </div>
        ) : mode === 'private' ? (
          <div className="p-5 space-y-3 overflow-y-auto">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.startPrivateChatHint}
            </p>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={t.searchPeoplePlaceholder}
                className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[340px] overflow-y-auto">
              {filteredPeers.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t.noSearchResultsHint}
                </p>
              ) : (
                filteredPeers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      onStartPrivateChat(user.id);
                      onClose();
                    }}
                    className="w-full min-h-[56px] py-2.5 px-2 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={user.name}
                        src={user.avatarUrl}
                        size="sm"
                        online={user.isOnline}
                      />
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {user.handle}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{t.privateChatLabel}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-5 space-y-4 overflow-y-auto"
          >
            {error && (
              <div className="rounded-xl p-3 text-sm bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                {error}
              </div>
            )}

            {mode !== 'group_members' && (
              <>
                <div>
                  <label
                    htmlFor="room-name"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
                  >
                    {mode === 'group' ? t.groupNameLabel : t.channelNameLabel}
                  </label>
                  <input
                    id="room-name"
                    type="text"
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      mode === 'group' ? t.groupNameLabel : t.channelNameLabel
                    }
                    className="w-full min-h-[46px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="room-desc"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
                  >
                    {mode === 'group' ? t.groupDescLabel : t.channelDescLabel}
                  </label>
                  <textarea
                    id="room-desc"
                    rows={2}
                    maxLength={280}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      mode === 'group' ? t.groupDescLabel : t.channelDescLabel
                    }
                    className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
                  />
                </div>

                {mode === 'channel' && (
                  <div className="rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 space-y-3">
                    <button
                      type="button"
                      onClick={() => setIsVipChannel((prev) => !prev)}
                      aria-pressed={isVipChannel}
                      className="w-full flex items-center justify-between gap-3 text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {t.vipChannelToggleLabel}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t.vipChannelToggleHint}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                          isVipChannel
                            ? 'bg-amber-600'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                            isVipChannel ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </button>

                    {isVipChannel && (
                      <div className="space-y-3 pt-2 border-t border-amber-200/70 dark:border-amber-800/50">
                        <div>
                          <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            {t.vipBillingTypeLabel}
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setVipBillingCycle('monthly')}
                              className={`p-2.5 rounded-xl border text-left transition-colors ${
                                vipBillingCycle === 'monthly'
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <p className="text-xs font-bold">
                                {t.vipBillingMonthlyLabel}
                              </p>
                              <p
                                className={`text-[11px] mt-0.5 ${
                                  vipBillingCycle === 'monthly'
                                    ? 'text-amber-50'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {t.vipBillingMonthlyHint}
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => setVipBillingCycle('once')}
                              className={`p-2.5 rounded-xl border text-left transition-colors ${
                                vipBillingCycle === 'once'
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <p className="text-xs font-bold">
                                {t.vipBillingOnceLabel}
                              </p>
                              <p
                                className={`text-[11px] mt-0.5 ${
                                  vipBillingCycle === 'once'
                                    ? 'text-amber-50'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {t.vipBillingOnceHint}
                              </p>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="vip-price"
                            className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                          >
                            {t.vipPriceLabelField}
                          </label>
                          <input
                            id="vip-price"
                            type="text"
                            maxLength={60}
                            value={vipPriceLabel}
                            onChange={(e) => setVipPriceLabel(e.target.value)}
                            placeholder={
                              vipBillingCycle === 'once'
                                ? '₦5,000 (Sau ɗaya)'
                                : '₦2,000 / wata'
                            }
                            className="w-full min-h-[42px] px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="vip-payment"
                            className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                          >
                            {t.vipPaymentInfoField}
                          </label>
                          <textarea
                            id="vip-payment"
                            rows={2}
                            maxLength={500}
                            value={vipPaymentInfo}
                            onChange={(e) => setVipPaymentInfo(e.target.value)}
                            placeholder={t.vipPaymentInfoPlaceholder}
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {(mode === 'group' || mode === 'group_members') && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {t.selectMembersLabel}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {selectedIds.length + 1} {t.membersWord}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder={t.searchPeoplePlaceholder}
                    className="w-full min-h-[42px] pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-2">
                  {filteredPeers.length === 0 ? (
                    <p className="py-5 text-center text-xs text-slate-500 dark:text-slate-400">
                      {t.noSearchResultsHint}
                    </p>
                  ) : (
                    filteredPeers.map((peer) => {
                      const checked = selectedIds.includes(peer.id);
                      return (
                        <button
                          key={peer.id}
                          type="button"
                          onClick={() => toggleMember(peer.id)}
                          className="w-full min-h-[52px] py-2 px-2 flex items-center justify-between gap-3 text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              name={peer.name}
                              src={peer.avatarUrl}
                              size="sm"
                              online={peer.isOnline}
                            />
                            <div className="min-w-0">
                              <p className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                                {peer.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {peer.handle}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                              checked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {submitting
                  ? t.saving
                  : mode === 'group'
                    ? t.createGroup
                    : mode === 'group_members'
                      ? t.save
                      : t.createChannel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

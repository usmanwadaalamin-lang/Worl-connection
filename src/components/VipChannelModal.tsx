import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crown,
  ImageIcon,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  UserMinus,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import {
  ChannelRoom,
  ChannelVipMemberItem,
  ChannelVipReceipt,
  UserProfile,
  VipBillingCycle,
} from '../types/social';
import { Translations } from '../lib/i18n';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  approveChannelVipReceipt,
  formatFirestoreTime,
  pruneExpiredChannelVipMembers,
  rejectChannelVipReceipt,
} from '../lib/firestoreSocial';
import { Avatar } from './Avatar';

interface VipChannelModalProps {
  channel: ChannelRoom | null;
  users: UserProfile[];
  currentUserId: string;
  t: Translations;
  onClose: () => void;
  onSaveSettings: (params: {
    channelId: string;
    vipBillingCycle: VipBillingCycle;
    vipPriceLabel: string;
    vipPaymentInfo: string;
  }) => Promise<void>;
  onGrantVip: (channelId: string, userId: string) => Promise<void>;
  onRevokeVip: (channelId: string, userId: string) => Promise<void>;
  onToast?: (msg: string) => void;
}

type ModalTab = 'receipts' | 'members';

export function VipChannelModal({
  channel,
  users,
  currentUserId,
  t,
  onClose,
  onSaveSettings,
  onGrantVip,
  onRevokeVip,
  onToast,
}: VipChannelModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('receipts');
  const [billingCycle, setBillingCycle] = useState<VipBillingCycle>('monthly');
  const [priceLabel, setPriceLabel] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyReceiptId, setBusyReceiptId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [vipMembers, setVipMembers] = useState<ChannelVipMemberItem[]>([]);
  const [receipts, setReceipts] = useState<ChannelVipReceipt[]>([]);

  useEffect(() => {
    if (!channel) return;
    setBillingCycle(channel.vipBillingCycle === 'once' ? 'once' : 'monthly');
    setPriceLabel(channel.vipPriceLabel ?? '');
    setPaymentInfo(channel.vipPaymentInfo ?? '');
    setMemberSearch('');
    setError(null);
    setZoomedImage(null);
  }, [channel]);

  useEffect(() => {
    if (!channel) {
      setVipMembers([]);
      setReceipts([]);
      return;
    }

    const channelId = channel.id;
    void pruneExpiredChannelVipMembers({
      channelId,
      creatorId: currentUserId,
    }).catch(() => {});

    const unsubMembers = onSnapshot(
      query(
        collection(db, 'channels', channelId, 'vipMembers'),
        where('grantedBy', '==', currentUserId),
      ),
      (snap) => {
        const list: ChannelVipMemberItem[] = snap.docs.map((d) => {
          const data = d.data();
          const expTs = data.expiresAt;
          const createdTs = data.createdAt;
          return {
            userId: String(data.userId ?? d.id),
            channelId: String(data.channelId ?? channelId),
            grantedBy: String(data.grantedBy ?? currentUserId),
            accessMode:
              data.accessMode === 'lifetime' ? 'lifetime' : 'monthly',
            expiresAtMs:
              expTs instanceof Timestamp ? expTs.toMillis() : null,
            durationDays:
              typeof data.durationDays === 'number' ? data.durationDays : 30,
            createdAtMs:
              createdTs instanceof Timestamp ? createdTs.toMillis() : Date.now(),
          };
        });
        setVipMembers(list);
      },
      (err) => {
        handleFirestoreError(
          err,
          OperationType.LIST,
          `channels/${channelId}/vipMembers`,
        );
      },
    );

    const unsubReceipts = onSnapshot(
      query(
        collection(db, 'channels', channelId, 'vipReceipts'),
        where('channelId', '==', channelId),
        where('creatorId', '==', currentUserId),
      ),
      (snap) => {
        const list: ChannelVipReceipt[] = snap.docs.map((d) => {
          const data = d.data();
          const { label, ms } = formatFirestoreTime(data.createdAt);
          const verdict =
            data.aiVerdict === 'match' ||
            data.aiVerdict === 'review' ||
            data.aiVerdict === 'mismatch' ||
            data.aiVerdict === 'unavailable'
              ? data.aiVerdict
              : 'review';
          const status =
            data.status === 'approved' || data.status === 'rejected'
              ? data.status
              : 'pending';
          return {
            id: d.id,
            channelId: String(data.channelId ?? channelId),
            creatorId: String(data.creatorId ?? currentUserId),
            userId: String(data.userId ?? ''),
            userName: String(data.userName ?? 'Member'),
            userHandle: String(data.userHandle ?? '@member'),
            amountText: String(data.amountText ?? ''),
            referenceText: String(data.referenceText ?? ''),
            note: String(data.note ?? ''),
            receiptImage:
              typeof data.receiptImage === 'string'
                ? data.receiptImage
                : undefined,
            status,
            aiVerdict: verdict,
            aiSummary: String(data.aiSummary ?? ''),
            reviewedBy:
              typeof data.reviewedBy === 'string' ? data.reviewedBy : undefined,
            createdAt: label,
            createdAtMs: ms,
          };
        });
        list.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          return b.createdAtMs - a.createdAtMs;
        });
        setReceipts(list);
      },
      (err) => {
        handleFirestoreError(
          err,
          OperationType.LIST,
          `channels/${channelId}/vipReceipts`,
        );
      },
    );

    return () => {
      unsubMembers();
      unsubReceipts();
    };
  }, [channel, currentUserId]);

  const memberRecordMap = useMemo(() => {
    const map = new Map<string, ChannelVipMemberItem>();
    for (const m of vipMembers) {
      map.set(m.userId, m);
    }
    return map;
  }, [vipMembers]);

  const pendingReceiptsCount = useMemo(
    () => receipts.filter((r) => r.status === 'pending').length,
    [receipts],
  );

  useEffect(() => {
    if (!channel) return;
    if (receipts.length === 0 && pendingReceiptsCount === 0) {
      // Keep default receipts tab unless creator switches
    }
  }, [channel, receipts.length, pendingReceiptsCount]);

  if (!channel) return null;

  const nowMs = Date.now();
  const vipSet = new Set(channel.vipMemberIds ?? []);
  const peers = users.filter((u) => u.id !== currentUserId);
  const q = memberSearch.trim().toLowerCase();
  const filteredPeers = (
    q
      ? peers.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.handle.toLowerCase().includes(q),
        )
      : peers
  ).sort((a, b) => {
    const av = vipSet.has(a.id) || memberRecordMap.has(a.id) ? 0 : 1;
    const bv = vipSet.has(b.id) || memberRecordMap.has(b.id) ? 0 : 1;
    if (av !== bv) return av - bv;
    return a.name.localeCompare(b.name);
  });

  const activeSubscribersCount = Math.max(
    0,
    (channel.vipMemberIds ?? []).filter((id) => id !== currentUserId).length,
  );

  const isOneTimeChannel = channel.vipBillingCycle === 'once';

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSettings) return;
    setError(null);
    setSavingSettings(true);
    try {
      await onSaveSettings({
        channelId: channel.id,
        vipBillingCycle: billingCycle,
        vipPriceLabel: priceLabel.trim(),
        vipPaymentInfo: paymentInfo.trim(),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save VIP settings.',
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const renderVerdictBadge = (verdict: ChannelVipReceipt['aiVerdict']) => {
    if (verdict === 'match') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          <span>{t.vipVerdictMatch}</span>
        </span>
      );
    }
    if (verdict === 'mismatch') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 text-[11px] font-semibold">
          <XCircle className="w-3 h-3" />
          <span>{t.vipVerdictMismatch}</span>
        </span>
      );
    }
    if (verdict === 'review') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
          <AlertTriangle className="w-3 h-3" />
          <span>{t.vipVerdictReview}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
        <Clock className="w-3 h-3" />
        <span>{t.vipVerdictUnavailable}</span>
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.vipMembersTitle}
    >
      <div className="w-full sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {t.vipMembersTitle} · {channel.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t.vipMembersSub}
              </p>
            </div>
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

        {/* Sub-Navigation Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('receipts')}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'receipts'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ReceiptText className="w-4 h-4 shrink-0" />
            <span>{t.vipReceiptsTab}</span>
            {pendingReceiptsCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                  activeTab === 'receipts'
                    ? 'bg-white text-amber-700'
                    : 'bg-amber-600 text-white'
                }`}
              >
                {pendingReceiptsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'members'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              {t.vipMembersTab} ({activeSubscribersCount})
            </span>
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="rounded-xl p-3 text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              {error}
            </div>
          )}

          {activeTab === 'receipts' ? (
            <div className="space-y-4">
              <div className="rounded-xl p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                {t.vipSafetyTip}
              </div>

              {receipts.length === 0 ? (
                <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl px-4">
                  <ReceiptText className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {t.vipNoReceiptsYet}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receipts.map((rec) => {
                    const busy = busyReceiptId === rec.id;
                    return (
                      <div
                        key={rec.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {rec.userName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {rec.userHandle} · {rec.createdAt}
                            </p>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                              rec.status === 'approved'
                                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                : rec.status === 'rejected'
                                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300'
                                  : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {rec.status === 'approved'
                              ? t.vipApprovedStatus
                              : rec.status === 'rejected'
                                ? t.vipRejectedStatus
                                : t.vipPendingStatus}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2">
                            <span className="text-slate-400 block text-[11px]">
                              {t.vipAmountPaidLabel}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {rec.amountText}
                            </span>
                          </div>
                          {rec.referenceText && (
                            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2">
                              <span className="text-slate-400 block text-[11px]">
                                {t.vipReferenceLabel}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                                {rec.referenceText}
                              </span>
                            </div>
                          )}
                        </div>

                        {rec.note && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                            {rec.note}
                          </p>
                        )}

                        {rec.receiptImage && (
                          <button
                            type="button"
                            onClick={() => setZoomedImage(rec.receiptImage!)}
                            className="group relative block w-full max-w-[220px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          >
                            <img
                              src={rec.receiptImage}
                              alt={`Receipt from ${rec.userName}`}
                              className="w-full max-h-44 object-cover"
                            />
                            <span className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-slate-950/75 text-white text-[10px] font-semibold inline-flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              <span>Duba Hoto</span>
                            </span>
                          </button>
                        )}

                        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            {renderVerdictBadge(rec.aiVerdict)}
                          </div>
                          {rec.aiSummary && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {rec.aiSummary}
                            </p>
                          )}
                        </div>

                        {rec.status === 'pending' && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                setBusyReceiptId(rec.id);
                                setError(null);
                                try {
                                  await approveChannelVipReceipt({
                                    channelId: channel.id,
                                    receiptId: rec.id,
                                    creatorId: currentUserId,
                                    subscriberId: rec.userId,
                                  });
                                  onToast?.(t.vipActiveBadge);
                                } catch (err) {
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Unable to approve receipt.',
                                  );
                                } finally {
                                  setBusyReceiptId(null);
                                }
                              }}
                              className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                {isOneTimeChannel
                                  ? t.vipApproveLifetimeBtn
                                  : t.vipApproveAndGrantBtn}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                setBusyReceiptId(rec.id);
                                setError(null);
                                try {
                                  await rejectChannelVipReceipt({
                                    channelId: channel.id,
                                    receiptId: rec.id,
                                    creatorId: currentUserId,
                                  });
                                } catch (err) {
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Unable to reject receipt.',
                                  );
                                } finally {
                                  setBusyReceiptId(null);
                                }
                              }}
                              className="min-h-[42px] px-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>{t.vipRejectReceiptBtn}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Edit VIP Billing Cycle, Price & Payment Details */}
              <form onSubmit={handleSaveSettings} className="space-y-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    {t.vipBillingTypeLabel}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`p-2.5 rounded-xl border text-left transition-colors ${
                        billingCycle === 'monthly'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <p className="text-xs font-bold">
                        {t.vipBillingMonthlyLabel}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          billingCycle === 'monthly'
                            ? 'text-amber-50'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {t.vipBillingMonthlyHint}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBillingCycle('once')}
                      className={`p-2.5 rounded-xl border text-left transition-colors ${
                        billingCycle === 'once'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <p className="text-xs font-bold">
                        {t.vipBillingOnceLabel}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          billingCycle === 'once'
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
                    htmlFor="vip-edit-price"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                  >
                    {t.vipPriceLabelField}
                  </label>
                  <input
                    id="vip-edit-price"
                    type="text"
                    maxLength={60}
                    value={priceLabel}
                    onChange={(e) => setPriceLabel(e.target.value)}
                    placeholder={
                      billingCycle === 'once'
                        ? '₦5,000 (Sau ɗaya)'
                        : '₦2,000 / wata'
                    }
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vip-edit-payment"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                  >
                    {t.vipPaymentInfoField}
                  </label>
                  <textarea
                    id="vip-edit-payment"
                    rows={3}
                    maxLength={500}
                    value={paymentInfo}
                    onChange={(e) => setPaymentInfo(e.target.value)}
                    placeholder={t.vipPaymentInfoPlaceholder}
                    className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="min-h-[40px] px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {savingSettings ? t.saving : t.save}
                  </button>
                </div>
              </form>

              {/* Approve / Renew / Revoke VIP Subscribers */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t.manageVipBtn} ({activeSubscribersCount}/49)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {t.vipMemberLimitNote}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder={t.searchPeoplePlaceholder}
                    className="w-full min-h-[42px] pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-2">
                  {filteredPeers.length === 0 ? (
                    <p className="py-5 text-center text-xs text-slate-500 dark:text-slate-400">
                      {t.noSearchResultsHint}
                    </p>
                  ) : (
                    filteredPeers.map((peer) => {
                      const rec = memberRecordMap.get(peer.id);
                      const isLifetime = rec?.accessMode === 'lifetime';
                      const isExpired = Boolean(
                        !isLifetime &&
                          rec &&
                          rec.expiresAtMs !== null &&
                          rec.expiresAtMs <= nowMs,
                      );
                      const isActiveVip = Boolean(
                        (rec && (isLifetime || !isExpired)) ||
                          (!rec && vipSet.has(peer.id)),
                      );
                      const daysRemaining =
                        !isLifetime &&
                        rec &&
                        rec.expiresAtMs !== null &&
                        rec.expiresAtMs > nowMs
                          ? Math.max(
                              1,
                              Math.ceil(
                                (rec.expiresAtMs - nowMs) /
                                  (24 * 60 * 60 * 1000),
                              ),
                            )
                          : null;
                      const busy = busyUserId === peer.id;

                      return (
                        <div
                          key={peer.id}
                          className="py-2.5 px-2 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              name={peer.name}
                              src={peer.avatarUrl}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                                  {peer.name}
                                </p>
                                {isActiveVip && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                                    {isLifetime
                                      ? t.vipOnceBadge
                                      : daysRemaining !== null
                                        ? `${daysRemaining} ${t.vipDaysWord}`
                                        : t.vipActiveBadge}
                                  </span>
                                )}
                                {isExpired && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 text-[10px] font-bold">
                                    {t.vipExpiredBadge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {peer.handle}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {(!isActiveVip || !isOneTimeChannel || !isLifetime) && (
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  (!isActiveVip && activeSubscribersCount >= 49)
                                }
                                onClick={async () => {
                                  setBusyUserId(peer.id);
                                  setError(null);
                                  try {
                                    await onGrantVip(channel.id, peer.id);
                                  } catch (err) {
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Unable to update VIP status.',
                                    );
                                  } finally {
                                    setBusyUserId(null);
                                  }
                                }}
                                className="min-h-[36px] px-2.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                              >
                                {isActiveVip || isExpired ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>
                                      {isOneTimeChannel
                                        ? t.vipOnceBadge
                                        : t.vipRenewBtn}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>{t.grantVipBtn}</span>
                                  </>
                                )}
                              </button>
                            )}

                            {(isActiveVip || isExpired) && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusyUserId(peer.id);
                                  setError(null);
                                  try {
                                    await onRevokeVip(channel.id, peer.id);
                                  } catch (err) {
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Unable to revoke VIP access.',
                                    );
                                  } finally {
                                    setBusyUserId(null);
                                  }
                                }}
                                aria-label={t.revokeVipBtn}
                                title={t.revokeVipBtn}
                                className="min-h-[36px] px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-50 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Full-Screen Receipt Screenshot Preview */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <button
            type="button"
            onClick={() => setZoomedImage(null)}
            aria-label={t.cancel}
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={zoomedImage}
            alt="Payment receipt preview"
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

import { Crown, ExternalLink, Megaphone, Plus, Sparkles } from 'lucide-react';
import { ChannelRoom, Post, SponsoredPost, UserProfile } from '../types/social';
import { Translations } from '../lib/i18n';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';

interface UpdatesViewProps {
  channels: ChannelRoom[];
  followedChannelIds: Set<string>;
  posts: Post[];
  sponsoredPosts: SponsoredPost[];
  isAdmin: boolean;
  users: UserProfile[];
  currentUser: UserProfile;
  t: Translations;
  onOpenCreateChannel: () => void;
  onOpenSponsoredModal: () => void;
  onOpenChannel: (channelId: string) => void;
  onToggleFollowChannel: (channelId: string, currentlyFollowing: boolean) => void;
  onOpenPostComposer: () => void;
  onToggleLike: (post: Post, currentlyLiked: boolean) => Promise<void>;
  onAddComment: (post: Post, text: string) => Promise<void>;
  onSaveAnalysis: (postId: string, analysis: string) => Promise<void>;
  onShare: (post: Post) => void;
}

export function UpdatesView({
  channels,
  followedChannelIds,
  posts,
  sponsoredPosts,
  isAdmin,
  users,
  currentUser,
  t,
  onOpenCreateChannel,
  onOpenSponsoredModal,
  onOpenChannel,
  onToggleFollowChannel,
  onOpenPostComposer,
  onToggleLike,
  onAddComment,
  onSaveAnalysis,
  onShare,
}: UpdatesViewProps) {
  const activeAds = sponsoredPosts.filter((ad) => ad.status === 'active');

  return (
    <section aria-label={t.navUpdates} className="space-y-5">
      {/* Channels Section (WhatsApp Updates Style) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              {t.channelsTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.createChannelSub}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCreateChannel}
            className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t.createChannel}</span>
          </button>
        </div>

        {channels.length === 0 ? (
          <div className="py-5 text-center space-y-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t.emptyChannelsDesc}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
            {channels.map((ch) => {
              const isOwner = ch.creatorId === currentUser.id;
              const isFollowing = followedChannelIds.has(ch.id);
              return (
                <div
                  key={ch.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => onOpenChannel(ch.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-85 transition-opacity"
                  >
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                        ch.isVip
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {ch.isVip ? (
                        <Crown className="w-5 h-5" />
                      ) : (
                        <Megaphone className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {ch.name}
                          </p>
                          {ch.isVip && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wide shrink-0">
                              {t.vipBadge}
                              {ch.vipBillingCycle === 'once'
                                ? ` · ${t.vipOnceBadge}`
                                : ''}
                              {ch.vipPriceLabel ? ` · ${ch.vipPriceLabel}` : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                          {ch.updatedAt}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {ch.lastMessage || ch.description || ch.creatorName} ·{' '}
                        <span className="tabular-nums">{ch.followersCount}</span>{' '}
                        {t.followersWord}
                      </p>
                    </div>
                  </button>

                  {!isOwner && (
                    <button
                      type="button"
                      onClick={() => onToggleFollowChannel(ch.id, isFollowing)}
                      className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        isFollowing
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                      }`}
                    >
                      {isFollowing ? t.followingBtn : t.followBtn}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Post Composer Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <button
          type="button"
          onClick={onOpenPostComposer}
          className="w-full text-left flex items-center gap-3.5 min-h-[48px] group"
        >
          <Avatar
            name={currentUser.name}
            src={currentUser.avatarUrl}
            size="md"
            online={currentUser.isOnline ?? true}
          />
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
              {currentUser.name}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
              {t.whatsOnMind}
            </p>
          </div>
          <span className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors whitespace-nowrap shrink-0">
            <Plus className="w-4 h-4" />
            <span>{t.postAction}</span>
          </span>
        </button>
      </div>

      {/* Sponsored Posts (Admin-Managed Business Promotions) */}
      {(isAdmin || activeAds.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.sponsoredLabel}</span>
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenSponsoredModal}
                className="min-h-[36px] px-3 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.manageSponsoredBtn}</span>
              </button>
            )}
          </div>

          {activeAds.map((ad) => {
            const safeUrl = /^https?:\/\//i.test(ad.actionUrl)
              ? ad.actionUrl
              : '';
            return (
              <article
                key={ad.id}
                className="bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/25 dark:to-slate-900 border border-amber-200 dark:border-amber-800/70 rounded-2xl p-4 sm:p-5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wide shrink-0">
                      {t.sponsoredLabel}
                    </span>
                    <span className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {ad.businessName}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                    {ad.createdAt}
                  </span>
                </div>

                <h4 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                  {ad.headline}
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                  {ad.text}
                </p>

                {safeUrl && (
                  <div className="pt-1">
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] px-4 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors inline-flex items-center gap-2"
                    >
                      <span>{ad.ctaLabel}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Community Feed */}
      <div className="space-y-3">
        <h3 className="px-1 font-display text-sm font-bold text-slate-700 dark:text-slate-300">
          {t.communityFeedTitle}
        </h3>

        {posts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <p className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              {t.emptyFeedTitle}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t.emptyFeedDesc}
            </p>
            <button
              type="button"
              onClick={onOpenPostComposer}
              className="min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              {t.createFirstPost}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const author = users.find((u) => u.id === post.authorId);
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  author={author}
                  currentUserId={currentUser.id}
                  currentUserName={currentUser.name}
                  t={t}
                  onToggleLike={onToggleLike}
                  onAddComment={onAddComment}
                  onSaveAnalysis={onSaveAnalysis}
                  onShare={onShare}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

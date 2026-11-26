import { Lock, Plus, Search, UserCheck, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { GroupRoom, UserProfile } from '../types/social';
import { Translations } from '../lib/i18n';
import { Avatar } from './Avatar';

interface CommunitiesViewProps {
  groups: GroupRoom[];
  users: UserProfile[];
  currentUserId: string;
  t: Translations;
  onOpenCreateGroup: () => void;
  onOpenGroup: (groupId: string) => void;
  onOpenPrivateChat: (userId: string) => void;
  onToggleFollow: (userId: string) => void;
}

export function CommunitiesView({
  groups,
  users,
  currentUserId,
  t,
  onOpenCreateGroup,
  onOpenGroup,
  onOpenPrivateChat,
  onToggleFollow,
}: CommunitiesViewProps) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const peers = users.filter((u) => u.id !== currentUserId);
  const filteredPeers = q
    ? peers.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q) ||
          u.bio.toLowerCase().includes(q),
      )
    : peers;

  return (
    <section aria-label={t.navCommunities} className="space-y-5">
      {/* Groups Section (WhatsApp Communities Style) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              {t.navCommunities}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.createGroupSub}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCreateGroup}
            className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t.createGroup}</span>
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="py-6 text-center space-y-2 border-t border-slate-100 dark:border-slate-800">
            <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.emptyGroupsTitle}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t.emptyGroupsDesc}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
            {groups.map((grp) => (
              <button
                key={grp.id}
                type="button"
                onClick={() => onOpenGroup(grp.id)}
                className="w-full py-3 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl px-2 transition-colors min-h-[60px]"
              >
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {grp.name}
                    </p>
                    <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                      {grp.updatedAt}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {grp.lastMessage ||
                      grp.description ||
                      `${grp.memberIds.length} ${t.membersWord}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* People Directory & Private 1-on-1 Chat Launcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            {t.peopleOnAlAmana}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {peers.length}
          </span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPeoplePlaceholder}
            aria-label={t.searchPeoplePlaceholder}
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        {filteredPeers.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.noSearchResultsHint}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPeers.map((user) => (
              <div
                key={user.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={user.name}
                    src={user.avatarUrl}
                    size="md"
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

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenPrivateChat(user.id)}
                    className="min-h-[40px] px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t.privateChatLabel}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleFollow(user.id)}
                    aria-label={user.following ? t.followingBtn : t.followBtn}
                    className={`min-h-[40px] min-w-[40px] px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                      user.following
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {user.following ? (
                      <UserCheck className="w-3.5 h-3.5" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {user.following ? t.followingBtn : t.followBtn}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

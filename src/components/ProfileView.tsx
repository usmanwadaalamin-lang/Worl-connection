import { useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Camera,
  Download,
  Edit3,
  Info,
  Languages,
  Loader2,
  LogOut,
  Megaphone,
  Moon,
  Settings,
  Sun,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AppSettings, Post, UserProfile } from '../types/social';
import { compressAvatarImage } from '../lib/firestoreSocial';
import { Language, Translations } from '../lib/i18n';
import { PWAInstallState } from '../lib/usePWAInstall';
import { WebNotificationsState } from '../lib/useWebNotifications';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';
import { LanguageSwitcher } from './LanguageSwitcher';

interface ProfileViewProps {
  currentUser: UserProfile;
  userContact: string | null;
  userPosts: Post[];
  isAdmin?: boolean;
  onOpenSponsoredModal?: () => void;
  settings: AppSettings;
  t: Translations;
  onUpdateProfile: (
    name: string,
    bio: string,
    avatarUrl?: string,
  ) => Promise<void>;
  onUpdateSettings: (next: Partial<AppSettings>) => void;
  onChangeLanguage: (lang: Language) => void;
  onSignOut: () => Promise<void>;
  onToggleLike: (post: Post, currentlyLiked: boolean) => Promise<void>;
  onAddComment: (post: Post, text: string) => Promise<void>;
  onSaveAnalysis: (postId: string, analysis: string) => Promise<void>;
  onShare: (post: Post) => void;
  pwa?: PWAInstallState;
  notif?: WebNotificationsState;
  onShowToast?: (msg: string) => void;
}

export function ProfileView({
  currentUser,
  userContact,
  userPosts,
  isAdmin,
  onOpenSponsoredModal,
  settings,
  t,
  onUpdateProfile,
  onUpdateSettings,
  onChangeLanguage,
  onSignOut,
  onToggleLike,
  onAddComment,
  onSaveAnalysis,
  onShare,
  pwa,
  notif,
  onShowToast,
}: ProfileViewProps) {
  const [activeDialog, setActiveDialog] = useState<
    null | 'edit' | 'settings' | 'about'
  >(null);
  const [nameInput, setNameInput] = useState(currentUser.name);
  const [bioInput, setBioInput] = useState(currentUser.bio);
  const [avatarInput, setAvatarInput] = useState(currentUser.avatarUrl);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const quickAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const dialogAvatarInputRef = useRef<HTMLInputElement | null>(null);

  const openEdit = () => {
    setNameInput(currentUser.name);
    setBioInput(currentUser.bio);
    setAvatarInput(currentUser.avatarUrl);
    setPhotoError(null);
    setActiveDialog('edit');
  };

  const handleQuickAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || photoUploading) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const compressed = await compressAvatarImage(file);
      await onUpdateProfile(currentUser.name, currentUser.bio, compressed);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Unable to update profile photo.',
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDialogAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const compressed = await compressAvatarImage(file);
      setAvatarInput(compressed);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Unable to process image.',
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = nameInput.trim();
    if (!trimmedName || saving || photoUploading) return;
    setSaving(true);
    setPhotoError(null);
    try {
      await onUpdateProfile(
        trimmedName,
        bioInput.trim() || 'My Social Profile',
        avatarInput,
      );
      setActiveDialog(null);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Unable to save profile.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label={t.navProfile} className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative inline-block self-start shrink-0">
            <Avatar
              name={currentUser.name}
              src={currentUser.avatarUrl}
              size="xl"
              online={currentUser.isOnline ?? true}
            />
            <input
              ref={quickAvatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void handleQuickAvatarChange(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => quickAvatarInputRef.current?.click()}
              disabled={photoUploading}
              aria-label={t.uploadPhotoBtn}
              title={t.uploadPhotoBtn}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-600 text-white border-2 border-white dark:border-slate-900 shadow-md flex items-center justify-center hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {photoUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
              {currentUser.name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {currentUser.handle}
              {userContact ? ` · ${userContact}` : ''}
            </p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {currentUser.bio}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-slate-600 dark:text-slate-400">
              <span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {userPosts.length}
                </strong>{' '}
                {t.postsStat}
              </span>
              <span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {currentUser.followersCount}
                </strong>{' '}
                {t.followersStat}
              </span>
              <span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {currentUser.followingCount}
                </strong>{' '}
                {t.followingStat}
              </span>
            </div>
            {photoError && activeDialog !== 'edit' && (
              <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                {photoError}
              </p>
            )}
          </div>
        </div>

        {/* Direct Language Selection Row */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Languages className="w-4 h-4 text-slate-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {t.languageTitle}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.languageDesc}
              </p>
            </div>
          </div>
          <div className="sm:w-52">
            <LanguageSwitcher
              language={settings.language}
              onChange={onChangeLanguage}
            />
          </div>
        </div>

        <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          <button
            type="button"
            onClick={openEdit}
            className="w-full min-h-[48px] px-2 flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <span className="inline-flex items-center gap-3">
              <Edit3 className="w-4 h-4 text-slate-500" />
              <span>{t.editProfile}</span>
            </span>
            <span className="text-xs text-slate-400">{t.editProfileSub}</span>
          </button>

          {isAdmin && onOpenSponsoredModal && (
            <button
              type="button"
              onClick={onOpenSponsoredModal}
              className="w-full min-h-[48px] px-2 flex items-center justify-between text-sm font-semibold text-amber-700 dark:text-amber-400 hover:opacity-85 transition-opacity"
            >
              <span className="inline-flex items-center gap-3">
                <Megaphone className="w-4 h-4" />
                <span>{t.manageSponsoredBtn}</span>
              </span>
              <span className="text-xs text-slate-400">{t.sponsoredLabel}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveDialog('settings')}
            className="w-full min-h-[48px] px-2 flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <span className="inline-flex items-center gap-3">
              <Settings className="w-4 h-4 text-slate-500" />
              <span>{t.settingsTitle}</span>
            </span>
            <span className="text-xs text-slate-400">
              {settings.darkMode ? t.darkLabel : t.lightLabel} ·{' '}
              {settings.language === 'ha' ? t.hausaName : t.englishName}
            </span>
          </button>

          {notif && notif.supported && (
            <button
              type="button"
              onClick={async () => {
                const status = await notif.toggleNotifications({
                  title: t.appName,
                  body: t.notifWelcomeBody,
                });
                if (status === 'granted') {
                  onShowToast?.(t.notifEnabledToast);
                } else if (status === 'disabled') {
                  onShowToast?.(t.notifDisabledToast);
                } else if (status === 'denied') {
                  onShowToast?.(t.notifBlockedToast);
                }
              }}
              className="w-full min-h-[48px] px-2 flex items-center justify-between gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              <span className="inline-flex items-center gap-3">
                {notif.notificationsEnabled ? (
                  <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <BellOff className="w-4 h-4 text-slate-500" />
                )}
                <span>{t.notifRowLabel}</span>
              </span>
              <span
                className={`text-xs truncate max-w-[190px] ${
                  notif.notificationsEnabled
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : notif.permission === 'denied'
                      ? 'text-rose-500 dark:text-rose-400'
                      : 'text-slate-400'
                }`}
              >
                {notif.permission === 'denied'
                  ? t.notifRowBlockedSub
                  : notif.notificationsEnabled
                    ? t.notifRowOnSub
                    : t.notifRowOffSub}
              </span>
            </button>
          )}

          {notif && (
            <button
              type="button"
              onClick={notif.toggleSound}
              className="w-full min-h-[48px] px-2 flex items-center justify-between gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              <span className="inline-flex items-center gap-3">
                {notif.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                <span>{t.notifSoundLabel}</span>
              </span>
              <span
                className={`text-xs truncate max-w-[190px] ${
                  notif.soundEnabled
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {notif.soundEnabled ? t.notifSoundOnSub : t.notifSoundOffSub}
              </span>
            </button>
          )}

          {pwa && !pwa.isStandalone && (pwa.canPromptNative || pwa.isIos) && (
            <button
              type="button"
              onClick={() => void pwa.promptInstall()}
              className="w-full min-h-[48px] px-2 flex items-center justify-between text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:opacity-85 transition-opacity"
            >
              <span className="inline-flex items-center gap-3">
                <Download className="w-4 h-4" />
                <span>{t.installAppBtn}</span>
              </span>
              <span className="text-xs text-slate-400 truncate max-w-[190px]">
                {t.installAppProfileSub}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveDialog('about')}
            className="w-full min-h-[48px] px-2 flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <span className="inline-flex items-center gap-3">
              <Info className="w-4 h-4 text-slate-500" />
              <span>{t.aboutApp}</span>
            </span>
            <span className="text-xs text-slate-400">{t.appName}</span>
          </button>

          <button
            type="button"
            onClick={() => void onSignOut()}
            className="w-full min-h-[48px] px-2 flex items-center justify-between text-sm font-medium text-rose-600 dark:text-rose-400 hover:opacity-80 transition-opacity"
          >
            <span className="inline-flex items-center gap-3">
              <LogOut className="w-4 h-4" />
              <span>{t.signOut}</span>
            </span>
            <span className="text-xs text-slate-400">{t.signOutSub}</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="px-1 font-display text-sm font-bold text-slate-700 dark:text-slate-300">
          {t.yourPosts} ({userPosts.length})
        </h3>
        {userPosts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.noUserPosts}
          </div>
        ) : (
          userPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={currentUser}
              currentUserId={currentUser.id}
              currentUserName={currentUser.name}
              t={t}
              onToggleLike={onToggleLike}
              onAddComment={onAddComment}
              onSaveAnalysis={onSaveAnalysis}
              onShare={onShare}
            />
          ))
        )}
      </div>

      {activeDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                {activeDialog === 'edit' && t.editProfile}
                {activeDialog === 'settings' && t.settingsTitle}
                {activeDialog === 'about' && t.aboutTitle}
              </h3>
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                aria-label="Close dialog"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeDialog === 'edit' && (
              <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
                {photoError && (
                  <div className="rounded-xl p-2.5 text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {photoError}
                  </div>
                )}

                <div>
                  <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    {t.profilePhotoLabel}
                  </span>
                  <div className="flex items-center gap-4">
                    <Avatar
                      name={nameInput || currentUser.name}
                      src={avatarInput}
                      size="lg"
                    />
                    <input
                      ref={dialogAvatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void handleDialogAvatarChange(e)}
                      className="hidden"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => dialogAvatarInputRef.current?.click()}
                        disabled={photoUploading}
                        className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center gap-1.5"
                      >
                        {photoUploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>{t.uploadPhotoBtn}</span>
                      </button>

                      {avatarInput && (
                        <button
                          type="button"
                          onClick={() => setAvatarInput('')}
                          className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t.removePhotoBtn}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="profile-name"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
                  >
                    {t.displayNameLabel}
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-bio"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
                  >
                    {t.bioLabel}
                  </label>
                  <textarea
                    id="profile-bio"
                    rows={3}
                    value={bioInput}
                    onChange={(e) => setBioInput(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveDialog(null)}
                    className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || photoUploading}
                    className="min-h-[44px] px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? t.saving : t.save}
                  </button>
                </div>
              </form>
            )}

            {activeDialog === 'settings' && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t.appearanceTitle}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.appearanceDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ darkMode: !settings.darkMode })
                    }
                    className="min-h-[44px] px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100 inline-flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {settings.darkMode ? (
                      <>
                        <Sun className="w-4 h-4" />
                        <span>{t.lightLabel}</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4" />
                        <span>{t.darkLabel}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="py-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t.languageTitle}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.languageDesc}
                    </p>
                  </div>
                  <LanguageSwitcher
                    language={settings.language}
                    onChange={onChangeLanguage}
                  />
                </div>
              </div>
            )}

            {activeDialog === 'about' && (
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>{t.aboutBody}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

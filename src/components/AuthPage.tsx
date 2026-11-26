import { useEffect, useRef, useState } from 'react';
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { Loader2, ShieldCheck, Users } from 'lucide-react';
import { auth } from '../lib/firebase';
import { Language, Translations } from '../lib/i18n';
import { PWAInstallState } from '../lib/usePWAInstall';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LegalDocKind } from './LegalPage';
import { PWAInstallBanner } from './PWAInstallBanner';

interface AuthPageProps {
  unverifiedUser: User | null;
  language: Language;
  t: Translations;
  onChangeLanguage: (lang: Language) => void;
  onVerifiedRefresh: () => Promise<boolean>;
  onOpenLegal?: (kind: LegalDocKind) => void;
  pwa?: PWAInstallState;
}

export function AuthPage({
  unverifiedUser,
  language,
  t,
  onChangeLanguage,
  onOpenLegal,
  pwa,
}: AuthPageProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'info';
    text: string;
  } | null>(null);

  const feedbackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getRedirectResult(auth).catch((err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Google sign-in redirect failed.';
      setFeedback({ type: 'error', text: msg });
    });
  }, []);

  useEffect(() => {
    if (feedback && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [feedback]);

  const handleGoogleSignIn = async () => {
    setFeedback(null);
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code?: unknown }).code === 'string'
          ? (err as { code: string }).code
          : '';

      const isTopLevel =
        typeof window !== 'undefined' && window.self === window.top;

      if (
        isTopLevel &&
        (code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment')
      ) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: unknown) {
          setFeedback({
            type: 'error',
            text:
              redirectErr instanceof Error
                ? redirectErr.message
                : 'Unable to sign in with Google right now.',
          });
          return;
        }
      }

      const host =
        typeof window !== 'undefined' ? window.location.hostname : '';

      if (code === 'auth/popup-blocked') {
        setFeedback({
          type: 'error',
          text:
            language === 'ha'
              ? 'Browser ɗinka ta toshe tagar Google (popup blocked). Ba da izinin popup a browser ɗinka sannan ka sake danna Shiga da Google.'
              : 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.',
        });
      } else if (code === 'auth/unauthorized-domain') {
        setFeedback({
          type: 'error',
          text:
            language === 'ha'
              ? `Wannan adireshin (${host}) bai cikin Authorized domains a Firebase Console > Authentication > Settings > Authorized domains.`
              : `This domain (${host}) is not listed under Firebase Console > Authentication > Settings > Authorized domains.`,
        });
      } else if (code === 'auth/popup-closed-by-user') {
        setFeedback({
          type: 'info',
          text:
            language === 'ha'
              ? 'An rufe tagar shiga da Google kafin a kammala.'
              : 'Google sign-in window was closed before completing.',
        });
      } else {
        setFeedback({
          type: 'error',
          text:
            err instanceof Error
              ? err.message
              : 'Unable to sign in with Google right now.',
        });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 gap-4">
      {pwa && (pwa.showInstallBanner || pwa.showIosInstructions) && (
        <div className="w-full max-w-4xl">
          <PWAInstallBanner pwa={pwa} t={t} compact />
        </div>
      )}

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-center">
        {/* Community Intro */}
        <div className="hidden lg:block space-y-5 pr-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Users className="w-7 h-7" />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
            {t.appName}
          </h1>
          <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400 max-w-md">
            {language === 'ha'
              ? 'Haɗu da abokai, wallafa ra’ayoyinka a Hausa ko Turanci, yi tattaunawa kai tsaye, kuma ka yi amfani da mataimakin World Connection don samun amsoshi cikin sauri.'
              : 'Connect with friends, share your ideas in Hausa or English, message directly, and explore topics with the World Connection AI assistant.'}
          </p>
          <div className="pt-2 space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
            <p>
              ·{' '}
              {language === 'ha'
                ? 'Wallafe-wallafe da tsokaci kai tsaye'
                : 'Real-time community feed & comments'}
            </p>
            <p>
              ·{' '}
              {language === 'ha'
                ? 'Tattaunawa kai tsaye, Groups da Channels'
                : 'Direct messaging, Groups & Channels'}
            </p>
            <p>
              ·{' '}
              {language === 'ha'
                ? 'Shiga nan take da Google (babu jiran link)'
                : 'Instant Google sign-in with no email link delay'}
            </p>
          </div>
        </div>

        {/* Google-Only Auth Card */}
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex justify-end mb-4">
            <LanguageSwitcher
              language={language}
              onChange={onChangeLanguage}
              compact
            />
          </div>

          <div className="flex flex-col items-center text-center">
            <img
              src="/pwa-192x192.png"
              alt={t.appName}
              className="w-16 h-16 rounded-2xl border border-emerald-500/20 shadow-sm mb-3 object-cover"
            />
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t.appName}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {language === 'ha'
                ? 'Shiga kai tsaye da asusunka na Google — cikin daƙiƙa kaɗan, ba tare da rubuta email ko jiran link ba.'
                : 'Sign in instantly with your Google account — fast, secure, and no email verification link required.'}
            </p>
          </div>

          {unverifiedUser && (
            <div className="mt-4 rounded-xl p-3.5 text-xs leading-relaxed bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              {language === 'ha'
                ? `Tsohon asusun (${unverifiedUser.email ?? ''}) bai kammala tabbatarwa ba. Danna "Shiga da Google" a ƙasa domin shiga kai tsaye.`
                : `Your previous email session (${unverifiedUser.email ?? ''}) was not verified. Tap "Continue with Google" below to sign in right away.`}
            </div>
          )}

          {feedback && (
            <div
              ref={feedbackRef}
              role="alert"
              className={`mt-4 rounded-xl p-3.5 text-sm leading-relaxed ${
                feedback.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full min-h-[52px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-3"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                </span>
              )}
              <span>{t.continueWithGoogle}</span>
            </button>

            {unverifiedUser && (
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  void signOut(auth);
                }}
                className="w-full min-h-[44px] rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                {t.useAnotherAccount}
              </button>
            )}
          </div>

          <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 p-3 flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {language === 'ha'
                ? 'Shiga da Google yana da tsaro kuma yana buɗe asusunka nan take.'
                : 'Google Sign-In keeps your account protected and verifies instantly.'}
            </span>
          </div>

          {onOpenLegal && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="hover:text-slate-700 dark:hover:text-slate-200 underline underline-offset-2"
              >
                {language === 'ha' ? 'Dokar Sirri' : 'Privacy Policy'}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="hover:text-slate-700 dark:hover:text-slate-200 underline underline-offset-2"
              >
                {language === 'ha' ? 'Ka’idojin Amfani' : 'Terms of Service'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

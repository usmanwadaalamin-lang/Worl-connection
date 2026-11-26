import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react';
import { Language } from '../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

export type LegalDocKind = 'privacy' | 'terms';

interface LegalPageProps {
  kind: LegalDocKind;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  onNavigateKind: (kind: LegalDocKind) => void;
  onBack: () => void;
}

export function LegalPage({
  kind,
  language,
  onChangeLanguage,
  onNavigateKind,
  onBack,
}: LegalPageProps) {
  const isPrivacy = kind === 'privacy';
  const isHa = language === 'ha';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4 py-6 sm:py-10">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isHa ? 'Koma World Connection' : 'Back to World Connection'}</span>
          </button>

          <LanguageSwitcher
            language={language}
            onChange={onChangeLanguage}
            compact
          />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                {isPrivacy ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </div>
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isPrivacy
                    ? isHa
                      ? 'Dokar Sirri — World Connection'
                      : 'Privacy Policy — World Connection'
                    : isHa
                      ? 'Ka’idojin Amfani — World Connection'
                      : 'Terms of Service — World Connection'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  World Connection Community Platform
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateKind('privacy')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isPrivacy
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isHa ? 'Dokar Sirri' : 'Privacy Policy'}
              </button>
              <button
                type="button"
                onClick={() => onNavigateKind('terms')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  !isPrivacy
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isHa ? 'Ka’idojin Amfani' : 'Terms of Service'}
              </button>
            </div>
          </div>

          {isPrivacy ? (
            <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <section className="space-y-1.5">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {isHa ? '1. Bayanan da Muke Karɓa' : '1. Information We Collect'}
                </h2>
                <p>
                  {isHa
                    ? 'Idan ka yi rajista ko ka shiga World Connection (ta Google, Email, ko Lambar Waya), muna adana sunanka, adireshin email ko lambar wayarka, da hoton profile don ƙirƙirar asusunka da kuma haɗa ka da sauran jama’a.'
                    : 'When you sign in to World Connection (via Google Sign-In, Email, or Phone), we store your display name, email address or phone number, and optional profile photo solely to create your account and enable community interactions.'}
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {isHa ? '2. Yadda Muke Amfani da Bayanai' : '2. How We Use Your Data'}
                </h2>
                <p>
                  {isHa
                    ? 'Ana amfani da bayananka ne kaɗai don ba ka damar yin hira (chat), kiran murya da bidiyo, shiga groups da channels, da kuma wallafa rubuce-rubuce a cikin app ɗin. Ba ma sayar da bayananka ga kowa.'
                    : 'Your data is used strictly to power messaging, voice notes, voice/video calls, groups, channels, and community updates inside World Connection. We never sell your personal information to third parties.'}
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {isHa ? '3. Tsaro da Kulawa' : '3. Data Security & Control'}
                </h2>
                <p>
                  {isHa
                    ? 'Ana kiyaye asusunka da saƙonninka ta hanyar tsarin tsaro na Firebase Authentication da Cloud Firestore. Kana iya sabunta sunanka ko bayananka a shafin Profile a kowane lokaci.'
                    : 'Accounts and messages are protected using Firebase Authentication and Cloud Firestore security rules. You can update your profile details or sign out at any time from your Profile page.'}
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <section className="space-y-1.5">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {isHa ? '1. Girmama Juna' : '1. Community Conduct'}
                </h2>
                <p>
                  {isHa
                    ? 'World Connection dandali ne na sada zumunci da tattaunawa cikin girmamawa. Ana sa ran kowane memba ya guji cin zarafi, saƙonnin ƙarya, ko yaɗa abubuwan da suka saɓa wa doka.'
                    : 'World Connection is a respectful social and communication space. Members agree not to post abusive content, spam, impersonation, or unlawful material.'}
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {isHa ? '2. Asusun Mai Amfani' : '2. User Accounts'}
                </h2>
                <p>
                  {isHa
                    ? 'Kowanne mai amfani yana da alhakin kiyaye sirrin asusunsa da na’urar da yake shiga da ita. Ba a yarda a yi amfani da sunan wani ba don yaudara.'
                    : 'You are responsible for maintaining the security of your sign-in credentials and device access, and for all activity under your account.'}
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {isHa ? '3. Sabis da Canje-Canje' : '3. Service Availability'}
                </h2>
                <p>
                  {isHa
                    ? 'Ana samar da World Connection a halin yanzu don taimakawa al’umma haɗuwa cikin sauƙi, kuma ana iya inganta fasaloli a kowane lokaci don ƙara inganci.'
                    : 'World Connection is provided to help communities connect seamlessly, and features may be updated or improved over time to enhance reliability and safety.'}
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { Languages } from 'lucide-react';
import { Language } from '../lib/i18n';

interface LanguageSwitcherProps {
  language: Language;
  onChange: (lang: Language) => void;
  compact?: boolean;
}

export function LanguageSwitcher({
  language,
  onChange,
  compact = false,
}: LanguageSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Language selection"
      className={`inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${
        compact ? '' : 'w-full'
      }`}
    >
      <span
        className="pl-2 pr-1.5 text-slate-500 dark:text-slate-400 shrink-0"
        aria-hidden="true"
      >
        <Languages className="w-4 h-4" />
      </span>
      <button
        type="button"
        onClick={() => onChange('ha')}
        aria-pressed={language === 'ha'}
        className={`flex-1 min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
          language === 'ha'
            ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        Hausa
      </button>
      <button
        type="button"
        onClick={() => onChange('en')}
        aria-pressed={language === 'en'}
        className={`flex-1 min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
          language === 'en'
            ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        English
      </button>
    </div>
  );
}

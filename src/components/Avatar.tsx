import { useEffect, useState } from 'react';
import { BrainCircuit } from 'lucide-react';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isAi?: boolean;
  online?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-24 h-24 text-2xl',
};

const DOT_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4 bottom-1 right-1',
};

export function Avatar({
  name,
  src,
  size = 'md',
  isAi = false,
  online = false,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (isAi) {
    return (
      <div
        className={`${SIZE_CLASSES[size]} rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-display font-semibold`}
        aria-label={name}
      >
        <BrainCircuit className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
      </div>
    );
  }

  const dot = online ? (
    <span
      title="Online"
      aria-label="Online"
      className={`absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 ${DOT_CLASSES[size]}`}
    />
  ) : null;

  if (!src || failed) {
    const initials = name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className="relative inline-flex shrink-0">
        <div
          className={`${SIZE_CLASSES[size]} rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-display font-semibold`}
          aria-label={name}
        >
          {initials || '?'}
        </div>
        {dot}
      </div>
    );
  }

  return (
    <div className="relative inline-flex shrink-0">
      <img
        src={src}
        alt={`${name} profile portrait`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${SIZE_CLASSES[size]} rounded-full object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700`}
      />
      {dot}
    </div>
  );
}

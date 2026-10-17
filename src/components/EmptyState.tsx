import React, { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'neutral' | 'error';
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  className = '',
}) => (
  <section
    role={tone === 'error' ? 'alert' : 'status'}
    aria-live={tone === 'error' ? 'assertive' : 'polite'}
    aria-atomic="true"
    className={`flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/[0.09] bg-white/[0.018] px-5 py-12 text-center backdrop-blur-xl ${className}`}
  >
    <div
      aria-hidden="true"
      className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border ${tone === 'error' ? 'border-red-400/20 bg-red-500/[0.08] text-red-300' : 'border-white/[0.08] bg-white/[0.035] text-zinc-500'}`}
    >
      {icon}
    </div>
    <h2 className="text-base font-bold tracking-tight text-white">{title}</h2>
    {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{description}</p>}
    {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
  </section>
);

export default EmptyState;

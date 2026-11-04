import React, { useRef, useEffect, useState } from 'react';
import { PlayerSource } from '../utils/playerSources.ts';

interface PlayerControlProps {
  source: PlayerSource;
  onChange: (source: PlayerSource) => void;
  disabled?: boolean;
  vertical?: boolean;
}

const PlayerControl: React.FC<PlayerControlProps> = ({ source, onChange, disabled, vertical = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const activeBtn = containerRef.current.querySelector(`[data-source="${source}"]`) as HTMLElement;
    if (activeBtn) {
      setSliderStyle({
        top: `${activeBtn.offsetTop}px`,
        left: `${activeBtn.offsetLeft}px`,
        width: `${activeBtn.offsetWidth}px`,
        height: `${activeBtn.offsetHeight}px`,
      });
    }
  }, [source, vertical]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sources = [
    {
      id: 'vidking' as PlayerSource,
      label: 'VidKing',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
        </svg>
      )
    },
    {
      id: 'vsembed' as PlayerSource,
      label: 'VsEmbed',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5-3h13.5m-13.5-3h13.5m-13.5 9h13.5" />
        </svg>
      )
    },
    {
      id: 'vidsrc' as PlayerSource,
      label: 'VidSrc',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21L14.907 14M21 3L3 11.857l6.813 3.047M21 3L14.907 14M21 3L9.813 15.904M14.907 14l1.96 5.882L21 3" />
        </svg>
      )
    },
    {
      id: 'twoembed' as PlayerSource,
      label: '2Embed',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l6-6m0 0l6 6m-6-6v12a3 3 0 01-3 3H3" />
        </svg>
      )
    },
    {
      id: 'vidlink' as PlayerSource,
      label: 'VidLink',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      )
    },
    {
      id: 'vidly' as PlayerSource,
      label: 'Vidly',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2" />
        </svg>
      )
    },
    {
      id: 'vidy' as PlayerSource,
      label: 'Vidy',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      )
    },
  ];

  const currentSource = sources.find(s => s.id === source) || sources[0];

  return (
    <>
      <div ref={dropdownRef} className="relative w-full sm:hidden">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.09] bg-zinc-900/60 px-3.5 py-2 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)] text-white text-[11px] font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-white/80">{currentSource.icon}</span>
            <span>{currentSource.label}</span>
          </div>
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-xl border border-white/[0.1] bg-zinc-950/85 p-1 shadow-[0_20px_45px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-2.5 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                Select source
              </span>
              <span className="text-[9px] font-medium text-zinc-600">
                {sources.length} available
              </span>
            </div>

            <div className="max-h-[144px] overflow-y-auto overscroll-contain py-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
              {sources.map((item) => {
                const isItemActive = item.id === source;

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      onChange(item.id);
                      setIsOpen(false);
                    }}
                    className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[11px] transition-all duration-200 active:scale-[0.98] ${isItemActive
                      ? 'border border-white/[0.09] bg-white/[0.09] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                      : 'border border-transparent font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-white'
                      }`}
                  >
                    <span className={isItemActive ? 'text-white' : 'text-zinc-500'}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {isItemActive && (
                      <svg className="h-3.5 w-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4 4L19 6.5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className={`hidden sm:flex relative bg-zinc-950/40 backdrop-blur-md rounded-xl border border-white/[0.04] shadow-2xl ${vertical ? 'flex-col p-1.5 w-full gap-1' : 'items-center p-1 w-fit'
          }`}
      >
        <div
          style={sliderStyle}
          className="absolute rounded-lg bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_8px_20px_-6px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-none"
        />

        {sources.map(({ id, label, icon }) => {
          const isActive = source === id;
          return (
            <button
              key={id}
              data-source={id}
              onClick={() => onChange(id)}
              disabled={disabled}
              className={`relative z-10 flex items-center rounded-lg font-medium tracking-wide transition-all duration-300 select-none disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${vertical ? 'w-full gap-2.5 px-3 py-2.5 text-[12px]' : 'gap-1.5 px-3.5 py-1.5 text-[11px]'
                } ${isActive
                  ? 'text-white font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'
                  : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <span className={`transition-transform duration-300 ${isActive ? 'scale-105 text-white' : 'text-zinc-600'}`}>
                {icon}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
};

export default PlayerControl;
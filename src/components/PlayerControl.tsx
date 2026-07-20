import React, { useRef, useEffect, useState } from 'react';
import { PlayerSource } from '../utils/playerSources.ts';

interface PlayerControlProps {
  source: PlayerSource;
  onChange: (source: PlayerSource) => void;
  disabled?: boolean;
}

const PlayerControl: React.FC<PlayerControlProps> = ({ source, onChange, disabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const activeBtn = containerRef.current.querySelector(`[data-source="${source}"]`) as HTMLElement;
    if (activeBtn) {
      setSliderStyle({
        left: `${activeBtn.offsetLeft}px`,
        width: `${activeBtn.offsetWidth}px`,
        height: `${activeBtn.offsetHeight}px`,
      });
    }
  }, [source]);

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
  ];

  const currentSource = sources.find(s => s.id === source) || sources[0];

  return (
    <>
      <div ref={dropdownRef} className="relative sm:hidden w-44">
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/60 backdrop-blur-md border border-white/[0.06] shadow-xl text-white font-medium text-[12px] transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            <span className="text-white/80">{currentSource.icon}</span>
            <span>{currentSource.label}</span>
          </div>
          <svg 
            className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-[calc(100%+6px)] left-0 w-full z-50 rounded-xl bg-zinc-950/80 backdrop-blur-xl border border-white/[0.08] p-1 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 px-3 py-1.5 font-bold">
              Select Source
            </div>
            {sources.map((item) => {
              const isItemActive = item.id === source;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onChange(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 text-left
                    ${isItemActive 
                      ? 'bg-white/[0.06] text-white font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                    }`}
                >
                  <span className={isItemActive ? 'text-white' : 'text-zinc-500'}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div 
        ref={containerRef}
        className="hidden sm:flex relative items-center bg-zinc-950/40 backdrop-blur-md rounded-xl p-1 border border-white/[0.04] shadow-2xl w-fit"
      >
        <div
          style={sliderStyle}
          className="absolute top-1 rounded-lg bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_8px_20px_-6px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-none"
        />

        {sources.map(({ id, label, icon }) => {
          const isActive = source === id;
          return (
            <button
              key={id}
              data-source={id}
              onClick={() => onChange(id)}
              disabled={disabled}
              className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-medium tracking-wide transition-all duration-300 select-none
                disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]
                ${isActive 
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
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, X, Link2, Star, Loader2, Clapperboard } from 'lucide-react';

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Full-bleed backdrop used for the card preview. */
  backdropUrl?: string;
  posterUrl?: string;
  rating?: number | string;
  genres?: string[];
  /** e.g. "2024-05-17" or just a year. */
  releaseDate?: string;
  overview?: string;
  /** Absolute deep link to copy / share. */
  shareUrl: string;
  /** "Movie" or "TV Show" — used for labels. */
  medium?: string;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const getYear = (date?: string) => {
  if (!date) return '';
  const year = new Date(date).getFullYear();
  return Number.isNaN(year) ? String(date) : String(year);
};

const fallbackCopy = (text: string) => {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    return true;
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
};

const ShareSheet: React.FC<ShareSheetProps> = ({
  open,
  onClose,
  title,
  backdropUrl,
  posterUrl,
  rating,
  genres = [],
  releaseDate,
  overview,
  shareUrl,
  medium = 'Movie',
  onToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1800);
      return () => clearTimeout(t);
    }
  }, [copied]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const copyLink = async () => {
    setCopying(true);
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = fallbackCopy(shareUrl);

    setCopying(false);
    setCopied(ok);
    if (ok) onToast?.('Link copied to clipboard', 'success');
    else onToast?.('Could not copy link — try again', 'error');
  };

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${title} | Cinescape`,
          text: `Check out ${title} on Cinescape`,
          url: shareUrl,
        });
        onClose();
      } catch {
        // user dismissed the native sheet — keep modal open
      }
    } else {
      copyLink();
    }
  };

  const year = getYear(releaseDate);
  const canNativeShare =
    typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare?.({ url: shareUrl });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Share this ${medium.toLowerCase()}`}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30, mass: 0.9 }}
            className="relative w-full max-w-md rounded-[28px] overflow-hidden border border-white/[0.08] bg-zinc-950 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.85),0_0_40px_-8px_rgba(245,158,11,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ===== Card preview using the backdrop ===== */}
            <div className="relative aspect-[16/9] w-full bg-zinc-900 overflow-hidden">
              {backdropUrl ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${backdropUrl})` }}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/20" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />

              {/* rating chip */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-white font-semibold text-xs tabular-nums">
                  {typeof rating === 'number' ? rating.toFixed(1) : (rating ?? '—')}
                </span>
              </div>

              {/* poster thumb + title */}
              <div className="absolute inset-x-0 bottom-0 p-4 flex items-end gap-3">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={title}
                    className="w-16 h-24 object-cover rounded-lg ring-1 ring-white/15 shadow-lg shadow-black/50 flex-shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-24 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Clapperboard className="w-6 h-6 text-zinc-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/90 font-bold mb-1">
                    {medium} · Cinescape
                  </p>
                  <h3 className="text-lg sm:text-xl font-black leading-tight text-white tracking-tight drop-shadow-lg line-clamp-2">
                    {title}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-white/70">
                    {year && <span>{year}</span>}
                    {genres.slice(0, 3).map((g, i) => (
                      <React.Fragment key={i}>
                        {i < (year ? 1 : 0) || i > 0 ? <span className="text-white/25">•</span> : null}
                        <span>{g}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== Body ===== */}
            <div className="relative p-5 sm:p-6">
              <button
                onClick={onClose}
                aria-label="Close share dialog"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all duration-200 active:scale-90 backdrop-blur-md"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-white text-lg font-bold tracking-tight flex items-center gap-2">
                <Share2 className="w-5 h-5 text-amber-400" />
                Share this {medium.toLowerCase()}
              </h2>
              <p className="text-zinc-400 text-[13px] mt-1 leading-relaxed">
                Copy a deep link to <span className="text-zinc-200 font-medium">{title}</span> and
                drop it anywhere — it opens straight back to this page.
              </p>

              {overview && (
                <p className="text-zinc-500 text-xs mt-3 leading-relaxed line-clamp-2">{overview}</p>
              )}

              {/* Deep link field */}
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 pl-3">
                <Link2 className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <span className="flex-1 min-w-0 text-[12.5px] text-zinc-300 font-medium truncate select-all">
                  {shareUrl}
                </span>
                <button
                  onClick={copyLink}
                  disabled={copying}
                  className="flex flex-shrink-0 items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all duration-200 active:scale-95 disabled:opacity-60"
                >
                  {copying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {canNativeShare && (
                <button
                  onClick={nativeShare}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-[0_10px_30px_-8px_rgba(245,158,11,0.5)]"
                >
                  <Share2 className="w-4 h-4" />
                  Share via…
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareSheet;
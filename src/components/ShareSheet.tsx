import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, X, Link2, Star, Loader2, Clapperboard, Tv } from 'lucide-react';

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  backdropUrl?: string;
  posterUrl?: string;
  rating?: number | string;
  genres?: string[];
  releaseDate?: string;
  overview?: string;
  shareUrl: string;
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

export const ShareSheet: React.FC<ShareSheetProps> = ({
  open,
  onClose,
  title = '',
  backdropUrl,
  posterUrl,
  rating,
  genres = [],
  releaseDate,
  overview,
  shareUrl = '',
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
      }
    } else {
      copyLink();
    }
  };

  const year = getYear(releaseDate);
  const canNativeShare =
    typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare?.({ url: shareUrl });

  const safeMedium = medium ?? 'Movie';
  const isTvShow = safeMedium.toLowerCase().includes('tv') || safeMedium.toLowerCase().includes('series');
  const MediumIcon = isTvShow ? Tv : Clapperboard;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Share this ${safeMedium.toLowerCase()}`}
        >
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative w-full max-w-md rounded-t-[38px] sm:rounded-[38px] overflow-hidden border border-white/15 bg-black shadow-[0_25px_80px_rgba(0,0,0,1),0_0_50px_rgba(245,158,11,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 via-transparent to-black pointer-events-none" />
            <div className="sm:hidden w-full flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20 backdrop-blur-md" />
            </div>
            <div className="relative p-5 sm:p-6">
              <button
                onClick={onClose}
                aria-label="Close share dialog"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 hover:bg-white/10 border border-white/15 text-white/70 hover:text-white flex items-center justify-center transition-all duration-200 active:scale-90 backdrop-blur-2xl z-10 shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative aspect-[16/9] w-full rounded-[26px] overflow-hidden border border-white/15 shadow-2xl bg-black mb-5 group">
                {backdropUrl ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{ backgroundImage: `url(${backdropUrl})` }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-black to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 shadow-2xl">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-white font-semibold text-xs tabular-nums tracking-tight">
                    {typeof rating === 'number' ? rating.toFixed(1) : (rating ?? '—')}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4 flex items-end gap-3.5">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={title}
                      className="w-14 h-20 object-cover rounded-xl border border-white/20 shadow-2xl flex-shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-14 h-20 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center flex-shrink-0">
                      <MediumIcon className="w-6 h-6 text-amber-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-xl border border-white/20 text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_8px_16px_rgba(0,0,0,0.5)]">
                      <MediumIcon className="w-3 h-3 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                      {safeMedium}
                    </span>

                    <h3 className="text-base sm:text-lg font-bold leading-tight text-white tracking-tight drop-shadow-md line-clamp-1">
                      {title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-white/60">
                      {year && <span>{year}</span>}
                      {genres.slice(0, 2).map((g, i) => (
                        <React.Fragment key={i}>
                          <span className="text-white/30">•</span>
                          <span>{g}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1 mb-4">
                <h2 className="text-white text-xl font-bold tracking-tight flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-amber-400" />
                  Share Preview
                </h2>
                {overview && (
                  <p className="text-white/50 text-xs leading-relaxed line-clamp-2 font-normal">
                    {overview}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-1.5 pl-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                <Link2 className="w-4 h-4 text-white/40 flex-shrink-0" />
                <span className="flex-1 min-w-0 text-xs text-white/80 font-medium truncate select-all">
                  {shareUrl}
                </span>
                <button
                  onClick={copyLink}
                  disabled={copying}
                  className="flex flex-shrink-0 items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-md"
                >
                  {copying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  ) : copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white/80" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {canNativeShare && (
                <button
                  onClick={nativeShare}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.98] shadow-[0_10px_30px_-8px_rgba(245,158,11,0.5)]"
                >
                  <Share2 className="w-4 h-4" />
                  Share via...
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
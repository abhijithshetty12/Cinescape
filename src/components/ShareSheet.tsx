import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, X, Link2, Star, Loader2, Clapperboard, Tv, Download, Image as ImageIcon } from 'lucide-react';
import { toPng } from 'html-to-image';

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
  director?: any;
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
  director,
  onToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const storyCardRef = useRef<HTMLDivElement>(null);

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

  const generateCardBlob = async (): Promise<Blob | null> => {
    if (!storyCardRef.current) return null;
    try {
      const dataUrl = await toPng(storyCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        quality: 0.95,
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch {
      return null;
    }
  };

  const shareStory = async () => {
    setGeneratingCard(true);
    try {
      const imageBlob = await generateCardBlob();
      if (!imageBlob) {
        onToast?.('Failed to generate story image', 'error');
        setGeneratingCard(false);
        return;
      }

      const file = new File([imageBlob], `${title.replace(/\s+/g, '-')}.png`, {
        type: 'image/png',
      });

      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: title,
          text: `Check out ${title} on Cinescape!`,
        });
        onToast?.('Story shared successfully', 'success');
      } else {
        await saveImage();
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        onToast?.('Could not share story image', 'error');
      }
    } finally {
      setGeneratingCard(false);
    }
  };

  const saveImage = async () => {
    setDownloadingImage(true);
    try {
      const imageBlob = await generateCardBlob();
      if (!imageBlob) {
        onToast?.('Failed to generate image', 'error');
        setDownloadingImage(false);
        return;
      }

      const url = URL.createObjectURL(imageBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast?.('Story card saved to device', 'success');
    } catch {
      onToast?.('Failed to save image', 'error');
    } finally {
      setDownloadingImage(false);
    }
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

  const getDirectorName = () => {
    if (!director) return null;
    if (typeof director === 'string') return director.trim() || null;
    if (typeof director === 'object') {
      if (director.name) return String(director.name).trim() || null;
      if (Array.isArray(director) && director.length > 0) {
        const first = director[0];
        if (typeof first === 'string') return first.trim() || null;
        if (first?.name) return String(first.name).trim() || null;
      }
    }
    return null;
  };

  const directorName = getDirectorName();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Share this ${safeMedium.toLowerCase()}`}
        >
          <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none aria-hidden">
            <div
              ref={storyCardRef}
              className="w-[1080px] h-[1920px] bg-black relative flex flex-col items-center justify-between p-20 pt-28 pb-24 overflow-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]"
              style={{
                backgroundImage: backdropUrl ? `url(${backdropUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[120px]" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90" />

              {/* Top Bar Header */}
              <div className="w-full flex justify-between items-center z-10">
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-3xl px-8 py-3.5 rounded-full border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.4)]">
                  <MediumIcon className="w-7 h-7 text-white" />
                  <span className="text-white text-2xl font-semibold tracking-wider uppercase">
                    {safeMedium}
                  </span>
                </div>
                {rating && (
                  <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-3xl px-8 py-3.5 rounded-full border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.4)]">
                    <Star className="w-7 h-7 text-amber-300 fill-amber-300" />
                    <span className="text-white text-2xl font-bold tracking-tight">
                      {typeof rating === 'number' ? rating.toFixed(1) : rating}
                    </span>
                  </div>
                )}
              </div>

              {/* Poster Section with glassmorphism border */}
              <div className="relative w-[820px] h-[1150px] rounded-[64px] p-2.5 bg-white/10 backdrop-blur-2xl border border-white/30 shadow-[0_40px_100px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.5)] z-10 my-auto flex flex-col items-center justify-center overflow-hidden">
                <div className="relative w-full h-full rounded-[54px] overflow-hidden bg-black/40">
                  {posterUrl || backdropUrl ? (
                    <img
                      src={posterUrl || backdropUrl}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MediumIcon className="w-36 h-36 text-white/20" />
                    </div>
                  )}
                </div>
              </div>

              {/* Content & Streaming Footer Stack */}
              <div className="w-full flex flex-col items-center text-center z-10 gap-6">
                {/* Title & Metadata */}
                <div className="flex flex-col items-center gap-2">
                  <h1 className="text-white text-6xl font-black tracking-tight leading-tight drop-shadow-2xl max-w-[920px] line-clamp-2">
                    {title}
                  </h1>
                  <div className="flex items-center gap-3 text-white/70 text-2xl font-medium mt-1">
                    {year && <span>{year}</span>}
                    {genres.length > 0 && (
                      <>
                        <span className="text-white/40">•</span>
                        <span>{genres.slice(0, 3).join(', ')}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Streaming On Line & Logos */}
                <div className="flex flex-col items-center gap-4 w-full pt-2">
                  <div className="flex items-center gap-6 w-full max-w-[500px] justify-center">
                    <span className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/25 to-white/25" />
                    <p className="text-white/50 text-lg font-semibold tracking-[0.3em] uppercase whitespace-nowrap">
                      STREAMING ON
                    </p>
                    <span className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-white/25 to-white/25" />
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <img
                      src="/Logo.png"
                      alt="Logo"
                      className="h-10 w-auto object-contain drop-shadow-lg"
                    />
                    <img
                      src="/Cinescape.png"
                      alt="Cinescape"
                      className="h-8 w-auto object-contain drop-shadow-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="relative w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] flex flex-col overflow-hidden border border-white/15 bg-zinc-950 shadow-[0_25px_80px_rgba(0,0,0,1),0_0_50px_rgba(245,158,11,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 via-transparent to-black pointer-events-none" />

            <div className="sm:hidden w-full flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-white/20 backdrop-blur-md" />
            </div>

            <div className="relative p-4 sm:p-6 overflow-y-auto max-h-full space-y-4">
              <div className="flex items-center justify-between pb-1">
                <h2 className="text-white text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-amber-400" />
                  Share Title
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close share dialog"
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden border border-white/15 shadow-xl bg-black group flex-shrink-0">
                {backdropUrl || posterUrl ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{ backgroundImage: `url(${backdropUrl || posterUrl})` }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-black to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                {rating && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 shadow-md">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-white font-semibold text-xs tabular-nums">
                      {typeof rating === 'number' ? rating.toFixed(1) : rating}
                    </span>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-3.5 flex items-end gap-3">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={title}
                      className="w-12 h-16 sm:w-14 sm:h-20 object-cover rounded-lg border border-white/20 shadow-lg flex-shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-16 sm:w-14 sm:h-20 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center flex-shrink-0">
                      <MediumIcon className="w-5 h-5 text-amber-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-xl border border-white/20 text-[9px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                      <MediumIcon className="w-2.5 h-2.5 text-amber-400" />
                      {safeMedium}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold leading-tight text-white tracking-tight line-clamp-1">
                      {title}
                    </h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] sm:text-[11px] font-medium text-white/60">
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

              {overview && (
                <p className="text-white/60 text-xs leading-relaxed line-clamp-2 px-1">
                  {overview}
                </p>
              )}

              <div className="grid grid-cols-1 gap-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={shareStory}
                    disabled={generatingCard || downloadingImage}
                    className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] shadow-lg disabled:opacity-50"
                  >
                    {generatingCard ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                    <span>Share to Story</span>
                  </button>

                  <button
                    onClick={saveImage}
                    disabled={generatingCard || downloadingImage}
                    className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] shadow-lg disabled:opacity-50"
                  >
                    {downloadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      <Download className="w-4 h-4 text-amber-400" />
                    )}
                    <span>Save as Image</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 backdrop-blur-xl p-1.5 pl-3">
                  <Link2 className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-xs text-white/80 font-medium truncate select-all">
                    {shareUrl}
                  </span>
                  <button
                    onClick={copyLink}
                    disabled={copying}
                    className="flex flex-shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all active:scale-95 disabled:opacity-50"
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs transition-all active:scale-[0.98]"
                  >
                    <Share2 className="w-3.5 h-3.5 text-amber-400" />
                    More Share Options
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareSheet;
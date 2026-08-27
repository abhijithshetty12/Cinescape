import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, X, Link2, Star, Loader2, Clapperboard, Tv, Download, Image as ImageIcon, Pencil, RotateCcw, Sparkles, Eye, Heart } from 'lucide-react';
import { toPng } from 'html-to-image';

export interface ShareMediaImage {
  file_path: string;
  vote_count?: number;
  vote_average?: number;
  aspect_ratio?: number;
  width?: number;
  height?: number;
}

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  backdropUrl?: string;
  posterUrl?: string;
  backdrops?: ShareMediaImage[];
  posters?: ShareMediaImage[];
  mediaId?: number | string;
  mediaType?: 'movie' | 'tv';
  rating?: number | string;
  genres?: string[];
  releaseDate?: string;
  overview?: string;
  shareUrl: string;
  medium?: string;
  director?: any;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

type ArtworkTab = 'poster' | 'backdrop';
type ShareStatus = 'now_watching' | 'just_watched' | 'recommended' | 'favorite' | 'rewatch';

const STATUS_OPTIONS = [
  { id: 'now_watching' as ShareStatus, label: 'NOW WATCHING', icon: Eye },
  { id: 'just_watched' as ShareStatus, label: 'JUST WATCHED', icon: Check },
  { id: 'recommended' as ShareStatus, label: 'RECOMMENDED', icon: Star },
  { id: 'favorite' as ShareStatus, label: 'MY FAVORITE', icon: Heart },
  { id: 'rewatch' as ShareStatus, label: 'REWATCH', icon: RotateCcw },
];

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = '859afbb4b98e3b467da9c99ac390e950';

const getYear = (date?: string) => {
  if (!date) return '';
  const year = new Date(date).getFullYear();
  return Number.isNaN(year) ? String(date) : String(year);
};

const normalizeImageUrl = (value?: string | null, size = 'original') => {
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
};

const uniqueUrls = (urls: string[]) => Array.from(new Set(urls.filter(Boolean)));

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

const preloadImage = (src?: string) =>
  new Promise<void>((resolve) => {
    if (!src) return resolve();
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });

export const ShareSheet: React.FC<ShareSheetProps> = ({
  open,
  onClose,
  title = '',
  backdropUrl,
  posterUrl,
  backdrops = [],
  posters = [],
  mediaId,
  mediaType,
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
  const [artworkSelector, setArtworkSelector] = useState<ArtworkTab | null>(null);
  const [selectedPoster, setSelectedPoster] = useState('');
  const [selectedBackdrop, setSelectedBackdrop] = useState('');
  const [remotePosters, setRemotePosters] = useState<ShareMediaImage[]>([]);
  const [remoteBackdrops, setRemoteBackdrops] = useState<ShareMediaImage[]>([]);
  const [artworkLoading, setArtworkLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ShareStatus | null>(null);
  const storyCardRef = useRef<HTMLDivElement>(null);

  const resolvedMedia = useMemo(() => {
    const shareMatch = shareUrl.match(/\/(movie|tv)\/(\d+)/i);
    const pageMatch = typeof window !== 'undefined' ? window.location.href.match(/\/(movie|tv)\/(\d+)/i) : null;
    const match = shareMatch || pageMatch;
    const fallbackType: 'movie' | 'tv' = medium.toLowerCase().includes('tv') || medium.toLowerCase().includes('series') ? 'tv' : 'movie';
    return { id: String(mediaId || match?.[2] || ''), type: (mediaType || match?.[1] || fallbackType) as 'movie' | 'tv' };
  }, [mediaId, mediaType, shareUrl, medium]);

  const posterChoices = useMemo(
    () => uniqueUrls([normalizeImageUrl(posterUrl), ...posters.map((item) => normalizeImageUrl(item.file_path)), ...remotePosters.map((item) => normalizeImageUrl(item.file_path))]),
    [posterUrl, posters, remotePosters]
  );

  const backdropChoices = useMemo(
    () => uniqueUrls([normalizeImageUrl(backdropUrl), ...backdrops.map((item) => normalizeImageUrl(item.file_path)), ...remoteBackdrops.map((item) => normalizeImageUrl(item.file_path))]),
    [backdropUrl, backdrops, remoteBackdrops]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadArtwork = async () => {
      if (!resolvedMedia.id || !TMDB_API_KEY) {
        setRemotePosters([]);
        setRemoteBackdrops([]);
        return;
      }
      setArtworkLoading(true);
      try {
        const response = await fetch(`${TMDB_API_BASE}/${resolvedMedia.type}/${resolvedMedia.id}/images?api_key=${encodeURIComponent(TMDB_API_KEY)}`);
        if (!response.ok) throw new Error('Artwork request failed');
        const data = await response.json();
        if (cancelled) return;
        const rank = (items: ShareMediaImage[]) => [...items].sort((a, b) => ((b.vote_count || 0) - (a.vote_count || 0)) || ((b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0)));
        setRemotePosters(rank(Array.isArray(data.posters) ? data.posters : []));
        setRemoteBackdrops(rank(Array.isArray(data.backdrops) ? data.backdrops : []));
      } catch {
      } finally {
        if (!cancelled) setArtworkLoading(false);
      }
    };
    loadArtwork();
    return () => { cancelled = true; };
  }, [open, resolvedMedia.id, resolvedMedia.type]);

  useEffect(() => {
    if (!open) return;
    if (!selectedPoster) setSelectedPoster(normalizeImageUrl(posterUrl) || posterChoices[0] || '');
    if (!selectedBackdrop) setSelectedBackdrop(normalizeImageUrl(backdropUrl) || backdropChoices[0] || '');
  }, [open, posterUrl, backdropUrl, posterChoices, backdropChoices, selectedPoster, selectedBackdrop]);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1800);
      return () => clearTimeout(t);
    }
  }, [copied]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (artworkSelector) setArtworkSelector(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, artworkSelector]);

  const previewBackdrop = selectedBackdrop || normalizeImageUrl(backdropUrl) || backdropChoices[0] || '';
  const previewPoster = selectedPoster || normalizeImageUrl(posterUrl) || posterChoices[0] || '';
  const artworkChoices = artworkSelector === 'backdrop' ? backdropChoices : posterChoices;
  const statusMeta = STATUS_OPTIONS.find((item) => item.id === selectedStatus) || null;

  const rankedPosterChoices = useMemo(() => {
    const ranked = [...posters, ...remotePosters].sort((a, b) => {
      const aScore = (a.vote_average || 0) * 100 + (a.vote_count || 0) * 4 + ((a.width || 0) * (a.height || 0)) / 1000000;
      const bScore = (b.vote_average || 0) * 100 + (b.vote_count || 0) * 4 + ((b.width || 0) * (b.height || 0)) / 1000000;
      return bScore - aScore;
    }).map((item) => normalizeImageUrl(item.file_path));
    return uniqueUrls([...ranked, ...posterChoices]);
  }, [posters, remotePosters, posterChoices]);

  const rankedBackdropChoices = useMemo(() => {
    const ranked = [...backdrops, ...remoteBackdrops].sort((a, b) => {
      const aScore = (a.vote_average || 0) * 100 + (a.vote_count || 0) * 4 + ((a.width || 0) * (a.height || 0)) / 1000000;
      const bScore = (b.vote_average || 0) * 100 + (b.vote_count || 0) * 4 + ((b.width || 0) * (b.height || 0)) / 1000000;
      return bScore - aScore;
    }).map((item) => normalizeImageUrl(item.file_path));
    return uniqueUrls([...ranked, ...backdropChoices]);
  }, [backdrops, remoteBackdrops, backdropChoices]);

  const resetArtwork = () => {
    setSelectedPoster(normalizeImageUrl(posterUrl) || posterChoices[0] || '');
    setSelectedBackdrop(normalizeImageUrl(backdropUrl) || backdropChoices[0] || '');
  };

  const selectArtwork = (url: string) => {
    if (artworkSelector === 'poster') setSelectedPoster(url);
    if (artworkSelector === 'backdrop') setSelectedBackdrop(url);
  };

  const randomizeArtwork = () => {
    const pickDifferent = (choices: string[], current: string) => {
      const pool = choices.slice(0, Math.min(14, choices.length)).filter((url) => url !== current);
      if (!pool.length) return current || choices[0] || '';
      return pool[Math.floor(Math.random() * pool.length)];
    };
    setSelectedPoster((current) => pickDifferent(rankedPosterChoices, current));
    setSelectedBackdrop((current) => pickDifferent(rankedBackdropChoices, current));
  };

  const thumbnailUrl = (url: string, size: 'w342' | 'w500' = 'w342') => url.replace('/original/', `/${size}/`);

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
      await Promise.all([preloadImage(previewBackdrop), preloadImage(previewPoster)]);
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

  return (
    <AnimatePresence>
      {open && (
        <>
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
                className="isolate w-[1080px] h-[1920px] bg-black relative flex flex-col items-center justify-between p-20 pt-28 pb-24 overflow-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]"
              >
                {previewBackdrop && <img src={previewBackdrop} crossOrigin="anonymous" alt="" className="absolute inset-0 h-full w-full object-cover" />}
                <div className="absolute inset-0 bg-black/55" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/90" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,transparent_0%,rgba(0,0,0,0.12)_42%,rgba(0,0,0,0.48)_100%)]" />


                <div className="w-full flex justify-between items-center z-10">
                  <div className="flex items-center gap-3 bg-[#35312f]/95 px-8 py-3.5 rounded-full border border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.38),inset_0_1px_1px_rgba(255,255,255,0.18)]">
                    <MediumIcon className="w-7 h-7 text-white" />
                    <span className="text-white text-2xl font-semibold tracking-wider uppercase">
                      {safeMedium}
                    </span>
                  </div>
                  {rating && (
                    <div className="flex items-center gap-2.5 bg-[#35312f]/95 px-8 py-3.5 rounded-full border border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.38),inset_0_1px_1px_rgba(255,255,255,0.18)]">
                      <Star className="w-7 h-7 text-amber-300 fill-amber-300" />
                      <span className="text-white text-2xl font-bold tracking-tight">
                        {typeof rating === 'number' ? rating.toFixed(1) : rating}
                      </span>
                    </div>
                  )}
                </div>


                <div className="relative w-[820px] h-[1150px] rounded-[64px] p-2.5 bg-white/[0.12] border border-white/30 shadow-[0_40px_100px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.24)] z-10 my-auto flex flex-col items-center justify-center overflow-hidden">
                  <div className="relative w-full h-full rounded-[54px] overflow-hidden bg-black/40">
                    {previewPoster ? (
                      <img
                        src={previewPoster}
                        crossOrigin="anonymous"
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


                <div className="w-full flex flex-col items-center text-center z-10 gap-6">
                  <div className="flex flex-col items-center gap-2">
                    {statusMeta && (
                      <div className="mb-2 flex items-center gap-2 rounded-full border border-amber-300/30 bg-[#3a3020]/95 px-5 py-2 text-xl font-black tracking-[0.18em] text-amber-200 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                        <statusMeta.icon className="h-5 w-5" />
                        {statusMeta.label}
                      </div>
                    )}
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
                  {previewBackdrop ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                      style={{ backgroundImage: `url(${previewBackdrop})` }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-black to-black" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />


                  <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setArtworkSelector('backdrop')}
                      aria-label="Change backdrop image"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-amber-400 shadow-md backdrop-blur-md transition-all hover:scale-110 hover:bg-black/90 active:scale-95"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={randomizeArtwork}
                      aria-label="Randomize poster and backdrop"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-amber-300 shadow-md backdrop-blur-md transition-all hover:scale-110 hover:bg-black/90 active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {rating && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 shadow-md">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-white font-semibold text-xs tabular-nums">
                        {typeof rating === 'number' ? rating.toFixed(1) : rating}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-3.5 flex items-end gap-3">

                    <div className="relative flex-shrink-0 group/poster">
                      {previewPoster ? (
                        <img
                          src={previewPoster}
                          alt={title}
                          className="w-12 h-16 sm:w-14 sm:h-20 object-cover rounded-lg border border-white/20 shadow-lg"
                        />
                      ) : (
                        <div className="w-12 h-16 sm:w-14 sm:h-20 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                          <MediumIcon className="w-5 h-5 text-amber-400" />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setArtworkSelector('poster')}
                        aria-label="Change poster image"
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-black/80 hover:bg-black backdrop-blur-md border border-white/30 text-amber-400 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg z-10"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      {statusMeta && (
                        <div className="mb-1.5 flex">
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/25 bg-amber-300/15 px-2 py-0.5 text-[8px] font-black tracking-wider text-amber-200 backdrop-blur-xl">
                            <statusMeta.icon className="h-2.5 w-2.5" />
                            {statusMeta.label}
                          </span>
                        </div>
                      )}
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

                <section className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 backdrop-blur-md">
                  <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                    <div>
                      <p className="text-[11px] font-bold text-white leading-tight">Share status</p>
                      <p className="text-[9px] font-medium text-white/40 leading-tight">Add context to your story</p>
                    </div>
                    {selectedStatus && (
                      <button
                        type="button"
                        onClick={() => setSelectedStatus(null)}
                        className="text-[9px] font-semibold text-amber-400/80 hover:text-amber-300 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {STATUS_OPTIONS.map((item) => {
                      const Icon = item.icon;
                      const active = selectedStatus === item.id;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setSelectedStatus(active ? null : item.id)}
                          className={`group relative flex shrink-0 snap-start items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-wide transition-all duration-200 active:scale-95 ${active
                              ? 'bg-amber-400 text-zinc-950 font-bold shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                              : 'bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white border border-white/10'
                            }`}
                        >
                          <Icon
                            className={`h-3 w-3 shrink-0 transition-transform duration-200 group-hover:scale-105 ${active ? 'text-zinc-950 stroke-[2.5]' : 'text-amber-400/90'
                              }`}
                          />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

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


          <AnimatePresence>
            {artworkSelector && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[11000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl"
                onClick={() => setArtworkSelector(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] border border-white/15 bg-zinc-950 shadow-2xl sm:h-[82vh] sm:rounded-[32px]"
                >
                  <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/10 flex-shrink-0">
                    <div>
                      <h3 className="text-sm font-bold text-white">Select {artworkSelector === 'poster' ? 'Poster' : 'Backdrop'}</h3>
                      <p className="text-[11px] text-white/50">{artworkChoices.length} images available</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setArtworkSelector(null)}
                      className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-90"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-shrink-0 border-b border-white/10 bg-zinc-950 px-3 py-3 sm:px-5 sm:py-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="relative aspect-[9/16] w-[72px] shrink-0 overflow-hidden rounded-[14px] border border-white/15 bg-black shadow-xl sm:w-[92px]">
                        {previewBackdrop ? <img src={thumbnailUrl(previewBackdrop, 'w500')} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-zinc-900" />}
                        <div className="absolute inset-0 bg-black/55" />
                        <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between gap-1">
                          <span className="rounded-full border border-white/15 bg-black/60 px-1.5 py-0.5 text-[5px] font-bold uppercase tracking-wide text-white/80">{safeMedium}</span>
                          {rating && <span className="flex items-center gap-0.5 rounded-full border border-white/15 bg-black/60 px-1.5 py-0.5 text-[5px] font-bold text-amber-200"><Star className="h-1.5 w-1.5 fill-amber-200" />{typeof rating === 'number' ? rating.toFixed(1) : rating}</span>}
                        </div>
                        <div className="absolute left-1/2 top-[43%] aspect-[2/3] w-[52%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[7px] border border-white/25 bg-black/50 shadow-lg">
                          {previewPoster ? <img src={thumbnailUrl(previewPoster, 'w342')} alt={title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><MediumIcon className="h-4 w-4 text-white/20" /></div>}
                        </div>
                        <div className="absolute inset-x-2 bottom-2 text-center">
                          {statusMeta && <div className="mx-auto mb-1 w-fit rounded-full border border-amber-300/25 bg-amber-300/15 px-1.5 py-0.5 text-[4.5px] font-black tracking-wide text-amber-200">{statusMeta.label}</div>}
                          <p className="line-clamp-2 text-[6px] font-black leading-tight text-white">{title}</p>
                          <p className="mt-0.5 text-[4.5px] font-medium text-white/50">{year}{genres[0] ? ` · ${genres[0]}` : ''}</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-xs font-black text-white"><ImageIcon className="h-3.5 w-3.5 text-amber-400" />Live story preview</p>
                            <p className="mt-1 text-[10px] leading-relaxed text-white/45">Artwork updates instantly while you browse.</p>
                          </div>
                          <button type="button" onClick={randomizeArtwork} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-amber-300 transition hover:bg-amber-400/20 active:scale-95" aria-label="Randomize artwork"><Sparkles className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <button type="button" onClick={resetArtwork} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-bold text-white/50 transition hover:text-white"><RotateCcw className="h-3 w-3" />Reset</button>
                          {statusMeta && <span className="rounded-lg border border-amber-300/15 bg-amber-300/10 px-2 py-1.5 text-[9px] font-black text-amber-200">{statusMeta.label}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 border-b border-white/10 bg-zinc-900/50 p-2 sm:px-5 flex-shrink-0">
                    <button type="button" onClick={() => setArtworkSelector('poster')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${artworkSelector === 'poster' ? 'bg-amber-500 text-black' : 'text-white/60 hover:text-white'}`}>Posters ({posterChoices.length})</button>
                    <button type="button" onClick={() => setArtworkSelector('backdrop')} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${artworkSelector === 'backdrop' ? 'bg-amber-500 text-black' : 'text-white/60 hover:text-white'}`}>Backdrops ({backdropChoices.length})</button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
                    {artworkLoading ? (
                      <div className="h-full flex items-center justify-center gap-2 text-xs text-white/50">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Loading artwork options…</span>
                      </div>
                    ) : artworkChoices.length ? (
                      <div className={artworkSelector === 'poster' ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 sm:gap-3' : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'}>
                        {artworkChoices.map((url) => {
                          const isSelected = artworkSelector === 'poster' ? selectedPoster === url : selectedBackdrop === url;
                          return (
                            <button
                              type="button"
                              key={url}
                              onClick={() => selectArtwork(url)}
                              className={`relative group overflow-hidden rounded-xl border bg-zinc-900 transition-all active:scale-[0.98] ${artworkSelector === 'poster' ? 'aspect-[2/3]' : 'aspect-video'} ${isSelected ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-white/10 hover:border-white/30'}`}
                            >
                              <img
                                src={thumbnailUrl(url, artworkSelector === 'poster' ? 'w342' : 'w500')}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                              {isSelected && (
                                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-md">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center">
                        <ImageIcon className="w-8 h-8 text-white/20 mb-2" />
                        <p className="text-xs font-medium text-white/60">No additional images found</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2 border-t border-white/10 bg-zinc-900/60 px-3 py-3 sm:px-5">
                    <button type="button" onClick={resetArtwork} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-bold text-white/55 transition hover:text-white active:scale-95">
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden xs:inline">Reset</span>
                    </button>
                    <button type="button" onClick={randomizeArtwork} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 text-[10px] font-black text-amber-300 transition hover:bg-amber-400/15 active:scale-95">
                      <Sparkles className="h-3.5 w-3.5" />
                      Randomize
                    </button>
                    <button type="button" onClick={() => setArtworkSelector(null)} className="ml-auto h-9 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 text-[10px] font-black text-black shadow-lg transition hover:brightness-110 active:scale-95">
                      Done
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShareSheet;
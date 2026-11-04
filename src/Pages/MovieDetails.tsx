import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Star, Calendar, Clock, DollarSign, Bookmark, ThumbsDown, ThumbsUp, BookmarkCheck, TvMinimalPlay, ImageOff, Check, Plus, Loader2, Users, Award, MessageCircle, MoreHorizontal, Edit2, Trash2, Quote, Lock, Send, SquarePen, Share2, Heart, ListChecks, RotateCcw, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, X, CheckCheck, Info, ExternalLink, Pencil, Settings2, Bell, Youtube, EyeOff, ArrowUpRight, Download, Clapperboard, Sparkles, Film, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { collection, addDoc, query, setDoc, doc, getDocs, deleteDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAutoLandscapeFullscreen } from '../hooks/useAutoLandscapeFullscreen.ts';
import Toast from '../components/Toast.tsx';
import Loading from '../components/Loading.tsx';
import * as htmlToImage from 'html-to-image';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { enqueueWatchlistOp, registerWatchlistSync } from '../utils/watchlistQueue.ts';
import { getMovieEmbedUrls, PlayerSource } from '../utils/playerSources.ts';
import PlayerControl from '../components/PlayerControl.tsx';
import MovieCollection from '../components/MovieCollection.tsx';
import SimilarTitles from '../components/SimilarTitles.tsx';
import ProductionMediaTrailers from '../components/ProductionMediaTrailers.tsx';
import MediaRating from '../components/MediaRating.tsx';

const TMDB_KEY = '859afbb4b98e3b467da9c99ac390e950';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p';

type MovieShareTheme = 'minimal' | 'cinematic' | 'poster' | 'backdrop';
type ReviewShareTheme = 'minimal' | 'cinematic' | 'poster' | 'backdrop';
type ReviewShareTextSize = 'small' | 'medium' | 'large';
type ArtworkTab = 'poster' | 'backdrop';

interface TmdbImageVariant {
  file_path: string;
  vote_count?: number;
  vote_average?: number;
  width?: number;
  height?: number;
}

interface Movie {
  id: number;
  title: string;
  overview: string;
  language: string;
  director: string;
  directorId?: number;
  boxOffice: string;
  release_date: string;
  genres: { id: number; name: string }[];
  runtime: number;
  vote_average: number;
  poster_path: string;
  backdrop_path?: string | null;
  cast: { id: number; name: string; role: string; profile_path: string; category?: string }[] | null;
  reviews: { id: string; author: string; content: string; likes?: number; dislikes?: number }[];
  trailers: { key: string; name: string }[];
  images: { backdrops: { file_path: string }[]; posters: { file_path: string }[] };
  streamingLinks: any;
  imdb_id: string;
  original_title?: string;
  status?: string;
  homepage?: string;
  certification?: string;
  productionCompanies?: { id: number; name: string }[];
  productionCountries?: { iso_3166_1: string; name: string }[];
  releases?: { iso_3166_1: string; certification?: string; release_date?: string; type?: number }[];
  watchProviders?: Record<string, any>;
}

interface MyListFolder {
  id: string;
  name: string;
  posterPaths?: string[];
}

const normalizeTmdbImageUrl = (value?: string | null, size = 'original') => {
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${TMDB_IMG_BASE}/${size}${path}`;
};

const uniqueTmdbUrls = (urls: string[]) => Array.from(new Set(urls.filter(Boolean)));

const preloadTmdbImage = (src?: string | null) =>
  new Promise<void>((resolve) => {
    if (!src) {
      resolve();
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });

const ShareRatingStars = ({ rating, size = 18, gap = 2 }: { rating: number; size?: number; gap?: number }) => {
  const clampedRating = Math.max(0, Math.min(10, rating));
  return (
    <div className="flex items-center" style={{ gap }}>
      {Array.from({ length: 10 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, clampedRating - index));
        return (
          <div key={index} className="relative shrink-0" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 fill-zinc-700/60 text-zinc-700/60" style={{ width: size, height: size }} strokeWidth={1.8} />
            {fill > 0 && (
              <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star
                  className="absolute left-0 top-0 fill-amber-500 text-amber-500 drop-shadow-[0_0_8px_rgba(252,211,77,0.34)]"
                  style={{ width: size, height: size, maxWidth: 'none' }}
                  strokeWidth={1.8}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const useTmdbArtwork = (
  open: boolean,
  movieId: number | undefined,
  mediaType: 'movie' | 'tv',
  posterPath?: string | null,
  backdropPath?: string | null,
) => {
  const [selectedPoster, setSelectedPoster] = useState('');
  const [selectedBackdrop, setSelectedBackdrop] = useState('');
  const [posterVariants, setPosterVariants] = useState<TmdbImageVariant[]>([]);
  const [backdropVariants, setBackdropVariants] = useState<TmdbImageVariant[]>([]);
  const [baseBackdrop, setBaseBackdrop] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedPoster(normalizeTmdbImageUrl(posterPath));
    setSelectedBackdrop(normalizeTmdbImageUrl(backdropPath));
  }, [open, posterPath, backdropPath]);

  useEffect(() => {
    if (!open || !movieId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [detailsRes, imagesRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/${mediaType}/${movieId}?api_key=${TMDB_KEY}&language=en-US`),
          fetch(`https://api.themoviedb.org/3/${mediaType}/${movieId}/images?api_key=${TMDB_KEY}&include_image_language=en,null`),
        ]);
        if (!detailsRes.ok || !imagesRes.ok) throw new Error('TMDB artwork request failed');
        const details = await detailsRes.json();
        const images = await imagesRes.json();
        if (cancelled) return;

        const rank = (items: TmdbImageVariant[]) =>
          [...items].sort((a, b) => {
            const aScore = (a.vote_average || 0) * 100 + (a.vote_count || 0) * 4 + ((a.width || 0) * (a.height || 0)) / 1000000;
            const bScore = (b.vote_average || 0) * 100 + (b.vote_count || 0) * 4 + ((b.width || 0) * (b.height || 0)) / 1000000;
            return bScore - aScore;
          });

        const posters = rank(Array.isArray(images.posters) ? images.posters : []);
        const backdrops = rank(Array.isArray(images.backdrops) ? images.backdrops : []);
        const detailsPoster = normalizeTmdbImageUrl(details.poster_path);
        const detailsBackdrop = normalizeTmdbImageUrl(details.backdrop_path);

        setPosterVariants(posters);
        setBackdropVariants(backdrops);
        setBaseBackdrop(detailsBackdrop);
        setSelectedPoster((current) => current || detailsPoster || normalizeTmdbImageUrl(posterPath));
        setSelectedBackdrop((current) => current || detailsBackdrop || normalizeTmdbImageUrl(backdrops[0]?.file_path));
      } catch {
        if (!cancelled) setBaseBackdrop('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, movieId, mediaType, posterPath, backdropPath]);

  const posterChoices = useMemo(
    () => uniqueTmdbUrls([normalizeTmdbImageUrl(posterPath), ...posterVariants.map((item) => normalizeTmdbImageUrl(item.file_path))]),
    [posterPath, posterVariants],
  );
  const backdropChoices = useMemo(
    () => uniqueTmdbUrls([baseBackdrop, ...backdropVariants.map((item) => normalizeTmdbImageUrl(item.file_path))]),
    [baseBackdrop, backdropVariants],
  );

  const previewPoster = selectedPoster || posterChoices[0] || '';
  const previewBackdrop = selectedBackdrop || backdropChoices[0] || previewPoster;

  const randomize = () => {
    const pick = (items: string[], current: string) => {
      const pool = items.slice(0, 14).filter((item) => item !== current);
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : current || items[0] || '';
    };
    setSelectedPoster((current) => pick(posterChoices, current));
    setSelectedBackdrop((current) => pick(backdropChoices, current));
  };

  const reset = () => {
    setSelectedPoster(normalizeTmdbImageUrl(posterPath) || posterChoices[0] || '');
    setSelectedBackdrop(normalizeTmdbImageUrl(backdropPath) || baseBackdrop || backdropChoices[0] || '');
  };

  return {
    poster: previewPoster,
    backdrop: previewBackdrop,
    setPoster: setSelectedPoster,
    setBackdrop: setSelectedBackdrop,
    posterChoices,
    backdropChoices,
    randomize,
    reset,
    loading,
  };
};

const ArtworkPickerModal = ({
  open,
  onClose,
  tab,
  choices,
  currentUrl,
  onSelect,
  onRandomize,
  onReset,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  tab: ArtworkTab;
  choices: string[];
  currentUrl: string;
  onSelect: (url: string) => void;
  onRandomize: () => void;
  onReset: () => void;
  loading: boolean;
}) => {
  if (!open) return null;
  const isPoster = tab === 'poster';

  return createPortal(
    <div className="fixed inset-0 z-[10080] flex items-end justify-center bg-black/80 p-0 backdrop-blur-lg sm:items-center sm:p-5" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} onClick={(event) => event.stopPropagation()} className="flex h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[30px] border border-white/15 bg-zinc-950 shadow-2xl sm:h-[80vh] sm:rounded-[32px]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
          <div>
            <h3 className="text-sm font-black text-white">Choose {isPoster ? 'Poster' : 'Backdrop'}</h3>
            <p className="text-[10px] text-white/40">{choices.length} TMDB images available</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-white/50"><Loader2 className="h-4 w-4 animate-spin text-amber-300" />Loading artwork…</div>
          ) : choices.length ? (
            <div className={isPoster ? 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3'}>
              {choices.map((url) => {
                const selected = currentUrl === url;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onSelect(url)}
                    className={`relative overflow-hidden rounded-xl border bg-zinc-900 transition active:scale-[0.98] ${isPoster ? 'aspect-[2/3]' : 'aspect-video'} ${selected ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-white/10 hover:border-white/30'}`}
                  >
                    <img src={url.replace('/original/', isPoster ? '/w342/' : '/w500/')} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black"><Check className="h-3.5 w-3.5 stroke-[3]" /></span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center"><ImageOff className="mb-2 h-8 w-8 text-white/20" /><p className="text-xs font-medium text-white/60">No additional images found</p></div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-3 sm:px-5">
          <button type="button" onClick={onReset} className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-bold text-white/55"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
          <button type="button" onClick={onRandomize} className="flex h-9 items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 text-[10px] font-black text-amber-300"><Sparkles className="h-3.5 w-3.5" />Randomize</button>
          <button type="button" onClick={onClose} className="ml-auto h-9 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 text-[10px] font-black text-black">Done</button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

const UserRatingShareSheet = ({
  open,
  onClose,
  movieId,
  title,
  posterPath,
  backdropPath,
  genres,
  releaseDate,
  userRating,
  userName,
  userAvatar,
  userHandle,
  lastWatched,
  isFavorite = false,
}: {
  open: boolean;
  onClose: () => void;
  movieId?: number;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  genres: string[];
  releaseDate: string;
  userRating?: number | null;
  userName?: string;
  userAvatar?: string | null;
  userHandle?: string;
  lastWatched?: string | null;
  isFavorite?: boolean;
}) => {
  const [theme, setTheme] = useState<MovieShareTheme>('cinematic');
  const [downloading, setDownloading] = useState(false);
  const [artworkSelector, setArtworkSelector] = useState<ArtworkTab | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const artwork = useTmdbArtwork(open, movieId, 'movie', posterPath, backdropPath);

  const hasUserRating = userRating !== null && userRating !== undefined && Number.isFinite(userRating);
  const handle = userHandle || userName?.toLowerCase().replace(/\s/g, '') || 'user';

  const GRAIN = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)' opacity='0.9'/%3E%3C/svg%3E")`,
  };

  const redGrainBg = `radial-gradient(ellipse 70% 50% at 25% 15%, rgba(200, 35, 30, 0.75), transparent 60%), radial-gradient(ellipse 80% 60% at 80% 25%, rgba(150, 20, 18, 0.85), transparent 55%), radial-gradient(ellipse 90% 70% at 40% 78%, rgba(220, 50, 40, 0.9), transparent 60%), radial-gradient(ellipse 70% 60% at 90% 85%, rgba(160, 25, 22, 0.8), transparent 55%), radial-gradient(ellipse 60% 50% at 10% 88%, rgba(180, 30, 25, 0.85), transparent 55%), linear-gradient(135deg, #2a0505 0%, #0a0101 50%, #1a0303 100%)`;

  const downloadCard = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      await Promise.all([
        preloadTmdbImage(artwork.poster),
        preloadTmdbImage(artwork.backdrop),
        preloadTmdbImage(userAvatar || '/user-icon.jpg'),
        preloadTmdbImage('/Cinescape_Logo.svg'),
        preloadTmdbImage('/Cinescape_Wordmark.svg'),
      ]);
      const dataUrl = await htmlToImage.toPng(cardRef.current, { cacheBust: true, pixelRatio: 1, width: 1080, height: 1920 });
      const link = document.createElement('a');
      link.download = `${title || 'Cinescape'}-share.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[10060] flex items-end justify-center bg-black/80 backdrop-blur-xl sm:items-center sm:p-5">
          <button type="button" aria-label="Close share sheet" onClick={onClose} className="absolute inset-0" />
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-zinc-950 shadow-2xl sm:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
              <div>
                <h2 className="text-sm font-black text-white">Share movie card</h2>
                <p className="mt-0.5 text-[10px] text-white/40">Create a cinematic card for {title}</p>
              </div>
              <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid min-h-0 flex-1 overflow-y-auto sm:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex items-center justify-center bg-black/30 p-4 sm:p-6">
                <div className={`relative aspect-[9/16] w-full max-w-[270px] overflow-hidden rounded-2xl ${theme === 'minimal' ? 'bg-black' : 'bg-black'}`}>

                  {theme === 'minimal' ? (
                    <div className="absolute inset-0 bg-[#0a0202]">
                      <div className="absolute inset-0" style={{ background: redGrainBg }} />
                      <div className="absolute inset-0 mix-blend-overlay opacity-60" style={GRAIN} />
                      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 18%, rgba(0,0,0,0.82) 100%)' }} />

                      <div className="absolute inset-0 flex flex-col p-5 justify-between">
                        <div className="flex justify-between items-start">
                          <div className="bg-black/60 p-1.5 rounded-xl backdrop-blur-md border border-white/10 shadow-lg">
                            <img src="/Cinescape_Logo.svg" alt="Logo" className="h-6 w-6 object-contain" />
                          </div>
                          <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-3 object-contain opacity-80 brightness-0 invert" />
                        </div>

                        <div className="flex flex-col items-start mt-auto">
                          <img src={artwork.poster} alt="" className="w-24 aspect-[2/3] object-cover rounded-xl shadow-2xl border border-white/10" />
                          <h3 className="mt-4 text-2xl font-bold leading-tight text-white line-clamp-2 drop-shadow-sm">{title}</h3>
                          <p className="mt-1 text-[11px] font-medium text-white/70">
                            {releaseDate?.slice(0, 4)} · {genres[0] || 'Movie'}
                          </p>
                          {hasUserRating && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,1)]" />
                              <span className="text-[13px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{userRating!.toFixed(1)}</span>
                              {isFavorite && <Heart className="h-3.5 w-3.5 fill-red-400 text-red-400" />}
                            </div>
                          )}
                          {lastWatched && (
                            <div className="mt-3">
                              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/50">Last Watched</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-white/90">{lastWatched}</p>
                            </div>
                          )}
                        </div>

                        <div className="mt-6 flex items-center gap-2">
                          {userAvatar ? (
                            <img src={userAvatar} alt="" className="w-7 h-7 rounded-full object-cover border border-white/20 shadow-sm" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">{userName?.charAt(0) || 'U'}</div>
                          )}
                          <div>
                            <p className="text-[10px] font-bold text-white">{userName || 'User'}</p>
                            <p className="text-[8px] text-white/50">@{handle}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : theme === 'cinematic' ? (
                    <div className="absolute inset-0 bg-black">
                      <img src={artwork.backdrop} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 blur-xl" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                      <div className="relative z-10 flex flex-col h-full p-6 items-center justify-between">
                        <div className="w-full flex justify-between items-center mb-4">
                          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-md border border-white/20">
                            <Clapperboard className="h-3 w-3 text-white" />
                            <span className="text-[9px] font-bold text-white tracking-widest uppercase">Movie</span>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-90">
                            <img src="/Cinescape_Logo.svg" alt="Logo" className="h-5 w-5 object-contain" />
                            <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-3 object-contain brightness-0 invert" />
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-start w-full mt-2">
                          <img src={artwork.poster} alt="" className="w-[160px] aspect-[2/3] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/20" />
                          <h3 className="text-xl font-black text-white mt-3 text-center line-clamp-2 leading-tight px-2">{title}</h3>
                          <p className="text-[10px] text-white/60 font-medium mt-1 text-center">{releaseDate?.slice(0, 4)} · {genres.slice(0, 2).join(', ')}</p>
                          {hasUserRating && (
                            <div className="mt-2 flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 border border-white/20 backdrop-blur-md">
                              <Star className="h-3 w-3 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                              <span className="text-[10px] font-bold text-white">{userRating!.toFixed(1)}/10</span>
                              {isFavorite && <Heart className="h-2.5 w-2.5 fill-red-400 text-red-400" />}
                            </div>
                          )}
                        </div>

                        <div className="w-full flex items-center justify-between mt-4">
                          <div className="flex items-center gap-2">
                            {userAvatar ? (
                              <img src={userAvatar} alt="" className="w-8 h-8 rounded-full border border-white/20 object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">{userName?.charAt(0) || 'U'}</div>
                            )}
                            <div>
                              <p className="text-[11px] font-bold text-white">{userName || 'User'}</p>
                              <p className="text-[9px] text-white/50">@{handle}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Last Watched</p>
                            <p className="text-[10px] font-bold text-white/80">{lastWatched || 'Today'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : theme === 'poster' ? (
                    <div className="absolute inset-0 bg-black">
                      {artwork.poster ? <img src={artwork.poster} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                      <div className="absolute inset-0 flex flex-col justify-between p-5">
                        <div className="flex justify-between items-start">
                          <div className="bg-black/60 p-1.5 rounded-xl backdrop-blur-md border border-white/10 shadow-lg">
                            <img src="/Cinescape_Logo.svg" alt="Logo" className="h-6 w-6 object-contain" />
                          </div>
                          <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-3 object-contain opacity-80 brightness-0 invert" />
                        </div>

                        <div className="bg-white/[0.06] backdrop-blur-[30px] border border-white/20 p-4 rounded-[20px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                          <h3 className="text-2xl font-black leading-tight text-white line-clamp-2">{title}</h3>
                          <p className="mt-1 text-[11px] font-medium text-white/60">{releaseDate?.slice(0, 4)} · {genres[0] || 'Movie'}</p>
                          {hasUserRating && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                              <span className="text-[12px] font-bold text-white">{userRating!.toFixed(1)}/10</span>
                              {isFavorite && <Heart className="h-3 w-3 fill-red-400 text-red-400" />}
                            </div>
                          )}

                          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                            <div className="flex items-center gap-2">
                              {userAvatar ? (
                                <img src={userAvatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/20" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white">{userName?.charAt(0) || 'U'}</div>
                              )}
                              <div>
                                <p className="text-[10px] font-bold text-white">{userName || 'User'}</p>
                                <p className="text-[8px] text-white/50">@{handle}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Watched</p>
                              <p className="text-[9px] font-bold text-white/80">{lastWatched || 'Today'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col">
                      <div className="relative h-[45%] w-full shrink-0">
                        {artwork.backdrop ? <img src={artwork.backdrop} alt="" className="absolute inset-0 w-full h-full object-cover" /> : null}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#0a0a0a]" />

                        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                          <div className="bg-black/60 p-1.5 rounded-xl backdrop-blur-md border border-white/10 shadow-lg">
                            <img src="/Cinescape_Logo.svg" alt="Logo" className="h-5 w-5 object-contain" />
                          </div>
                          <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-3 object-contain opacity-80 brightness-0 invert" />
                        </div>
                      </div>

                      <div className="relative flex-1 flex flex-col items-center px-6 pb-6 -mt-16 z-10">
                        {artwork.poster ? <img src={artwork.poster} alt="" className="w-24 aspect-[2/3] rounded-xl object-cover shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-white/20" /> : null}

                        <h3 className="text-xl font-black text-white mt-4 text-center line-clamp-2 leading-tight">{title}</h3>
                        <p className="text-[10px] text-white/60 font-medium mt-1 text-center">{releaseDate?.slice(0, 4)} · {genres.slice(0, 2).join(', ')}</p>

                        {hasUserRating && (
                          <div className="mt-2 flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 border border-white/20 backdrop-blur-md">
                            <Star className="h-3 w-3 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                            <span className="text-[10px] font-bold text-white">{userRating!.toFixed(1)}/10</span>
                            {isFavorite && <Heart className="h-2.5 w-2.5 fill-red-400 text-red-400" />}
                          </div>
                        )}

                        <div className="mt-auto w-full flex items-center justify-between border-t border-white/10 pt-4">
                          <div className="flex items-center gap-2">
                            {userAvatar ? (
                              <img src={userAvatar} alt="" className="w-8 h-8 rounded-full border border-white/20 object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">{userName?.charAt(0) || 'U'}</div>
                            )}
                            <div>
                              <p className="text-[11px] font-bold text-white">{userName || 'User'}</p>
                              <p className="text-[9px] text-white/50">@{handle}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Last Watched</p>
                            <p className="text-[10px] font-bold text-white/80">{lastWatched || 'Today'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t border-white/10 p-4 sm:border-l sm:border-t-0 sm:p-5">
                <div>
                  <p className="text-xs font-black text-white">Card theme</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([['minimal', 'Minimal'], ['cinematic', 'Cinematic'], ['poster', 'Poster-first'], ['backdrop', 'Backdrop-first']] as [MovieShareTheme, string][]).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setTheme(value)} className={`rounded-xl border px-3 py-2.5 text-left text-[10px] font-bold transition active:scale-[0.98] ${theme === value ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white/80'}`}>{label}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black text-white">Artwork</p>
                  <p className="mt-0.5 text-[10px] text-white/40">Choose, randomize, or reset</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setArtworkSelector('poster')} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-[10px] font-bold text-white/75 transition hover:bg-white/[0.08] hover:text-white">
                    <ImageIcon className="h-3.5 w-3.5 text-amber-300" />Poster
                  </button>
                  <button type="button" onClick={() => setArtworkSelector('backdrop')} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-[10px] font-bold text-white/75 transition hover:bg-white/[0.08] hover:text-white">
                    <ImageIcon className="h-3.5 w-3.5 text-sky-300" />Backdrop
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={artwork.randomize} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-[10px] font-black text-emerald-300 transition hover:bg-emerald-400/15">
                    <Sparkles className="h-3.5 w-3.5" />Randomize
                  </button>
                  <button type="button" onClick={artwork.reset} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[10px] font-bold text-white/55 transition hover:text-white">
                    <RotateCcw className="h-3.5 w-3.5" />Reset
                  </button>
                </div>

                {hasUserRating && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-white/45">Your rating</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                          <span className="text-lg font-black tabular-nums text-white">{userRating!.toFixed(1)}</span>
                        </div>
                      </div>
                      {isFavorite && (
                        <div className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-red-500 to-red-600 px-3 py-2 text-[10px] font-black text-white shadow-md shadow-red-500/30">
                          <Heart className="h-3.5 w-3.5 fill-current" /> Favorite
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button type="button" onClick={downloadCard} disabled={downloading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-200 to-cyan-100 px-4 text-xs font-black text-zinc-950 disabled:opacity-50">
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloading ? 'Exporting…' : 'Save Share Card'}
                </button>
              </div>
            </div>

            <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden="true">
              {theme === 'minimal' ? (
                <div ref={cardRef} className="relative h-[1920px] w-[1080px] overflow-hidden bg-[#0a0202] text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',sans-serif]">
                  <div className="absolute inset-0" style={{ background: redGrainBg }} />
                  <div className="absolute inset-0 mix-blend-overlay opacity-60" style={GRAIN} />
                  <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 18%, rgba(0,0,0,0.82) 100%)' }} />

                  <div className="absolute inset-0 flex flex-col p-[90px] justify-between">
                    <div className="flex justify-between items-start w-full">
                      <div className="bg-black/60 p-[16px] rounded-[24px] backdrop-blur-md border border-white/10 shadow-xl">
                        <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[80px] w-[80px] object-contain" />
                      </div>
                      <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[40px] object-contain opacity-80 brightness-0 invert mt-[20px]" />
                    </div>

                    <div className="flex flex-col items-start mt-auto">
                      <img src={artwork.poster} crossOrigin="anonymous" alt="" className="w-[380px] aspect-[2/3] object-cover rounded-[40px] shadow-[0_40px_80px_rgba(0,0,0,0.6)] border border-white/20" />
                      <h1 className="mt-[50px] text-[96px] font-bold leading-[1.05] text-white line-clamp-3 tracking-tight drop-shadow-md">{title}</h1>
                      <p className="mt-[20px] text-[36px] font-medium text-white/70">
                        {releaseDate?.slice(0, 4)} · {genres[0] || 'Movie'}
                      </p>
                      {hasUserRating && (
                        <div className="mt-[30px] flex items-center gap-4">
                          <Star className="h-[48px] w-[48px] fill-amber-400 text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,1)]" />
                          <span className="text-[48px] font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{userRating!.toFixed(1)}</span>
                          {isFavorite && <Heart className="h-[42px] w-[42px] fill-red-400 text-red-400" />}
                        </div>
                      )}
                      {lastWatched && (
                        <div className="mt-[50px]">
                          <p className="text-[24px] font-bold uppercase tracking-[0.2em] text-white/50">Last Watched</p>
                          <p className="mt-[16px] text-[40px] font-semibold text-white/90">{lastWatched}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-[30px] mt-[80px]">
                      {userAvatar ? (
                        <img src={userAvatar} crossOrigin="anonymous" alt="" className="w-[120px] h-[120px] rounded-full object-cover border-[4px] border-white/20 shadow-xl" />
                      ) : (
                        <div className="w-[120px] h-[120px] rounded-full bg-white/10 flex items-center justify-center text-[48px] font-bold shadow-xl">{userName?.charAt(0) || 'U'}</div>
                      )}
                      <div>
                        <p className="text-[44px] font-bold text-white">{userName || 'User'}</p>
                        <p className="text-[32px] text-white/50">@{handle}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : theme === 'cinematic' ? (
                <div ref={cardRef} className="relative h-[1920px] w-[1080px] overflow-hidden bg-black text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',sans-serif]">
                  <img src={artwork.backdrop} crossOrigin="anonymous" alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 blur-[80px]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />

                  <div className="relative z-10 flex flex-col h-full p-[80px] items-center justify-between">
                    <div className="w-full flex justify-between items-center mb-[80px]">
                      <div className="flex items-center gap-[16px] rounded-full bg-white/10 px-[40px] py-[20px] backdrop-blur-md border border-white/20">
                        <Clapperboard className="h-[36px] w-[36px] text-white" />
                        <span className="text-[28px] font-bold text-white tracking-widest uppercase">Movie</span>
                      </div>
                      <div className="flex items-center gap-[20px] opacity-90">
                        <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[60px] w-[60px] object-contain" />
                        <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[40px] object-contain brightness-0 invert" />
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-start w-full mt-[40px]">
                      <img src={artwork.poster} crossOrigin="anonymous" alt="" className="w-[500px] aspect-[2/3] rounded-[40px] shadow-[0_60px_120px_rgba(0,0,0,0.9)] border-[3px] border-white/20" />
                      <h1 className="text-[80px] font-black text-white mt-[30px] text-center line-clamp-2 leading-[1.1]">{title}</h1>
                      <p className="text-[32px] text-white/60 font-medium mt-[20px] text-center">{releaseDate?.slice(0, 4)} · {genres.slice(0, 2).join(', ')}</p>

                      {hasUserRating && (
                        <div className="mt-[30px] flex items-center gap-[12px] rounded-full bg-white/10 px-[30px] py-[12px] border border-white/20 backdrop-blur-md">
                          <Star className="h-[32px] w-[32px] text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
                          <span className="text-[32px] font-bold text-white">{userRating!.toFixed(1)}/10</span>
                          {isFavorite && <Heart className="h-[28px] w-[28px] fill-red-400 text-red-400" />}
                        </div>
                      )}
                    </div>

                    <div className="w-full flex items-center justify-between mt-[80px]">
                      <div className="flex items-center gap-[30px]">
                        {userAvatar ? (
                          <img src={userAvatar} crossOrigin="anonymous" alt="" className="w-[120px] h-[120px] rounded-full border-[4px] border-white/20 object-cover" />
                        ) : (
                          <div className="w-[120px] h-[120px] rounded-full bg-white/10 flex items-center justify-center text-[48px] font-bold text-white">{userName?.charAt(0) || 'U'}</div>
                        )}
                        <div>
                          <p className="text-[40px] font-bold text-white">{userName || 'User'}</p>
                          <p className="text-[28px] text-white/50">@{handle}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[24px] font-bold text-white/40 uppercase tracking-[0.2em]">Last Watched</p>
                        <p className="text-[36px] font-bold text-white/90">{lastWatched || 'Today'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : theme === 'poster' ? (
                <div ref={cardRef} className="relative h-[1920px] w-[1080px] overflow-hidden bg-black text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',sans-serif]">
                  {artwork.poster ? <img src={artwork.poster} crossOrigin="anonymous" alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                  <div className="absolute inset-0 flex flex-col justify-between p-[90px]">
                    <div className="flex justify-between items-start w-full">
                      <div className="bg-black/60 p-[16px] rounded-[24px] backdrop-blur-md border border-white/10 shadow-xl">
                        <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[80px] w-[80px] object-contain" />
                      </div>
                      <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[40px] object-contain opacity-80 brightness-0 invert mt-[20px]" />
                    </div>

                    <div className="bg-white/[0.06] backdrop-blur-[60px] border border-white/20 p-[60px] rounded-[40px] shadow-[inset_0_2px_2px_rgba(255,255,255,0.3),0_20px_60px_rgba(0,0,0,0.5)]">
                      <h1 className="text-[90px] font-black leading-[1.05] text-white line-clamp-3 tracking-tight drop-shadow-md">{title}</h1>
                      <p className="mt-[20px] text-[36px] font-medium text-white/60">
                        {releaseDate?.slice(0, 4)} · {genres[0] || 'Movie'}
                      </p>

                      {hasUserRating && (
                        <div className="mt-[30px] flex items-center gap-4">
                          <Star className="h-[48px] w-[48px] fill-amber-400 text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,1)]" />
                          <span className="text-[48px] font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{userRating!.toFixed(1)}/10</span>
                          {isFavorite && <Heart className="h-[42px] w-[42px] fill-red-400 text-red-400" />}
                        </div>
                      )}

                      <div className="mt-[50px] flex items-center justify-between border-t border-white/20 pt-[40px]">
                        <div className="flex items-center gap-[24px]">
                          {userAvatar ? (
                            <img src={userAvatar} crossOrigin="anonymous" alt="" className="w-[100px] h-[100px] rounded-full object-cover border-[3px] border-white/20 shadow-xl" />
                          ) : (
                            <div className="w-[100px] h-[100px] rounded-full bg-white/10 flex items-center justify-center text-[40px] font-bold shadow-xl">{userName?.charAt(0) || 'U'}</div>
                          )}
                          <div>
                            <p className="text-[36px] font-bold text-white">{userName || 'User'}</p>
                            <p className="text-[24px] text-white/50">@{handle}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[24px] font-bold text-white/40 uppercase tracking-[0.2em]">Watched</p>
                          <p className="text-[32px] font-bold text-white/90">{lastWatched || 'Today'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div ref={cardRef} className="relative h-[1920px] w-[1080px] overflow-hidden bg-[#0a0a0a] text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',sans-serif] flex flex-col">
                  <div className="relative h-[45%] w-full shrink-0">
                    {artwork.backdrop ? <img src={artwork.backdrop} crossOrigin="anonymous" alt="" className="absolute inset-0 w-full h-full object-cover" /> : null}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#0a0a0a]" />

                    <div className="absolute top-[80px] left-[80px] right-[80px] flex justify-between items-center">
                      <div className="bg-black/60 p-[16px] rounded-[24px] backdrop-blur-md border border-white/10 shadow-xl">
                        <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[80px] w-[80px] object-contain" />
                      </div>
                      <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[40px] object-contain opacity-80 brightness-0 invert" />
                    </div>
                  </div>

                  <div className="relative flex-1 flex flex-col items-center px-[80px] pb-[80px] -mt-[180px] z-10">
                    {artwork.poster ? <img src={artwork.poster} crossOrigin="anonymous" alt="" className="w-[360px] aspect-[2/3] rounded-[30px] object-cover shadow-[0_40px_80px_rgba(0,0,0,0.9)] border border-white/20" /> : null}

                    <h1 className="text-[80px] font-black text-white mt-[50px] text-center line-clamp-3 leading-[1.05]">{title}</h1>
                    <p className="text-[32px] text-white/60 font-medium mt-[24px] text-center">{releaseDate?.slice(0, 4)} · {genres.slice(0, 2).join(', ')}</p>

                    {hasUserRating && (
                      <div className="mt-[30px] flex items-center gap-[12px] rounded-full bg-white/10 px-[30px] py-[12px] border border-white/20 backdrop-blur-md">
                        <Star className="h-[32px] w-[32px] text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
                        <span className="text-[32px] font-bold text-white">{userRating!.toFixed(1)}/10</span>
                        {isFavorite && <Heart className="h-[28px] w-[28px] fill-red-400 text-red-400" />}
                      </div>
                    )}

                    <div className="mt-auto w-full flex items-center justify-between border-t border-white/10 pt-[50px]">
                      <div className="flex items-center gap-[24px]">
                        {userAvatar ? (
                          <img src={userAvatar} crossOrigin="anonymous" alt="" className="w-[120px] h-[120px] rounded-full object-cover border-[3px] border-white/20 shadow-xl" />
                        ) : (
                          <div className="w-[120px] h-[120px] rounded-full bg-white/10 flex items-center justify-center text-[48px] font-bold shadow-xl">{userName?.charAt(0) || 'U'}</div>
                        )}
                        <div>
                          <p className="text-[40px] font-bold text-white">{userName || 'User'}</p>
                          <p className="text-[28px] text-white/50">@{handle}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[24px] font-bold text-white/40 uppercase tracking-[0.2em]">Last Watched</p>
                        <p className="text-[36px] font-bold text-white/90">{lastWatched || 'Today'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>,
        document.body,
      )}

      <ArtworkPickerModal
        open={artworkSelector === 'poster'}
        onClose={() => setArtworkSelector(null)}
        tab="poster"
        choices={artwork.posterChoices}
        currentUrl={artwork.poster}
        onSelect={artwork.setPoster}
        onRandomize={artwork.randomize}
        onReset={artwork.reset}
        loading={artwork.loading}
      />
      <ArtworkPickerModal
        open={artworkSelector === 'backdrop'}
        onClose={() => setArtworkSelector(null)}
        tab="backdrop"
        choices={artwork.backdropChoices}
        currentUrl={artwork.backdrop}
        onSelect={artwork.setBackdrop}
        onRandomize={artwork.randomize}
        onReset={artwork.reset}
        loading={artwork.loading}
      />
    </>
  );
};

const ReviewShareSheet = ({
  open,
  onClose,
  movieId,
  title,
  posterPath,
  backdropPath,
  releaseYear,
  reviewContent,
  author,
  userPhoto,
  userHandle,
  rating,
  watchDate,
  watchCount,
  mediaType = 'movie',
  isFavorite = false,
}: {
  open: boolean;
  onClose: () => void;
  movieId: number;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseYear: string;
  reviewContent: string;
  author: string;
  userPhoto?: string | null;
  userHandle?: string | null;
  rating?: number | null;
  watchDate?: string | null;
  watchCount?: number;
  mediaType?: 'movie' | 'tv';
  isFavorite?: boolean;
}) => {
  const [theme, setTheme] = useState<ReviewShareTheme>('cinematic');
  const [textSize, setTextSize] = useState<ReviewShareTextSize>('medium');
  const [artworkSelector, setArtworkSelector] = useState<ArtworkTab | null>(null);
  const [downloading, setDownloading] = useState(false);
  const storyCardRef = useRef<HTMLDivElement | null>(null);
  const artwork = useTmdbArtwork(open, movieId, mediaType, posterPath, backdropPath);

  const hasRating = rating !== null && rating !== undefined && Number.isFinite(rating);
  const isRewatch = (watchCount || 0) > 1;
  const handle = userHandle || author.toLowerCase().replace(/\s/g, '') || 'user';

  const GRAIN = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)' opacity='0.9'/%3E%3C/svg%3E")`,
  };

  const redGrainBg = `radial-gradient(ellipse 70% 50% at 25% 15%, rgba(200, 35, 30, 0.75), transparent 60%), radial-gradient(ellipse 80% 60% at 80% 25%, rgba(150, 20, 18, 0.85), transparent 55%), radial-gradient(ellipse 90% 70% at 40% 78%, rgba(220, 50, 40, 0.9), transparent 60%), radial-gradient(ellipse 70% 60% at 90% 85%, rgba(160, 25, 22, 0.8), transparent 55%), radial-gradient(ellipse 60% 50% at 10% 88%, rgba(180, 30, 25, 0.85), transparent 55%), linear-gradient(135deg, #2a0505 0%, #0a0101 50%, #1a0303 100%)`;

  const handleDownload = async () => {
    if (!storyCardRef.current) return;
    setDownloading(true);
    try {
      await Promise.all([
        preloadTmdbImage(artwork.poster),
        preloadTmdbImage(artwork.backdrop),
        preloadTmdbImage(userPhoto || '/user-icon.jpg'),
        preloadTmdbImage('/Cinescape_Logo.svg'),
        preloadTmdbImage('/Cinescape_Wordmark.svg'),
      ]);
      const dataUrl = await htmlToImage.toPng(storyCardRef.current, { cacheBust: true, pixelRatio: 1, width: 1080, height: 1920 });
      const link = document.createElement('a');
      link.download = `${title || 'review'}-${author || 'user'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate review card image:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (!open) return null;

  const backdropCardClass = 'border-white/[0.18] bg-black/60 text-white';
  const backdropFooterBorder = 'border-white/[0.055]';

  const ratingLabel = hasRating
    ? (rating as number) % 1 === 0
      ? `${rating}/10`
      : `${(rating as number).toFixed(1)}/10`
    : '';

  return createPortal(
    <>
      <div className="fixed inset-0 z-[10065] flex items-end justify-center p-0 overflow-hidden sm:items-center sm:p-5">
        <div onClick={onClose} className="absolute inset-0 bg-black/70 sm:bg-black/45" />
        <div className="pointer-events-none absolute inset-0 backdrop-blur-xl sm:backdrop-blur-md" />

        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 70, scale: 0.985 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="relative z-10 flex h-[92dvh] max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] border border-white/15 bg-zinc-950 shadow-[0_32px_100px_rgba(0,0,0,0.72)] sm:h-[min(88dvh,820px)] sm:max-h-[88dvh] sm:grid sm:grid-cols-[minmax(0,1fr)_340px] sm:rounded-[28px] sm:bg-zinc-950/85 sm:backdrop-blur-3xl lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <div className="flex min-h-0 flex-none flex-col overflow-hidden p-3 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:p-6">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-3 sm:mb-4">
              <div>
                <h3 className="text-base font-black tracking-tight text-white sm:text-lg">Share Review</h3>
                <p className="text-[10px] font-medium text-white/40">9:16 review card · export in 1080×1920</p>
              </div>
              <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/60 transition hover:bg-white/10 hover:text-white active:scale-90">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex h-[36dvh] min-h-[190px] max-h-[340px] shrink-0 items-center justify-center py-1 sm:h-auto sm:min-h-0 sm:max-h-none sm:flex-1 sm:py-4">
              <div className="relative h-full max-h-full aspect-[9/16] w-auto max-w-full shrink-0 overflow-hidden rounded-[20px] border border-white/15 bg-black shadow-[0_24px_70px_rgba(0,0,0,0.5)] sm:rounded-[30px]">
                {theme === 'minimal' && (
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-[#0a0202]" />
                    <div className="absolute inset-0" style={{ background: redGrainBg }} />
                    <div className="absolute inset-0 mix-blend-overlay opacity-60" style={GRAIN} />
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 18%, rgba(0,0,0,0.82) 100%)' }} />

                    <div className="relative z-10 flex h-full flex-col p-4 justify-between sm:p-5">
                      <div className="flex items-start justify-between">
                        <div className="rounded-xl border border-white/10 bg-black/50 p-1.5 backdrop-blur-md shadow-lg">
                          <img src="/Cinescape_Logo.svg" alt="Logo" className="h-5 w-5 object-contain sm:h-6 sm:w-6" />
                        </div>
                        <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="mt-1 h-2.5 object-contain opacity-80 brightness-0 invert sm:h-3" />
                      </div>

                      <div className="break-words">
                        {artwork.poster && (
                          <div className="mb-3 flex justify-start sm:mb-4">
                            <img
                              src={artwork.poster}
                              alt={title}
                              className="h-24 w-16 rounded-md border border-white/10 object-cover shadow-[0_8px_20px_rgba(0,0,0,0.5)] sm:h-32 sm:w-[86px] sm:rounded-lg"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[6px] font-black uppercase tracking-[0.28em] text-white/55 sm:text-[7px]">
                          <span className="h-px w-3 bg-white/35 sm:w-4" />
                          Cinematic Review
                        </div>
                        <h3 className="mt-1.5 font-serif text-[14px] font-bold leading-[1.05] text-white line-clamp-3 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:mt-2 sm:text-[24px]">
                          {title || 'Untitled'}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-2.5 sm:gap-2">
                          {releaseYear && <span className="text-[8px] font-semibold text-white/60 sm:text-[10px]">{releaseYear}</span>}
                          {hasRating && (
                            <>
                              <span className="text-[8px] text-white/30 sm:text-[10px]">·</span>
                              <ShareRatingStars rating={rating as number} size={7} gap={1} />
                              <span className="text-[8px] font-bold text-white/90 sm:text-[10px]">{ratingLabel}</span>
                              {isFavorite && <Heart className="h-2 w-2 fill-red-400 text-red-400 sm:h-2.5 sm:w-2.5" />}
                            </>
                          )}
                        </div>

                        {reviewContent && (
                          <div className="relative mt-2 sm:mt-3">
                            <Quote className="absolute -top-0.5 left-0 h-2 w-2 rotate-180 text-white/35 sm:h-2.5 sm:w-2.5" />
                            <p className="line-clamp-3 pl-3 text-[8px] italic leading-[1.5] text-white/70 sm:pl-4 sm:text-[10px]">{reviewContent}</p>
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2 sm:mt-4 sm:pt-3">
                          <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/20 sm:h-7 sm:w-7">
                            <img src={userPhoto || '/user-icon.jpg'} alt={author} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[8px] font-bold text-white sm:text-[10px]">{author}</p>
                            <p className="truncate text-[6px] text-white/45 sm:text-[8px]">@{handle}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[5px] font-bold uppercase tracking-[0.22em] text-white/40 sm:text-[6px]">Watched</p>
                            <p className="text-[7px] font-semibold text-white/80 sm:text-[8px]">{watchDate || 'Recently'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {theme === 'cinematic' && (
                  <div className="absolute inset-0 flex flex-col bg-black">
                    <div className="relative h-[52%] w-full shrink-0 overflow-hidden">
                      {artwork.backdrop ? (
                        <img src={artwork.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black" />

                      <div className="absolute left-2.5 right-2.5 top-3 flex items-center justify-between sm:left-3 sm:right-3 sm:top-4">
                        <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 backdrop-blur-md sm:px-2.5 sm:py-1">
                          <Clapperboard className="h-2 w-2 text-white sm:h-2.5 sm:w-2.5" />
                          <span className="text-[5px] font-bold uppercase tracking-[0.2em] text-white sm:text-[7px]">{mediaType === 'tv' ? 'Series Review' : 'Film Review'}</span>
                        </div>
                        <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-2 object-contain brightness-0 invert opacity-90 sm:h-2.5" />
                      </div>
                    </div>

                    <div className="relative flex min-h-0 flex-1 flex-col bg-black px-3 pb-3 pt-0 sm:px-5 sm:pb-5">
                      <div className="relative flex shrink-0 items-end gap-2 sm:gap-3">
                        <div className="relative z-10 -mt-8 sm:-mt-11">
                          {artwork.poster ? (
                            <img
                              src={artwork.poster}
                              alt={title}
                              className="h-[72px] w-12 rounded-md border border-white/15 object-cover shadow-[0_16px_32px_rgba(0,0,0,0.7)] sm:h-[96px] sm:w-16 sm:rounded-lg"
                            />
                          ) : (
                            <div className="flex h-[72px] w-12 items-center justify-center rounded-md border border-white/15 bg-zinc-900 sm:h-[96px] sm:w-16 sm:rounded-lg">
                              <Film className="h-3 w-3 text-white/20 sm:h-4 sm:w-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pb-0.5 sm:pb-1 break-words">
                          <p className="text-[5.5px] font-black uppercase tracking-[0.24em] text-white/35 sm:text-[6.5px]">A {mediaType === 'tv' ? 'Series' : 'Film'} By Review</p>
                          <h3 className="mt-0.5 font-serif text-[13px] font-bold leading-[1.08] text-white line-clamp-2 sm:mt-1 sm:text-[17px]">{title || 'Untitled'}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1 sm:mt-1.5 sm:gap-1.5">
                            {releaseYear && <span className="text-[8px] font-semibold text-white/50 sm:text-[9px]">{releaseYear}</span>}
                            {hasRating && (
                              <>
                                <span className="text-[8px] text-white/25 sm:text-[9px]">·</span>
                                <ShareRatingStars rating={rating as number} size={7} gap={1} />
                                <span className="text-[8px] font-bold text-white/85 sm:text-[9px]">{ratingLabel}</span>
                                {isFavorite && <Heart className="h-2 w-2 fill-red-400 text-red-400 sm:h-2.5 sm:w-2.5" />}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {reviewContent && (
                        <div className="relative mt-2 overflow-hidden pl-3 sm:mt-2.5 sm:pl-3.5">
                          <Quote className="absolute left-0 top-0 h-2 w-2 rotate-180 text-white/30 sm:h-2.5 sm:w-2.5" />
                          <p className={`whitespace-pre-line break-words text-[8px] italic leading-[1.5] text-white/70 sm:text-[10px] line-clamp-3 sm:line-clamp-4 ${textSize === 'small' ? 'text-[7px] sm:text-[8px]' : textSize === 'large' ? 'text-[9px] sm:text-[12px]' : ''}`}>
                            {reviewContent}
                          </p>
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/10 pt-2 sm:pt-2.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-white/15 sm:h-5 sm:w-5">
                            <img src={userPhoto || '/user-icon.jpg'} alt={author} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[8px] font-bold text-white sm:text-[9px]">{author}</p>
                            <p className="truncate text-[6px] text-white/45 sm:text-[7px]">@{handle}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 opacity-80 sm:gap-1.5">
                          <img src="/Cinescape_Logo.svg" alt="Logo" className="h-2 w-auto object-contain sm:h-2.5" />
                          <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-1.5 w-auto object-contain brightness-0 invert sm:h-2" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {theme === 'poster' && (
                  <div className="absolute inset-0 bg-black">
                    {artwork.poster ? (
                      <img src={artwork.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black" />
                    )}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.65) 58%, #000 92%)',
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-25" style={GRAIN} />

                    <div className="absolute left-2.5 right-2.5 top-2.5 z-30 flex items-center justify-between sm:left-3 sm:right-3 sm:top-3">
                      <div className="rounded-lg border border-white/15 bg-black/55 p-1.5 backdrop-blur-md">
                        <img src="/Cinescape_Logo.svg" alt="Logo" className="h-4 w-4 object-contain sm:h-5 sm:w-5" />
                      </div>
                      <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-2.5 object-contain opacity-85 brightness-0 invert sm:h-3" />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-6 break-words">
                      <Quote className="h-4 w-4 rotate-180 text-white/40 sm:h-5 sm:w-5" />
                      <h3 className="mt-1.5 font-serif text-[16px] font-bold leading-[1.05] text-white line-clamp-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] sm:mt-2 sm:text-[26px]">
                        {title || 'Untitled'}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-2">
                        {releaseYear && <span className="text-[8px] font-semibold text-white/60 sm:text-[10px]">{releaseYear}</span>}
                        {hasRating && (
                          <>
                            <span className="text-[8px] text-white/30 sm:text-[10px]">·</span>
                            <ShareRatingStars rating={rating as number} size={7} gap={1} />
                            <span className="text-[8px] font-bold text-white/90 sm:text-[10px]">{ratingLabel}</span>
                            {isFavorite && <Heart className="h-2 w-2 fill-red-400 text-red-400 sm:h-2.5 sm:w-2.5" />}
                          </>
                        )}
                      </div>

                      {reviewContent && (
                        <p className={`mt-2 whitespace-pre-line break-words text-[8px] italic leading-[1.5] text-white/75 sm:mt-2.5 sm:text-[11px] line-clamp-3 ${textSize === 'small' ? 'text-[7px] sm:text-[9px]' : textSize === 'large' ? 'text-[9px] sm:text-[12.5px]' : ''}`}>
                          {reviewContent}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/15 pt-2.5 sm:mt-4 sm:pt-3">
                        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                          <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/20 sm:h-6 sm:w-6">
                            <img src={userPhoto || '/user-icon.jpg'} alt={author} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[8px] font-bold text-white sm:text-[9px]">{author}</p>
                            <p className="truncate text-[6px] text-white/50 sm:text-[7px]">@{handle}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[5px] font-bold uppercase tracking-[0.22em] text-white/40 sm:text-[6px]">Watched</p>
                          <p className="text-[7px] font-semibold text-white/80 sm:text-[8px]">{watchDate || 'Recently'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {theme === 'backdrop' && (
                  <>
                    {artwork.backdrop ? (
                      <img src={artwork.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-950 to-black" />
                    )}
                    <div className="absolute inset-0 bg-black/25" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/45" />

                    <div className={`absolute left-1/2 top-1/2 z-20 w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border p-3 text-left shadow-[0_20px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:w-[82%] sm:rounded-[18px] sm:p-4 ${backdropCardClass}`}>
                      <div className="flex items-center gap-2 pr-[50px] sm:pr-[72px] break-words">
                        <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/10 bg-zinc-800 sm:h-7 sm:w-7">
                          <img src={userPhoto || '/user-icon.jpg'} alt={author} className="h-full w-full object-cover" />
                        </div>
                        <span className="truncate text-[7px] font-semibold text-zinc-300 sm:text-[9px]">{author}</span>
                      </div>

                      <div className="absolute right-3 top-3 h-[60px] w-[40px] overflow-hidden rounded-[3px] border border-white/10 bg-zinc-900 shadow-[0_8px_20px_rgba(0,0,0,0.4)] sm:right-4 sm:top-4 sm:h-[82px] sm:w-[55px]">
                        {artwork.poster ? (
                          <img src={artwork.poster} alt={title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><Film className="h-3 w-3 text-white/20 sm:h-5 sm:w-5" /></div>
                        )}
                      </div>

                      <div className="mt-2 pr-[46px] sm:mt-3 sm:pr-[68px]">
                        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 break-words">
                          <h2 className="text-[10px] font-black leading-tight tracking-tight text-white sm:text-[13px]">{title || 'Untitled'}</h2>
                          {releaseYear && <span className="text-[7px] font-medium text-zinc-500 sm:text-[9px]">{releaseYear}</span>}
                        </div>

                        {hasRating && (
                          <div className="mt-1 flex flex-wrap items-center gap-1 sm:mt-1.5 sm:flex-nowrap sm:gap-1.5">
                            <ShareRatingStars rating={rating as number} size={8} gap={1} />
                            <span className="text-[7px] font-medium leading-none text-zinc-400 sm:text-[9px]">{ratingLabel}</span>
                            {isFavorite && <Heart className="h-2 w-2 shrink-0 fill-red-500 text-red-500 drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)] sm:h-3 sm:w-3" />}
                          </div>
                        )}
                      </div>

                      {(watchDate || isRewatch) && (
                        <div className="mt-2 flex items-center gap-1.5 sm:mt-3">
                          <p className="text-[6px] font-medium text-zinc-500 sm:text-[8px]">Watched {watchDate || 'Recently'}</p>
                          {isRewatch && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.05] px-1 py-[1px] text-[5px] font-semibold tracking-wide text-zinc-300 shadow-[inset_0_0.5px_0_rgba(255,255,255,0.1)] backdrop-blur-md sm:gap-1 sm:px-1.5 sm:text-[6.5px]">
                              <RotateCcw className="h-1 w-1 stroke-[2] text-zinc-400 sm:h-2 sm:w-2" />
                              <span>Rewatch ×{watchCount}</span>
                            </span>
                          )}
                        </div>
                      )}

                      <div className="relative mt-1.5 pl-0 sm:mt-2">
                        <Quote className="pointer-events-none absolute -top-1 left-0 h-2 w-2 rotate-180 text-white/30 sm:h-2.5 sm:w-2.5" />
                        <p
                          className={`overflow-hidden whitespace-pre-line break-words pl-3 text-[8px] font-normal leading-[1.4] text-zinc-300 sm:pl-3.5 sm:text-[10px] sm:leading-[1.45] ${textSize === 'small' ? 'text-[7px] sm:text-[8px]' : textSize === 'large' ? 'text-[9px] sm:text-[12px]' : ''}`}
                          style={{ maxHeight: textSize === 'large' ? '115px' : '80px' }}
                        >
                          {reviewContent}
                        </p>
                      </div>

                      <div className={`mt-2 flex items-center justify-between border-t pt-1.5 sm:mt-3 sm:pt-2.5 ${backdropFooterBorder}`}>
                        <span className="text-[5px] font-medium text-zinc-600 sm:text-[7px]">{mediaType === 'tv' ? 'Series review' : 'Film review'}</span>
                        <div className="flex items-center gap-1 opacity-80 sm:gap-1.5">
                          <img src="/Cinescape_Logo.svg" alt="Logo" className="h-2.5 w-auto object-contain sm:h-3.5" />
                          <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-1.5 w-auto object-contain brightness-0 invert sm:h-2.5" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain border-t border-white/10 bg-white/[0.025] p-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent sm:flex-none sm:w-[340px] sm:border-l sm:border-t-0 sm:p-5 lg:w-[360px]">
            <div className="space-y-4 pb-2">
              <div>
                <p className="text-xs font-black text-white">Card theme</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([['minimal', 'Minimal'], ['cinematic', 'Cinematic'], ['poster', 'Poster-first'], ['backdrop', 'Backdrop-first']] as [ReviewShareTheme, string][]).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setTheme(value)} className={`rounded-xl border px-3 py-2.5 text-left text-[10px] font-bold transition active:scale-[0.98] ${theme === value ? 'border-emerald-200/25 bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]' : 'border-white/[0.08] bg-white/[0.035] text-white/50 hover:bg-white/[0.07] hover:text-white/80'}`}>{label}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-black text-white">Review text</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] as [ReviewShareTextSize, string][]).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setTextSize(value)} className={`rounded-xl border px-2 py-2.5 text-[10px] font-bold transition active:scale-[0.98] ${textSize === value ? 'border-emerald-200/25 bg-white/[0.12] text-white' : 'border-white/[0.08] bg-white/[0.035] text-white/50 hover:text-white/80'}`}>{label}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-black text-white">Artwork</p>
                <p className="mt-0.5 text-[10px] text-white/40">Choose, randomize, or reset your poster and backdrop</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setArtworkSelector('poster')} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-[10px] font-bold text-white/75 transition hover:bg-white/[0.08] hover:text-white">
                  <ImageIcon className="h-3.5 w-3.5 text-amber-300" />Poster
                </button>
                <button type="button" onClick={() => setArtworkSelector('backdrop')} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-[10px] font-bold text-white/75 transition hover:bg-white/[0.08] hover:text-white">
                  <ImageIcon className="h-3.5 w-3.5 text-sky-300" />Backdrop
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={artwork.randomize} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-[10px] font-black text-emerald-300 transition hover:bg-emerald-400/15">
                  <Sparkles className="h-3.5 w-3.5" />Randomize
                </button>
                <button type="button" onClick={artwork.reset} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[10px] font-bold text-white/55 transition hover:text-white">
                  <RotateCcw className="h-3.5 w-3.5" />Reset
                </button>
              </div>

              {hasRating && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-white/45">Your rating</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                        <span className="text-lg font-black tabular-nums text-white">{(rating as number).toFixed(1)}</span>
                      </div>
                    </div>
                    {isFavorite && (
                      <div className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-red-500 to-red-600 px-3 py-2 text-[10px] font-black text-white shadow-md shadow-red-500/30">
                        <Heart className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" /> Favorite
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button type="button" onClick={handleDownload} disabled={downloading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-200 via-emerald-100 to-cyan-100 px-4 py-3 text-xs font-black text-zinc-950 shadow-[0_10px_30px_rgba(16,185,129,0.16)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50">
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading ? 'Exporting…' : 'Save Review Card'}
              </button>
              <button type="button" onClick={onClose} className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07] hover:text-white">
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden="true">
        {theme === 'minimal' && (
          <div ref={storyCardRef} className="relative h-[1920px] w-[1080px] overflow-hidden bg-[#0a0202] text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]">
            <div className="absolute inset-0" style={{ background: redGrainBg }} />
            <div className="absolute inset-0 mix-blend-overlay opacity-60" style={GRAIN} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 18%, rgba(0,0,0,0.82) 100%)' }} />

            <div className="relative z-10 flex h-full flex-col justify-between p-[100px]">
              <div className="flex items-start justify-between">
                <div className="rounded-[28px] border border-white/10 bg-black/50 p-[24px] backdrop-blur-md shadow-2xl">
                  <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[100px] w-[100px] object-contain" />
                </div>
                <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="mt-[10px] h-[50px] object-contain opacity-80 brightness-0 invert" />
              </div>

              <div>
                {artwork.poster && (
                  <img
                    src={artwork.poster}
                    crossOrigin="anonymous"
                    alt={title}
                    className="mb-[60px] h-[540px] w-[360px] rounded-[30px] border border-white/10 object-cover shadow-[0_30px_60px_rgba(0,0,0,0.7)]"
                  />
                )}
                <div className="flex items-center gap-[20px] text-[26px] font-black uppercase tracking-[0.28em] text-white/55">
                  <span className="h-px w-[60px] bg-white/35" />
                  Cinematic Review
                </div>
                <h1 className="mt-[40px] font-serif text-[130px] font-bold leading-[1.02] tracking-tight text-white line-clamp-3 drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
                  {title || 'Untitled'}
                </h1>
                <div className="mt-[30px] flex flex-wrap items-center gap-[20px]">
                  {releaseYear && <span className="text-[36px] font-semibold text-white/60">{releaseYear}</span>}
                  {hasRating && (
                    <>
                      <span className="text-[36px] text-white/30">·</span>
                      <ShareRatingStars rating={rating as number} size={36} gap={4} />
                      <span className="text-[36px] font-bold text-white/90">{ratingLabel}</span>
                      {isFavorite && <Heart className="h-[36px] w-[36px] fill-red-400 text-red-400" />}
                    </>
                  )}
                </div>

                {reviewContent && (
                  <div className="relative mt-[50px] overflow-hidden pl-[56px]">
                    <Quote className="absolute left-0 top-0 h-[40px] w-[40px] rotate-180 text-white/35" />
                    <p className="whitespace-pre-line text-[36px] italic leading-[1.5] text-white/75 line-clamp-3">
                      {reviewContent}
                    </p>
                  </div>
                )}

                <div className="mt-[50px] flex items-center justify-between border-t border-white/10 pt-[36px]">
                  <div className="flex items-center gap-[24px]">
                    <div className="h-[100px] w-[100px] overflow-hidden rounded-full border-[3px] border-white/20 shadow-xl">
                      <img src={userPhoto || '/user-icon.jpg'} crossOrigin="anonymous" alt={author} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-[32px] font-bold text-white">{author}</p>
                      <p className="text-[24px] text-white/50">@{handle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[20px] uppercase tracking-[0.22em] text-white/40">Watched</p>
                    <p className="mt-[8px] text-[28px] font-semibold text-white/85">{watchDate || 'Recently'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {theme === 'cinematic' && (
          <div ref={storyCardRef} className="relative flex h-[1920px] w-[1080px] flex-col overflow-hidden bg-black text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]">
            <div className="relative h-[1000px] w-full shrink-0 overflow-hidden">
              {artwork.backdrop ? (
                <img src={artwork.backdrop} crossOrigin="anonymous" alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black" />

              <div className="absolute left-[80px] right-[80px] top-[110px] flex items-center justify-between">
                <div className="flex items-center gap-[16px] rounded-full border border-white/15 bg-black/55 px-[36px] py-[16px] backdrop-blur-md">
                  <Clapperboard className="h-[30px] w-[30px] text-white" />
                  <span className="text-[24px] font-bold uppercase tracking-[0.22em] text-white">{mediaType === 'tv' ? 'Series Review' : 'Film Review'}</span>
                </div>
                <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[40px] object-contain brightness-0 invert opacity-90" />
              </div>
            </div>

            <div className="relative flex flex-1 flex-col bg-black px-[80px] pb-[80px] pt-0">
              <div className="relative flex shrink-0 items-end gap-[40px]">
                <div className="relative z-10 -mt-[180px]">
                  {artwork.poster ? (
                    <img
                      src={artwork.poster}
                      crossOrigin="anonymous"
                      alt={title}
                      className="h-[420px] w-[280px] rounded-[20px] border border-white/15 object-cover shadow-[0_40px_80px_rgba(0,0,0,0.8)]"
                    />
                  ) : (
                    <div className="flex h-[420px] w-[280px] items-center justify-center rounded-[20px] border border-white/15 bg-zinc-900">
                      <Film className="h-[60px] w-[60px] text-white/20" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-[20px]">
                  <p className="text-[22px] font-black uppercase tracking-[0.24em] text-white/35">
                    A {mediaType === 'tv' ? 'Series' : 'Film'} By Review
                  </p>
                  <h1 className="mt-[20px] font-serif text-[96px] font-bold leading-[1.02] tracking-tight text-white line-clamp-2">
                    {title || 'Untitled'}
                  </h1>
                  <div className="mt-[20px] flex flex-wrap items-center gap-[18px]">
                    {releaseYear && <span className="text-[32px] font-semibold text-white/50">{releaseYear}</span>}
                    {hasRating && (
                      <>
                        <span className="text-[32px] text-white/25">·</span>
                        <ShareRatingStars rating={rating as number} size={32} gap={4} />
                        <span className="text-[30px] font-bold text-white/85">{ratingLabel}</span>
                        {isFavorite && <Heart className="h-[30px] w-[30px] fill-red-400 text-red-400" />}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {reviewContent && (
                <div className="relative mt-[40px] overflow-hidden pl-[40px]" style={{ maxHeight: '360px' }}>
                  <Quote className="absolute left-0 top-0 h-[32px] w-[32px] rotate-180 text-white/30" />
                  <p className="whitespace-pre-line text-[30px] italic leading-[1.5] text-white/75 line-clamp-6">
                    {reviewContent}
                  </p>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-[30px]">
                <div className="flex items-center gap-[20px]">
                  <div className="h-[72px] w-[72px] overflow-hidden rounded-full border border-white/15">
                    <img src={userPhoto || '/user-icon.jpg'} crossOrigin="anonymous" alt={author} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-[28px] font-bold text-white">{author}</p>
                    <p className="text-[20px] text-white/45">@{handle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-[16px] opacity-85">
                  <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[36px] w-auto object-contain" />
                  <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[26px] w-auto object-contain brightness-0 invert" />
                </div>
              </div>
            </div>
          </div>
        )}

        {theme === 'poster' && (
          <div ref={storyCardRef} className="relative h-[1920px] w-[1080px] overflow-hidden bg-black text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]">
            {artwork.poster ? (
              <img src={artwork.poster} crossOrigin="anonymous" alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black" />
            )}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.65) 58%, #000 92%)',
              }}
            />
            <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-25" style={GRAIN} />

            <div className="absolute left-[80px] right-[80px] top-[80px] z-30 flex items-center justify-between">
              <div className="rounded-[24px] border border-white/15 bg-black/55 p-[20px] backdrop-blur-md">
                <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[70px] w-[70px] object-contain" />
              </div>
              <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[40px] object-contain opacity-85 brightness-0 invert" />
            </div>

            <div className="absolute inset-x-0 bottom-0 z-20 px-[80px] pb-[80px] pt-[40px]">
              <Quote className="h-[60px] w-[60px] rotate-180 text-white/45" />
              <h1 className="mt-[24px] font-serif text-[110px] font-bold leading-[1.02] tracking-tight text-white line-clamp-2 drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
                {title || 'Untitled'}
              </h1>
              <div className="mt-[26px] flex flex-wrap items-center gap-[20px]">
                {releaseYear && <span className="text-[32px] font-semibold text-white/60">{releaseYear}</span>}
                {hasRating && (
                  <>
                    <span className="text-[32px] text-white/30">·</span>
                    <ShareRatingStars rating={rating as number} size={32} gap={4} />
                    <span className="text-[32px] font-bold text-white/90">{ratingLabel}</span>
                    {isFavorite && <Heart className="h-[32px] w-[32px] fill-red-400 text-red-400" />}
                  </>
                )}
              </div>

              {reviewContent && (
                <p className="mt-[32px] whitespace-pre-line text-[34px] italic leading-[1.5] text-white/80 line-clamp-4">
                  {reviewContent}
                </p>
              )}

              <div className="mt-[40px] flex items-center justify-between border-t border-white/20 pt-[30px]">
                <div className="flex items-center gap-[20px]">
                  <div className="h-[80px] w-[80px] overflow-hidden rounded-full border border-white/25">
                    <img src={userPhoto || '/user-icon.jpg'} crossOrigin="anonymous" alt={author} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-[28px] font-bold text-white">{author}</p>
                    <p className="text-[20px] text-white/50">@{handle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-[16px] opacity-90">
                  <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[36px] w-auto object-contain" />
                  <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[24px] w-auto object-contain brightness-0 invert" />
                </div>
              </div>
            </div>
          </div>
        )}

        {theme === 'backdrop' && (
          <div ref={storyCardRef} className="relative h-[1920px] w-[1080px] overflow-hidden bg-black text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]">
            {artwork.backdrop ? (
              <img src={artwork.backdrop} crossOrigin="anonymous" alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-950 to-black" />
            )}
            <div className="absolute inset-0 bg-black/25" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40" />

            <div className={`absolute left-1/2 top-1/2 w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-[32px] border px-[42px] pb-[34px] pt-[38px] shadow-[0_48px_140px_rgba(0,0,0,0.58)] ${backdropCardClass}`}>
              <div className="flex items-center gap-[16px] pr-[190px]">
                <div className="h-[58px] w-[58px] shrink-0 overflow-hidden rounded-full border border-white/10 bg-zinc-800">
                  <img src={userPhoto || '/user-icon.jpg'} crossOrigin="anonymous" alt={author} className="h-full w-full object-cover" />
                </div>
                <span className="max-w-[470px] truncate text-[24px] font-semibold tracking-tight text-zinc-300">{author}</span>
              </div>

              <div className="absolute right-[42px] top-[38px] h-[230px] w-[154px] overflow-hidden rounded-[7px] border border-white/10 bg-zinc-900 shadow-[0_22px_55px_rgba(0,0,0,0.48)]">
                {artwork.poster ? (
                  <img src={artwork.poster} crossOrigin="anonymous" alt={title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Film className="h-14 w-14 text-white/15" /></div>
                )}
              </div>

              <div className="mt-[32px] pr-[186px]">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="text-[39px] font-black leading-[1.08] tracking-tight text-white">{title || 'Untitled'}</h1>
                  {releaseYear && <span className="text-[24px] font-medium text-zinc-500">{releaseYear}</span>}
                </div>

                {hasRating && (
                  <div className="mt-[12px] flex items-center gap-[10px]">
                    <ShareRatingStars rating={rating as number} size={28} gap={4} />
                    <span className="text-[20px] font-medium leading-none text-zinc-400">{ratingLabel}</span>
                    {isFavorite && <Heart className="h-[26px] w-[26px] shrink-0 fill-red-500 text-red-500 drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)]" />}
                  </div>
                )}
              </div>

              {(watchDate || isRewatch) && (
                <div className="mt-[34px] flex items-center gap-[12px]">
                  <p className="text-[20px] font-medium text-zinc-500">Watched {watchDate || 'Recently'}</p>
                  {isRewatch && (
                    <span className="inline-flex items-center gap-[8px] text-[15px] font-semibold tracking-[0.02em] text-zinc-500">
                      <RotateCcw className="h-[17px] w-[17px] stroke-[2]" />
                      Rewatch ×{watchCount}
                    </span>
                  )}
                </div>
              )}

              <div className="relative mt-[20px] pl-[38px]">
                <Quote className="absolute left-1.5 -top-0.5 h-[28px] w-[28px] rotate-180 text-white/25" />
                <p
                  className="overflow-hidden whitespace-pre-line font-normal tracking-[-0.01em] text-zinc-300"
                  style={{
                    fontSize: textSize === 'small' ? '22px' : textSize === 'large' ? '30px' : reviewContent.length > 700 ? '22px' : reviewContent.length > 420 ? '25px' : '28px',
                    lineHeight: 1.43,
                    maxHeight: textSize === 'large' ? '680px' : '620px',
                  }}
                >
                  {reviewContent}
                </p>
              </div>

              <div className={`mt-[30px] flex items-center justify-between border-t pt-[20px] ${backdropFooterBorder}`}>
                <span className="text-[16px] font-medium text-zinc-600">{mediaType === 'tv' ? 'Series review' : 'Film review'}</span>
                <div className="flex items-center gap-[12px] opacity-80">
                  <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[28px] w-auto object-contain" />
                  <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[20px] w-auto object-contain brightness-0 invert" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ArtworkPickerModal
        open={artworkSelector === 'poster'}
        onClose={() => setArtworkSelector(null)}
        tab="poster"
        choices={artwork.posterChoices}
        currentUrl={artwork.poster}
        onSelect={artwork.setPoster}
        onRandomize={artwork.randomize}
        onReset={artwork.reset}
        loading={artwork.loading}
      />
      <ArtworkPickerModal
        open={artworkSelector === 'backdrop'}
        onClose={() => setArtworkSelector(null)}
        tab="backdrop"
        choices={artwork.backdropChoices}
        currentUrl={artwork.backdrop}
        onSelect={artwork.setBackdrop}
        onRandomize={artwork.randomize}
        onReset={artwork.reset}
        loading={artwork.loading}
      />
    </>,
    document.body,
  );
};

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English', kn: 'Kannada', te: 'Telugu', hi: 'Hindi', ta: 'Tamil',
  ml: 'Malayalam', ko: 'Korean', fr: 'French', de: 'German', es: 'Spanish',
  ru: 'Russian', ja: 'Japanese', zh: 'Chinese', ar: 'Arabic', it: 'Italian',
  pt: 'Portuguese', sv: 'Swedish', nl: 'Dutch', pl: 'Polish', tr: 'Turkish',
  vi: 'Vietnamese', id: 'Indonesian', fa: 'Persian', ur: 'Urdu', bg: 'Bulgarian',
  cs: 'Czech', da: 'Danish', el: 'Greek', et: 'Estonian', fi: 'Finnish',
  hu: 'Hungarian', is: 'Icelandic', lt: 'Lithuanian', lv: 'Latvian',
  mk: 'Macedonian', no: 'Norwegian', sr: 'Serbian', sk: 'Slovak', sl: 'Slovenian',
  th: 'Thai', uk: 'Ukrainian', he: 'Hebrew', ro: 'Romanian', nb: 'Norwegian Bokmål',
  ca: 'Catalan', hr: 'Croatian', eu: 'Basque', gl: 'Galician',
};

const CHART_COLORS = [
  '#8400ff', '#FF5500', '#00F0FF', '#ffcc00', '#ff0080',
  '#F4C2C2', '#995a2d', '#F97316', '#14B8A6', '#EF4444',
];

const SpatialCard = ({
  children,
  index,
}: {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement>;
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, x: 16 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.35, delay: 0.08 + index * 0.04 }}
    className="flex-shrink-0"
  >
    {children}
  </motion.div>
);

const ProgressiveImage = ({
  src,
  lowSrc,
  alt,
  className = '',
  wrapperClassName = '',
  eager = false,
}: {
  src: string;
  lowSrc?: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  eager?: boolean;
}) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative overflow-hidden ${wrapperClassName}`}>
      {lowSrc && <img src={lowSrc} alt="" aria-hidden="true" className={`absolute inset-0 h-full w-full scale-105 object-cover blur-xl transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-70'}`} />}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
        className={`${className} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};

type WatchActionMode = 'mark' | 'change' | 'rewatch';
type WatchMenuStep = 'root' | 'date-options' | 'calendar';

const valueToDate = (value: any) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value.seconds === 'number') {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const watchedMillis = (value: any) => valueToDate(value)?.getTime() || 0;

const normalizeWatchedDates = (values: any[], fallback?: any) => {
  const dates = (Array.isArray(values) ? values : [])
    .map((value) => valueToDate(value))
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.toISOString());
  const fallbackDate = valueToDate(fallback);
  if (fallbackDate) {
    const iso = fallbackDate.toISOString();
    if (!dates.includes(iso)) dates.push(iso);
  }
  return [...new Set(dates)].sort((a, b) => watchedMillis(a) - watchedMillis(b));
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const keyToDate = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

const formatWatchDate = (value: any) => {
  const date = valueToDate(value);
  if (!date) return 'Unknown date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatWatchDateTime = (value: any) => {
  const date = valueToDate(value);
  if (!date) return 'Unknown date';
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const isDateOnlyValue = date.getHours() === 12 && date.getMinutes() === 0 && date.getSeconds() === 0;
  if (isDateOnlyValue) return datePart;
  return `${datePart} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};

const countryFlag = (code?: string) => code && code.length === 2
  ? String.fromCodePoint(...code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0)))
  : '🌐';

const releaseTypeLabel = (type?: number) => ({ 1: 'Premiere', 2: 'Limited Theatrical', 3: 'Theatrical', 4: 'Digital', 5: 'Physical', 6: 'TV' } as Record<number, string>)[type || 0] || 'Release';

const formatRuntime = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
};

const buildCalendarDays = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

const WatchedButton = ({
  movie,
  onSync,
  onToast,
}: {
  movie: Movie;
  onSync: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) => {
  const { user } = useAuth();
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [watchedDates, setWatchedDates] = useState<string[]>([]);
  const [watchedLoading, setWatchedLoading] = useState(false);
  const [showWatchMenu, setShowWatchMenu] = useState(false);
  const [watchMenuStep, setWatchMenuStep] = useState<WatchMenuStep>('root');
  const [watchActionMode, setWatchActionMode] = useState<WatchActionMode>('mark');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState(dateKey(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const isWatched = Boolean(historyDocId);
  const watchCount = watchedDates.length;
  const latestWatchDate = watchCount ? watchedDates[watchCount - 1] : null;

  useEffect(() => {
    if (!user?.uid || !movie.id) {
      setHistoryDocId(null);
      setWatchedDates([]);
      return;
    }
    const historyRef = collection(db, `users/${user.uid}/history`);
    const historyQuery = query(historyRef, where('movieId', '==', movie.id));
    return onSnapshot(historyQuery, (snapshot) => {
      const match = snapshot.docs.find((historyDoc) => (historyDoc.data().mediaType ?? 'movie') === 'movie');
      if (!match) {
        setHistoryDocId(null);
        setWatchedDates([]);
        return;
      }
      const data = match.data();
      const dates = normalizeWatchedDates(data.watchedDates || [], data.watchedDate ?? data.timestamp ?? data.createdAt);
      setHistoryDocId(match.id);
      setWatchedDates(dates);
    }, () => {
      setHistoryDocId(null);
      setWatchedDates([]);
    });
  }, [user?.uid, movie.id]);

  const closeWatchMenu = () => {
    setShowWatchMenu(false);
    setWatchMenuStep('root');
    setWatchActionMode(isWatched ? 'change' : 'mark');
  };

  const openDateOptions = (mode: WatchActionMode) => {
    setWatchActionMode(mode);
    setWatchMenuStep('date-options');
  };

  const openCalendar = () => {
    const initial = watchActionMode === 'change' && latestWatchDate ? valueToDate(latestWatchDate) || new Date() : new Date();
    setSelectedDateKey(dateKey(initial));
    setCalendarMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
    setWatchMenuStep('calendar');
  };

  const removeFromWatchlist = async () => {
    if (!user?.uid) return;
    const watchlistRef = collection(db, `users/${user.uid}/watchlist`);
    const snapshot = await getDocs(query(watchlistRef, where('movieId', '==', movie.id)));
    if (!snapshot.empty) await Promise.all(snapshot.docs.map((watchDoc) => deleteDoc(watchDoc.ref)));
  };

  const saveWatchEvent = async (date: Date, mode: WatchActionMode) => {
    if (!user?.uid) {
      onToast('Please log in to update watch history', 'error');
      return;
    }
    setWatchedLoading(true);
    try {
      const iso = date.toISOString();
      const nextDates = [...watchedDates];
      if (mode === 'rewatch') {
        nextDates.push(iso);
      } else if (mode === 'change' && nextDates.length) {
        nextDates[nextDates.length - 1] = iso;
      } else if (!nextDates.length) {
        nextDates.push(iso);
      }
      const normalized = normalizeWatchedDates(nextDates);
      const latest = normalized[normalized.length - 1] || iso;
      const payload = {
        movieId: movie.id,
        mediaId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path ?? '',
        releaseDate: movie.release_date,
        genres: movie.genres?.map((genre) => genre.name) ?? [],
        mediaType: 'movie' as const,
        watchedDate: latest,
        watchedDates: normalized,
        timestamp: serverTimestamp(),
      };
      if (historyDocId) {
        await updateDoc(doc(db, `users/${user.uid}/history/${historyDocId}`), payload);
      } else {
        const historyRef = collection(db, `users/${user.uid}/history`);
        await addDoc(historyRef, payload);
      }
      if (mode === 'mark' || mode === 'rewatch') await removeFromWatchlist();
      if (mode !== 'change') {
        confetti({
          particleCount: mode === 'rewatch' ? 90 : 130,
          spread: 68,
          origin: { y: 0.82 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#059669'],
          ticks: 170,
          gravity: 1.15,
          scalar: 1.05,
        });
      }
      onSync();
      onToast(
        mode === 'rewatch'
          ? `Rewatch added for ${movie.title} · update your rating if it changed`
          : mode === 'change'
            ? `Watch date updated for ${movie.title}`
            : `Added ${movie.title} to history`,
        'success',
      );
      closeWatchMenu();
    } catch {
      onToast('Failed to update watch history', 'error');
    } finally {
      setWatchedLoading(false);
    }
  };

  const removeFromHistory = async () => {
    if (!user?.uid || !historyDocId) return;
    setWatchedLoading(true);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/history/${historyDocId}`));
      onSync();
      onToast(`Removed ${movie.title} from history`, 'info');
      closeWatchMenu();
    } catch {
      onToast('Failed to remove from history', 'error');
    } finally {
      setWatchedLoading(false);
    }
  };

  const releaseDate = movie.release_date ? new Date(`${movie.release_date}T12:00:00`) : null;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const validReleaseDate = releaseDate && !Number.isNaN(releaseDate.getTime()) && releaseDate <= todayEnd ? releaseDate : null;
  const calendarDays = buildCalendarDays(calendarMonth);
  const currentMonth = new Date();
  const canGoNextMonth = calendarMonth.getFullYear() < currentMonth.getFullYear() || (calendarMonth.getFullYear() === currentMonth.getFullYear() && calendarMonth.getMonth() < currentMonth.getMonth());

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setShowWatchMenu(true);
          if (isWatched) {
            setWatchMenuStep('root');
            setWatchActionMode('change');
          } else {
            openDateOptions('mark');
          }
        }}
        disabled={watchedLoading}
        className={`relative group flex h-12 w-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 md:h-auto md:w-auto md:min-h-[46px] md:rounded-2xl md:px-4 md:py-3 md:text-xs md:whitespace-nowrap lg:px-5 lg:text-sm ${isWatched
          ? 'border border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30 hover:from-emerald-600 hover:to-teal-600'
          : 'border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-200 shadow-black/40 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white'
          } ${watchedLoading ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
        {watchedLoading ? (
          <Loader2 className="relative z-10 h-5 w-5 animate-spin md:h-4 md:w-4" />
        ) : isWatched ? (
          <CheckCheck className="relative z-10 h-5 w-5 stroke-[3] text-emerald-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.8)] md:h-4 md:w-4" />
        ) : (
          <Check className="relative z-10 h-5 w-5 text-zinc-400 transition-colors duration-300 group-hover:text-emerald-500 md:h-4 md:w-4" />
        )}
        <span className="relative z-10 hidden md:inline">
          {watchedLoading ? 'Updating…' : isWatched ? `Watched · ${latestWatchDate ? formatWatchDate(latestWatchDate).replace(/, \d{4}/, '') : ''}` : 'Mark as Watched'}
        </span>
        {isWatched && watchCount > 1 && (
          <span className="absolute -right-1 -top-1 rounded-full border border-white/15 bg-emerald-500 px-1.5 py-0.5 text-[8px] font-black leading-none text-white shadow-md shadow-emerald-500/20 md:static md:rounded-md md:bg-black/15 md:text-[9px] md:text-emerald-100">
            ×{watchCount}
          </span>
        )}
      </button>

      {showWatchMenu && createPortal(
        <div className="fixed inset-0 z-[10040] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close watch options" onClick={closeWatchMenu} className="absolute inset-0 bg-black/70 backdrop-blur-xl sm:bg-black/55" />
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,0.72)] sm:rounded-[30px]"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.07] p-4 sm:p-5">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                {movie.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageOff className="h-4 w-4 text-zinc-600" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{movie.title}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Movie{movie.release_date ? ` · ${movie.release_date.slice(0, 4)}` : ''}</p>
                {isWatched && latestWatchDate && <p className="mt-1 text-[10px] text-zinc-400">Latest watch · {formatWatchDate(latestWatchDate)}{watchCount > 1 ? ` · ${watchCount} watches` : ''}</p>}
              </div>
              <button type="button" onClick={closeWatchMenu} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {watchMenuStep === 'root' && (
                <div className="space-y-2">
                  <button type="button" onClick={() => openDateOptions('change')} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3.5 text-left transition hover:bg-white/[0.06]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/10 text-amber-300"><CalendarDays className="h-4 w-4" /></span>
                    <span><span className="block text-xs font-black text-white">Change watch date</span><span className="mt-0.5 block text-[10px] text-zinc-500">Update your latest watch event</span></span>
                  </button>
                  <button type="button" onClick={() => openDateOptions('rewatch')} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3.5 text-left transition hover:bg-white/[0.06]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/10 text-cyan-300"><RotateCcw className="h-4 w-4" /></span>
                    <span><span className="block text-xs font-black text-white">Add rewatch</span><span className="mt-0.5 block text-[10px] text-zinc-500">Keep the previous watch dates too</span></span>
                  </button>
                  <button type="button" onClick={removeFromHistory} className="flex w-full items-center gap-3 rounded-2xl border border-red-500/10 bg-red-500/[0.045] p-3.5 text-left transition hover:bg-red-500/[0.08]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/15 bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></span>
                    <span><span className="block text-xs font-black text-red-300">Remove from History</span><span className="mt-0.5 block text-[10px] text-zinc-500">Delete all watch dates for this movie</span></span>
                  </button>
                </div>
              )}

              {watchMenuStep === 'date-options' && (
                <div>
                  {isWatched && <button type="button" onClick={() => setWatchMenuStep('root')} className="mb-3 flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-white"><ChevronLeft className="h-3.5 w-3.5" />Back</button>}
                  <div className="mb-3 px-1">
                    <h3 className="text-sm font-black text-white">{watchActionMode === 'rewatch' ? 'When did you rewatch it?' : watchActionMode === 'change' ? 'Change watch date' : 'When did you watch it?'}</h3>
                    <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Choose a quick date or open the calendar.</p>
                  </div>
                  <div className="space-y-2">
                    <button type="button" onClick={() => saveWatchEvent(new Date(), watchActionMode)} className="flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3.5 text-left hover:bg-white/[0.065]">
                      <span className="text-xs font-black text-white">Just Now</span><span className="text-[10px] text-zinc-500">Today</span>
                    </button>
                    <button type="button" disabled={!validReleaseDate} onClick={() => validReleaseDate && saveWatchEvent(validReleaseDate, watchActionMode)} className="flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3.5 text-left hover:bg-white/[0.065] disabled:cursor-not-allowed disabled:opacity-35">
                      <span className="text-xs font-black text-white">Release Date</span><span className="text-[10px] text-zinc-500">{validReleaseDate ? formatWatchDate(validReleaseDate) : 'Unavailable'}</span>
                    </button>
                    <button type="button" onClick={openCalendar} className="flex w-full items-center justify-between rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] px-4 py-3.5 text-left hover:bg-emerald-400/[0.09]">
                      <span className="flex items-center gap-2 text-xs font-black text-emerald-300"><CalendarDays className="h-4 w-4" />Choose Date</span><ChevronRight className="h-4 w-4 text-zinc-600" />
                    </button>
                  </div>
                </div>
              )}

              {watchMenuStep === 'calendar' && (
                <div>
                  <button
                    type="button"
                    onClick={() => { setWatchMenuStep('date-options'); setShowPicker(false); }}
                    className="mb-3 flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />Back
                  </button>

                  <div className="relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0a0a] shadow-[0_24px_80px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)]">
                    <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-[80%] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[60px]" />

                    <div className="relative p-5">
                      <div className="mb-6 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white active:scale-95"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowPicker(!showPicker)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 transition hover:bg-white/5 active:scale-[0.98]"
                        >
                          <span className="text-lg font-black tracking-wide text-white">
                            {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-emerald-500 transition-transform duration-300 ${showPicker ? 'rotate-180' : ''}`} />
                        </button>

                        <button
                          type="button"
                          disabled={!canGoNextMonth}
                          onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      <AnimatePresence>
                        {showPicker && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: -10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -10, scale: 0.95 }}
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                              className="absolute left-4 right-4 top-[72px] z-50 overflow-hidden rounded-3xl border border-white/10 bg-[#111]/95 shadow-[0_30px_60px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-3xl"
                            >
                              <div className="p-4">
                                <div className="mb-3 flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                  {Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => new Date().getFullYear() - i).map((year) => {
                                    const isYearActive = calendarMonth.getFullYear() === year;
                                    const isYearDisabled = year > new Date().getFullYear();
                                    return (
                                      <button
                                        key={year}
                                        type="button"
                                        disabled={isYearDisabled}
                                        onClick={() => {
                                          const safeMonth = year === new Date().getFullYear() ? Math.min(calendarMonth.getMonth(), new Date().getMonth()) : calendarMonth.getMonth();
                                          setCalendarMonth(new Date(year, safeMonth, 1));
                                        }}
                                        className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 
                            ${isYearActive ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]' :
                                            isYearDisabled ? 'text-zinc-700 cursor-not-allowed' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
                                      >
                                        {year}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  {Array.from({ length: 12 }, (_, month) => {
                                    const isMonthActive = calendarMonth.getMonth() === month;
                                    const isMonthDisabled = calendarMonth.getFullYear() === new Date().getFullYear() && month > new Date().getMonth();
                                    return (
                                      <button
                                        key={month}
                                        type="button"
                                        disabled={isMonthDisabled}
                                        onClick={() => {
                                          setCalendarMonth(new Date(calendarMonth.getFullYear(), month, 1));
                                          setShowPicker(false);
                                        }}
                                        className={`rounded-xl py-2.5 text-xs font-bold transition-all duration-200 active:scale-95 
                            ${isMonthActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                            isMonthDisabled ? 'text-zinc-700 cursor-not-allowed' : 'bg-white/[0.02] text-zinc-400 border border-transparent hover:bg-white/[0.08] hover:text-white'}`}
                                      >
                                        {new Date(2000, month, 1).toLocaleDateString(undefined, { month: 'short' })}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>

                      <div className="mb-4 grid grid-cols-7 gap-1 text-center">
                        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, index) => (
                          <span key={`${day}-${index}`} className="py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                            {day}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center">
                        {calendarDays.map((date) => {
                          const key = dateKey(date);
                          const outsideMonth = date.getMonth() !== calendarMonth.getMonth();
                          const future = date > todayEnd;
                          const selected = selectedDateKey === key;
                          const isToday = key === dateKey(new Date());

                          return (
                            <button
                              type="button"
                              key={key}
                              disabled={future}
                              onClick={() => setSelectedDateKey(key)}
                              className={`group relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold transition-all duration-300 
                  ${selected
                                  ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.6)] scale-110 z-10 font-black'
                                  : outsideMonth
                                    ? 'text-zinc-600 hover:bg-white/5'
                                    : 'text-zinc-200 hover:bg-white/10 hover:scale-105'
                                } disabled:cursor-not-allowed disabled:opacity-20`}
                            >
                              {date.getDate()}
                              {isToday && !selected && (
                                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-white/5 bg-white/[0.01] p-4">
                      <button
                        type="button"
                        onClick={() => saveWatchEvent(keyToDate(selectedDateKey), watchActionMode)}
                        className="flex w-full items-center justify-between rounded-2xl bg-zinc-900 border border-white/10 px-5 py-3.5 transition hover:bg-zinc-800 active:scale-[0.98] group"
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">Selected Date</span>
                          <span className="text-sm font-black text-white">{formatWatchDate(keyToDate(selectedDateKey))}</span>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-transform group-hover:scale-110 group-active:scale-95">
                          <Check className="h-5 w-5 stroke-[3]" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>,
        document.body,
      )}
    </>
  );
};

const WatchHistoryPill = ({
  movie,
  onToast,
}: {
  movie: Movie;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) => {
  const { user } = useAuth();
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editMonth, setEditMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState(dateKey(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid || !movie.id) {
      setHistoryDocId(null);
      setDates([]);
      return;
    }
    const ref = collection(db, `users/${user.uid}/history`);
    return onSnapshot(query(ref, where('movieId', '==', movie.id)), (snapshot) => {
      const match = snapshot.docs.find((entry) => (entry.data().mediaType ?? 'movie') === 'movie');
      if (!match) {
        setHistoryDocId(null);
        setDates([]);
        return;
      }
      const data = match.data();
      setHistoryDocId(match.id);
      setDates(normalizeWatchedDates(data.watchedDates || [], data.watchedDate ?? data.timestamp ?? data.createdAt));
    });
  }, [user?.uid, movie.id]);

  if (!historyDocId || !dates.length) return null;

  const latest = dates[dates.length - 1];
  const calendarDays = buildCalendarDays(editMonth);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const canGoNextMonth = editMonth.getFullYear() < todayEnd.getFullYear() || (editMonth.getFullYear() === todayEnd.getFullYear() && editMonth.getMonth() < todayEnd.getMonth());

  const startEdit = (index: number) => {
    const current = valueToDate(dates[index]) || new Date();
    setEditingIndex(index);
    setSelectedDateKey(dateKey(current));
    setEditMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    setShowPicker(false);
  };

  const persistDates = async (nextDates: string[]) => {
    if (!user?.uid || !historyDocId) return;
    setSaving(true);
    try {
      const normalized = normalizeWatchedDates(nextDates);
      if (!normalized.length) {
        await deleteDoc(doc(db, `users/${user.uid}/history/${historyDocId}`));
        setOpen(false);
        onToast(`Removed ${movie.title} from history`, 'info');
      } else {
        await updateDoc(doc(db, `users/${user.uid}/history/${historyDocId}`), {
          watchedDates: normalized,
          watchedDate: normalized[normalized.length - 1],
          timestamp: serverTimestamp(),
        });
        onToast('Watch history updated', 'success');
      }
      setEditingIndex(null);
    } catch {
      onToast('Failed to update watch history', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const next = [...dates];
    next[editingIndex] = keyToDate(selectedDateKey).toISOString();
    void persistDates(next);
  };

  const deleteEvent = (index: number) => {
    void persistDates(dates.filter((_, dateIndex) => dateIndex !== index));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.16] bg-black/45 px-3.5 py-2 text-[11px] font-bold text-zinc-300 shadow-[0_10px_30px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl transition hover:border-emerald-400/25 hover:bg-black/60 hover:text-white"
      >
        <CalendarDays className="h-3.5 w-3.5 text-emerald-400" />
        <span>{dates.length > 1 ? 'Latest ' : 'Watched '}{formatWatchDate(latest)}</span>
        {dates.length > 1 && <span className="text-zinc-500">• {dates.length}×</span>}
        <ChevronRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close watch history" onClick={() => { setOpen(false); setEditingIndex(null); }} className="absolute inset-0 bg-black/72 backdrop-blur-xl" />

          <motion.div
            initial={{ opacity: 0, y: 34, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-zinc-950/95 shadow-[0_28px_90px_rgba(0,0,0,0.78)] backdrop-blur-3xl sm:rounded-[32px]"
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" />

            <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] p-4 sm:p-5">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                {movie.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt="" className="h-full w-full object-cover" /> : <ImageOff className="m-auto h-full w-4 text-zinc-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">Watch History</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-400">{movie.title}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-400/80">{dates.length} {dates.length === 1 ? 'watch' : 'watches'}</p>
              </div>
              <button type="button" onClick={() => { setOpen(false); setEditingIndex(null); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {editingIndex === null ? (
                <div className="relative space-y-1">
                  <div className="absolute bottom-5 left-[19px] top-5 w-px bg-gradient-to-b from-emerald-400/60 via-white/10 to-emerald-400/60" />
                  {dates.map((watchDate, index) => {
                    const isFirst = index === 0;
                    const isLatest = index === dates.length - 1;
                    return (
                      <div key={`${watchDate}-${index}`} className="relative flex gap-3 py-2.5">
                        <span className={`relative z-10 mt-2 h-3 w-3 shrink-0 rounded-full border-2 border-zinc-950 ${isLatest ? 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.65)]' : 'bg-zinc-600'}`} />
                        <div className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3.5 py-3 ${isLatest ? 'border-emerald-400/15 bg-emerald-400/[0.055]' : 'border-white/[0.06] bg-white/[0.025]'}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">{isLatest ? 'Latest Watch' : isFirst ? 'First Watch' : `Rewatch #${index}`}</p>
                            <p className="mt-1 text-xs font-bold text-zinc-100">{formatWatchDate(watchDate)}</p>
                          </div>
                          <button type="button" onClick={() => startEdit(index)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-zinc-500 transition hover:text-amber-300"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" disabled={saving} onClick={() => deleteEvent(index)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-500/10 bg-red-500/[0.04] text-zinc-600 transition hover:text-red-400 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pb-2">
                  <button
                    type="button"
                    onClick={() => { setEditingIndex(null); setShowPicker(false); }}
                    className="mb-3 flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />Watch History
                  </button>
                  <div className="mb-4">
                    <h3 className="text-sm font-black text-white">Edit watch date</h3>
                    <p className="mt-1 text-[10px] text-zinc-500">Update only this watch event.</p>
                  </div>

                  <div className="relative w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#0a0a0a] shadow-[0_24px_80px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)]">
                    <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-[80%] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[60px]" />

                    <div className="relative p-4 sm:p-5">
                      <div className="mb-6 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setEditMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white active:scale-95"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowPicker(!showPicker)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 transition hover:bg-white/5 active:scale-[0.98]"
                        >
                          <span className="text-base font-black tracking-wide text-white">
                            {editMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-emerald-500 transition-transform duration-300 ${showPicker ? 'rotate-180' : ''}`} />
                        </button>

                        <button
                          type="button"
                          disabled={!canGoNextMonth}
                          onClick={() => setEditMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      <AnimatePresence>
                        {showPicker && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: -10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -10, scale: 0.95 }}
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                              className="absolute left-4 right-4 top-[60px] z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#111]/95 shadow-[0_30px_60px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-3xl"
                            >
                              <div className="p-3">
                                <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                  {Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => new Date().getFullYear() - i).map((year) => {
                                    const isYearActive = editMonth.getFullYear() === year;
                                    const isYearDisabled = year > new Date().getFullYear();
                                    return (
                                      <button
                                        key={year}
                                        type="button"
                                        disabled={isYearDisabled}
                                        onClick={() => {
                                          const safeMonth = year === new Date().getFullYear() ? Math.min(editMonth.getMonth(), new Date().getMonth()) : editMonth.getMonth();
                                          setEditMonth(new Date(year, safeMonth, 1));
                                        }}
                                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all duration-200 
                                          ${isYearActive ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                                            isYearDisabled ? 'text-zinc-700 cursor-not-allowed' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
                                      >
                                        {year}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="grid grid-cols-3 gap-1.5">
                                  {Array.from({ length: 12 }, (_, month) => {
                                    const isMonthActive = editMonth.getMonth() === month;
                                    const isMonthDisabled = editMonth.getFullYear() === new Date().getFullYear() && month > new Date().getMonth();
                                    return (
                                      <button
                                        key={month}
                                        type="button"
                                        disabled={isMonthDisabled}
                                        onClick={() => {
                                          setEditMonth(new Date(editMonth.getFullYear(), month, 1));
                                          setShowPicker(false);
                                        }}
                                        className={`rounded-lg py-2 text-[11px] font-bold transition-all duration-200 active:scale-95 
                                          ${isMonthActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                            isMonthDisabled ? 'text-zinc-700 cursor-not-allowed' : 'bg-white/[0.02] text-zinc-400 border border-transparent hover:bg-white/[0.08] hover:text-white'}`}
                                      >
                                        {new Date(2000, month, 1).toLocaleDateString(undefined, { month: 'short' })}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>

                      <div className="mb-2 grid grid-cols-7 gap-1 text-center">
                        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, index) => (
                          <span key={`${day}-${index}`} className="py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                            {day}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center">
                        {calendarDays.map((date) => {
                          const key = dateKey(date);
                          const outside = date.getMonth() !== editMonth.getMonth();
                          const future = date > todayEnd;
                          const selected = selectedDateKey === key;
                          const isToday = key === dateKey(new Date());

                          return (
                            <button
                              type="button"
                              key={key}
                              disabled={future}
                              onClick={() => setSelectedDateKey(key)}
                              className={`group relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold transition-all duration-300 
                                ${selected
                                  ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.6)] scale-110 z-10 font-black'
                                  : outside
                                    ? 'text-zinc-600 hover:bg-white/5'
                                    : 'text-zinc-200 hover:bg-white/10 hover:scale-105'
                                } disabled:cursor-not-allowed disabled:opacity-20`}
                            >
                              {date.getDate()}
                              {isToday && !selected && (
                                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-white/5 bg-white/[0.01] p-4">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={saveEdit}
                        className="flex w-full items-center justify-between rounded-2xl bg-zinc-900 border border-white/10 px-5 py-3.5 transition hover:bg-zinc-800 active:scale-[0.98] group disabled:opacity-50"
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">{saving ? 'Updating...' : 'Selected Date'}</span>
                          <span className="text-sm font-black text-white">{formatWatchDate(keyToDate(selectedDateKey))}</span>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-transform group-hover:scale-110 group-active:scale-95">
                          {saving ? <Loader2 className="h-5 w-5 stroke-[3] animate-spin" /> : <Check className="h-5 w-5 stroke-[3]" />}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>,
        document.body,
      )}
    </>
  );
};

const MovieDetails = () => {
  const castContainerRef = useRef<HTMLDivElement>(null);
  const crewContainerRef = useRef<HTMLDivElement>(null);
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  useAutoLandscapeFullscreen();

  const [userReview, setUserReview] = useState('');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hasSavedRating, setHasSavedRating] = useState(false);
  const [editingRating, setEditingRating] = useState(false);
  const [activeGenreId, setActiveGenreId] = useState<number | null>(null);
  const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userExistingReview, setUserExistingReview] = useState<{
    id: string;
    content: string;
    author: string;
    timestamp: any;
    title?: string;
    rating?: number;
    posterPath?: string;
    mediaType?: string;
    spoiler?: boolean;
  } | null>(null);
  const [isLoadingUserReview, setIsLoadingUserReview] = useState<boolean>(false);
  const [isEditingUserReview, setIsEditingUserReview] = useState(false);
  const [editReviewContent, setEditReviewContent] = useState('');
  const [isUpdatingUserReview, setIsUpdatingUserReview] = useState(false);
  const [isDeletingReview, setIsDeletingReview] = useState(false);
  const [sortOption, setSortOption] = useState('mostHelpful');
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [heroBackdropUrl, setHeroBackdropUrl] = useState<string | null>(null);
  const [artworkEditor, setArtworkEditor] = useState(false);
  const [artworkTab, setArtworkTab] = useState<'poster' | 'backdrop'>('poster');
  const [artworkOverrides, setArtworkOverrides] = useState<{ poster?: string; backdrop?: string }>({});
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`cinescape:artwork:movie:${id}`);
      setArtworkOverrides(stored ? JSON.parse(stored) : {});
    } catch { setArtworkOverrides({}); }
  }, [id]);
  const saveArtwork = (type: 'poster' | 'backdrop', path: string | null) => {
    const next = { ...artworkOverrides };
    if (path) next[type] = path;
    else delete next[type];
    setArtworkOverrides(next);
    try { localStorage.setItem(`cinescape:artwork:movie:${id}`, JSON.stringify(next)); } catch { }
  };

  const [crew, setCrew] = useState<any[]>([]);
  const [movieParts, setMovieParts] = useState<any[]>([]);
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({ message: '', type: 'success', isVisible: false });
  const [playerSource, setPlayerSource] = useState<PlayerSource>('vidly');
  const [shareOpen, setShareOpen] = useState(false);
  const [reviewShareOpen, setReviewShareOpen] = useState(false);
  const [watchedMovieIds, setWatchedMovieIds] = useState<number[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteDocId, setFavoriteDocId] = useState<string | null>(null);
  const [myListFolders, setMyListFolders] = useState<MyListFolder[]>([]);
  const [myListFolderIds, setMyListFolderIds] = useState<Set<string>>(new Set());
  const [showMyListPicker, setShowMyListPicker] = useState(false);
  const [isUpdatingLibrary, setIsUpdatingLibrary] = useState(false);
  const [showMovieInfo, setShowMovieInfo] = useState(false);
  const [providerRegion, setProviderRegion] = useState('IN');
  const [showTrailerPreview, setShowTrailerPreview] = useState(false);
  const [reviewSpoiler, setReviewSpoiler] = useState(false);
  const [revealOwnSpoiler, setRevealOwnSpoiler] = useState(false);
  const [ratingHistory, setRatingHistory] = useState<{ rating: number; at: any }[]>([]);
  const [releaseReminder, setReleaseReminder] = useState(false);
  const [currentWatchDates, setCurrentWatchDates] = useState<string[]>([]);


  useEffect(() => {
    if (!user?.uid) {
      setWatchedMovieIds([]);
      return;
    }

    const historyRef = collection(db, 'users', user.uid, 'history');
    const unsubscribe = onSnapshot(
      historyRef,
      (snapshot) => {
        const movieIds = snapshot.docs.reduce<number[]>((ids, historyDoc) => {
          const data = historyDoc.data();
          const mediaType = data.mediaType ?? 'movie';
          const movieId = Number(data.movieId);

          if (mediaType === 'movie' && Number.isInteger(movieId) && movieId > 0) {
            ids.push(movieId);
          }

          return ids;
        }, []);

        setWatchedMovieIds([...new Set(movieIds)]);
      },
      (historyError) => {
        console.error('Error listening for movie history:', historyError);
        setWatchedMovieIds([]);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !movieDetails?.id) { setCurrentWatchDates([]); return; }
    const ref = collection(db, `users/${user.uid}/history`);
    return onSnapshot(query(ref, where('movieId', '==', movieDetails.id)), (snapshot) => {
      const match = snapshot.docs.find((entry) => (entry.data().mediaType ?? 'movie') === 'movie');
      if (!match) { setCurrentWatchDates([]); return; }
      const data = match.data();
      setCurrentWatchDates(normalizeWatchedDates(data.watchedDates || [], data.watchedDate ?? data.timestamp ?? data.createdAt));
    }, () => setCurrentWatchDates([]));
  }, [user?.uid, movieDetails?.id]);

  useEffect(() => {
    if (!user?.uid || !movieDetails?.id) {
      setIsFavorite(false);
      setFavoriteDocId(null);
      return;
    }
    const favoritesRef = collection(db, `users/${user.uid}/favouriteMedia`);
    return onSnapshot(favoritesRef, (snapshot) => {
      const match = snapshot.docs.find((favoriteDoc) => {
        const data = favoriteDoc.data();
        const mediaId = Number(data.mediaId ?? data.movieId ?? favoriteDoc.id.replace(/^(movie|tv)-/, ''));
        const mediaType = data.mediaType === 'tv' ? 'tv' : 'movie';
        return mediaType === 'movie' && mediaId === movieDetails.id;
      });
      setIsFavorite(Boolean(match));
      setFavoriteDocId(match?.id ?? null);
    }, () => {
      setIsFavorite(false);
      setFavoriteDocId(null);
    });
  }, [user?.uid, movieDetails?.id]);

  useEffect(() => {
    if (!user?.uid || !movieDetails?.id) {
      setMyListFolders([]);
      setMyListFolderIds(new Set());
      return;
    }

    const nestedMembership = new Map<string, boolean>();
    const legacyMembership = new Map<string, boolean>();
    const folderNames = new Map<string, string>();
    const legacyPosters = new Map<string, string[]>();
    const nestedPosters = new Map<string, string[]>();
    const itemUnsubscribes = new Map<string, () => void>();

    const matchesMovie = (data: any, fallbackId?: string) => {
      const rawId = data?.movieId ?? data?.mediaId ?? data?.id ?? fallbackId?.replace(/^(movie|tv)-/, '');
      const mediaId = Number(rawId);
      const mediaType = data?.mediaType ?? data?.type ?? (fallbackId?.startsWith('tv-') ? 'tv' : 'movie');
      return mediaType !== 'tv' && mediaId === movieDetails.id;
    };

    const getPosterPath = (data: any) => data?.posterPath || data?.poster || data?.poster_path || '';

    const emitMembership = () => {
      const next = new Set<string>();
      legacyMembership.forEach((value, folderId) => { if (value) next.add(folderId); });
      nestedMembership.forEach((value, folderId) => { if (value) next.add(folderId); });
      setMyListFolderIds(next);
    };

    const emitFolders = () => {
      const folders = [...folderNames.entries()].map(([folderId, name]) => ({
        id: folderId,
        name,
        posterPaths: [...new Set([...(nestedPosters.get(folderId) || []), ...(legacyPosters.get(folderId) || [])])].filter(Boolean).slice(0, 3),
      }));
      setMyListFolders(folders);
    };

    const rootRef = collection(db, `users/${user.uid}/customWatchlists`);
    const rootUnsubscribe = onSnapshot(rootRef, (snapshot) => {
      const liveFolderIds = new Set<string>();

      snapshot.docs.forEach((folderDoc) => {
        const folderId = folderDoc.id;
        const data = folderDoc.data();
        const legacyItems = Array.isArray(data.items) ? data.items : [];
        folderNames.set(folderId, data.name || data.title || data.listName || 'Untitled List');
        legacyPosters.set(folderId, legacyItems.map((item: any) => getPosterPath(item)).filter(Boolean));
        liveFolderIds.add(folderId);
        legacyMembership.set(folderId, legacyItems.some((item: any) => matchesMovie(item)));

        if (!itemUnsubscribes.has(folderId)) {
          const itemsRef = collection(db, `users/${user.uid}/customWatchlists/${folderId}/items`);
          const unsubscribeItems = onSnapshot(itemsRef, (itemsSnapshot) => {
            nestedMembership.set(folderId, itemsSnapshot.docs.some((itemDoc) => matchesMovie(itemDoc.data(), itemDoc.id)));
            nestedPosters.set(folderId, itemsSnapshot.docs.map((itemDoc) => getPosterPath(itemDoc.data())).filter(Boolean));
            emitMembership();
            emitFolders();
          }, () => {
            nestedMembership.set(folderId, false);
            nestedPosters.set(folderId, []);
            emitMembership();
            emitFolders();
          });
          itemUnsubscribes.set(folderId, unsubscribeItems);
        }
      });

      [...itemUnsubscribes.entries()].forEach(([folderId, unsubscribeItems]) => {
        if (!liveFolderIds.has(folderId)) {
          unsubscribeItems();
          itemUnsubscribes.delete(folderId);
          nestedMembership.delete(folderId);
          legacyMembership.delete(folderId);
          nestedPosters.delete(folderId);
          legacyPosters.delete(folderId);
          folderNames.delete(folderId);
        }
      });

      emitFolders();
      emitMembership();
    }, () => {
      setMyListFolders([]);
      setMyListFolderIds(new Set());
    });

    return () => {
      rootUnsubscribe();
      itemUnsubscribes.forEach((unsubscribeItems) => unsubscribeItems());
    };
  }, [user?.uid, movieDetails?.id]);

  useEffect(() => {
    const fetchUserRating = async () => {
      if (!user || !id) return;
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const ratingDoc = await getDoc(doc(db, `users/${user.uid}/ratings`, id));
        if (ratingDoc.exists()) {
          setUserRating(ratingDoc.data().rating);
          setRatingHistory(Array.isArray(ratingDoc.data().ratingHistory) ? ratingDoc.data().ratingHistory : []);
          setHasSavedRating(true);
        }
      } catch {
      }
    };
    fetchUserRating();
  }, [user, id]);

  useEffect(() => {
    setIsLoadingUserReview(true);
    setIsEditingUserReview(false);
    setEditReviewContent('');

    if (!user?.uid || !movieDetails?.id) {
      setUserExistingReview(null);
      setIsLoadingUserReview(false);
      return;
    }

    const reviewsRef = collection(db, 'users', user.uid, 'reviews');
    const reviewQuery = query(reviewsRef, where('movieId', '==', movieDetails.id));
    const unsubscribe = onSnapshot(
      reviewQuery,
      (snapshot) => {
        const reviewDoc = snapshot.docs[0];

        if (!reviewDoc) {
          setUserExistingReview(null);
          setIsLoadingUserReview(false);
          return;
        }

        const data = reviewDoc.data();
        setUserExistingReview({
          id: reviewDoc.id,
          content: data.content ?? '',
          author: data.author ?? 'Anonymous',
          timestamp: data.timestamp ?? null,
          title: data.title ?? '',
          rating: data.rating ?? undefined,
          posterPath: data.posterPath ?? movieDetails.poster_path,
          mediaType: data.mediaType ?? 'movie',
          spoiler: Boolean(data.spoiler),
        });
        setIsLoadingUserReview(false);
      },
      (snapshotError) => {
        console.error('Error listening for user review:', snapshotError);
        setUserExistingReview(null);
        setIsLoadingUserReview(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, movieDetails?.id, movieDetails?.poster_path]);

  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [userHandle, setUserHandle] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserPhoto(data.photoDataUrl ?? null);
        setUserHandle(data.handle ?? null);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, isVisible: true });
  };

  const syncWatchlistState = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser || !movieDetails?.id) return;
    const ref = collection(db, 'users', currentUser.uid, 'watchlist');
    const snap = await getDocs(query(ref, where('movieId', '==', movieDetails.id)));
    setIsInWatchlist(snap.docs.length > 0);
  };

  useEffect(() => {
    const fetchAll = async () => {
      setHeroBackdropUrl(null);
      setLoading(true);
      setError(null);
      try {
        const resp = await axios.get(
          `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&append_to_response=credits,reviews,videos,images,watch/providers,release_dates`,
        );
        const data = resp.data;

        const directorCredit = data.credits?.crew?.find((m: any) => m.job === 'Director');
        const director = directorCredit?.name ?? 'Unknown Director';
        const directorId = Number(directorCredit?.id) || undefined;
        const providerResults = data['watch/providers']?.results ?? {};
        const preferredProviders = providerResults.IN ?? providerResults.US ?? {};
        const streamingLinks = preferredProviders.flatrate ?? [];
        const releaseResults = (data.release_dates?.results ?? []).flatMap((region: any) =>
          (region.release_dates ?? []).map((release: any) => ({
            iso_3166_1: region.iso_3166_1,
            certification: release.certification || '',
            release_date: release.release_date || '',
            type: release.type,
          })),
        );
        const certification = (data.release_dates?.results ?? [])
          .find((region: any) => region.iso_3166_1 === 'IN')?.release_dates?.find((release: any) => release.certification)?.certification
          || (data.release_dates?.results ?? []).find((region: any) => region.iso_3166_1 === 'US')?.release_dates?.find((release: any) => release.certification)?.certification
          || '';
        const backdrops: { file_path: string }[] = data.images?.backdrops ?? [];

        if (backdrops.length > 0) {
          setHeroBackdropUrl(
            `https://image.tmdb.org/t/p/original/${backdrops[Math.floor(Math.random() * backdrops.length)].file_path
            }`,
          );
        }

        setCrew(data.credits?.crew ?? []);

        const firstPageReviews: any[] = data.reviews?.results ?? [];
        const totalReviewPages: number = data.reviews?.total_pages ?? 1;
        const extraReviewFetches = [];
        for (let page = 2; page <= totalReviewPages; page++) {
          extraReviewFetches.push(
            axios.get(
              `https://api.themoviedb.org/3/movie/${id}/reviews?api_key=${TMDB_KEY}&page=${page}`,
            ),
          );
        }
        const extraReviewResponses = await Promise.all(extraReviewFetches);
        const allRawReviews = [
          ...firstPageReviews,
          ...extraReviewResponses.flatMap((r) => r.data.results ?? []),
        ];
        const reviews = allRawReviews.map((r: any) => ({
          id: r.id,
          author: r.author,
          content: r.content,
        }));

        setMovieDetails({
          id: data.id,
          title: data.title,
          language: data.original_language,
          director,
          directorId,
          boxOffice: data.revenue,
          overview: data.overview,
          release_date: data.release_date,
          genres: data.genres ?? [],
          runtime: data.runtime,
          poster_path: data.poster_path,
          vote_average: data.vote_average,
          cast:
            data.credits?.cast?.map((m: any) => ({
              id: m.id,
              name: m.name,
              role: m.character,
              profile_path: m.profile_path,
            })) ?? null,
          reviews,
          trailers: data.videos?.results ?? [],
          images: { backdrops, posters: data.images?.posters ?? [] },
          streamingLinks,
          imdb_id: data.imdb_id ?? '',
          original_title: data.original_title ?? data.title,
          status: data.status ?? '',
          homepage: data.homepage ?? '',
          certification,
          productionCompanies: data.production_companies ?? [],
          productionCountries: data.production_countries ?? [],
          releases: releaseResults,
          watchProviders: providerResults,
        });

        if (data.belongs_to_collection?.id) {
          setCollectionName(data.belongs_to_collection.name);
          const colResp = await axios.get(
            `https://api.themoviedb.org/3/collection/${data.belongs_to_collection.id}?api_key=${TMDB_KEY}`,
          );
          const now = new Date();
          setMovieParts(
            colResp.data.parts.filter(
              (p: any) => p.release_date && new Date(p.release_date) <= now,
            ),
          );
        } else {
          setCollectionName(null);
          setMovieParts([]);
        }
      } catch {
        setError('Failed to fetch movie details.');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  useEffect(() => {
    const check = async () => {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !movieDetails?.id) return;
      const ref = collection(db, 'users', currentUser.uid, 'watchlist');
      const snap = await getDocs(query(ref, where('movieId', '==', movieDetails.id)));
      setIsInWatchlist(snap.docs.length > 0);
    };
    check();
  }, [movieDetails?.id]);

  const handleRateMovie = (rating: number) => {
    setUserRating(rating);
    if (rating >= 4) {
      const defaults = {
        origin: { y: 0.7 },
        colors: ['#facc15', '#eab308', '#ca8a04', '#ffffff'],
        ticks: 150,
      };
      const fire = (ratio: number, opts: object) =>
        confetti({ ...defaults, ...opts, particleCount: Math.floor(100 * ratio), shapes: ['circle'] });
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    }
  };

  const handleUpvote = (index: number) => {
    setMovieDetails((prev) =>
      prev
        ? {
          ...prev,
          reviews: prev.reviews.map((r, i) =>
            i === index ? { ...r, likes: (r.likes ?? 0) + 1 } : r,
          ),
        }
        : null,
    );
  };

  const handleDownvote = (index: number) => {
    setMovieDetails((prev) =>
      prev
        ? {
          ...prev,
          reviews: prev.reviews.map((r, i) =>
            i === index ? { ...r, dislikes: (r.dislikes ?? 0) + 1 } : r,
          ),
        }
        : null,
    );
  };

  const handleFavoriteToggle = async () => {
    if (!user?.uid || !movieDetails) {
      showToast('Please log in to update favorites', 'error');
      return;
    }
    setIsUpdatingLibrary(true);
    try {
      if (isFavorite && favoriteDocId) {
        await deleteDoc(doc(db, `users/${user.uid}/favouriteMedia/${favoriteDocId}`));
        showToast('Removed from favourites', 'info');
      } else {
        const key = `movie-${movieDetails.id}`;
        await setDoc(doc(db, `users/${user.uid}/favouriteMedia/${key}`), {
          movieId: movieDetails.id,
          mediaId: movieDetails.id,
          mediaType: 'movie',
          title: movieDetails.title,
          posterPath: movieDetails.poster_path,
          releaseDate: movieDetails.release_date,
          addedAt: serverTimestamp(),
        }, { merge: true });
        showToast('Added to favourites', 'success');
      }
    } catch {
      showToast('Failed to update favourites', 'error');
    } finally {
      setIsUpdatingLibrary(false);
    }
  };

  const handleMyListFolderToggle = async (folderId: string) => {
    if (!user?.uid || !movieDetails || !folderId) return;
    setIsUpdatingLibrary(true);
    const isAlreadyInFolder = myListFolderIds.has(folderId);
    try {
      const folderRef = doc(db, `users/${user.uid}/customWatchlists/${folderId}`);
      const rootSnapshot = await getDocs(collection(db, `users/${user.uid}/customWatchlists`));
      const folderSnapshot = rootSnapshot.docs.find((folderDoc) => folderDoc.id === folderId);
      const itemsRef = collection(db, `users/${user.uid}/customWatchlists/${folderId}/items`);

      if (isAlreadyInFolder) {
        const tasks: Promise<unknown>[] = [];
        if (folderSnapshot) {
          const data = folderSnapshot.data();
          if (Array.isArray(data.items)) {
            const nextItems = data.items.filter((item: any) => {
              const rawId = Number(item?.movieId ?? item?.mediaId ?? item?.id);
              const type = item?.mediaType ?? item?.type ?? 'movie';
              return !(type !== 'tv' && rawId === movieDetails.id);
            });
            if (nextItems.length !== data.items.length) tasks.push(updateDoc(folderRef, { items: nextItems }));
          }
        }
        const nestedSnapshot = await getDocs(itemsRef);
        nestedSnapshot.docs.forEach((itemDoc) => {
          const data = itemDoc.data();
          const rawId = Number(data.movieId ?? data.mediaId ?? data.id ?? itemDoc.id.replace(/^(movie|tv)-/, ''));
          const type = data.mediaType ?? data.type ?? (itemDoc.id.startsWith('tv-') ? 'tv' : 'movie');
          if (type !== 'tv' && rawId === movieDetails.id) tasks.push(deleteDoc(itemDoc.ref));
        });
        await Promise.all(tasks);
        showToast('Removed from My List', 'info');
      } else {
        await setDoc(doc(db, `users/${user.uid}/customWatchlists/${folderId}/items/movie-${movieDetails.id}`), {
          id: movieDetails.id,
          movieId: movieDetails.id,
          mediaId: movieDetails.id,
          type: 'movie',
          mediaType: 'movie',
          title: movieDetails.title,
          poster: movieDetails.poster_path,
          posterPath: movieDetails.poster_path,
          releaseYear: movieDetails.release_date?.slice(0, 4) || '',
          releaseDate: movieDetails.release_date,
          voteAverage: movieDetails.vote_average || 0,
          runtimeMinutes: movieDetails.runtime || 0,
          genres: movieDetails.genres?.map((genre) => genre.name) ?? [],
          addedAt: serverTimestamp(),
        }, { merge: true });
        showToast('Added to My List', 'success');
      }
    } catch {
      showToast('Failed to update My List', 'error');
    } finally {
      setIsUpdatingLibrary(false);
    }
  };

  const handleWatchlistToggle = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser || !movieDetails) {
      if (!currentUser) showToast('Please log in to add to watchlist', 'error');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const willSave = !isInWatchlist;
      setIsInWatchlist(willSave);
      try {
        await enqueueWatchlistOp({
          type: willSave ? 'watchlist_add' : 'watchlist_remove',
          userId: currentUser.uid,
          movieId: movieDetails.id,
          title: movieDetails.title,
          releaseDate: movieDetails.release_date,
          genres: movieDetails.genres?.map((g) => g.name),
          posterPath: movieDetails.poster_path,
          mediaType: 'movie',
        });
        await registerWatchlistSync();
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.active?.postMessage({ type: 'WATCHLIST_FLUSH' });
          }
        } catch { }
        if (willSave) {
          confetti({
            particleCount: 150, spread: 70, origin: { y: 0.8 },
            colors: ['#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8'],
            ticks: 200, gravity: 1.2, scalar: 1.2,
          });
        }
        showToast(
          willSave ? 'Saved offline. Will sync when online.' : 'Removed offline. Will sync when online.',
          'info',
        );
      } catch {
        showToast('Failed to save offline', 'error');
      }
      return;
    }

    const ref = collection(db, 'users', currentUser.uid, 'watchlist');
    try {
      const snap = await getDocs(query(ref, where('movieId', '==', movieDetails.id)));
      if (snap.docs.length > 0) {
        await deleteDoc(snap.docs[0].ref);
        setIsInWatchlist(false);
        showToast('Removed from watchlist', 'info');
      } else {
        await addDoc(ref, {
          movieId: movieDetails.id,
          title: movieDetails.title,
          releaseDate: movieDetails.release_date,
          genres: movieDetails.genres?.map((g) => g.name),
          posterPath: movieDetails.poster_path,
          mediaType: 'movie',
        });
        setIsInWatchlist(true);
        confetti({
          particleCount: 150, spread: 70, origin: { y: 0.8 },
          colors: ['#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8'],
          ticks: 200, gravity: 1.2, scalar: 1.2,
        });
        showToast('Added to watchlist!', 'success');
      }
    } catch {
      showToast('Failed to update watchlist', 'error');
    }
  };

  const handleRatingSubmit = async () => {
    if (!user) { showToast('Please log in to rate this movie', 'error'); return; }
    if (userRating === null || userRating < 0 || userRating > 10) {
      showToast('Rating must be between 0 and 10', 'error'); return;
    }
    try {
      if (!id) throw new Error('Missing movie ID');
      const nextRatingHistory = [...ratingHistory];
      const previous = nextRatingHistory[nextRatingHistory.length - 1]?.rating;
      if (previous !== userRating) nextRatingHistory.push({ rating: userRating, at: new Date() });
      await setDoc(doc(db, `users/${user.uid}/ratings`, id), {
        movieId: movieDetails?.id,
        title: movieDetails?.title,
        posterPath: movieDetails?.poster_path,
        rating: userRating,
        ratingHistory: nextRatingHistory.slice(-12),
        mediaType: "movie",
        timestamp: new Date(),
      }, { merge: true });
      setRatingHistory(nextRatingHistory.slice(-12));
      setHasSavedRating(true);
      setEditingRating(false);
      showToast(hasSavedRating ? 'Rating updated!' : 'Rating submitted!', 'success');
    } catch {
      showToast('Failed to submit rating', 'error');
    }
  };

  const handleEditRating = () => {
    setEditingRating(true);
  };

  const handleCancelEditRating = () => {
    setEditingRating(false);
  };

  const handleDeleteRating = async () => {
    if (!user) { showToast('Please log in to delete rating', 'error'); return; }
    if (!id) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/ratings`, id));
      setUserRating(null);
      setHasSavedRating(false);
      setEditingRating(false);
      showToast('Rating deleted', 'success');
    } catch {
      showToast('Failed to delete rating', 'error');
    }
  };

  const handleReviewSubmit = async () => {
    if (!user) { showToast('Please log in to submit a review', 'error'); return; }
    if (!userReview.trim()) { showToast('Review cannot be empty', 'error'); return; }
    try {
      const reviewRef = await addDoc(collection(db, 'users', user.uid, 'reviews'), {
        author: user.displayName ?? 'Anonymous',
        content: userReview.trim(),
        title: movieDetails?.title,
        movieId: movieDetails?.id,
        posterPath: movieDetails?.poster_path,
        mediaType: 'movie',
        spoiler: reviewSpoiler,
        timestamp: new Date(),
      });
      setUserExistingReview({
        id: reviewRef.id,
        content: userReview.trim(),
        author: user.displayName ?? 'Anonymous',
        timestamp: new Date(),
        title: movieDetails?.title ?? '',
        posterPath: movieDetails?.poster_path,
        mediaType: 'movie',
        spoiler: reviewSpoiler,
      });
      setUserReview('');
      setReviewSpoiler(false);
      showToast('Review submitted!', 'success');
    } catch {
      showToast('Failed to submit review', 'error');
    }
  };

  const handleEditUserReview = () => {
    if (userExistingReview) {
      setEditReviewContent(userExistingReview.content);
      setIsEditingUserReview(true);
    }
  };

  const handleCancelEditUserReview = () => {
    setIsEditingUserReview(false);
    setEditReviewContent('');
  };

  const handleUpdateUserReview = async () => {
    const nextContent = editReviewContent.trim();
    if (!user || !userExistingReview) return;
    if (!nextContent) {
      showToast('Review cannot be empty', 'error');
      return;
    }

    setIsUpdatingUserReview(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'reviews', userExistingReview.id), {
        content: nextContent,
      });
      setUserExistingReview({ ...userExistingReview, content: nextContent });
      setIsEditingUserReview(false);
      setEditReviewContent('');
      showToast('Review updated!', 'success');
    } catch {
      showToast('Failed to update review', 'error');
    } finally {
      setIsUpdatingUserReview(false);
    }
  };

  const handleDeleteUserReview = async () => {
    if (!user || !userExistingReview) return;
    setIsDeletingReview(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'reviews', userExistingReview.id));
      setUserExistingReview(null);
      setIsEditingUserReview(false);
      setEditReviewContent('');
      showToast('Review deleted', 'success');
    } catch {
      showToast('Failed to delete review', 'error');
    } finally {
      setIsDeletingReview(false);
    }
  };

  const groupedCrew = useMemo(() => {
    const grouped: Record<string, any> = {};
    crew.forEach((m) => {
      if (!grouped[m.id]) {
        grouped[m.id] = { ...m, jobs: [m.job] };
      } else if (!grouped[m.id].jobs.includes(m.job)) {
        grouped[m.id].jobs.push(m.job);
      }
    });
    const jobPriority = (jobs: string[]) => {
      if (jobs.includes('Director')) return 1;
      if (jobs.some((j) => ['Writer', 'Screenplay', 'Story'].includes(j))) return 2;
      if (jobs.includes('Producer')) return 3;
      return 4;
    };
    return Object.values(grouped).sort((a: any, b: any) => {
      const diff = jobPriority(a.jobs) - jobPriority(b.jobs);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [crew]);

  const embedUrls = useMemo(() => {
    const tmdbId = id ?? '';
    const imdbId = movieDetails?.imdb_id ?? '';
    return getMovieEmbedUrls(tmdbId, imdbId);
  }, [id, movieDetails?.imdb_id]);

  const currentSrc = embedUrls[playerSource];

  const VideoPlayer = useMemo(() => {
    if (!currentSrc) return null;
    return (
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-[0_0_50px_-12px_rgba(239,68,68,0.15)] group-hover:shadow-[0_0_60px_-10px_rgba(239,68,68,0.25)] group-hover:border-white/[0.12] transition-all duration-500">
        <div className="w-full aspect-video bg-zinc-950">
          <iframe
            key={`${playerSource}-${id}`}
            src={currentSrc!}
            width="100%"
            height="100%"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; orientation-lock"
            title="Movie Player"
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>
      </div>
    );
  }, [currentSrc, id]);


  if (loading) return <Loading />;
  if (error || !movieDetails) return <p className="text-center text-red-500 py-20">{error}</p>;

  const language = LANGUAGE_MAP[movieDetails.language] ?? movieDetails.language ?? 'Unknown';
  const boxOffice = movieDetails.boxOffice
    ? `$${Number(movieDetails.boxOffice).toLocaleString()}`
    : 'N/A';
  const posterPath = artworkOverrides.poster || movieDetails.poster_path;
  const backdropPath = artworkOverrides.backdrop || movieDetails.backdrop_path || null;
  const posterUrl = `https://image.tmdb.org/t/p/w780${posterPath}`;
  const heroBackdrop = artworkOverrides.backdrop ? `https://image.tmdb.org/t/p/original${artworkOverrides.backdrop}` : (heroBackdropUrl ?? posterUrl);

  const genres = movieDetails.genres ?? [];
  const segments = genres.map((genre) => ({
    id: genre.id,
    name: genre.name,
    value: genres.length ? 100 / genres.length : 0,
  }));
  const activeSegment = activeGenreId === null ? null : segments.find((s) => s.id === activeGenreId) ?? null;
  const featuredListFolders = myListFolders.filter((folder) => myListFolderIds.has(folder.id));

  const chartSize = 220;
  const strokeW = 26;
  const r = chartSize / 2 - strokeW;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const circumference = 2 * Math.PI * r;
  const gapPx = 4;

  const providerRegions = Object.keys(movieDetails.watchProviders || {}).filter((code) => {
    const region = movieDetails.watchProviders?.[code];
    return region?.flatrate?.length || region?.rent?.length || region?.buy?.length;
  }).sort((a, b) => (a === 'IN' ? -1 : b === 'IN' ? 1 : a.localeCompare(b)));
  const effectiveProviderRegion = providerRegions.includes(providerRegion) ? providerRegion : (providerRegions[0] || providerRegion);
  const selectedProviders = movieDetails.watchProviders?.[effectiveProviderRegion] || {};
  const latestWatch = currentWatchDates[currentWatchDates.length - 1] || null;
  const releaseAt = movieDetails.release_date ? new Date(`${movieDetails.release_date}T12:00:00`) : null;
  const isUpcoming = Boolean(releaseAt && !Number.isNaN(releaseAt.getTime()) && releaseAt.getTime() > Date.now());
  const daysUntilRelease = isUpcoming && releaseAt ? Math.max(1, Math.ceil((releaseAt.getTime() - Date.now()) / 86400000)) : 0;
  const keyCreators = groupedCrew.filter((member: any) => member.jobs?.some((job: string) => ['Director', 'Writer', 'Screenplay', 'Original Music Composer', 'Director of Photography'].includes(job))).slice(0, 8);

  const sortedReviews = [...movieDetails.reviews].sort((a, b) => {
    if (sortOption === 'mostHelpful') return (b.likes ?? 0) - (a.likes ?? 0);
    return 0;
  });

  return (
    <div className="bg-black text-white min-h-screen">
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((t) => ({ ...t, isVisible: false }))}
      />

      {artworkEditor && createPortal(
        <div className="fixed inset-0 z-[10100] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Artwork settings" onKeyDown={(event) => { if (event.key === 'Escape') setArtworkEditor(false); }}>
          <button type="button" aria-label="Close artwork settings" onClick={() => setArtworkEditor(false)} className="absolute inset-0 bg-black/75 backdrop-blur-[5px]" />
          <div className="relative flex h-[min(85dvh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-[30px] border border-white/15 bg-black shadow-[0_30px_100px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.10)] sm:h-[min(82dvh,760px)] sm:rounded-[30px] sm:bg-black">
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25 sm:hidden" />
            <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-3 sm:px-6 sm:pt-5">
              <div className="min-w-0"><h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-white sm:text-lg"><Settings2 className="h-4 w-4 text-white/70" /> Artwork settings</h2><p className="mt-1 text-xs text-zinc-400">Customize this movie's appearance</p></div>
              <button type="button" aria-label="Close" onClick={() => setArtworkEditor(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 transition-colors hover:bg-white/20 active:scale-95"><X className="h-4 w-4" /></button>
            </div>
            <div className="shrink-0 border-b border-white/10 px-4 pb-3 sm:px-6">
              <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/40 p-1" role="tablist" aria-label="Artwork type">
                {(['poster', 'backdrop'] as const).map((tab) => <button type="button" role="tab" key={tab} aria-selected={artworkTab === tab} onClick={() => setArtworkTab(tab)} className={`min-h-11 rounded-full px-4 py-2.5 text-sm font-semibold capitalize transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[.98] ${artworkTab === tab ? 'border border-white/15 bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_3px_12px_rgba(0,0,0,.2)]' : 'border border-transparent text-zinc-400 hover:bg-white/5 hover:text-white'}`}>{tab}</button>)}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:p-5" role="tabpanel">
              <div className={artworkTab === 'poster' ? 'grid grid-cols-2 gap-3 min-[380px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4'}>
                {Array.from(new Set([...(artworkTab === 'poster' ? [movieDetails.poster_path] : [movieDetails.backdrop_path]), ...(movieDetails.images?.[artworkTab === 'poster' ? 'posters' : 'backdrops'] || []).map((item) => item.file_path)])).filter((path): path is string => typeof path === 'string' && path.length > 0).map((path) => {
                  const selected = (artworkOverrides[artworkTab] || (artworkTab === 'poster' ? movieDetails.poster_path : movieDetails.backdrop_path)) === path;
                  return <button type="button" key={path} onClick={() => saveArtwork(artworkTab, path)} aria-label={`Select ${artworkTab} artwork`} aria-pressed={selected} className={`group relative overflow-hidden rounded-2xl border text-left transition-[transform,border-color,box-shadow] duration-200 active:scale-[.97] sm:hover:-translate-y-1 ${selected ? 'border-white/80 shadow-[0_0_0_2px_rgba(255,255,255,.2)]' : 'border-white/10 hover:border-white/40'}`}>
                    <img src={`https://image.tmdb.org/t/p/w500${path}`} alt="" loading="lazy" decoding="async" className={`w-full object-cover ${artworkTab === 'poster' ? 'aspect-[2/3]' : 'aspect-video'}`} />
                    {selected && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-lg"><Check className="h-4 w-4" /></span>}
                  </button>;
                })}
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
              <button type="button" onClick={() => saveArtwork(artworkTab, null)} className="min-h-11 rounded-full border border-white/15 bg-white/10 px-4 text-xs font-medium text-white transition-colors hover:bg-white/20 sm:text-sm">Restore default</button>
              <button type="button" onClick={() => setArtworkEditor(false)} className="min-h-11 rounded-full bg-white px-6 text-sm font-semibold text-black transition-[transform,background-color] hover:bg-zinc-200 active:scale-95">Done</button>
            </div>
          </div>
        </div>, document.body
      )}

      <UserRatingShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        movieId={movieDetails.id}
        title={movieDetails.title}
        posterPath={posterPath}
        backdropPath={backdropPath}
        genres={genres.map((g) => g.name)}
        releaseDate={movieDetails.release_date}
        userRating={userRating}
        userName={user?.displayName || undefined}
        userAvatar={userPhoto}
        userHandle={userHandle || undefined}
        lastWatched={latestWatch ? formatWatchDate(latestWatch) : null}
        isFavorite={isFavorite}
      />

      <ReviewShareSheet
        open={reviewShareOpen}
        onClose={() => setReviewShareOpen(false)}
        movieId={movieDetails.id}
        title={movieDetails.title}
        posterPath={posterPath}
        backdropPath={backdropPath}
        releaseYear={movieDetails.release_date?.slice(0, 4) || ''}
        reviewContent={userExistingReview?.content || ''}
        author={userExistingReview?.author || user?.displayName || 'Anonymous'}
        userPhoto={userPhoto}
        userHandle={userHandle}
        rating={userRating ?? userExistingReview?.rating ?? null}
        watchDate={latestWatch ? formatWatchDate(latestWatch) : null}
        watchCount={currentWatchDates.length}
        mediaType="movie"
        isFavorite={isFavorite}
      />

      {showMyListPicker && createPortal(
        <div className="fixed inset-0 z-[10035] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close My List picker" onClick={() => setShowMyListPicker(false)} className="absolute inset-0 bg-black/70 backdrop-blur-xl sm:bg-black/55" />
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,0.72)] sm:rounded-[30px]"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.07] p-4 sm:p-5">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                {movieDetails.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${movieDetails.poster_path}`} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageOff className="h-4 w-4 text-zinc-600" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{movieDetails.title}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Choose My List</p>
              </div>
              <button type="button" onClick={() => setShowMyListPicker(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {myListFolders.length ? (
                <div className="space-y-2">
                  {myListFolders.map((folder) => {
                    const selected = myListFolderIds.has(folder.id);
                    return (
                      <button
                        type="button"
                        key={folder.id}
                        disabled={isUpdatingLibrary}
                        onClick={() => handleMyListFolderToggle(folder.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] disabled:opacity-50 ${selected ? 'border-violet-400/20 bg-violet-500/10' : 'border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06]'}`}
                      >
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${selected ? 'border-violet-400/20 bg-violet-500/15 text-violet-300' : 'border-white/10 bg-white/[0.04] text-zinc-500'}`}>
                          {selected ? <Check className="h-4 w-4 stroke-[3]" /> : <Plus className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-black text-white">{folder.name}</span>
                          <span className="mt-0.5 block text-[10px] text-zinc-500">{selected ? 'Added · tap to remove' : 'Tap to add'}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center px-5 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-500"><ListChecks className="h-5 w-5" /></span>
                  <p className="mt-3 text-sm font-black text-white">No My List folders yet</p>
                  <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-zinc-500">Create a custom list first, then add this movie to it.</p>
                  <Link to="/mylist" onClick={() => setShowMyListPicker(false)} className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-[10px] font-black text-violet-300">Open My List</Link>
                </div>
              )}
            </div>
            <div className="border-t border-white/[0.07] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
              <button type="button" onClick={() => setShowMyListPicker(false)} className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3 text-xs font-bold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white">Done</button>
            </div>
          </motion.div>
        </div>,
        document.body,
      )}

      {showMovieInfo && createPortal(
        <div className="fixed inset-0 z-[10045] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close movie information" onClick={() => setShowMovieInfo(false)} className="absolute inset-0 bg-black/72 backdrop-blur-xl" />
          <motion.div initial={{ opacity: 0, y: 38, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative z-10 flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[34px] border border-white/10 bg-zinc-950/95 shadow-[0_30px_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl sm:rounded-[34px]">
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Movie Information</p><h2 className="mt-1 truncate text-lg font-black text-white">{movieDetails.title}</h2></div>
              <button type="button" onClick={() => setShowMovieInfo(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <section>
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">General</p>
                <div className="grid grid-cols-2 gap-x-7 gap-y-5">
                  <div><p className="text-[10px] font-semibold text-zinc-600">Release Date</p><p className="mt-1 text-sm font-bold text-zinc-200">{movieDetails.release_date ? formatWatchDate(`${movieDetails.release_date}T12:00:00`) : 'Unknown'}</p></div>
                  <div><p className="text-[10px] font-semibold text-zinc-600">Runtime</p><p className="mt-1 text-sm font-bold text-zinc-200">{formatRuntime(movieDetails.runtime)}</p></div>
                  <div><p className="text-[10px] font-semibold text-zinc-600">Status</p><p className="mt-1 text-sm font-bold text-zinc-200">{movieDetails.status || 'Unknown'}</p></div>
                  <div><p className="text-[10px] font-semibold text-zinc-600">Original Language</p><p className="mt-1 text-sm font-bold text-zinc-200">{language}</p></div>
                  <div><p className="text-[10px] font-semibold text-zinc-600">Certification</p><p className="mt-1 text-sm font-bold text-zinc-200">{movieDetails.certification || 'NR'}</p></div>
                  <div className="col-span-2"><p className="text-[10px] font-semibold text-zinc-600">Original Title</p><p className="mt-1 text-sm font-bold text-zinc-200">{movieDetails.original_title || movieDetails.title}</p></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">{genres.map((genre) => <span key={genre.id} className="rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300">{genre.name}</span>)}</div>
              </section>
              <div className="my-6 h-px bg-white/[0.07]" />
              <section>
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Production</p>
                <div className="space-y-4">
                  <div><p className="text-[10px] font-semibold text-zinc-600">Director</p>{movieDetails.directorId ? <Link to={`/talent/${movieDetails.directorId}`} onClick={() => setShowMovieInfo(false)} className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-zinc-200 transition hover:text-amber-300">{movieDetails.director}<ChevronRight className="h-3.5 w-3.5" /></Link> : <p className="mt-1 text-sm font-bold text-zinc-200">{movieDetails.director}</p>}</div>
                  {!!movieDetails.productionCountries?.length && <div><p className="text-[10px] font-semibold text-zinc-600">Countries</p><div className="mt-2 flex flex-wrap gap-2">{movieDetails.productionCountries.map((country) => <span key={country.iso_3166_1} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300"><span className="text-base leading-none" role="img" aria-label={`${country.name} flag`}>{countryFlag(country.iso_3166_1)}</span><span>{country.name}</span></span>)}</div></div>}
                  {!!movieDetails.productionCompanies?.length && <div><p className="text-[10px] font-semibold text-zinc-600">Companies</p><div className="mt-2 flex flex-wrap gap-2">{movieDetails.productionCompanies.map((company) => <span key={company.id} className="rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300">{company.name}</span>)}</div></div>}
                </div>
              </section>
              {!!movieDetails.releases?.length && <><div className="my-6 h-px bg-white/[0.07]" /><section><p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Releases</p><div className="space-y-2">{movieDetails.releases.filter((release, index, array) => release.release_date && array.findIndex((item) => item.iso_3166_1 === release.iso_3166_1 && item.release_date === release.release_date && item.type === release.type) === index).slice(0, 8).map((release, index) => <div key={`${release.iso_3166_1}-${release.release_date}-${index}`} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-3"><span className="text-xl">{countryFlag(release.iso_3166_1)}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-zinc-200">{release.iso_3166_1}</p><p className="mt-0.5 text-[10px] text-zinc-500">{release.release_date ? formatWatchDate(release.release_date) : ''} · {releaseTypeLabel(release.type)}</p></div>{release.certification && <span className="rounded-lg border border-white/[0.07] bg-black/30 px-2 py-1 text-[9px] font-black text-zinc-400">{release.certification}</span>}</div>)}</div></section></>}
              {(movieDetails.imdb_id || movieDetails.homepage) && <><div className="my-6 h-px bg-white/[0.07]" /><section><p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Links</p><div className="flex flex-wrap gap-2">{movieDetails.imdb_id && <a href={`https://www.imdb.com/title/${movieDetails.imdb_id}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300 hover:text-white">IMDb<ExternalLink className="h-3.5 w-3.5" /></a>}{movieDetails.homepage && <a href={movieDetails.homepage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300 hover:text-white">Official Site<ExternalLink className="h-3.5 w-3.5" /></a>}</div></section></>}
            </div>
          </motion.div>
        </div>,
        document.body,
      )}

      {showTrailerPreview && movieDetails.trailers?.[0] && createPortal(
        <div className="fixed inset-0 z-[10080] flex items-center justify-center bg-black/90 p-3 backdrop-blur-2xl">
          <button type="button" aria-label="Close trailer" onClick={() => setShowTrailerPreview(false)} className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-xl"><X className="h-5 w-5" /></button>
          <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl"><iframe className="h-full w-full" src={`https://www.youtube.com/embed/${movieDetails.trailers[0].key}?autoplay=1`} title={`${movieDetails.title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
        </div>, document.body
      )}

      <div id="overview" className="relative isolate flex min-h-[70vh] items-end overflow-hidden bg-black md:min-h-[85vh]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -inset-10 scale-110 bg-cover bg-center opacity-85 blur-[20px] saturate-[1.12] transform-gpu transition-[opacity,filter] duration-700 sm:blur-[16px] lg:blur-[10px]"
            style={{ backgroundImage: `url(${heroBackdrop})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-black" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/55" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/65 to-transparent" />
        </div>

        <button type="button" onClick={() => { setArtworkTab('poster'); setArtworkEditor(true); }} className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-xl transition-[transform,background-color] duration-200 hover:bg-white/20 active:scale-95 sm:right-8 sm:top-20 sm:h-11 sm:w-11" aria-label="Artwork settings" title="Artwork settings"><Settings2 className="h-4 w-4 sm:h-[18px] sm:w-[18px]" /></button>
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-12">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
            className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-12"
          >
            <div className="w-full md:w-auto flex-shrink-0 flex justify-center md:justify-start md:-mt-20 order-1 md:order-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="relative ring-1 ring-white/10 bg-white/5 rounded-2xl p-1.5 sm:p-2 shadow-2xl shadow-black/50">
                  {movieDetails.poster_path ? (
                    <ProgressiveImage
                      src={posterUrl}
                      lowSrc={`https://image.tmdb.org/t/p/w92${movieDetails.poster_path}`}
                      alt={movieDetails.title}
                      eager
                      wrapperClassName="w-40 h-56 sm:w-52 sm:h-72 md:w-56 md:h-80 lg:w-64 lg:h-96 rounded-lg"
                      className="h-full w-full object-cover rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-40 h-56 sm:w-52 sm:h-72 md:w-56 md:h-80 lg:w-64 lg:h-96 bg-zinc-900/80 flex flex-col items-center justify-center text-gray-500 rounded-lg">
                      <ImageOff className="w-10 h-10 mb-2 opacity-50" />
                      <p className="text-xs text-center px-3">No Image</p>
                    </div>
                  )}
                  {movieDetails.trailers?.[0] && (
                    <button
                      type="button"
                      onClick={() => setShowTrailerPreview(true)}
                      className="absolute bottom-3 right-3 z-30 flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-black/60 shadow-lg backdrop-blur-xl transition duration-300 hover:scale-105 hover:border-red-500/40 hover:bg-black/80 hover:shadow-[0_0_15px_rgba(239,68,68,0.35)] active:scale-95 sm:bottom-4 sm:right-4 sm:h-9 sm:w-9"
                      aria-label="Play trailer"
                    >
                      <svg
                        className="h-4 w-4 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)] sm:h-[18px] sm:w-[18px]"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 1.96A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.96 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.37z"
                          fill="#FF0000"
                        />
                        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#FFFFFF" />
                      </svg>
                    </button>
                  )}                </div>
              </motion.div>
            </div>

            <div className="flex-1 flex flex-col justify-end w-full text-center md:text-left order-2 md:order-none">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-3 leading-tight tracking-tight"
              >
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  {movieDetails.title}
                </span>
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.45 }}
                className="mb-4"
              >
                <div className="flex items-center justify-center gap-2 text-[15px] font-semibold text-zinc-300 md:hidden">
                  <span>{movieDetails.release_date?.slice(0, 4) || '—'}</span>
                  <span className="text-zinc-600">•</span>
                  <span>{formatRuntime(movieDetails.runtime)}</span>
                  <span className="text-zinc-600">•</span>
                  <span>{language}</span>
                  {movieDetails.certification && <><span className="text-zinc-600">•</span><span>{movieDetails.certification}</span></>}
                  <button
                    type="button"
                    onClick={() => setShowMovieInfo(true)}
                    className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/[0.07] hover:text-white active:scale-95"
                    title="Movie information"
                    aria-label="Movie information"
                  >
                    <Info className="h-[19px] w-[19px] stroke-[2.2]" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-center md:hidden">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 backdrop-blur-md">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-bold text-white">{movieDetails.vote_average.toFixed(1)}</span>
                    <span className="text-[10px] font-semibold text-zinc-500">TMDB</span>
                  </div>
                </div>

                <div className="hidden flex-wrap items-center gap-2 md:flex">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-white font-semibold text-sm">{movieDetails.vote_average.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-white/80 font-medium text-sm">{formatRuntime(movieDetails.runtime)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <span className="text-white/80 font-medium text-sm">{movieDetails.release_date}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMovieInfo(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 backdrop-blur-md transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                    title="Movie information"
                    aria-label="Movie information"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap justify-center md:justify-start gap-2 mb-6"
              >
                {movieDetails.genres.map((g) => (
                  <span
                    key={g.id}
                    className="px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all duration-300"
                  >
                    {g.name}
                  </span>
                ))}
              </motion.div>

              {isUpcoming && (
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black text-amber-300">Releases in {daysUntilRelease} days</span>
                  <button type="button" onClick={() => { setReleaseReminder((value) => !value); showToast(releaseReminder ? 'Release reminder removed' : 'Release reminder saved on this device', 'info'); }} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black transition ${releaseReminder ? 'border-amber-400/30 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/35 text-zinc-400'}`}><Bell className="h-3.5 w-3.5" />{releaseReminder ? 'Reminder On' : 'Notify Me'}</button>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex w-full justify-center md:flex-nowrap md:items-center md:justify-start md:gap-2 lg:gap-2.5"
              >
                <div className="relative flex max-w-full items-center gap-1.5 overflow-hidden rounded-[30px] border border-white/[0.12] bg-black/60 p-2 shadow-[0_18px_46px_rgba(0,0,0,0.50),inset_0_1px_1px_rgba(255,255,255,0.09)] backdrop-blur-2xl md:contents md:overflow-visible">
                  <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent md:hidden" />

                  <WatchedButton
                    movie={movieDetails}
                    onSync={syncWatchlistState}
                    onToast={showToast}
                  />

                  <button
                    type="button"
                    onClick={handleWatchlistToggle}
                    className={`relative group flex h-12 w-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 md:h-auto md:w-auto md:min-h-[46px] md:rounded-2xl md:px-4 md:py-3 md:text-xs md:whitespace-nowrap lg:px-5 lg:text-sm ${isInWatchlist
                      ? 'border border-blue-400/40 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700'
                      : 'border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-200 shadow-black/40 hover:border-blue-500/30 hover:text-white'
                      }`}
                    title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
                    {isInWatchlist ? (
                      <BookmarkCheck className="relative z-10 h-5 w-5 text-blue-50 drop-shadow-[0_0_6px_rgba(255,255,255,0.75)] md:h-4 md:w-4" />
                    ) : (
                      <Bookmark className="relative z-10 h-5 w-5 text-zinc-400 transition-colors duration-300 group-hover:text-blue-500 md:h-4 md:w-4" />
                    )}
                    <span className="relative z-10 hidden md:inline">{isInWatchlist ? 'Saved to Watchlist' : 'Add to Watchlist'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFavoriteToggle}
                    disabled={isUpdatingLibrary}
                    className={`relative group flex h-12 w-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 md:h-auto md:w-auto md:min-h-[46px] md:rounded-2xl md:px-4 md:py-3 md:text-xs md:whitespace-nowrap lg:px-5 lg:text-sm ${isFavorite
                      ? 'border border-red-400/40 bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/30 hover:from-red-600 hover:to-rose-700'
                      : 'border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-200 shadow-black/40 hover:border-red-500/30 hover:text-white'
                      }`}
                    title={isFavorite ? 'Remove from Favourites' : 'Add to Favourites'}
                  >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
                    <Heart className={`relative z-10 h-5 w-5 transition-colors duration-300 md:h-4 md:w-4 ${isFavorite ? 'fill-current text-red-50 drop-shadow-[0_0_6px_rgba(255,255,255,0.75)]' : 'text-zinc-400 group-hover:text-red-500'}`} />
                    <span className="relative z-10 hidden md:inline">{isFavorite ? 'Favourite' : 'Add Favourite'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!user?.uid) {
                        showToast('Please log in to use My List', 'error');
                        return;
                      }
                      setShowMyListPicker(true);
                    }}
                    disabled={isUpdatingLibrary}
                    className={`relative group flex h-12 w-12 shrink-0 items-center justify-center gap-2 overflow-visible rounded-full font-bold text-white transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 md:h-auto md:w-auto md:min-h-[46px] md:overflow-hidden md:rounded-2xl md:px-4 md:py-3 md:text-xs md:whitespace-nowrap lg:px-5 lg:text-sm ${myListFolderIds.size
                      ? 'border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-none md:shadow-xl md:shadow-fuchsia-500/30 hover:from-fuchsia-600 hover:to-violet-700'
                      : 'border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-200 shadow-none md:shadow-xl md:shadow-black/40 hover:border-fuchsia-500/30 hover:text-white'
                      }`}
                    title="Manage Lists"
                  >
                    <div className="hidden md:block absolute inset-0 -translate-x-full rounded-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full md:rounded-none" />

                    <ListChecks className={`relative z-10 h-5 w-5 transition-colors duration-300 md:h-4 md:w-4 ${myListFolderIds.size ? 'text-fuchsia-50 md:drop-shadow-[0_0_6px_rgba(255,255,255,0.75)]' : 'text-zinc-400 group-hover:text-fuchsia-500'}`} />

                    {myListFolderIds.size > 0 && (
                      <span className="absolute -right-1 -top-1 z-20 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white/20 bg-fuchsia-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm md:static md:ml-1 md:h-auto md:min-w-0 md:border-none md:bg-black/20 md:px-1.5 md:py-0.5 md:text-[9px] md:font-semibold md:text-fuchsia-100 md:shadow-none">
                        {myListFolderIds.size}
                      </span>
                    )}

                    <span className="relative z-10 hidden md:inline">Manage Lists</span>
                  </button>

                  <div className="mx-0.5 h-7 w-px bg-white/10 md:hidden" />

                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="relative group flex h-12 w-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 font-bold text-white shadow-xl shadow-black/40 transition-all duration-300 hover:scale-105 hover:border-amber-400/25 active:scale-95 md:h-auto md:w-auto md:min-h-[46px] md:rounded-2xl md:bg-gradient-to-r md:from-zinc-700 md:to-zinc-600 md:px-4 md:py-3 md:text-xs md:whitespace-nowrap md:shadow-zinc-500/25 lg:px-5 lg:text-sm md:hover:from-zinc-600 md:hover:to-zinc-500"
                    title="Share"
                  >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
                    <Share2 className="relative z-10 h-5 w-5 text-amber-400 transition-colors duration-300 group-hover:text-amber-300 md:h-4 md:w-4 md:text-amber-300" />
                    <span className="relative z-10 hidden md:inline">Share</span>
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="flex justify-center md:justify-start"
              >
                <WatchHistoryPill movie={movieDetails} onToast={showToast} />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto mt-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative col-span-1 flex w-full flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.055] to-white/[0.018] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.10),0_18px_52px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-5 md:p-6"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Vibe Chart</h2>
              <p className="mt-0.5 text-[10px] font-medium text-zinc-500 sm:text-xs">Genre distribution</p>
            </div>
            <span className="rounded-full border border-white/[0.07] bg-black/25 px-2.5 py-1 text-[9px] font-semibold text-zinc-500 backdrop-blur-xl sm:text-[10px]">Tap or hover</span>
          </div>

          <div className="flex flex-col items-center gap-5">
            <div className="relative flex aspect-square w-full max-w-[184px] items-center justify-center sm:max-w-[204px] lg:max-w-[214px]">
              <div className="absolute inset-[18%] rounded-full border border-white/[0.07] bg-black/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_8px_26px_rgba(0,0,0,0.30)] backdrop-blur-xl" />
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${chartSize} ${chartSize}`}
                role="img"
                aria-label="Movie genre distribution"
                className="relative z-10 drop-shadow-[0_8px_24px_rgba(0,0,0,0.38)]"
              >
                <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="rgba(255,255,255,0.035)" strokeWidth={strokeW} />
                {(() => {
                  let offset = 0;
                  return segments.map((seg, idx) => {
                    const baseDash = (circumference * seg.value) / 100;
                    const adjusted = Math.max(0, baseDash - gapPx);
                    const dashOffset = -offset;
                    offset += baseDash;
                    const isActive = seg.id === activeGenreId;
                    const anyActive = activeGenreId !== null;
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    return (
                      <circle
                        key={seg.id}
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={isActive ? strokeW + 5 : strokeW}
                        strokeLinecap="butt"
                        strokeDasharray={`${adjusted} ${circumference - adjusted}`}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(-90 ${cx} ${cy})`}
                        style={{
                          filter: isActive ? `drop-shadow(0 0 14px ${color}80)` : `drop-shadow(0 2px 4px ${color}20)`,
                          opacity: !anyActive || isActive ? 1 : 0.28,
                          transition: 'all 320ms cubic-bezier(0.16, 1, 0.3, 1)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={() => setActiveGenreId(seg.id)}
                        onMouseLeave={() => setActiveGenreId(null)}
                        onFocus={() => setActiveGenreId(seg.id)}
                        onBlur={() => setActiveGenreId(null)}
                        onClick={() => setActiveGenreId((current) => current === seg.id ? null : seg.id)}
                        tabIndex={0}
                        aria-label={`${seg.name}: ${seg.value.toFixed(0)}%`}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-8 text-center">
                <span className="max-w-[110px] truncate text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500 sm:text-[10px]">
                  {activeSegment?.name ?? 'Genres'}
                </span>
                <span className="mt-1 text-2xl font-black tracking-tight text-white tabular-nums sm:text-3xl">
                  {activeSegment ? `${activeSegment.value.toFixed(0)}%` : `${segments.length}`}
                </span>
                {!activeSegment && <span className="mt-0.5 text-[9px] font-semibold text-zinc-600">signals</span>}
              </div>
            </div>

            <ul className="grid w-full grid-cols-2 gap-2 lg:grid-cols-1">
              {segments.map((segment, idx) => {
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                const isActive = segment.id === activeGenreId;
                const anyActive = activeGenreId !== null;
                return (
                  <li key={segment.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveGenreId(segment.id)}
                      onMouseLeave={() => setActiveGenreId(null)}
                      onFocus={() => setActiveGenreId(segment.id)}
                      onBlur={() => setActiveGenreId(null)}
                      onClick={() => setActiveGenreId((current) => current === segment.id ? null : segment.id)}
                      className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all duration-300 active:scale-[0.99] ${isActive ? 'border-white/[0.12] bg-white/[0.07] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]' : 'border-white/[0.045] bg-black/20 hover:border-white/[0.09] hover:bg-white/[0.035]'}`}
                      style={{ opacity: !anyActive || isActive ? 1 : 0.48 }}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color, boxShadow: isActive ? `0 0 12px ${color}` : `0 0 6px ${color}35` }}
                      />
                      <span className={`min-w-0 flex-1 truncate text-[11px] font-semibold sm:text-xs ${isActive ? 'text-white' : 'text-zinc-400'}`}>{segment.name}</span>
                      <span className={`text-[10px] font-bold tabular-nums sm:text-[11px] ${isActive ? 'text-zinc-200' : 'text-zinc-600'}`}>{segment.value.toFixed(0)}%</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative lg:col-span-2 w-full bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden group flex flex-col justify-between gap-8"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent blur-sm pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-gradient-to-br from-red-600/5 via-orange-600/5 to-transparent rounded-full blur-3xl opacity-60 group-hover:opacity-80 transition-opacity duration-700 pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-xl md:text-2xl font-black mb-4 text-white tracking-tight">Synopsis</h2>
            {movieDetails.overview ? (
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed tracking-wide">
                {movieDetails.overview}
              </p>
            ) : (
              <p className="text-sm text-zinc-600 italic font-medium">
                An official synopsis has not yet been recorded for this film.
              </p>
            )}
          </div>

          <div className="relative z-10 pt-6 border-t border-white/[0.06]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-white/[0.02] border border-white/[0.02] rounded-2xl hover:bg-white/[0.04] transition-colors duration-300">
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Language</dt>
                <dd className="text-zinc-200 font-semibold text-sm">{language}</dd>
              </div>
              <div className="p-3.5 bg-white/[0.02] border border-white/[0.02] rounded-2xl hover:bg-white/[0.04] transition-colors duration-300">
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Box Office</dt>
                <dd className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                  <span>{boxOffice}</span>
                </dd>
              </div>
              <div className="p-3.5 bg-white/[0.02] border border-white/[0.02] rounded-2xl hover:bg-white/[0.04] transition-colors duration-300">
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Director</dt>
                <dd className="text-sm font-semibold">
                  {movieDetails.directorId ? (
                    <Link to={`/talent/${movieDetails.directorId}`} className="inline-flex items-center gap-1.5 text-zinc-200 transition-colors hover:text-amber-300">
                      <span>{movieDetails.director}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                    </Link>
                  ) : (
                    <span className="text-zinc-200">{movieDetails.director}</span>
                  )}
                </dd>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {providerRegions.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-8" id="watch">
          <div className="rounded-[28px] border border-white/[0.07] bg-zinc-950/55 p-5 shadow-2xl backdrop-blur-3xl sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white sm:text-2xl">Where to Watch</h2><p className="mt-1 text-xs text-zinc-500">Availability varies by region</p></div><select value={effectiveProviderRegion} onChange={(e) => setProviderRegion(e.target.value)} className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-bold text-zinc-200 outline-none">{providerRegions.map((code) => <option key={code} value={code}>{code === 'IN' ? '🇮🇳 India' : `${countryFlag(code)} ${code}`}</option>)}</select></div>
            <div className="grid gap-3 md:grid-cols-3">{[['Stream', 'flatrate'], ['Rent', 'rent'], ['Buy', 'buy']].map(([label, key]) => { const providers = selectedProviders?.[key] || []; return <div key={key} className="rounded-2xl border border-white/[0.06] bg-black/25 p-4"><p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>{providers.length ? <div className="flex flex-wrap gap-2">{providers.map((provider: any) => <div key={`${key}-${provider.provider_id}`} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] p-2 pr-3"><img src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt="" className="h-8 w-8 rounded-lg" /><span className="text-[10px] font-bold text-zinc-300">{provider.provider_name}</span></div>)}</div> : <p className="text-xs text-zinc-600">Not listed</p>}</div>; })}</div>
          </div>
        </section>
      )}

      {keyCreators.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 md:px-8"><div className="mb-4"><h2 className="text-xl font-black text-white sm:text-2xl">Key Creators</h2><p className="mt-1 text-xs text-zinc-500">The core creative team behind the film</p></div><div className="flex gap-3 overflow-x-auto pb-2">{keyCreators.map((creator: any) => <Link key={creator.id} to={`/talent/${creator.id}`} className="flex min-w-[210px] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"><div className="h-12 w-12 overflow-hidden rounded-xl bg-zinc-900">{creator.profile_path ? <img src={`https://image.tmdb.org/t/p/w185${creator.profile_path}`} alt="" className="h-full w-full object-cover" /> : <Users className="m-3 h-6 w-6 text-zinc-700" />}</div><div className="min-w-0"><p className="truncate text-xs font-black text-white">{creator.name}</p><p className="mt-1 line-clamp-1 text-[9px] font-bold uppercase tracking-wide text-amber-400/75">{creator.jobs.filter((job: string) => ['Director', 'Writer', 'Screenplay', 'Original Music Composer', 'Director of Photography'].includes(job)).join(' · ')}</p></div></Link>)}</div></section>
      )}

      <ProductionMediaTrailers
        trailers={movieDetails.trailers}
        backdrops={movieDetails.images.backdrops}
        posters={movieDetails.images.posters}
        title={movieDetails.title}
        mediaType="movie"
      />

      {user && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 md:px-8 md:pt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Lists</h2>
              <p className="mt-1 text-[13px] font-medium text-zinc-400">Your collections featuring this title</p>
            </div>
            <button
              type="button"
              onClick={() => setShowMyListPicker(true)}
              className="rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              Manage
            </button>
          </div>

          {featuredListFolders.length ? (
            <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-12 pt-4 no-scrollbar sm:mx-0 sm:px-0">
              {featuredListFolders.map((folder) => {
                const previewPaths = [...new Set([...(folder.posterPaths || []), movieDetails.poster_path])].filter(Boolean).slice(0, 3);
                return (
                  <Link
                    key={folder.id}
                    to="/mylist"
                    className="group relative block w-[82vw] max-w-[340px] shrink-0 snap-center sm:w-[320px]"
                  >
                    <div className="relative w-full aspect-[4/3.4]">
                      <svg className="absolute w-0 h-0">
                        <defs>
                          <clipPath id={`folder-clip-${folder.id}`} clipPathUnits="objectBoundingBox">
                            <path d="M 0 0.15 C 0 0.05 0.05 0 0.15 0 L 0.35 0 C 0.4 0 0.45 0.05 0.5 0.15 L 0.55 0.2 C 0.6 0.25 0.65 0.25 0.7 0.25 L 0.85 0.25 C 0.95 0.25 1 0.3 1 0.35 L 1 0.85 C 1 0.95 0.95 1 0.85 1 L 0.15 1 C 0.05 1 0 0.95 0 0.85 Z" />
                          </clipPath>
                        </defs>
                      </svg>

                      <div className="absolute inset-x-0 top-0 bottom-[25%] flex justify-center items-end">
                        {[0, 1, 2].map((index) => {
                          const path = previewPaths[index] || previewPaths[0];
                          const rotations = ['-rotate-[14deg] -translate-x-[28%] translate-y-[8%]', 'rotate-[14deg] translate-x-[28%] translate-y-[8%]', 'rotate-0 -translate-y-1'];
                          const zIndexes = ['z-10', 'z-10', 'z-20'];
                          return path ? (
                            <div
                              key={`${folder.id}-${index}`}
                              className={`absolute h-[85%] w-[45%] overflow-hidden rounded-[20px] border border-white/20 bg-zinc-800 shadow-[0_12px_24px_rgba(0,0,0,0.4)] transition-all duration-500 group-hover:-translate-y-3 ${rotations[index]} ${zIndexes[index]}`}
                              style={{
                                backgroundImage: `url(https://image.tmdb.org/t/p/w500${path.startsWith('/') ? path : `/${path}`})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                              }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-40" />
                            </div>
                          ) : null;
                        })}
                      </div>

                      <div
                        className="absolute inset-x-0 bottom-0 h-[75%] z-30 overflow-hidden"
                        style={{
                          clipPath: `url(#folder-clip-${folder.id})`,
                          filter: 'drop-shadow(0 24px 32px rgba(0,0,0,0.5))'
                        }}
                      >
                        <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-3xl backdrop-saturate-150" />
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-transparent opacity-80" />
                        <div className="absolute top-0 left-0 w-2/3 h-1/3 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.3),transparent_60%)] mix-blend-overlay" />

                        <div className="absolute inset-0 border border-white/20 opacity-40" style={{ clipPath: `url(#folder-clip-${folder.id})` }} />

                        <div className="relative z-10 flex h-full flex-col justify-between p-5 pt-12 sm:p-6 sm:pt-14">
                          <div>
                            <h3 className="truncate text-[17px] font-bold text-white tracking-tight">{folder.name}</h3>
                            <div className="mt-1.5 flex items-center gap-2 text-[12px] font-medium text-zinc-400">
                              {userPhoto ? (
                                <img src={userPhoto} alt="" className="h-5 w-5 rounded-full object-cover border border-white/20 shadow-sm" />
                              ) : (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-white border border-white/20 shadow-sm">
                                  {(user.displayName || 'U').slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <span className="truncate">{user.displayName || 'Your list'}</span>
                            </div>
                            <p className="mt-1 text-[11px] font-medium text-zinc-500">
                              {previewPaths.length} {previewPaths.length === 1 ? 'title' : 'titles'}
                            </p>
                          </div>

                          <div className="flex items-end justify-between mt-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 shadow-[0_8px_16px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.5)] backdrop-blur-xl border border-white/30 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
                              <ArrowUpRight className="h-5 w-5 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMyListPicker(true)}
              className="group relative flex w-full max-w-xl items-center gap-5 overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-4 text-left shadow-[0_16px_32px_-10px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl transition hover:bg-white/10"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-zinc-900 shadow-inner">
                <img src={posterUrl} alt="" className="h-full w-full object-cover opacity-90 blur-[0.5px] transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 border border-white/30 backdrop-blur-md shadow-lg">
                    <ListChecks className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-white">Add to one of your lists</p>
                <p className="mt-1 text-[13px] leading-snug font-medium text-zinc-400">Create a curated collection around this movie or add it to an existing list.</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-md transition group-hover:bg-white/20">
                <ChevronRight className="h-5 w-5 text-white" />
              </div>
            </button>
          )}
        </section>
      )}

      <div className="container mx-auto px-4 py-8 space-y-8 md:space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-3.5 sm:p-5 md:p-6"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
              <TvMinimalPlay className="h-[17px] w-[17px] text-[#EEF1F6]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-[#EEF1F6]">
                Watch Now
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#7D8798]">
                Choose your preferred player
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

            <div className="order-2 min-w-0 flex-1 lg:order-1">
              <div className="relative w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black">
                <div className="relative aspect-video w-full">
                  {VideoPlayer}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 px-0.5">
                <p className="text-[11px] leading-relaxed text-[#7D8798]">
                  For the best experience, use fullscreen mode.
                </p>

                <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-[#9AA3B2]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Player ready
                </span>
              </div>
            </div>

            <div className="order-1 w-full shrink-0 lg:order-2 lg:w-[260px] xl:w-[280px]">
              <div className="h-full rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#7D8798]">
                  Media Sources
                </h3>

                <div id="media" className="w-full">
                  <PlayerControl
                    source={playerSource}
                    onChange={setPlayerSource}
                    vertical
                  />
                </div>
              </div>
            </div>

          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-10 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />

          <div className="flex items-center gap-3.5 mb-6 relative z-10">
            <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
              <Users className="w-5 h-5 text-blue-500 stroke-[1.5]" />
            </div>
            <div>
              <h2 id="cast" className="text-xl md:text-2xl font-black text-white tracking-tight">Top Cast</h2>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">Performers</span>
            </div>
          </div>

          <div
            ref={castContainerRef}
            className="overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory scroll-smooth relative z-10"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex items-center gap-4 sm:gap-5 px-1">
              {movieDetails.cast?.map((talent: any, idx: number) => {
                const category = talent.category || (idx < 3 ? 'Lead' : 'Supporting');
                const prevCategory =
                  idx > 0
                    ? (movieDetails.cast as any)[idx - 1].category || (idx - 1 < 3 ? 'Lead' : 'Supporting')
                    : null;
                const isFirstOfCategory = idx === 0 || category !== prevCategory;

                return (
                  <React.Fragment key={talent.id}>
                    {isFirstOfCategory && (
                      <div
                        key={`divider-${category}`}
                        className="flex-shrink-0 snap-start flex items-center h-[240px] sm:h-[280px] mr-1 sm:mr-2"
                      >
                        <div className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                        <div className="flex items-center pl-1 pr-0.5">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-blue-500/80 -rotate-90 whitespace-nowrap">
                            {category}
                          </span>
                        </div>
                      </div>
                    )}

                    <Link to={`/talent/${talent.id}`} className="flex-shrink-0 snap-start group/card">
                      <SpatialCard containerRef={castContainerRef} index={idx}>
                        <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden w-[135px] sm:w-[175px] md:w-[185px] transition-all duration-500 group-hover/card:bg-white/[0.05] group-hover/card:border-blue-500/30 group-hover/card:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                          <div className="absolute -top-10 -left-10 w-28 h-28 bg-blue-500/0 rounded-full blur-xl opacity-0 group-hover/card:opacity-30 group-hover/card:bg-blue-500 transition-all duration-500 pointer-events-none" />

                          <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950 group-hover/card:border-blue-500/20 transition-colors duration-500">
                            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/15 to-transparent -translate-x-full -translate-y-full group-hover/card:translate-x-full group-hover/card:translate-y-full transition-transform duration-1000 ease-in-out z-10 pointer-events-none" />

                            {talent.profile_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w780${talent.profile_path}`}
                                alt={talent.name}
                                className="w-full h-full object-cover scale-[1.01] group-hover/card:scale-105 group-hover/card:brightness-[1.05] transition-all duration-700"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                                <ImageOff className="w-7 h-7 mb-1.5 opacity-30" />
                                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                                  No Photo
                                </span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
                          </div>

                          <div className="px-3.5 pb-4 pt-2 flex flex-col items-center text-center">
                            <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight line-clamp-1 group-hover/card:text-blue-400 transition-colors duration-300">
                              {talent.name}
                            </h3>
                            <div className="mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] inline-block max-w-full">
                              <p className="text-[10px] text-zinc-400 font-semibold tracking-wide line-clamp-1">
                                {talent.role || 'Character'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </SpatialCard>
                    </Link>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2 text-zinc-500 text-[10px] md:hidden font-bold uppercase tracking-widest">
            <span>Swipe to explore</span>
            <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
              <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.02, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-10 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />

          <div className="flex items-center gap-3.5 mb-6 relative z-10">
            <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
              <Award className="w-5 h-5 text-amber-400 stroke-[1.5]" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Crew</h2>
              <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">Production Team</span>
            </div>
          </div>

          <div
            ref={crewContainerRef}
            className="overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory scroll-smooth relative z-10"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex items-center gap-4 sm:gap-5 px-1">
              {(() => {
                const getCategoryLabel = (item: any) => {
                  if (!item) return 'CREW';
                  const dept = (item.category || item.department || item.known_for_department || '').toUpperCase();

                  if (dept.includes('DIRECT')) return 'DIRECTING';
                  if (dept.includes('PRODUC')) return 'PRODUCERS';

                  return 'CREW';
                };

                const getPriority = (item: any) => {
                  const label = getCategoryLabel(item);
                  if (label === 'DIRECTING') return 1;
                  if (label === 'PRODUCERS') return 2;
                  return 3;
                };

                const sortedCrew = [...groupedCrew].sort((a, b) => getPriority(a) - getPriority(b));

                return sortedCrew.map((member: any, idx: number) => {
                  const category = getCategoryLabel(member);
                  const prevCategory = idx > 0 ? getCategoryLabel(sortedCrew[idx - 1]) : null;
                  const isFirstOfCategory = idx === 0 || category !== prevCategory;

                  return (
                    <React.Fragment key={member.credit_id || idx}>
                      {isFirstOfCategory && (
                        <div
                          key={`divider-${category}`}
                          className="flex-shrink-0 snap-start flex items-center h-[240px] sm:h-[280px] mr-1 sm:mr-2"
                        >
                          <div className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                          <div className="flex items-center pl-1 pr-0.5">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-amber-500/80 -rotate-90 whitespace-nowrap">
                              {category}
                            </span>
                          </div>
                        </div>
                      )}

                      <Link to={`/talent/${member.id}`} className="flex-shrink-0 snap-start group/card">
                        <SpatialCard containerRef={crewContainerRef} index={idx}>
                          <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden w-[135px] sm:w-[175px] md:w-[185px] transition-all duration-500 group-hover/card:bg-white/[0.05] group-hover/card:border-amber-500/30 group-hover/card:shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                            <div className="absolute -top-10 -left-10 w-28 h-28 bg-amber-500/0 rounded-full blur-xl opacity-0 group-hover/card:opacity-30 group-hover/card:bg-amber-500 transition-all duration-500 pointer-events-none" />
                            <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950 group-hover/card:border-amber-500/20 transition-colors duration-500">
                              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/15 to-transparent -translate-x-full -translate-y-full group-hover/card:translate-x-full group-hover/card:translate-y-full transition-transform duration-1000 ease-in-out z-10 pointer-events-none" />

                              {member.profile_path ? (
                                <ProgressiveImage
                                  src={`https://image.tmdb.org/t/p/w780${member.profile_path}`}
                                  lowSrc={`https://image.tmdb.org/t/p/w92${member.profile_path}`}
                                  alt={member.name}
                                  wrapperClassName="w-full h-full"
                                  className="w-full h-full object-cover scale-[1.01] group-hover/card:scale-105 group-hover/card:brightness-[1.05] transition-all duration-700"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                                  <ImageOff className="w-7 h-7 mb-1.5 opacity-30" />
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                                    No Photo
                                  </span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
                            </div>

                            <div className="px-3.5 pb-4 pt-2 flex flex-col items-center text-center">
                              <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight line-clamp-1 group-hover/card:text-amber-400 transition-colors duration-300">
                                {member.name}
                              </h3>
                              <div className="mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] inline-block max-w-full">
                                <p className="text-[10px] text-zinc-400 font-semibold tracking-wide line-clamp-1">
                                  {Array.isArray(member.jobs)
                                    ? `${member.jobs.slice(0, 2).join(', ')}${member.jobs.length > 2 ? ` +${member.jobs.length - 2}` : ''}`
                                    : member.job || 'Crew'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </SpatialCard>
                      </Link>
                    </React.Fragment>
                  );
                });
              })()}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2 text-zinc-500 text-[10px] md:hidden font-bold uppercase tracking-widest">
            <span>Swipe to explore</span>
            <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
              <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
            </div>
          </div>
        </motion.section>
        <MovieCollection
          movieParts={movieParts}
          collectionName={collectionName}
          watchedMovieIds={watchedMovieIds}
          SpatialCard={SpatialCard}
        />
        <div id="similar">
          <SimilarTitles
            mediaType="movie"
            currentId={movieDetails.id}
            genreIds={genres.map((g) => g.id)}
          />
        </div>
        {ratingHistory.length > 1 && (
          <section className="rounded-3xl border border-white/[0.07] bg-zinc-950/55 p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">Rating Evolution</p><p className="mt-1 text-sm font-black text-white">{ratingHistory[ratingHistory.length - 2].rating.toFixed(1)} → {ratingHistory[ratingHistory.length - 1].rating.toFixed(1)}</p></div><div className="flex h-16 items-end gap-1">{ratingHistory.slice(-8).map((entry, index) => <div key={index} className="w-2 rounded-t-sm bg-gradient-to-t from-amber-600 to-amber-300" style={{ height: `${Math.max(10, entry.rating * 6)}px` }} title={`${entry.rating}/10`} />)}</div></div></section>
        )}
        <MediaRating
          userRating={userRating}
          hasSavedRating={hasSavedRating}
          editingRating={editingRating}
          onRate={handleRateMovie}
          onSubmit={handleRatingSubmit}
          onEdit={handleEditRating}
          onCancelEdit={handleCancelEditRating}
          onDeleteRating={handleDeleteRating}
          onShare={() => setShareOpen(true)}
          mediaType="movie"
        />
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl bg-zinc-950 p-6 sm:p-8 text-zinc-100 border border-zinc-800/60 shadow-2xl font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Segoe_UI',Roboto,sans-serif] antialiased"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-zinc-800/40">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-600 border border-emerald-400/30 text-white shrink-0 shadow-md">
                <SquarePen className="w-5 h-5 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
                  Your Review
                </h2>
                <p className="text-xs text-zinc-400 font-normal mt-0.5">
                  Write your thoughts or update your entry for this title
                </p>
              </div>
            </div>

            {userExistingReview && !isEditingUserReview && !isLoadingUserReview && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Saved
              </span>
            )}
          </div>

          {!user ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-zinc-800/40 bg-zinc-900/30">
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 mb-3">
                <Lock className="w-5 h-5 stroke-[1.75]" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200">
                Sign In to Share Your Thoughts
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                Log in to write critiques, save entries, and join the conversation.
              </p>
            </div>
          ) : isLoadingUserReview ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span className="text-xs font-medium text-zinc-500 tracking-wide">
                Fetching review data...
              </span>
            </div>
          ) : userExistingReview && !isEditingUserReview ? (
            <div className="relative rounded-2xl bg-zinc-900/40 border border-zinc-800/50 p-5 overflow-hidden backdrop-blur-md">
              {userExistingReview.posterPath && (
                <div className="absolute top-0 right-0 bottom-0 w-1/3 opacity-10 pointer-events-none">
                  <img
                    src={`https://image.tmdb.org/t/p/w500${userExistingReview.posterPath}`}
                    alt=""
                    className="w-full h-full object-cover grayscale"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent to-zinc-950" />
                </div>
              )}

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={userPhoto || '/user-icon.jpg'}
                      alt={userExistingReview.author}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <div>
                      <h4 className="text-xs font-medium text-zinc-200">
                        {userExistingReview.author}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-0.5">
                        <Calendar className="w-3 h-3 text-green-600 stroke-[1.75]" />
                        <span>
                          {userExistingReview.timestamp?.seconds
                            ? new Date(userExistingReview.timestamp.seconds * 1000).toLocaleDateString(
                              undefined,
                              { month: 'short', day: 'numeric', year: 'numeric' }
                            )
                            : 'Recently'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => setReviewShareOpen(true)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-amber-400/10 active:scale-95 transition-all"
                      title="Share review"
                    >
                      <Share2 className="w-3.5 h-3.5 stroke-[1.75]" />
                    </button>
                    <button
                      type="button"
                      onClick={handleEditUserReview}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
                      title="Edit review"
                    >
                      <Edit2 className="w-3.5 h-3.5 stroke-[1.75]" />
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingReview}
                      onClick={handleDeleteUserReview}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all disabled:opacity-50"
                      title="Delete review"
                    >
                      {isDeletingReview ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 my-2">
                  <Quote className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5 scale-x-[-1] scale-y-[-1] stroke-[1.75]" />
                  <div className="relative flex-1">
                    <blockquote className={`text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal italic transition ${userExistingReview.spoiler && !revealOwnSpoiler ? 'select-none blur-[7px]' : ''}`}>{userExistingReview.content}</blockquote>
                    {userExistingReview.spoiler && !revealOwnSpoiler && <button type="button" onClick={() => setRevealOwnSpoiler(true)} className="absolute inset-0 m-auto h-9 w-fit rounded-full border border-amber-400/20 bg-black/75 px-4 text-[10px] font-black text-amber-300 backdrop-blur-xl">Reveal spoiler</button>}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/40">
                  <span className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase bg-zinc-800/40 px-2.5 py-1 rounded-full border border-zinc-700/30">
                    {userExistingReview.mediaType === 'tv' ? 'TV Series' : 'Feature Film'}
                  </span>

                  {userExistingReview.rating && (
                    <div className="flex items-center gap-1 text-amber-400 font-semibold text-xs">
                      <Star className="w-3.5 h-3.5 fill-amber-400 stroke-none" />
                      <span>{userExistingReview.rating.toFixed(1)}</span>
                      <span className="text-zinc-600 font-normal">/ 10</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : isEditingUserReview ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl bg-zinc-900/60 border border-emerald-500/30 p-3.5 focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all">
                <textarea
                  className="w-full bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none min-h-[110px] font-normal leading-relaxed"
                  rows={4}
                  value={editReviewContent}
                  onChange={(e) => setEditReviewContent(e.target.value)}
                  maxLength={1000}
                  placeholder="Edit your review content..."
                />
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                  <span>{editReviewContent.length} / 1000</span>
                  <span className="text-emerald-400 font-medium">Editing</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEditUserReview}
                  disabled={isUpdatingUserReview}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateUserReview}
                  disabled={editReviewContent.trim().length === 0 || isUpdatingUserReview}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 transition-all disabled:opacity-50"
                >
                  {isUpdatingUserReview ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  <span>Save Update</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-3.5 focus-within:border-zinc-700 focus-within:bg-zinc-900/90 transition-all">
                <textarea
                  className="w-full bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none min-h-[110px] font-normal leading-relaxed"
                  rows={4}
                  placeholder="What were your thoughts on the cinematography, pacing, or story structure?"
                  value={userReview}
                  onChange={(e) => setUserReview(e.target.value)}
                  maxLength={1000}
                />
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                  <span>{userReview.length} / 1000</span>
                  {userReview.length > 0 && (
                    <span className="text-emerald-400 font-medium">Ready</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <button type="button" onClick={() => setReviewSpoiler((value) => !value)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold transition ${reviewSpoiler ? 'border-amber-400/25 bg-amber-400/10 text-amber-300' : 'border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-300'}`}><EyeOff className="h-3.5 w-3.5" />{reviewSpoiler ? 'Marked as spoiler' : 'Mark as spoiler'}</button>
                <button
                  type="button"
                  onClick={handleReviewSubmit}
                  disabled={userReview.trim().length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                >
                  <span>Post Review</span>
                  <Send className="w-3.5 h-3.5 stroke-[2]" />
                </button>
              </div>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tl from-purple-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-white/[0.04]">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                <MessageCircle className="w-5 h-5 text-blue-400 stroke-[1.5]" />
              </div>
              <div>
                <h2 id="reviews" className="text-xl md:text-2xl font-black text-white tracking-tight">User Reviews</h2>
                <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">Community Discussion</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-zinc-950/40 p-1 rounded-xl border border-white/[0.03]">
              <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase pl-2">Sort by</span>
              <div className="flex items-center gap-1">
                {(['mostHelpful', 'mostRecent'] as const).map((option) => (
                  <motion.button
                    key={option}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSortOption(option)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition-all duration-300 ${sortOption === option
                      ? 'bg-white/[0.05] text-white border border-white/[0.08]'
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                      }`}
                  >
                    {option === 'mostHelpful' ? 'Helpful' : 'Recent'}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative space-y-4 z-10">
            {sortedReviews.length > 0 ? (
              sortedReviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative bg-white/[0.01] rounded-2xl p-5 border border-white/[0.03] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-500"
                >
                  <div className="absolute left-0 top-6 bottom-6 w-[2px] bg-gradient-to-b from-blue-500/40 to-purple-500/40 rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="flex items-start justify-between mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-black text-sm">
                          {review.author.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-zinc-200 group-hover:text-blue-400 transition-colors duration-300">
                        {review.author}
                      </h3>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md hover:bg-white/5 transition-all"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="w-4 h-4 stroke-[1.5]" />
                    </motion.button>
                  </div>

                  <p className="text-zinc-300 text-xs md:text-sm leading-relaxed mb-4 font-normal tracking-wide line-clamp-4 group-hover:line-clamp-none transition-all duration-500">
                    {review.content}
                  </p>

                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleUpvote(index)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.08] text-emerald-400 rounded-lg border border-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 stroke-[1.5]" />
                      <span className="text-[11px] font-mono font-bold">{review.likes ?? 0}</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDownvote(index)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/[0.03] hover:bg-rose-500/[0.08] text-rose-400 rounded-lg border border-rose-500/10 hover:border-rose-500/30 transition-all duration-300"
                    >
                      <ThumbsDown className="w-3.5 h-3.5 stroke-[1.5]" />
                      <span className="text-[11px] font-mono font-bold">{review.dislikes ?? 0}</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 border border-dashed border-white/[0.03] rounded-2xl bg-white/[0.005]"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-3.5">
                  <MessageCircle className="w-5 h-5 text-zinc-600 stroke-[1.5]" />
                </div>
                <h4 className="text-zinc-300 text-sm font-bold tracking-tight mb-0.5">No reviews yet</h4>
                <p className="text-zinc-500 text-xs font-medium max-w-xs mx-auto">
                  Be the first to share your thoughts on this film.
                </p>
              </motion.div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default MovieDetails;
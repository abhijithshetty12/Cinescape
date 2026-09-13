import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase.ts';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Star, Trash2, LucideCalendarDays, MessageSquare, Quote, Edit3, X, Check, Clapperboard, Tv, Loader2, Film, Share2, Download, Edit2, Heart, Pencil, Sparkles, RotateCcw, MoreHorizontal, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as htmlToImage from 'html-to-image';

interface ReviewItem {
  id: string;
  content: string;
  author: string;
  timestamp: any;
  title?: string;
  rating?: number;
  movieId?: string;
  posterPath?: string;
  mediaType?: 'movie' | 'tv';
}

interface HistoryMeta {
  latestWatchedDate: Date | null;
  watchCount: number;
}

interface ShareMediaImage {
  file_path: string;
  vote_count?: number;
  vote_average?: number;
  width?: number;
  height?: number;
}

type ArtworkTab = 'poster' | 'backdrop';

const TMDB_API_KEY = '859afbb4b98e3b467da9c99ac390e950';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const normalizeImageUrl = (value?: string | null, size = 'original') => {
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
};

const uniqueUrls = (urls: string[]) => Array.from(new Set(urls.filter(Boolean)));

const preloadImage = (src?: string | null) =>
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

const getReviewMediaKey = (review: ReviewItem) =>
  `${review.mediaType === 'tv' ? 'tv' : 'movie'}-${String(review.movieId || '')}`;

const historyValueToDate = (value: any) => {
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

const formatReviewDate = (value: any) => {
  const date = historyValueToDate(value);
  return date
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recent';
};

const getHistoryMediaKey = (data: any, fallbackId?: string) => {
  const fallbackMatch = typeof fallbackId === 'string' ? fallbackId.match(/^(movie|tv)[-_](\d+)$/i) : null;
  const rawId = data?.mediaId ?? data?.movieId ?? fallbackMatch?.[2] ?? fallbackId ?? '';
  const numericId = Number(rawId);
  if (!Number.isFinite(numericId) || numericId <= 0) return '';
  const mediaType = data?.mediaType === 'tv' || data?.type === 'tv' || fallbackMatch?.[1] === 'tv' ? 'tv' : 'movie';
  return `${mediaType}-${numericId}`;
};

const getHistoryMeta = (data: any): HistoryMeta => {
  const values = Array.isArray(data?.watchedDates) ? [...data.watchedDates] : [];
  const fallback = data?.watchedDate ?? data?.timestamp ?? data?.createdAt;
  if (fallback) values.push(fallback);
  const uniqueDates = new Map<number, Date>();
  values.forEach((value) => {
    const date = historyValueToDate(value);
    if (date) uniqueDates.set(date.getTime(), date);
  });
  const dates = [...uniqueDates.values()].sort((a, b) => a.getTime() - b.getTime());
  return {
    latestWatchedDate: dates.length ? dates[dates.length - 1] : null,
    watchCount: dates.length,
  };
};

const getFiveStarRating = (rating?: number) => {
  if (rating === undefined || Number.isNaN(rating)) return 0;
  const normalized = rating > 5 ? rating / 2 : rating;
  return Math.max(0, Math.min(5, normalized));
};

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
                <Star className="absolute left-0 top-0 fill-amber-500 text-amber-500 drop-shadow-[0_0_8px_rgba(252,211,77,0.34)]" style={{ width: size, height: size, maxWidth: 'none' }} strokeWidth={1.8} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ReviewList = ({
  userId,
  compact = false,
}: {
  userId: string;
  compact?: boolean;
}) => {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [shareReview, setShareReview] = useState<ReviewItem | null>(null);
  const [mobileActionsReview, setMobileActionsReview] = useState<ReviewItem | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [historyMetaByKey, setHistoryMetaByKey] = useState<Map<string, HistoryMeta>>(new Map());
  const [shareArtworkSelector, setShareArtworkSelector] = useState<ArtworkTab | null>(null);
  const [shareSelectedPoster, setShareSelectedPoster] = useState('');
  const [shareSelectedBackdrop, setShareSelectedBackdrop] = useState('');
  const [sharePosterImages, setSharePosterImages] = useState<ShareMediaImage[]>([]);
  const [shareBackdropImages, setShareBackdropImages] = useState<ShareMediaImage[]>([]);
  const [shareBaseBackdrop, setShareBaseBackdrop] = useState('');
  const [shareReleaseYear, setShareReleaseYear] = useState('');
  const [shareArtworkLoading, setShareArtworkLoading] = useState(false);
  const storyCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userId) return;

    const userUnsubscribe = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        setUserPhoto(snap.data().photoDataUrl ?? null);
      }
    });

    const reviewsRef = collection(db, `users/${userId}/reviews`);
    const ratingsRef = collection(db, `users/${userId}/ratings`);
    const reviewsQuery = query(reviewsRef, orderBy('timestamp', 'desc'));

    let ratingsMap: Record<string, number> = {};
    let reviewDocs: any[] = [];

    const syncReviewsWithRatings = () => {
      const reviewArr = reviewDocs.map((docSnap) => {
        const data = docSnap.data();
        const mId = String(data.movieId ?? '');
        const dynamicRating = ratingsMap[mId] ?? data.rating ?? undefined;

        return {
          id: docSnap.id,
          content: data.content ?? '',
          author: data.author ?? 'Unknown',
          timestamp: data.timestamp ?? null,
          title: data.title ?? '',
          rating: dynamicRating,
          movieId: data.movieId ?? undefined,
          posterPath: data.posterPath ?? undefined,
          mediaType: data.mediaType ?? 'movie',
        };
      });
      setReviews(reviewArr);
    };

    const ratingsUnsubscribe = onSnapshot(ratingsRef, (snapshot) => {
      const map: Record<string, number> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        map[docSnap.id] = data.rating ?? data.value ?? (typeof data === 'number' ? data : 0);
      });
      ratingsMap = map;
      syncReviewsWithRatings();
    });

    const reviewsUnsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      reviewDocs = snapshot.docs;
      syncReviewsWithRatings();
    });

    return () => {
      userUnsubscribe();
      ratingsUnsubscribe();
      reviewsUnsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const favoritesRef = collection(db, `users/${userId}/favouriteMedia`);
    return onSnapshot(
      favoritesRef,
      (snapshot) => {
        const next = new Set<string>();
        snapshot.docs.forEach((favoriteDoc) => {
          const data = favoriteDoc.data();
          const type = data.mediaType === 'tv' ? 'tv' : 'movie';
          const mediaId = data.mediaId ?? data.movieId ?? favoriteDoc.id.replace(/^(movie|tv)-/, '');
          next.add(`${type}-${String(mediaId)}`);
        });
        setFavoriteKeys(next);
      },
      () => setFavoriteKeys(new Set()),
    );
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setHistoryMetaByKey(new Map());
      return;
    }
    const historyRef = collection(db, `users/${userId}/history`);
    return onSnapshot(
      historyRef,
      (snapshot) => {
        const next = new Map<string, HistoryMeta>();
        snapshot.docs.forEach((historyDoc) => {
          const data = historyDoc.data();
          const key = getHistoryMediaKey(data, historyDoc.id);
          if (!key) return;
          const meta = getHistoryMeta(data);
          if (!meta.latestWatchedDate) return;
          const current = next.get(key);
          if (!current) {
            next.set(key, meta);
            return;
          }
          const mergedLatest = current.latestWatchedDate && meta.latestWatchedDate
            ? new Date(Math.max(current.latestWatchedDate.getTime(), meta.latestWatchedDate.getTime()))
            : current.latestWatchedDate || meta.latestWatchedDate;
          next.set(key, {
            latestWatchedDate: mergedLatest,
            watchCount: current.watchCount + meta.watchCount,
          });
        });
        setHistoryMetaByKey(next);
      },
      () => setHistoryMetaByKey(new Map()),
    );
  }, [userId]);

  useEffect(() => {
    if (!shareReview) return;

    setShareSelectedPoster(normalizeImageUrl(shareReview.posterPath));
    setShareSelectedBackdrop('');
    setSharePosterImages([]);
    setShareBackdropImages([]);
    setShareBaseBackdrop('');
    setShareReleaseYear('');
    setShareArtworkSelector(null);

    const mediaId = String(shareReview.movieId || '').trim();
    if (!mediaId) return;

    let cancelled = false;
    const type = shareReview.mediaType === 'tv' ? 'tv' : 'movie';

    const loadArtwork = async () => {
      setShareArtworkLoading(true);
      try {
        const [detailsResponse, imagesResponse] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/${type}/${mediaId}?api_key=${encodeURIComponent(TMDB_API_KEY)}&language=en-US`),
          fetch(`https://api.themoviedb.org/3/${type}/${mediaId}/images?api_key=${encodeURIComponent(TMDB_API_KEY)}&include_image_language=en,null`),
        ]);

        if (!detailsResponse.ok || !imagesResponse.ok) throw new Error('TMDB artwork request failed');

        const details = await detailsResponse.json();
        const images = await imagesResponse.json();
        if (cancelled) return;

        const rank = (items: ShareMediaImage[]) =>
          [...items].sort((a, b) => {
            const aScore = (a.vote_average || 0) * 100 + (a.vote_count || 0) * 4 + ((a.width || 0) * (a.height || 0)) / 1000000;
            const bScore = (b.vote_average || 0) * 100 + (b.vote_count || 0) * 4 + ((b.width || 0) * (b.height || 0)) / 1000000;
            return bScore - aScore;
          });

        const posters = rank(Array.isArray(images.posters) ? images.posters : []);
        const backdrops = rank(Array.isArray(images.backdrops) ? images.backdrops : []);
        const detailsPoster = normalizeImageUrl(details.poster_path);
        const detailsBackdrop = normalizeImageUrl(details.backdrop_path);
        const releaseDate = type === 'tv' ? details.first_air_date : details.release_date;

        setShareReleaseYear(releaseDate ? String(releaseDate).slice(0, 4) : '');
        setSharePosterImages(posters);
        setShareBackdropImages(backdrops);
        setShareBaseBackdrop(detailsBackdrop);
        setShareSelectedPoster((current) => current || detailsPoster || normalizeImageUrl(shareReview.posterPath));
        setShareSelectedBackdrop((current) => current || detailsBackdrop || normalizeImageUrl(backdrops[0]?.file_path));
      } catch {
        if (!cancelled) {
          setShareBaseBackdrop('');
        }
      } finally {
        if (!cancelled) setShareArtworkLoading(false);
      }
    };

    loadArtwork();
    return () => {
      cancelled = true;
    };
  }, [shareReview]);

  const sharePosterChoices = useMemo(
    () => uniqueUrls([normalizeImageUrl(shareReview?.posterPath), ...sharePosterImages.map((item) => normalizeImageUrl(item.file_path))]),
    [shareReview?.posterPath, sharePosterImages],
  );

  const shareBackdropChoices = useMemo(
    () => uniqueUrls([shareBaseBackdrop, ...shareBackdropImages.map((item) => normalizeImageUrl(item.file_path))]),
    [shareBaseBackdrop, shareBackdropImages],
  );

  const sharePreviewPoster = shareSelectedPoster || sharePosterChoices[0] || '';
  const sharePreviewBackdrop = shareSelectedBackdrop || shareBackdropChoices[0] || sharePreviewPoster;
  const shareArtworkChoices = shareArtworkSelector === 'backdrop' ? shareBackdropChoices : sharePosterChoices;
  const shareIsFavorite = shareReview ? favoriteKeys.has(getReviewMediaKey(shareReview)) : false;
  const shareHistoryMeta = shareReview ? historyMetaByKey.get(getReviewMediaKey(shareReview)) : undefined;
  const shareLatestWatchDate = shareHistoryMeta?.latestWatchedDate ?? shareReview?.timestamp;
  const shareWatchCount = Math.max(shareHistoryMeta?.watchCount || 0, shareHistoryMeta ? 1 : 0);
  const shareIsRewatch = shareWatchCount > 1;

  const randomizeShareArtwork = () => {
    const pick = (items: string[], current: string) => {
      const pool = items.slice(0, 14).filter((item) => item !== current);
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : current || items[0] || '';
    };
    setShareSelectedPoster((current) => pick(sharePosterChoices, current));
    setShareSelectedBackdrop((current) => pick(shareBackdropChoices, current));
  };

  const resetShareArtwork = () => {
    setShareSelectedPoster(normalizeImageUrl(shareReview?.posterPath) || sharePosterChoices[0] || '');
    setShareSelectedBackdrop(shareBaseBackdrop || shareBackdropChoices[0] || '');
  };

  const handleDelete = async (reviewId: string) => {
    if (!userId || !reviewId) return;
    try {
      await deleteDoc(doc(db, `users/${userId}/reviews/${reviewId}`));
    } catch (error) {
      console.error('Error deleting review:', error);
    }
  };

  const handleOpenEdit = (review: ReviewItem) => {
    setEditingReview(review);
    setEditContent(review.content);
  };

  const handleCloseEdit = () => {
    setEditingReview(null);
    setEditContent('');
  };

  const handleUpdateReview = async () => {
    if (!userId || !editingReview) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, `users/${userId}/reviews/${editingReview.id}`), {
        content: editContent,
      });
      handleCloseEdit();
    } catch (error) {
      console.error('Error updating review:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!storyCardRef.current || !shareReview) return;
    setIsDownloading(true);
    try {
      await Promise.all([
        preloadImage(sharePreviewPoster),
        preloadImage(sharePreviewBackdrop),
        preloadImage(userPhoto || '/user-icon.jpg'),
        preloadImage('/Logo.png'),
        preloadImage('/Cinescape.png'),
      ]);
      const dataUrl = await htmlToImage.toPng(storyCardRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: 1080,
        height: 1920,
      });
      const link = document.createElement('a');
      link.download = `${shareReview.title || 'review'}-${shareReview.author || 'user'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredReviews = reviews.filter((review) => {
    if (mediaType === 'movie') return review.mediaType === 'movie' || !review.mediaType;
    if (mediaType === 'tv') return review.mediaType === 'tv';
    return true;
  });
  const movieCount = reviews.filter((r) => r.mediaType === 'movie' || !r.mediaType).length;
  const tvCount = reviews.filter((r) => r.mediaType === 'tv').length;

  if (reviews.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[32px] border border-white/[0.04] bg-zinc-950/20 p-8 sm:p-12 text-center backdrop-blur-3xl shadow-2xl max-w-md mx-auto">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center max-w-xs mx-auto">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.01] border border-white/[0.05] text-zinc-600 mb-5 shadow-inner">
            <MessageSquare className="w-5 h-5 stroke-[1.2] text-emerald-500/80" />
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight uppercase">Timeline Empty</h3>
          <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
            Your critique panel is clear. Author a review inside any title catalog to map your cinematic footprint here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {!compact && (
        <div className="flex items-center justify-start">
          <div className="relative flex items-center p-0.5 bg-zinc-950/80 backdrop-blur-2xl border border-white/[0.06] rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setMediaType('movie')}
              className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 font-bold text-[11px] sm:text-xs tracking-wide transition-all duration-300 rounded-lg select-none active:scale-95 ${mediaType === 'movie'
                ? 'text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'
                : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <Clapperboard
                className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${mediaType === 'movie' ? 'scale-110 text-red-400' : ''
                  }`}
              />
              <span>Movies</span>
              <span
                className={`ml-0.5 text-[9px] px-1 py-0.2 rounded font-extrabold transition-colors duration-300 ${mediaType === 'movie'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/[0.04] text-zinc-500 border border-white/[0.04]'
                  }`}
              >
                {movieCount}
              </span>
              {mediaType === 'movie' && (
                <motion.div
                  layoutId="liquid-pill"
                  className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMediaType('tv')}
              className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 font-bold text-[11px] sm:text-xs tracking-wide transition-all duration-300 rounded-lg select-none active:scale-95 ${mediaType === 'tv'
                ? 'text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'
                : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <Tv
                className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${mediaType === 'tv' ? 'scale-110 text-cyan-400' : ''
                  }`}
              />
              <span>Series</span>
              <span
                className={`ml-0.5 text-[9px] px-1 py-0.2 rounded font-extrabold transition-colors duration-300 ${mediaType === 'tv'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/[0.04] text-zinc-500 border border-white/[0.04]'
                  }`}
              >
                {tvCount}
              </span>
              {mediaType === 'tv' && (
                <motion.div
                  layoutId="liquid-pill"
                  className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                />
              )}
            </button>
            <div className="absolute inset-y-0.5 left-0.5 right-0.5 pointer-events-none overflow-hidden rounded-lg">
              <motion.div
                className={`absolute top-0 bottom-0 w-1/2 blur-md opacity-80 transition-colors duration-500 ${mediaType === 'movie'
                  ? 'bg-gradient-to-r from-red-500/10 via-red-500/20 to-orange-500/10'
                  : 'bg-gradient-to-l from-cyan-500/10 via-sky-500/20 to-blue-500/10'
                  }`}
                animate={{
                  x: mediaType === 'movie' ? '0%' : '100%',
                }}
                transition={{ type: 'spring', stiffness: 240, damping: 28 }}
              />
            </div>
          </div>
        </div>
      )}
      {filteredReviews.length === 0 ? (
        <div className="relative overflow-hidden rounded-[20px] border border-white/[0.04] bg-zinc-950/20 p-6 text-center backdrop-blur-2xl my-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            No {mediaType === 'movie' ? 'movie' : 'series'} reviews logged yet.
          </p>
        </div>
      ) : (
        <div
          className={
            compact
              ? 'flex gap-4 overflow-x-auto pb-4 pt-1 px-1 -mx-1 scrollbar-none snap-x snap-mandatory'
              : 'grid grid-cols-1 lg:grid-cols-2 gap-4 w-full'
          }
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {filteredReviews.slice(0, compact ? 6 : filteredReviews.length).map((review) => {
            const reviewHistoryMeta = historyMetaByKey.get(getReviewMediaKey(review));
            const latestWatchDate = reviewHistoryMeta?.latestWatchedDate ?? review.timestamp;
            const reviewWatchCount = Math.max(reviewHistoryMeta?.watchCount || 0, reviewHistoryMeta ? 1 : 0);
            const isRewatch = reviewWatchCount > 1;
            const cardContent = (
              <>
                <div className="absolute inset-0 z-0 pointer-events-none">
                  {review.posterPath && (
                    <div className="absolute right-0 top-0 bottom-0 w-2/3 opacity-[0.03] group-hover:opacity-[0.08] blur-[2px] group-hover:blur-0 group-hover:scale-105 transition-all duration-700 overflow-hidden mix-blend-luminosity">
                      <img
                        src={`https://image.tmdb.org/t/p/w342${review.posterPath}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/40 to-transparent" />
                    </div>
                  )}
                  <div className="absolute -inset-px rounded-[20px] sm:rounded-[24px] border border-transparent group-hover:border-emerald-500/20 bg-gradient-to-b from-white/[0.06] to-transparent [mask-image:linear-gradient(to_bottom,white,transparent)] group-hover:[mask-image:none] transition-all duration-500" />
                </div>
                <div className="relative z-10 flex flex-row gap-3.5 items-start w-full h-full">
                  {review.posterPath && (
                    <div className="relative w-14 h-20 sm:w-20 sm:h-28 rounded-lg sm:rounded-xl overflow-hidden border border-white/[0.06] shrink-0 bg-zinc-950 shadow-xl group-hover:border-emerald-500/30 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-500 self-start">
                      <img
                        src={`https://image.tmdb.org/t/p/w185${review.posterPath}`}
                        alt={review.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full min-h-[80px] sm:min-h-[112px] w-full">
                    <div className="space-y-1 sm:space-y-1.5 w-full pr-10 sm:pr-24">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full overflow-hidden bg-zinc-900 border border-white/[0.08] shrink-0">
                          <img
                            src={userPhoto || '/user-icon.jpg'}
                            alt={review.author}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="font-bold text-zinc-400 text-[9px] sm:text-[10px] uppercase tracking-wider truncate">
                          {review.author}
                        </span>
                      </div>
                      {review.title && (
                        <h4 className="text-xs sm:text-sm font-black text-white tracking-tight truncate group-hover:text-emerald-400 transition-colors duration-300">
                          {review.title}
                        </h4>
                      )}
                      <div className="relative pt-0.5 sm:pt-1">
                        <Quote className="absolute -left-1 -top-1.5 w-3 h-3 text-white/40 rotate-180 opacity-60 pointer-events-none" />
                        <p className="text-zinc-400 text-[11px] sm:text-xs leading-relaxed font-normal line-clamp-2 pl-2.5 group-hover:text-zinc-300 transition-colors">
                          {review.content}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/[0.02]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {review.rating !== undefined ? (
                          <div className="flex items-center gap-1 bg-amber-500/[0.04] border border-amber-500/[0.12] px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg shadow-sm">
                            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 fill-amber-400" />
                            <span className="text-[9px] sm:text-[10px] font-black text-amber-400 tracking-wider">
                              {review.rating.toFixed(1)}
                            </span>
                          </div>
                        ) : null}
                        <span className="text-[8px] font-extrabold tracking-widest text-zinc-500 uppercase bg-zinc-900/60 border border-white/[0.04] px-1.5 py-0.5 rounded-md shrink-0">
                          {review.mediaType === 'tv' ? 'Series' : 'Movie'}
                        </span>
                        {isRewatch && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[8px] font-semibold tracking-wide text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md">
                            <RotateCcw className="h-2.5 w-2.5 stroke-[2] text-zinc-400" />
                            <span>Rewatch ×{reviewWatchCount}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-zinc-500 text-[8px] sm:text-[9px] font-semibold shrink-0 uppercase tracking-widest bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded">
                        <LucideCalendarDays className="w-2.5 h-2.5 text-emerald-500/70" />
                        <span>{formatReviewDate(latestWatchDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute top-2 right-2 z-20 sm:top-3 sm:right-3">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-zinc-950/80 text-zinc-400 shadow-[0_6px_18px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:border-white/15 hover:bg-zinc-900 hover:text-white active:scale-90 sm:hidden"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMobileActionsReview(review);
                    }}
                    title="Review actions"
                    aria-label="Review actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  <div className="hidden items-center gap-1 sm:flex">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/[0.1] bg-zinc-900/90 text-zinc-400 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 hover:border-cyan-500/30 hover:bg-cyan-950/40 hover:text-cyan-400 active:scale-90"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShareReview(review);
                      }}
                      title="Share Story Card"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/[0.1] bg-zinc-900/90 text-zinc-400 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 hover:border-emerald-500/30 hover:bg-emerald-950/40 hover:text-emerald-400 active:scale-90"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenEdit(review);
                      }}
                      title="Edit Review"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/[0.1] bg-zinc-900/90 text-zinc-400 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 hover:border-red-500/30 hover:bg-red-950/40 hover:text-red-400 active:scale-90"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(review.id);
                      }}
                      title="Delete Review"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </>
            );
            const baseStyles = `group relative flex flex-col bg-zinc-950/30 border border-white/[0.03] rounded-[20px] sm:rounded-[24px] p-3 sm:p-4 backdrop-blur-3xl transition-all duration-500 hover:shadow-[0_0_40px_rgba(16,185,129,0.04)] ${compact ? 'w-[260px] sm:w-[340px] flex-shrink-0 snap-start' : 'w-full'
              }`;
            return review.movieId ? (
              <Link
                key={review.id}
                to={review.mediaType === 'tv' ? `/tv/${review.movieId}` : `/movie/${review.movieId}`}
                className={`${baseStyles} hover:bg-zinc-950/50 active:scale-[0.995]`}
              >
                {cardContent}
              </Link>
            ) : (
              <div key={review.id} className={baseStyles}>
                {cardContent}
              </div>
            );
          })}
        </div>
      )}
      {mobileActionsReview &&
        createPortal(
          <div className="fixed inset-0 z-[9998] flex items-end justify-center sm:hidden">
            <button
              type="button"
              aria-label="Close review actions"
              className="absolute inset-0 h-full w-full border-0 bg-black/70 p-0 backdrop-blur-md"
              onClick={() => setMobileActionsReview(null)}
            />
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative z-10 w-full rounded-t-[28px] border border-white/10 bg-zinc-950/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_70px_rgba(0,0,0,0.62)] backdrop-blur-3xl"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
              <div className="mb-4 flex items-center gap-3">
                {mobileActionsReview.posterPath ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${mobileActionsReview.posterPath}`}
                    alt={mobileActionsReview.title || ''}
                    className="h-16 w-11 shrink-0 rounded-lg border border-white/10 object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <Film className="h-4 w-4 text-zinc-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{mobileActionsReview.title || 'Untitled'}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-zinc-500">{mobileActionsReview.mediaType === 'tv' ? 'Series review' : 'Film review'}</p>
                </div>
                <button type="button" onClick={() => setMobileActionsReview(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => { const review = mobileActionsReview; setMobileActionsReview(null); setShareReview(review); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 py-3.5 text-left text-xs font-semibold text-zinc-200 transition active:scale-[0.99]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300"><Share2 className="h-4 w-4" /></span>
                  Share review
                </button>
                <button
                  type="button"
                  onClick={() => { const review = mobileActionsReview; setMobileActionsReview(null); handleOpenEdit(review); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 py-3.5 text-left text-xs font-semibold text-zinc-200 transition active:scale-[0.99]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300"><Edit3 className="h-4 w-4" /></span>
                  Edit review
                </button>
                <button
                  type="button"
                  onClick={async () => { const review = mobileActionsReview; setMobileActionsReview(null); await handleDelete(review.id); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-red-500/10 bg-red-500/[0.035] px-4 py-3.5 text-left text-xs font-semibold text-red-300 transition active:scale-[0.99]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-300"><Trash2 className="h-4 w-4" /></span>
                  Delete review
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {editingReview &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none antialiased">
            <div
              onClick={handleCloseEdit}
              className="absolute inset-0 bg-black/50 backdrop-blur-3xl transition-opacity duration-300"
            />
            <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-[28px] sm:rounded-[32px] border border-white/[0.18] bg-zinc-900/90 sm:bg-zinc-900/60 p-5 sm:p-7 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-3xl backdrop-saturate-200 transition-all">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <div className="relative flex flex-col sm:flex-row gap-5 sm:gap-6">
                {editingReview.posterPath ? (
                  <div className="relative shrink-0 w-24 h-36 sm:w-44 sm:h-auto rounded-2xl overflow-hidden border border-white/15 bg-black/40 shadow-2xl self-center sm:self-stretch group">
                    <img
                      src={`https://image.tmdb.org/t/p/w342${editingReview.posterPath}`}
                      alt={editingReview.title || 'Movie Poster'}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/15 rounded-2xl pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                  </div>
                ) : (
                  <div className="relative shrink-0 w-24 h-36 sm:w-44 sm:h-auto rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col items-center justify-center gap-2 text-zinc-500 self-center sm:self-stretch">
                    <Film className="h-6 w-6 sm:h-8 sm:w-8 stroke-[1.25]" />
                    <span className="text-[9px] sm:text-[10px] font-medium tracking-widest uppercase text-zinc-500">No Poster</span>
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-between space-y-4 sm:space-y-5 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                        <Edit2 className="h-3.5 w-3.5 stroke-[2]" />
                        <h3 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                          Edit Review
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base sm:text-xl font-semibold tracking-tight text-white/95 truncate">
                          {editingReview.title || 'Untitled'}
                        </h4>
                        <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-emerald-300 tracking-wider uppercase backdrop-blur-md">
                          {editingReview.mediaType || 'Movie'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseEdit}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/20 active:scale-90 transition-all backdrop-blur-md shadow-sm"
                    >
                      <X className="h-3.5 w-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-0.5">
                      <label className="text-xs font-medium text-zinc-400">
                        Review Content
                      </label>
                      {typeof editContent !== 'undefined' && (
                        <span className="text-[10px] font-medium text-zinc-500 tabular-nums">
                          {editContent.length} / 1000
                        </span>
                      )}
                    </div>
                    <div className="relative rounded-2xl border border-white/10 bg-black/40 p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={4}
                        maxLength={1000}
                        className="w-full rounded-xl bg-transparent p-3 text-xs sm:text-sm text-white/90 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed font-normal antialiased"
                        placeholder="Share your thoughts on performance, pacing, or direction..."
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleCloseEdit}
                      className="h-9 px-4 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white active:scale-95 transition-all backdrop-blur-md"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateReview}
                      disabled={isUpdating || (typeof editContent !== 'undefined' && editContent.trim().length === 0)}
                      className="flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 px-5 text-xs font-semibold text-zinc-950 shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_24px_rgba(16,185,129,0.45)] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-950" />
                      ) : (
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      )}
                      <span>{isUpdating ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      {shareReview &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-5 overflow-hidden">
              <div onClick={() => setShareReview(null)} className="absolute inset-0 bg-black/70 sm:bg-black/45" />
              <div className="pointer-events-none absolute inset-0 backdrop-blur-xl sm:backdrop-blur-md" />

              <motion.div
                initial={{ opacity: 0, y: 80, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 70, scale: 0.985 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                className="relative z-10 grid max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-t-[34px] border border-white/15 bg-zinc-950 shadow-[0_32px_100px_rgba(0,0,0,0.72)] sm:grid-cols-[minmax(0,1fr)_340px] sm:overflow-hidden sm:rounded-[34px] sm:bg-zinc-950/78 sm:backdrop-blur-3xl"
              >
                <div className="relative min-h-0 overflow-y-auto p-4 sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-black tracking-tight text-white sm:text-lg">Share Review</h3>
                      <p className="text-[10px] font-medium text-white/40">Backdrop-first 9:16 review card</p>
                    </div>
                    <button type="button" onClick={() => setShareReview(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/60 transition hover:bg-white/10 hover:text-white active:scale-90">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mx-auto w-full max-w-[280px] sm:max-w-[350px]">
                    <div className="relative aspect-[9/16] overflow-hidden rounded-[30px] border border-white/15 bg-black shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
                      {sharePreviewBackdrop ? (
                        <img src={sharePreviewBackdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-950 to-black" />
                      )}
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />

                      <div className="absolute left-3 top-3 z-30 flex items-center gap-1.5">
                        <button type="button" onClick={() => setShareArtworkSelector('backdrop')} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 backdrop-blur-md transition hover:bg-black/80 hover:text-white active:scale-95" aria-label="Choose backdrop">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={randomizeShareArtwork} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-emerald-300 backdrop-blur-md transition hover:bg-black/80 active:scale-95" aria-label="Randomize artwork">
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="absolute left-1/2 top-1/2 z-20 w-[86%] sm:w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-white/[0.07] bg-[#11171c]/95 p-3.5 sm:p-4 text-left shadow-[0_20px_55px_rgba(0,0,0,0.5)] backdrop-blur-[2px] font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',Helvetica,Arial,sans-serif]">
                        <div className="flex items-center gap-2 pr-[56px] sm:pr-[72px]">
                          <div className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 overflow-hidden rounded-full border border-white/10 bg-zinc-800">
                            <img src={userPhoto || '/user-icon.jpg'} alt={shareReview.author} className="h-full w-full object-cover" />
                          </div>
                          <span className="truncate text-[8px] sm:text-[9px] font-semibold text-zinc-300">{shareReview.author}</span>
                        </div>

                        <div className="absolute right-3.5 sm:right-4 top-3.5 sm:top-4 h-[70px] w-[46px] sm:h-[82px] sm:w-[55px] overflow-hidden rounded-[3px] border border-white/10 bg-zinc-900 shadow-[0_8px_20px_rgba(0,0,0,0.4)]">
                          {sharePreviewPoster ? (
                            <img src={sharePreviewPoster} alt={shareReview.title || ''} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center"><Film className="h-4 w-4 sm:h-5 sm:w-5 text-white/20" /></div>
                          )}
                          <button type="button" onClick={() => setShareArtworkSelector('poster')} className="absolute right-1 top-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white/75 backdrop-blur-sm transition hover:text-white" aria-label="Choose poster">
                            <Pencil className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                          </button>
                        </div>

                        <div className="mt-2.5 sm:mt-3 pr-[52px] sm:pr-[68px]">
                          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                            <h2 className="text-[11px] sm:text-[13px] font-black leading-tight tracking-tight text-white">{shareReview.title || 'Untitled'}</h2>
                            {shareReleaseYear && <span className="text-[8px] sm:text-[9px] font-medium text-zinc-500">{shareReleaseYear}</span>}
                          </div>

                          {shareReview.rating !== undefined && (
                            <div className="mt-1 sm:mt-1.5 flex items-center gap-1.5 flex-wrap sm:flex-nowrap" aria-label={`${shareReview.rating.toFixed(1)} rating`}>
                              <ShareRatingStars rating={shareReview.rating} size={10} gap={1} />
                              <span className="text-[8px] sm:text-[9px] font-medium text-zinc-400 leading-none">
                                {Number.isInteger(shareReview.rating) ? shareReview.rating : shareReview.rating.toFixed(1)}/10
                              </span>
                              {shareIsFavorite && (
                                <Heart className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 fill-red-500 text-red-500 drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)]" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="mt-2.5 sm:mt-3 flex items-center gap-1.5">
                          <p className="text-[7px] sm:text-[8px] font-medium text-zinc-500">Watched {formatReviewDate(shareLatestWatchDate)}</p>
                          {shareIsRewatch && (
                            <span className="inline-flex items-center gap-0.5 sm:gap-1 rounded-full border border-white/10 bg-white/[0.05] px-1 sm:px-1.5 py-[1px] text-[5.5px] sm:text-[6.5px] font-semibold tracking-wide text-zinc-300 shadow-[inset_0_0.5px_0_rgba(255,255,255,0.1)] backdrop-blur-md">
                              <RotateCcw className="h-1.5 w-1.5 sm:h-2 sm:w-2 stroke-[2] text-zinc-400" />
                              <span>Rewatch ×{shareWatchCount}</span>
                            </span>
                          )}
                        </div>
                        <div className="relative mt-1.5 sm:mt-2 pl-0">
                          <Quote className="absolute left-0 -top-1 w-2.5 h-2.5 sm:w-2.5 sm:h-2.5 text-white/30 rotate-180 drop-shadow-[0_2px_8px_rgba(255,255,255,0.1)] pointer-events-none" />
                          <p
                            className="pl-4 sm:pl-3.5 overflow-hidden whitespace-pre-line text-[9px] sm:text-[10px] font-normal leading-[1.4] sm:leading-[1.45] text-zinc-300"
                            style={{ maxHeight: '100px' }}
                          >
                            {shareReview.content}
                          </p>
                        </div>
                        <div className="mt-2.5 sm:mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2 sm:pt-2.5">
                          <span className="text-[6px] sm:text-[7px] font-medium text-zinc-600">{shareReview.mediaType === 'tv' ? 'Series review' : 'Film review'}</span>
                          <div className="flex items-center gap-1.5 opacity-80">
                            <img src="/Logo.png" alt="Logo" className="h-3 sm:h-3.5 w-auto object-contain" />
                            <img src="/Cinescape.png" alt="Cinescape" className="h-2 sm:h-2.5 w-auto object-contain" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 bg-white/[0.025] p-4 sm:border-l sm:border-t-0 sm:p-5">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-black text-white">Artwork</p>
                      <p className="mt-0.5 text-[10px] text-white/40">Backdrop fills the story; poster stays inside the review card</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setShareArtworkSelector('poster')} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-[10px] font-bold text-white/75 transition hover:bg-white/[0.08] hover:text-white">
                        <ImageIcon className="h-3.5 w-3.5 text-amber-300" />Poster
                      </button>
                      <button type="button" onClick={() => setShareArtworkSelector('backdrop')} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-[10px] font-bold text-white/75 transition hover:bg-white/[0.08] hover:text-white">
                        <ImageIcon className="h-3.5 w-3.5 text-sky-300" />Backdrop
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={randomizeShareArtwork} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-[10px] font-black text-emerald-300 transition hover:bg-emerald-400/15">
                        <Sparkles className="h-3.5 w-3.5" />Randomize
                      </button>
                      <button type="button" onClick={resetShareArtwork} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[10px] font-bold text-white/55 transition hover:text-white">
                        <RotateCcw className="h-3.5 w-3.5" />Reset
                      </button>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold text-white/45">Your rating</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                            <span className="text-lg font-black tabular-nums text-white">{shareReview.rating?.toFixed(1) || '—'}</span>
                          </div>
                        </div>
                        {shareIsFavorite && (
                          <div className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-red-500 to-red-600 px-3 py-2 text-[10px] font-black text-white shadow-md shadow-red-500/30">
                            <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" /> Favorite
                          </div>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={handleDownloadImage} disabled={isDownloading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-black shadow-xl transition hover:bg-white/90 active:scale-[0.98] disabled:opacity-50">
                      {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {isDownloading ? 'Exporting…' : 'Save 9:16 Image'}
                    </button>
                    <button type="button" onClick={() => setShareReview(null)} className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07] hover:text-white">
                      Close
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
            <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden="true">
              <div ref={storyCardRef} className="relative h-[1920px] w-[1080px] overflow-hidden bg-black font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif] text-white">
                {sharePreviewBackdrop ? (
                  <img src={sharePreviewBackdrop} crossOrigin="anonymous" alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-950 to-black" />
                )}
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />
                <div className="absolute left-1/2 top-1/2 w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/[0.08] bg-[#11171c]/[0.97] px-[42px] pb-[34px] pt-[38px] shadow-[0_48px_140px_rgba(0,0,0,0.58)]">
                  <div className="flex items-center gap-[16px] pr-[190px]">
                    <div className="h-[58px] w-[58px] shrink-0 overflow-hidden rounded-full border border-white/10 bg-zinc-800">
                      <img src={userPhoto || '/user-icon.jpg'} crossOrigin="anonymous" alt={shareReview.author} className="h-full w-full object-cover" />
                    </div>
                    <span className="max-w-[470px] truncate text-[24px] font-semibold tracking-tight text-zinc-300">{shareReview.author}</span>
                  </div>
                  <div className="absolute right-[42px] top-[38px] h-[230px] w-[154px] overflow-hidden rounded-[7px] border border-white/10 bg-zinc-900 shadow-[0_22px_55px_rgba(0,0,0,0.48)]">
                    {sharePreviewPoster ? (
                      <img src={sharePreviewPoster} crossOrigin="anonymous" alt={shareReview.title || ''} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><Film className="h-14 w-14 text-white/15" /></div>
                    )}
                  </div>
                  <div className="mt-[32px] pr-[186px]">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h1 className="text-[39px] font-black leading-[1.08] tracking-tight text-white">{shareReview.title || 'Untitled'}</h1>
                      {shareReleaseYear && <span className="text-[24px] font-medium text-zinc-500">{shareReleaseYear}</span>}
                    </div>

                    {shareReview.rating !== undefined && (
                      <div className="mt-[12px] flex items-center gap-[10px]">
                        <ShareRatingStars rating={shareReview.rating} size={28} gap={4} />
                        <span className="text-[20px] font-medium leading-none text-zinc-400">
                          {Number.isInteger(shareReview.rating) ? shareReview.rating : shareReview.rating.toFixed(1)}/10
                        </span>
                        {shareIsFavorite && (
                          <Heart className="h-[26px] w-[26px] shrink-0 fill-red-500 text-red-500 drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)]" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-[34px] flex items-center gap-[12px]">
                    <p className="text-[20px] font-medium text-zinc-500">Watched {formatReviewDate(shareLatestWatchDate)}</p>
                    {shareIsRewatch && (
                      <span className="inline-flex items-center gap-[8px] text-[15px] font-semibold tracking-[0.02em] text-zinc-500">
                        <RotateCcw className="h-[17px] w-[17px] stroke-[2]" />
                        Rewatch ×{shareWatchCount}
                      </span>
                    )}
                  </div>
                  <div className="relative mt-[20px] pl-[38px]">
                    <Quote className="absolute left-1.5 -top-0.5 h-[28px] w-[28px] rotate-180 text-white/25" />
                    <p
                      className="overflow-hidden whitespace-pre-line font-normal tracking-[-0.01em] text-zinc-300"
                      style={{
                        fontSize: shareReview.content.length > 700 ? '22px' : shareReview.content.length > 420 ? '25px' : '28px',
                        lineHeight: 1.43,
                        maxHeight: '620px',
                      }}
                    >
                      {shareReview.content}
                    </p>
                  </div>
                  <div className="mt-[30px] flex items-center justify-between border-t border-white/[0.055] pt-[20px]">
                    <span className="text-[16px] font-medium text-zinc-600">{shareReview.mediaType === 'tv' ? 'Series review' : 'Film review'}</span>
                    <div className="flex items-center gap-[12px] opacity-80">
                      <img src="/Logo.png" alt="Logo" className="h-[28px] w-auto object-contain" />
                      <img src="/Cinescape.png" alt="Cinescape" className="h-[20px] w-auto object-contain" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {shareArtworkSelector && (
              <div className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/80 p-0 backdrop-blur-lg sm:items-center sm:p-5" onClick={() => setShareArtworkSelector(null)}>
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} onClick={(event) => event.stopPropagation()} className="flex h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[30px] border border-white/15 bg-zinc-950 shadow-2xl sm:h-[80vh] sm:rounded-[32px]">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
                    <div>
                      <h3 className="text-sm font-black text-white">Choose {shareArtworkSelector === 'poster' ? 'Poster' : 'Backdrop'}</h3>
                      <p className="text-[10px] text-white/40">{shareArtworkChoices.length} TMDB images available</p>
                    </div>
                    <button type="button" onClick={() => setShareArtworkSelector(null)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                    {shareArtworkLoading ? (
                      <div className="flex h-full items-center justify-center gap-2 text-xs text-white/50"><Loader2 className="h-4 w-4 animate-spin text-amber-300" />Loading artwork…</div>
                    ) : shareArtworkChoices.length ? (
                      <div className={shareArtworkSelector === 'poster' ? 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3'}>
                        {shareArtworkChoices.map((url) => {
                          const selected = shareArtworkSelector === 'poster' ? shareSelectedPoster === url : shareSelectedBackdrop === url;
                          return (
                            <button
                              key={url}
                              type="button"
                              onClick={() => shareArtworkSelector === 'poster' ? setShareSelectedPoster(url) : setShareSelectedBackdrop(url)}
                              className={`relative overflow-hidden rounded-xl border bg-zinc-900 transition active:scale-[0.98] ${shareArtworkSelector === 'poster' ? 'aspect-[2/3]' : 'aspect-video'} ${selected ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-white/10 hover:border-white/30'}`}
                            >
                              <img src={url.replace('/original/', shareArtworkSelector === 'poster' ? '/w342/' : '/w500/')} alt="" loading="lazy" className="h-full w-full object-cover" />
                              {selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black"><Check className="h-3.5 w-3.5 stroke-[3]" /></span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center"><ImageIcon className="mb-2 h-8 w-8 text-white/20" /><p className="text-xs font-medium text-white/60">No additional images found</p></div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 border-t border-white/10 px-3 py-3 sm:px-5">
                    <button type="button" onClick={resetShareArtwork} className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-bold text-white/55"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
                    <button type="button" onClick={randomizeShareArtwork} className="flex h-9 items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 text-[10px] font-black text-amber-300"><Sparkles className="h-3.5 w-3.5" />Randomize</button>
                    <button type="button" onClick={() => setShareArtworkSelector(null)} className="ml-auto h-9 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 text-[10px] font-black text-black">Done</button>
                  </div>
                </motion.div>
              </div>
            )}
          </>,
          document.body
        )}
    </div>
  );
};

export default ReviewList;
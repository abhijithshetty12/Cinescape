import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase.ts';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Star, Trash2, LucideCalendarDays, MessageSquare, Quote, Edit3, X, Check, Clapperboard, Tv, Loader2, Film, Share2, Download, Edit2, Heart, Pencil, Sparkles, RotateCcw, MoreHorizontal, Image as ImageIcon, Search, SlidersHorizontal, ChevronDown, Pin, PinOff, Eye, EyeOff, ShieldAlert, Bookmark } from 'lucide-react';
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
  backdropPath?: string;
  mediaType?: 'movie' | 'tv';
  year?: string;
  pinned: boolean;
  spoiler: boolean;
  reviewHistory: ReviewVersion[];
  ratingHistory: ReviewVersion[];
}

interface HistoryMeta {
  latestWatchedDate: Date | null;
  watchCount: number;
  watchedDates: Date[];
}

interface ReviewVersion {
  content?: string;
  rating?: number;
  timestamp?: any;
  watchedDate?: any;
}

interface ShareMediaImage {
  file_path: string;
  vote_count?: number;
  vote_average?: number;
  width?: number;
  height?: number;
}

type ArtworkTab = 'poster' | 'backdrop';
type ReviewSort = 'newest' | 'oldest' | 'highest' | 'lowest' | 'watched';
type ReviewFilter = 'all' | '9' | '8' | '7' | 'favorites' | 'rewatches';
type ShareTheme = 'minimal' | 'cinematic' | 'poster' | 'backdrop';
type ShareTextSize = 'small' | 'medium' | 'large';

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
    watchedDates: dates,
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
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>(compact ? 'movie' : 'all');
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
  const [shareTheme, setShareTheme] = useState<ShareTheme>('cinematic');
  const [shareTextSize, setShareTextSize] = useState<ShareTextSize>('medium');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<ReviewSort>('newest');
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('all');
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [compareReview, setCompareReview] = useState<ReviewItem | null>(null);
  const [myListKeys, setMyListKeys] = useState<Set<string>>(new Set());
  const [watchlistKeys, setWatchlistKeys] = useState<Set<string>>(new Set());
  const [previewScale, setPreviewScale] = useState(0.25);

  const storyCardRef = useRef<HTMLDivElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) {
        setPreviewScale(Math.min(width / 1080, height / 1920));
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [shareReview]);

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

    let ratingsMap: Record<string, any> = {};
    let reviewDocs: any[] = [];

    const syncReviewsWithRatings = () => {
      const reviewArr = reviewDocs.map((docSnap) => {
        const data = docSnap.data();
        const mId = String(data.movieId ?? data.mediaId ?? '');
        const type: 'movie' | 'tv' = data.mediaType === 'tv' ? 'tv' : 'movie';
        const ratingEntry = ratingsMap[mId] ?? ratingsMap[`${type}-${mId}`];
        const ratingValue = ratingEntry?.rating ?? ratingEntry?.value ?? data.rating;
        const dynamicRating = Number(ratingValue);

        return {
          id: docSnap.id,
          content: data.content ?? '',
          author: data.author ?? 'Unknown',
          timestamp: data.timestamp ?? null,
          title: data.title ?? '',
          rating: Number.isFinite(dynamicRating) && dynamicRating > 0 ? dynamicRating : undefined,
          movieId: data.movieId ?? undefined,
          posterPath: data.posterPath ?? undefined,
          backdropPath: data.backdropPath ?? data.backdrop_path ?? undefined,
          mediaType: type,
          year: String(data.year ?? data.releaseYear ?? ''),
          pinned: Boolean(data.pinned ?? data.isPinned),
          spoiler: Boolean(data.spoiler ?? data.containsSpoilers),
          reviewHistory: Array.isArray(data.reviewHistory) ? data.reviewHistory : Array.isArray(data.reviewVersions) ? data.reviewVersions : [],
          ratingHistory: Array.isArray(ratingEntry?.ratingHistory) ? ratingEntry.ratingHistory : Array.isArray(data.ratingHistory) ? data.ratingHistory : [],
        };
      });
      setReviews(reviewArr);
    };

    const ratingsUnsubscribe = onSnapshot(ratingsRef, (snapshot) => {
      const map: Record<string, any> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        map[docSnap.id] = data;
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
    if (!userId) {
      setMyListKeys(new Set());
      setWatchlistKeys(new Set());
      return;
    }
    const subscribe = (path: string, setKeys: React.Dispatch<React.SetStateAction<Set<string>>>) =>
      onSnapshot(
        collection(db, `users/${userId}/${path}`),
        (snapshot) => {
          const next = new Set<string>();
          snapshot.docs.forEach((entry) => {
            const data = entry.data();
            const id = data.mediaId ?? data.movieId ?? data.id ?? entry.id.replace(/^(movie|tv)[-_]/, '');
            const type: 'movie' | 'tv' = data.mediaType === 'tv' || data.type === 'tv' || entry.id.startsWith('tv-') ? 'tv' : 'movie';
            if (String(id)) next.add(`${type}-${String(id)}`);
          });
          setKeys(next);
        },
        () => setKeys(new Set()),
      );
    const unsubscribeMyList = subscribe('myList', setMyListKeys);
    const unsubscribeWatchlist = subscribe('watchlist', setWatchlistKeys);
    return () => {
      unsubscribeMyList();
      unsubscribeWatchlist();
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
            watchedDates: [...new Map([...current.watchedDates, ...meta.watchedDates].map((date) => [date.getTime(), date])).values()].sort((a, b) => a.getTime() - b.getTime()),
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
  const shareHandle = shareReview?.author ? shareReview.author.toLowerCase().replace(/\s/g, '') : 'user';

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

  const pinnedCount = reviews.filter((review) => review.pinned).length;

  const togglePinned = async (review: ReviewItem) => {
    if (!userId) return;
    if (!review.pinned && pinnedCount >= 5) return;
    try {
      await updateDoc(doc(db, `users/${userId}/reviews/${review.id}`), {
        pinned: !review.pinned,
        isPinned: !review.pinned,
      });
      setMobileActionsReview(null);
    } catch (error) {
      console.error('Error updating pinned review:', error);
    }
  };

  const toggleSpoiler = async (review: ReviewItem) => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, `users/${userId}/reviews/${review.id}`), {
        spoiler: !review.spoiler,
        containsSpoilers: !review.spoiler,
      });
      setMobileActionsReview(null);
    } catch (error) {
      console.error('Error updating spoiler setting:', error);
    }
  };

  const openShare = (review: ReviewItem) => {
    setShareTheme('cinematic');
    setShareTextSize('medium');
    setMobileActionsReview(null);
    setShareReview(review);
  };

  const getCompareVersion = (review: ReviewItem) =>
    [...review.reviewHistory, ...review.ratingHistory]
      .filter((version) => version.content || version.rating !== undefined)
      .sort((a, b) => {
        const aDate = historyValueToDate(a.timestamp ?? a.watchedDate)?.getTime() ?? 0;
        const bDate = historyValueToDate(b.timestamp ?? b.watchedDate)?.getTime() ?? 0;
        return aDate - bDate;
      })[0];

  const toggleExpanded = (reviewId: string) =>
    setExpandedReviews((current) => {
      const next = new Set(current);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });

  const handleDownloadImage = async () => {
    if (!storyCardRef.current || !shareReview) return;
    setIsDownloading(true);
    try {
      await Promise.all([
        preloadImage(sharePreviewPoster),
        preloadImage(sharePreviewBackdrop),
        preloadImage(userPhoto || '/user-icon.jpg'),
        preloadImage('/Cinescape_Logo.svg'),
        preloadImage('/Cinescape_Wordmark.svg'),
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

  const filteredReviews = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    const filtered = reviews.filter((review) => {
      const key = getReviewMediaKey(review);
      const history = historyMetaByKey.get(key);
      if (mediaType !== 'all' && review.mediaType !== mediaType) return false;
      if (term && !`${review.title || ''} ${review.content}`.toLowerCase().includes(term)) return false;
      if (activeFilter === '9' && (review.rating ?? 0) < 9) return false;
      if (activeFilter === '8' && (review.rating ?? 0) < 8) return false;
      if (activeFilter === '7' && (review.rating ?? 0) < 7) return false;
      if (activeFilter === 'favorites' && !favoriteKeys.has(key)) return false;
      if (activeFilter === 'rewatches' && (history?.watchCount ?? 0) < 2) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sortBy === 'oldest') return (historyValueToDate(a.timestamp)?.getTime() ?? 0) - (historyValueToDate(b.timestamp)?.getTime() ?? 0);
      if (sortBy === 'highest') return (b.rating ?? -1) - (a.rating ?? -1) || (historyValueToDate(b.timestamp)?.getTime() ?? 0) - (historyValueToDate(a.timestamp)?.getTime() ?? 0);
      if (sortBy === 'lowest') return (a.rating ?? 11) - (b.rating ?? 11) || (historyValueToDate(b.timestamp)?.getTime() ?? 0) - (historyValueToDate(a.timestamp)?.getTime() ?? 0);
      if (sortBy === 'watched') return (historyMetaByKey.get(getReviewMediaKey(b))?.latestWatchedDate?.getTime() ?? 0) - (historyMetaByKey.get(getReviewMediaKey(a))?.latestWatchedDate?.getTime() ?? 0);
      return (historyValueToDate(b.timestamp)?.getTime() ?? 0) - (historyValueToDate(a.timestamp)?.getTime() ?? 0);
    });
  }, [reviews, searchText, mediaType, activeFilter, sortBy, favoriteKeys, historyMetaByKey]);

  const movieCount = reviews.filter((review) => review.mediaType === 'movie' || !review.mediaType).length;
  const tvCount = reviews.filter((review) => review.mediaType === 'tv').length;
  const ratedReviews = reviews.filter((review) => typeof review.rating === 'number');
  const averageRating = ratedReviews.length ? ratedReviews.reduce((sum, review) => sum + (review.rating || 0), 0) / ratedReviews.length : 0;
  const favoritesReviewed = reviews.filter((review) => favoriteKeys.has(getReviewMediaKey(review))).length;
  const rewatchesReviewed = reviews.filter((review) => (historyMetaByKey.get(getReviewMediaKey(review))?.watchCount ?? 0) > 1).length;

  const renderShareCard = (isExport = false) => {
    if (!shareReview) return null;
    const ref = isExport ? { ref: storyCardRef } : {};

    if (shareTheme === 'minimal') {
      return (
        <div {...ref} className="relative h-[1920px] w-[1080px] overflow-hidden bg-[#0a0202] text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]">
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 50% at 25% 15%, rgba(200, 35, 30, 0.75), transparent 60%), radial-gradient(ellipse 80% 60% at 80% 25%, rgba(150, 20, 18, 0.85), transparent 55%), radial-gradient(ellipse 90% 70% at 40% 78%, rgba(220, 50, 40, 0.9), transparent 60%), radial-gradient(ellipse 70% 60% at 90% 85%, rgba(160, 25, 22, 0.8), transparent 55%), radial-gradient(ellipse 60% 50% at 10% 88%, rgba(180, 30, 25, 0.85), transparent 55%), linear-gradient(135deg, #2a0505 0%, #0a0101 50%, #1a0303 100%)` }} />
          <div className="absolute inset-0 mix-blend-overlay opacity-60" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)' opacity='0.9'/%3E%3C/svg%3E")` }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 18%, rgba(0,0,0,0.82) 100%)' }} />

          <div className="relative z-10 flex h-full flex-col justify-between p-[100px]">
            <div className="flex items-start justify-between">
              <div className="rounded-[28px] border border-white/10 bg-black/60 p-[24px] shadow-2xl">
                <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[100px] w-[100px] object-contain" />
              </div>
              <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="mt-[10px] h-[50px] object-contain opacity-80 brightness-0 invert" />
            </div>

            <div>
              {sharePreviewPoster && (
                <img
                  src={sharePreviewPoster}
                  crossOrigin={isExport ? "anonymous" : undefined}
                  alt={shareReview.title}
                  className="mb-[60px] h-[540px] w-[360px] rounded-[30px] border border-white/10 object-cover shadow-[0_30px_60px_rgba(0,0,0,0.7)]"
                />
              )}
              <div className="flex items-center gap-[20px] text-[26px] font-black uppercase tracking-[0.28em] text-white/55">
                <span className="h-px w-[60px] bg-white/35" />
                Cinematic Review
              </div>
              <h1 className="mt-[40px] font-serif text-[130px] font-bold leading-[1.02] tracking-tight text-white line-clamp-3 drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
                {shareReview.title || 'Untitled'}
              </h1>
              <div className="mt-[30px] flex flex-wrap items-center gap-[20px]">
                {shareReleaseYear && <span className="text-[36px] font-semibold text-white/60">{shareReleaseYear}</span>}
                {shareReview.rating !== undefined && (
                  <>
                    <span className="text-[36px] text-white/30">·</span>
                    <ShareRatingStars rating={shareReview.rating} size={36} gap={4} />
                    <span className="text-[36px] font-bold text-white/90">
                      {Number.isInteger(shareReview.rating) ? shareReview.rating : shareReview.rating.toFixed(1)}/10
                    </span>
                    {shareIsFavorite && <Heart className="h-[36px] w-[36px] fill-red-400 text-red-400" />}
                  </>
                )}
              </div>

              {shareReview.content && (
                <div className="relative mt-[50px] overflow-hidden pl-[56px]">
                  <Quote className="absolute left-0 top-0 h-[40px] w-[40px] rotate-180 text-white/35" />
                  <p className="whitespace-pre-line text-[36px] italic leading-[1.5] text-white/75 line-clamp-3">
                    {shareReview.content}
                  </p>
                </div>
              )}

              <div className="mt-[50px] flex items-center justify-between border-t border-white/10 pt-[36px]">
                <div className="flex items-center gap-[24px]">
                  <div className="h-[100px] w-[100px] overflow-hidden rounded-full border-[3px] border-white/20 shadow-xl">
                    <img src={userPhoto || '/user-icon.jpg'} crossOrigin={isExport ? "anonymous" : undefined} alt={shareReview.author} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-[32px] font-bold text-white">{shareReview.author}</p>
                    <p className="text-[24px] text-white/50">@{shareHandle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[20px] uppercase tracking-[0.22em] text-white/40">Watched</p>
                  <p className="mt-[8px] text-[28px] font-semibold text-white/85">{formatReviewDate(shareLatestWatchDate)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (shareTheme === 'cinematic') {
      return (
        <div {...ref} className="relative flex h-[1920px] w-[1080px] flex-col overflow-hidden bg-black text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]">
          <div className="relative h-[1000px] w-full shrink-0 overflow-hidden">
            {sharePreviewBackdrop ? (
              <img src={sharePreviewBackdrop} crossOrigin={isExport ? "anonymous" : undefined} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black" />

            <div className="absolute left-[80px] right-[80px] top-[110px] flex items-center justify-between">
              <div className="flex items-center gap-[16px] rounded-full border border-white/15 bg-black/55 px-[36px] py-[16px] backdrop-blur-md">
                <Clapperboard className="h-[30px] w-[30px] text-white" />
                <span className="text-[24px] font-bold uppercase tracking-[0.22em] text-white">{shareReview.mediaType === 'tv' ? 'Series Review' : 'Film Review'}</span>
              </div>
              <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[40px] object-contain brightness-0 invert opacity-90" />
            </div>
          </div>

          <div className="relative flex flex-1 flex-col bg-black px-[80px] pb-[80px] pt-0">
            <div className="relative flex shrink-0 items-end gap-[40px]">
              <div className="relative z-10 -mt-[180px]">
                {sharePreviewPoster ? (
                  <img
                    src={sharePreviewPoster}
                    crossOrigin={isExport ? "anonymous" : undefined}
                    alt={shareReview.title}
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
                  A {shareReview.mediaType === 'tv' ? 'Series' : 'Film'} By Review
                </p>
                <h1 className="mt-[20px] font-serif text-[96px] font-bold leading-[1.02] tracking-tight text-white line-clamp-2">
                  {shareReview.title || 'Untitled'}
                </h1>
                <div className="mt-[20px] flex flex-wrap items-center gap-[18px]">
                  {shareReleaseYear && <span className="text-[32px] font-semibold text-white/50">{shareReleaseYear}</span>}
                  {shareReview.rating !== undefined && (
                    <>
                      <span className="text-[32px] text-white/25">·</span>
                      <ShareRatingStars rating={shareReview.rating} size={32} gap={4} />
                      <span className="text-[30px] font-bold text-white/85">
                        {Number.isInteger(shareReview.rating) ? shareReview.rating : shareReview.rating.toFixed(1)}/10
                      </span>
                      {shareIsFavorite && <Heart className="h-[30px] w-[30px] fill-red-400 text-red-400" />}
                    </>
                  )}
                </div>
              </div>
            </div>

            {shareReview.content && (
              <div className="relative mt-[40px] overflow-hidden pl-[40px]" style={{ maxHeight: '360px' }}>
                <Quote className="absolute left-0 top-0 h-[32px] w-[32px] rotate-180 text-white/30" />
                <p className="whitespace-pre-line text-[30px] italic leading-[1.5] text-white/75 line-clamp-6">
                  {shareReview.content}
                </p>
              </div>
            )}

            <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-[30px]">
              <div className="flex items-center gap-[20px]">
                <div className="h-[72px] w-[72px] overflow-hidden rounded-full border border-white/15">
                  <img src={userPhoto || '/user-icon.jpg'} crossOrigin={isExport ? "anonymous" : undefined} alt={shareReview.author} className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-[28px] font-bold text-white">{shareReview.author}</p>
                  <p className="text-[20px] text-white/45">@{shareHandle}</p>
                </div>
              </div>
              <div className="flex items-center gap-[16px] opacity-85">
                <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[36px] w-auto object-contain" />
                <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[26px] w-auto object-contain brightness-0 invert" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (shareTheme === 'poster') {
      return (
        <div {...ref} className="relative h-[1920px] w-[1080px] overflow-hidden bg-black text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]">
          {sharePreviewPoster ? (
            <img src={sharePreviewPoster} crossOrigin={isExport ? "anonymous" : undefined} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
          <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-25" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)' opacity='0.9'/%3E%3C/svg%3E")` }} />

          <div className="absolute left-[80px] right-[80px] top-[80px] z-30 flex items-center justify-between">
            <div className="rounded-[24px] border border-white/15 bg-black/55 p-[20px] backdrop-blur-md">
              <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[70px] w-[70px] object-contain" />
            </div>
            <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[40px] object-contain opacity-85 brightness-0 invert" />
          </div>

          <div className="absolute inset-x-0 bottom-0 z-20 px-[80px] pb-[80px] pt-[40px]">
            <Quote className="h-[60px] w-[60px] rotate-180 text-white/45" />
            <h1 className="mt-[24px] font-serif text-[110px] font-bold leading-[1.02] tracking-tight text-white line-clamp-2 drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              {shareReview.title || 'Untitled'}
            </h1>
            <div className="mt-[26px] flex flex-wrap items-center gap-[20px]">
              {shareReleaseYear && <span className="text-[32px] font-semibold text-white/60">{shareReleaseYear}</span>}
              {shareReview.rating !== undefined && (
                <>
                  <span className="text-[32px] text-white/30">·</span>
                  <ShareRatingStars rating={shareReview.rating} size={32} gap={4} />
                  <span className="text-[32px] font-bold text-white/90">
                    {Number.isInteger(shareReview.rating) ? shareReview.rating : shareReview.rating.toFixed(1)}/10
                  </span>
                  {shareIsFavorite && <Heart className="h-[32px] w-[32px] fill-red-400 text-red-400" />}
                </>
              )}
            </div>

            {shareReview.content && (
              <p className="mt-[32px] whitespace-pre-line text-[34px] italic leading-[1.5] text-white/80 line-clamp-4">
                {shareReview.content}
              </p>
            )}

            <div className="mt-[40px] flex items-center justify-between border-t border-white/20 pt-[30px]">
              <div className="flex items-center gap-[20px]">
                <div className="h-[80px] w-[80px] overflow-hidden rounded-full border border-white/25">
                  <img src={userPhoto || '/user-icon.jpg'} crossOrigin={isExport ? "anonymous" : undefined} alt={shareReview.author} className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-[28px] font-bold text-white">{shareReview.author}</p>
                  <p className="text-[20px] text-white/50">@{shareHandle}</p>
                </div>
              </div>
              <div className="flex items-center gap-[16px] opacity-90">
                <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[36px] w-auto object-contain" />
                <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[24px] w-auto object-contain brightness-0 invert" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div {...ref} className="relative h-[1920px] w-[1080px] overflow-hidden bg-black text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]">
        {sharePreviewBackdrop ? (
          <img src={sharePreviewBackdrop} crossOrigin={isExport ? "anonymous" : undefined} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-950 to-black" />
        )}
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40" />

        <div className="absolute left-1/2 top-1/2 w-[820px] -translate-x-1/2 -translate-y-1/2">
          <div className={`absolute inset-0 overflow-hidden rounded-[32px] border border-white/[0.18] bg-black/60 text-white shadow-[0_48px_140px_rgba(0,0,0,0.58)]`}>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          </div>
          <div className="relative z-10 px-[42px] pb-[34px] pt-[38px]">
            <div className="flex items-center gap-[16px] pr-[190px]">
              <div className="h-[58px] w-[58px] shrink-0 overflow-hidden rounded-full border border-white/10 bg-zinc-800">
                <img src={userPhoto || '/user-icon.jpg'} crossOrigin={isExport ? "anonymous" : undefined} alt={shareReview.author} className="h-full w-full object-cover" />
              </div>
              <span className="max-w-[470px] truncate text-[24px] font-semibold tracking-tight text-zinc-300">{shareReview.author}</span>
            </div>

            <div className="absolute right-[42px] top-[38px] h-[230px] w-[154px] overflow-hidden rounded-[7px] border border-white/10 bg-zinc-900 shadow-[0_22px_55px_rgba(0,0,0,0.48)]">
              {sharePreviewPoster ? (
                <img src={sharePreviewPoster} crossOrigin={isExport ? "anonymous" : undefined} alt={shareReview.title || ''} className="h-full w-full object-cover" />
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
                  {shareIsFavorite && <Heart className="h-[26px] w-[26px] shrink-0 fill-red-500 text-red-500 drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)]" />}
                </div>
              )}
            </div>

            {(shareLatestWatchDate || shareIsRewatch) && (
              <div className="mt-[34px] flex items-center gap-[12px]">
                <p className="text-[20px] font-medium text-zinc-500">Watched {formatReviewDate(shareLatestWatchDate)}</p>
                {shareIsRewatch && (
                  <span className="inline-flex items-center gap-[8px] text-[15px] font-semibold tracking-[0.02em] text-zinc-500">
                    <RotateCcw className="h-[17px] w-[17px] stroke-[2]" />
                    Rewatch ×{shareWatchCount}
                  </span>
                )}
              </div>
            )}

            <div className="relative mt-[20px] pl-[38px]">
              <Quote className="absolute left-1.5 -top-0.5 h-[28px] w-[28px] rotate-180 text-white/25" />
              <p
                className="overflow-hidden whitespace-pre-line font-normal tracking-[-0.01em] text-zinc-300"
                style={{
                  fontSize: shareTextSize === 'small' ? '22px' : shareTextSize === 'large' ? '30px' : (shareReview.content?.length || 0) > 700 ? '22px' : (shareReview.content?.length || 0) > 420 ? '25px' : '28px',
                  lineHeight: 1.43,
                  maxHeight: shareTextSize === 'large' ? '680px' : '620px',
                }}
              >
                {shareReview.content}
              </p>
            </div>

            <div className="mt-[30px] flex items-center justify-between border-t border-white/[0.055] pt-[20px]">
              <span className="text-[16px] font-medium text-zinc-600">{shareReview.mediaType === 'tv' ? 'Series review' : 'Film review'}</span>
              <div className="flex items-center gap-[12px] opacity-80">
                <img src="/Cinescape_Logo.svg" alt="Logo" className="h-[28px] w-auto object-contain" />
                <img src="/Cinescape_Wordmark.svg" alt="Cinescape" className="h-[20px] w-auto object-contain brightness-0 invert" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (reviews.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-white/[0.02] p-10 sm:p-14 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_80px_-20px_rgba(0,0,0,0.5)] backdrop-blur-3xl max-w-md mx-auto transform-gpu">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center max-w-xs mx-auto">
          <div className="flex items-center justify-center w-16 h-16 rounded-[24px] border border-white/[0.06] bg-white/[0.03] text-zinc-600 mb-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <MessageSquare className="w-6 h-6 stroke-[1.5] text-emerald-400/80" />
          </div>
          <h3 className="text-base font-bold text-white tracking-tight">Timeline Empty</h3>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            Your critique panel is clear. Author a review inside any title catalog to map your cinematic footprint here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full transform-gpu">
      {!compact && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: 'Average rating', value: averageRating ? averageRating.toFixed(1) : '—', icon: <Star className="h-4 w-4 fill-amber-300 text-amber-300" /> },
            { label: 'Reviews', value: reviews.length, icon: <MessageSquare className="h-4 w-4 text-emerald-300" /> },
            { label: 'Movies', value: movieCount, icon: <Clapperboard className="h-4 w-4 text-red-300" /> },
            { label: 'Series', value: tvCount, icon: <Tv className="h-4 w-4 text-cyan-300" /> },
            { label: 'Favorites', value: favoritesReviewed, icon: <Heart className="h-4 w-4 text-rose-300" /> },
            { label: 'Rewatches', value: rewatchesReviewed, icon: <RotateCcw className="h-4 w-4 text-violet-300" /> },
          ].map((stat) => (
            <div key={stat.label} className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_-10px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">{stat.label}</p>
                {stat.icon}
              </div>
              <p className="mt-3 text-2xl font-black leading-none tabular-nums text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {!compact && (
        <div className="flex items-center justify-start">
          <div className="relative flex items-center p-1 bg-[#0a0a0a]/80 backdrop-blur-3xl border border-white/[0.08] rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setMediaType('all')}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold tracking-wide transition-all duration-300 active:scale-95 sm:flex-initial sm:px-5 sm:text-xs ${mediaType === 'all' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              All
              <span className={`text-[10px] ${mediaType === 'all' ? 'text-white/80' : 'text-zinc-500'}`}>{reviews.length}</span>
              {mediaType === 'all' && <motion.div layoutId="liquid-pill" className="absolute inset-0 -z-10 rounded-xl border border-white/[0.12] bg-gradient-to-b from-white/[0.12] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_10px_rgba(0,0,0,0.2)]" transition={{ type: 'spring', stiffness: 320, damping: 30 }} />}
            </button>
            <button
              type="button"
              onClick={() => setMediaType('movie')}
              className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 font-bold text-[11px] sm:text-xs tracking-wide transition-all duration-300 rounded-xl select-none active:scale-95 ${mediaType === 'movie'
                ? 'text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'
                : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <Clapperboard className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${mediaType === 'movie' ? 'scale-110 text-red-400' : ''}`} />
              <span>Movies</span>
              <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-md font-extrabold transition-colors duration-300 ${mediaType === 'movie' ? 'bg-white/20 text-white' : 'bg-white/[0.04] text-zinc-500'}`}>
                {movieCount}
              </span>
              {mediaType === 'movie' && (
                <motion.div
                  layoutId="liquid-pill"
                  className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.12] to-white/[0.02] border border-white/[0.12] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_10px_rgba(0,0,0,0.2)]"
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMediaType('tv')}
              className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 font-bold text-[11px] sm:text-xs tracking-wide transition-all duration-300 rounded-xl select-none active:scale-95 ${mediaType === 'tv'
                ? 'text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'
                : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <Tv className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${mediaType === 'tv' ? 'scale-110 text-cyan-400' : ''}`} />
              <span>Series</span>
              <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-md font-extrabold transition-colors duration-300 ${mediaType === 'tv' ? 'bg-white/20 text-white' : 'bg-white/[0.04] text-zinc-500'}`}>
                {tvCount}
              </span>
              {mediaType === 'tv' && (
                <motion.div
                  layoutId="liquid-pill"
                  className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.12] to-white/[0.02] border border-white/[0.12] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_10px_rgba(0,0,0,0.2)]"
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                />
              )}
            </button>
            <div className="absolute inset-y-1 left-1 right-1 pointer-events-none overflow-hidden rounded-xl">
              <motion.div
                className={`absolute top-0 bottom-0 w-1/3 blur-lg opacity-60 transition-colors duration-500 ${mediaType === 'movie'
                  ? 'bg-gradient-to-r from-red-500/10 via-red-500/20 to-orange-500/10'
                  : mediaType === 'tv'
                    ? 'bg-gradient-to-l from-cyan-500/10 via-sky-500/20 to-blue-500/10'
                    : 'bg-gradient-to-r from-emerald-500/10 via-white/10 to-cyan-500/10'
                  }`}
                animate={{ x: mediaType === 'all' ? '0%' : mediaType === 'movie' ? '100%' : '200%' }}
                transition={{ type: 'spring', stiffness: 240, damping: 28 }}
              />
            </div>
          </div>
        </div>
      )}

      {!compact && (
        <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a0a0a]/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-3xl sm:p-4 space-y-3">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex flex-col gap-3 sm:flex-row relative z-10">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search titles or review text…" className="h-12 w-full rounded-2xl border border-white/[0.06] bg-black/40 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300/30 focus:bg-white/[0.04] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
            </label>
            <label className="relative flex h-12 items-center gap-2 rounded-2xl border border-white/[0.06] bg-black/40 px-4 text-xs text-white/40 sm:w-56 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-white/30" />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as ReviewSort)} className="w-full appearance-none bg-transparent pr-5 text-sm text-white outline-none">
                <option value="newest" className="bg-zinc-950">Newest</option>
                <option value="oldest" className="bg-zinc-950">Oldest</option>
                <option value="highest" className="bg-zinc-950">Highest rated</option>
                <option value="lowest" className="bg-zinc-950">Lowest rated</option>
                <option value="watched" className="bg-zinc-950">Recently watched</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-white/30" />
            </label>
          </div>
          <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 relative z-10">
            {([['all', 'All reviews'], ['9', '9+ rated'], ['8', '8+ rated'], ['7', '7+ rated'], ['favorites', 'Favorites'], ['rewatches', 'Rewatches']] as [ReviewFilter, string][]).map(([filter, label]) => (
              <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-xl border px-4 py-2.5 text-[11px] font-bold tracking-wide transition-all duration-300 active:scale-[0.97] ${activeFilter === filter ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_20px_-5px_rgba(16,185,129,0.3)]' : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06] hover:text-white'}`}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {!compact && reviews.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2 pt-2">
          <div>
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Review Timeline</h2>
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-white/40">{filteredReviews.length} {filteredReviews.length === 1 ? 'review' : 'reviews'} shown · pinned reviews stay first</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[10px] font-bold tracking-wide text-white/50 self-start sm:self-end">
            {pinnedCount}/5 pinned
          </span>
        </div>
      )}

      {filteredReviews.length === 0 ? (
        <div className="relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.01] p-8 text-center backdrop-blur-2xl my-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"><Search className="h-5 w-5" /></div>
          <p className="mt-4 text-sm font-bold text-white">No matching reviews</p>
          <p className="mt-1 text-xs text-white/40">Try another search or clear the selected filters.</p>
          {!compact && <button type="button" onClick={() => { setSearchText(''); setActiveFilter('all'); setMediaType('all'); setSortBy('newest'); }} className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-2.5 text-[11px] font-bold text-white/60 transition hover:bg-white/[0.1] hover:text-white active:scale-95">Clear filters</button>}
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
            const watchedDates = reviewHistoryMeta?.watchedDates ?? [];
            const expanded = expandedReviews.has(review.id);
            const spoilerRevealed = revealedSpoilers.has(review.id);
            const favorite = favoriteKeys.has(getReviewMediaKey(review));
            const inMyList = myListKeys.has(getReviewMediaKey(review));
            const inWatchlist = watchlistKeys.has(getReviewMediaKey(review));
            const isWatched = Boolean(reviewHistoryMeta?.latestWatchedDate);
            const olderVersion = getCompareVersion(review);
            const cardContent = (
              <>
                <div className="absolute inset-0 z-0 pointer-events-none">
                  {review.posterPath && (
                    <div className="absolute right-0 top-0 bottom-0 w-2/3 opacity-[0.02] group-hover:opacity-[0.06] blur-[2px] group-hover:blur-0 group-hover:scale-105 transition-all duration-700 overflow-hidden mix-blend-luminosity">
                      <img src={`https://image.tmdb.org/t/p/w342${review.posterPath}`} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/60 to-transparent" />
                    </div>
                  )}
                  <div className="absolute -inset-px rounded-[26px] border border-transparent group-hover:border-emerald-500/20 bg-gradient-to-b from-white/[0.06] to-transparent [mask-image:linear-gradient(to_bottom,white,transparent)] group-hover:[mask-image:none] transition-all duration-500" />
                </div>
                <div className="relative z-10 flex flex-row gap-4 items-start w-full h-full">
                  {review.posterPath && (
                    <div className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-[14px] overflow-hidden border border-white/[0.08] shrink-0 bg-zinc-950 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.6)] group-hover:border-emerald-500/30 group-hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] transition-all duration-500 self-start">
                      <img src={`https://image.tmdb.org/t/p/w185${review.posterPath}`} alt={review.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full min-h-[96px] sm:min-h-[112px] w-full">
                    <div className="space-y-1.5 w-full pr-12 sm:pr-24">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-900 border border-white/[0.1] shrink-0">
                          <img src={userPhoto || '/user-icon.jpg'} alt={review.author} className="w-full h-full object-cover" />
                        </div>
                        <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider truncate">{review.author}</span>
                      </div>
                      {review.title && (
                        <h4 className="flex items-center gap-2 truncate text-sm font-black tracking-tight text-white transition-colors duration-300 group-hover:text-emerald-300 sm:text-base">
                          <span className="truncate">{review.title}</span>
                          {review.pinned && <Pin className="h-3.5 w-3.5 shrink-0 fill-current text-rose-300 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]" />}
                        </h4>
                      )}
                      {review.content && (
                        <div className="relative pt-1">
                          <Quote className="absolute -left-1 -top-1.5 h-3 w-3 rotate-180 text-white/30 pointer-events-none" />
                          {review.spoiler && !spoilerRevealed ? (
                            <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setRevealedSpoilers((current) => new Set(current).add(review.id)); }} className="relative flex min-h-12 w-full items-center overflow-hidden rounded-xl border border-white/[0.08] bg-black/30 pl-3 text-left text-[11px] font-semibold text-white/65 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                              <span aria-hidden="true" className="absolute inset-0 overflow-hidden whitespace-pre-line px-3.5 py-2.5 text-left text-xs text-white/65 blur-[6px]">{review.content}</span>
                              <span className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" />
                              <span className="relative z-10 inline-flex items-center gap-2"><EyeOff className="h-4 w-4 shrink-0 text-rose-300" />Potential spoilers · Tap to reveal</span>
                            </button>
                          ) : (
                            <>
                              <p className={`whitespace-pre-line pl-3 text-xs font-normal leading-relaxed text-zinc-400 transition-colors group-hover:text-zinc-200 sm:text-[13px] ${expanded ? '' : 'line-clamp-2'}`}>
                                {review.content}
                              </p>
                              {review.spoiler && (
                                <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setRevealedSpoilers((current) => { const next = new Set(current); next.delete(review.id); return next; }); }} className="ml-3 mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-300 hover:text-white transition">
                                  <EyeOff className="h-3 w-3" />Hide spoiler
                                </button>
                              )}
                              {review.content.length > 120 && (
                                <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleExpanded(review.id); }} className="ml-3 mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 transition hover:text-white">
                                  {expanded ? 'Read less' : 'Read more'}
                                  <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-white/[0.04]">
                      <div className="flex items-center gap-2 flex-wrap">
                        {review.rating !== undefined ? (
                          <div className="flex items-center gap-1 bg-amber-500/[0.08] border border-amber-500/20 px-2 py-0.5 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
                            <span className="text-[10px] font-black text-amber-300 tracking-wider">{review.rating.toFixed(1)}</span>
                          </div>
                        ) : null}
                        <span className="text-[9px] font-extrabold tracking-widest text-zinc-500 uppercase bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 rounded-md shrink-0">
                          {review.mediaType === 'tv' ? 'Series' : 'Movie'}
                        </span>
                        {isRewatch && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <RotateCcw className="h-3 w-3 stroke-[2] text-zinc-400" />
                            <span>Rewatch ×{reviewWatchCount}</span>
                          </span>
                        )}
                        {favorite && <span className="inline-flex items-center gap-1 rounded-lg border border-rose-300/20 bg-rose-300/[0.08] px-2 py-0.5 text-[9px] font-semibold text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"><Heart className="h-2.5 w-2.5 fill-current" />Favorite</span>}
                        {inMyList && <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold text-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"><Bookmark className="h-2.5 w-2.5" />My List</span>}
                        {inWatchlist && <span className="inline-flex items-center gap-1 rounded-lg border border-sky-300/20 bg-sky-300/[0.08] px-2 py-0.5 text-[9px] font-semibold text-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"><Eye className="h-2.5 w-2.5" />Watchlist</span>}
                        {isWatched && <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] px-2 py-0.5 text-[9px] font-semibold text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"><Check className="h-2.5 w-2.5" />Watched</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-500 text-[9px] font-semibold shrink-0 uppercase tracking-widest bg-white/[0.02] border border-white/[0.04] px-2 py-0.5 rounded-lg">
                        <LucideCalendarDays className="w-3 h-3 text-emerald-500/70" />
                        <span>{formatReviewDate(latestWatchDate)}</span>
                      </div>
                    </div>
                    {isRewatch && !compact && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/30 px-3.5 py-2.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
                        <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-white/50">
                          <RotateCcw className="h-3.5 w-3.5 text-violet-300" />
                          Rewatch evolution · {reviewWatchCount} watches
                          {watchedDates[2] && <span className="text-white/30">· 3rd watch {formatReviewDate(watchedDates[2])}</span>}
                        </span>
                        {(olderVersion || watchedDates.length > 1) && (
                          <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setCompareReview(review); }} className="text-[10px] font-bold text-emerald-300 transition hover:text-white">Compare reviews</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_12px_rgba(0,0,0,0.2)] backdrop-blur-md transition hover:bg-white/[0.12] hover:text-white active:scale-90 sm:right-4 sm:top-4"
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMobileActionsReview(review); }}
                  title="Review actions"
                  aria-label={`Review actions for ${review.title || 'review'}`}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </>
            );
            const baseStyles = `group relative flex flex-col overflow-hidden border border-white/[0.08] bg-[#0a0a0a]/50 rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_50px_-15px_rgba(0,0,0,0.4)] backdrop-blur-3xl transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.04] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_25px_60px_-15px_rgba(0,0,0,0.5)] ${compact ? 'w-[280px] sm:w-[340px] flex-shrink-0 snap-start' : 'w-full'}`;
            return review.movieId ? (
              <Link key={review.id} to={review.mediaType === 'tv' ? `/tv/${review.movieId}` : `/movie/${review.movieId}`} className={`${baseStyles} hover:bg-[#0a0a0a]/70 active:scale-[0.995]`}>
                {cardContent}
              </Link>
            ) : (
              <div key={review.id} className={baseStyles}>{cardContent}</div>
            );
          })}
        </div>
      )}

      {mobileActionsReview &&
        createPortal(
          <div className="fixed inset-0 z-[9998] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <button type="button" aria-label="Close review actions" className="absolute inset-0 h-full w-full border-0 bg-black/60 p-0 backdrop-blur-md" onClick={() => setMobileActionsReview(null)} />
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 30, stiffness: 360 }}
              className="relative z-10 w-full max-w-md rounded-t-[32px] border border-white/[0.12] bg-[#0a0a0a]/90 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-3xl sm:rounded-[32px] sm:pb-6"
            >
              <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/20" />
              <div className="mb-5 flex items-center gap-4">
                {mobileActionsReview.posterPath ? (
                  <img src={`https://image.tmdb.org/t/p/w185${mobileActionsReview.posterPath}`} alt={mobileActionsReview.title || ''} className="h-16 w-11 shrink-0 rounded-xl border border-white/10 object-cover shadow-lg" />
                ) : (
                  <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"><Film className="h-4 w-4 text-zinc-600" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-white">{mobileActionsReview.title || 'Untitled'}</p>
                  <p className="mt-1 text-[11px] font-medium text-zinc-400">{mobileActionsReview.mediaType === 'tv' ? 'Series review' : 'Film review'}</p>
                </div>
                <button type="button" onClick={() => setMobileActionsReview(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 active:scale-90 transition"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-2">
                <button type="button" onClick={() => openShare(mobileActionsReview)} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-left text-sm font-semibold text-zinc-200 transition active:scale-[0.99] hover:bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"><Share2 className="h-4 w-4" /></span>Share review
                </button>
                <button type="button" onClick={() => { const review = mobileActionsReview; setMobileActionsReview(null); handleOpenEdit(review); }} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-left text-sm font-semibold text-zinc-200 transition active:scale-[0.99] hover:bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"><Edit3 className="h-4 w-4" /></span>Edit review
                </button>
                <button type="button" onClick={() => togglePinned(mobileActionsReview)} disabled={!mobileActionsReview.pinned && pinnedCount >= 5} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-left text-sm font-semibold text-zinc-200 transition active:scale-[0.99] hover:bg-white/[0.06] disabled:opacity-40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-400/10 text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">{mobileActionsReview.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</span>{mobileActionsReview.pinned ? 'Unpin review' : 'Pin to profile'}
                </button>
                <button type="button" onClick={() => toggleSpoiler(mobileActionsReview)} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-left text-sm font-semibold text-zinc-200 transition active:scale-[0.99] hover:bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">{mobileActionsReview.spoiler ? <Eye className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}</span>{mobileActionsReview.spoiler ? 'Remove spoiler mark' : 'Mark as spoiler'}
                </button>
                <button type="button" onClick={async () => { const review = mobileActionsReview; setMobileActionsReview(null); await handleDelete(review.id); }} className="flex w-full items-center gap-3 rounded-2xl border border-red-500/10 bg-red-500/[0.03] px-4 py-3.5 text-left text-sm font-semibold text-red-300 transition active:scale-[0.99] hover:bg-red-500/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"><Trash2 className="h-4 w-4" /></span>Delete review
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {compareReview &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <button type="button" aria-label="Close review comparison" onClick={() => setCompareReview(null)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ y: 24, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 30, stiffness: 360 }} className="relative max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-t-[32px] border border-white/[0.12] bg-[#0a0a0a]/90 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-3xl sm:rounded-[32px] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Rewatch evolution</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{compareReview.title || 'Untitled'}</h3>
                  <p className="mt-1 text-sm text-white/50">Compare this review with an earlier saved version.</p>
                </div>
                <button type="button" onClick={() => setCompareReview(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 transition hover:bg-white/[0.1] hover:text-white active:scale-90"><X className="h-5 w-5" /></button>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Earlier saved version</p>
                  {getCompareVersion(compareReview) ? (
                    <>
                      <p className="mt-3 text-xs font-medium text-white/40">{formatReviewDate(getCompareVersion(compareReview)?.timestamp ?? getCompareVersion(compareReview)?.watchedDate)}</p>
                      <p className="mt-4 text-xl font-black text-white">{getCompareVersion(compareReview)?.rating !== undefined ? `${getCompareVersion(compareReview)?.rating}/10` : 'No saved rating'}</p>
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/60">{getCompareVersion(compareReview)?.content || 'No older review text was saved.'}</p>
                    </>
                  ) : (
                    <p className="mt-4 text-sm leading-relaxed text-white/50">Earlier watch dates are available in your history, but no older review or rating snapshot was saved for comparison.</p>
                  )}
                </div>
                <div className="rounded-[20px] border border-emerald-300/20 bg-emerald-300/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-200/70">Current review</p>
                  <p className="mt-3 text-xs font-medium text-white/40">{formatReviewDate(compareReview.timestamp)}</p>
                  <p className="mt-4 text-xl font-black text-white">{compareReview.rating !== undefined ? `${compareReview.rating}/10` : 'No rating'}</p>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/80">{compareReview.content || 'No review text.'}</p>
                </div>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {editingReview &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none antialiased">
            <div onClick={handleCloseEdit} className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-opacity duration-300" />
            <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-[32px] border border-white/[0.12] bg-[#0a0a0a]/90 p-5 sm:p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-3xl transition-all">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="relative flex flex-col sm:flex-row gap-6">
                {editingReview.posterPath ? (
                  <div className="relative shrink-0 w-28 h-40 sm:w-48 sm:h-auto rounded-[24px] overflow-hidden border border-white/10 bg-black/40 shadow-2xl self-center sm:self-stretch group">
                    <img src={`https://image.tmdb.org/t/p/w342${editingReview.posterPath}`} alt={editingReview.title || 'Movie Poster'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[24px] pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                  </div>
                ) : (
                  <div className="relative shrink-0 w-28 h-40 sm:w-48 sm:h-auto rounded-[24px] border border-white/10 bg-white/[0.03] flex flex-col items-center justify-center gap-3 text-zinc-500 self-center sm:self-stretch shadow-inner">
                    <Film className="h-8 w-8 sm:h-10 sm:w-10 stroke-[1.5]" />
                    <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-600">No Poster</span>
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-between space-y-5 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Edit2 className="h-4 w-4 stroke-[2] text-emerald-400" />
                        <h3 className="text-xs font-bold tracking-widest text-emerald-400/80 uppercase">Edit Review</h3>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="text-lg sm:text-2xl font-black tracking-tight text-white truncate">{editingReview.title || 'Untitled'}</h4>
                        <span className="inline-flex shrink-0 items-center rounded-lg bg-white/[0.05] border border-white/[0.1] px-2 py-1 text-[10px] font-bold text-zinc-300 tracking-wider uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                          {editingReview.mediaType || 'Movie'}
                        </span>
                      </div>
                    </div>
                    <button type="button" onClick={handleCloseEdit} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.1] text-zinc-400 hover:text-white hover:bg-white/[0.1] active:scale-90 transition-all shadow-sm"><X className="h-4 w-4 stroke-[2.5]" /></button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Review Content</label>
                      {typeof editContent !== 'undefined' && <span className="text-[11px] font-medium text-zinc-500 tabular-nums">{editContent.length} / 1000</span>}
                    </div>
                    <div className="relative rounded-[20px] border border-white/[0.08] bg-black/50 p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] focus-within:border-emerald-500/40 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all">
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4} maxLength={1000} className="w-full rounded-[16px] bg-transparent p-4 text-sm text-white placeholder-zinc-600 focus:outline-none resize-none leading-relaxed font-normal antialiased" placeholder="Share your thoughts on performance, pacing, or direction..." />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="button" onClick={handleCloseEdit} className="h-10 px-5 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-bold text-zinc-300 hover:bg-white/[0.08] hover:text-white active:scale-95 transition-all">Cancel</button>
                    <button type="button" onClick={handleUpdateReview} disabled={isUpdating || (typeof editContent !== 'undefined' && editContent.trim().length === 0)} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-300 to-emerald-500 px-6 text-xs font-bold text-emerald-950 shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none">
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin text-emerald-950" /> : <Check className="h-4 w-4 stroke-[3]" />}
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
            <div className="fixed inset-0 z-[10065] flex items-end justify-center p-0 overflow-hidden sm:items-center sm:p-5">
              <div onClick={() => setShareReview(null)} className="absolute inset-0 bg-black/60 sm:bg-black/40" />
              <div className="pointer-events-none absolute inset-0 backdrop-blur-xl sm:backdrop-blur-md" />

              <motion.div
                initial={{ opacity: 0, y: 80, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 70, scale: 0.985 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                className="relative z-10 flex h-[92dvh] max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[32px] border border-white/[0.12] bg-[#0a0a0a]/95 shadow-[0_-20px_60px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)] sm:h-[min(88dvh,820px)] sm:max-h-[88dvh] sm:grid sm:grid-cols-[minmax(0,1fr)_360px] sm:rounded-[32px] backdrop-blur-3xl lg:grid-cols-[minmax(0,1fr)_380px]"
              >
                <div className="flex w-full flex-col overflow-hidden p-3 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:p-6">
                  <div className="mb-3 flex shrink-0 items-center justify-between gap-3 sm:mb-5">
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-white sm:text-xl">Share Review</h3>
                      <p className="text-[11px] font-medium text-white/40">9:16 review card · export in 1080×1920</p>
                    </div>
                    <button type="button" onClick={() => setShareReview(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 transition hover:bg-white/10 hover:text-white active:scale-90"><X className="h-5 w-5" /></button>
                  </div>

                  <div className="flex h-[36dvh] min-h-[190px] max-h-[340px] shrink-0 items-center justify-center py-1 sm:h-auto sm:min-h-0 sm:max-h-none sm:flex-1 sm:py-4">
                    <div ref={previewContainerRef} className="relative h-full aspect-[9/16] w-auto max-w-full shrink-0 overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] sm:rounded-[32px]">
                      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${previewScale})`, width: '1080px', height: '1920px' }}>
                        {renderShareCard(false)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain border-t border-white/[0.06] bg-[#0a0a0a]/50 p-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent sm:flex-none sm:w-[360px] sm:border-l sm:border-t-0 lg:w-[380px]">
                  <div className="space-y-5 pb-2">
                    <div>
                      <p className="text-xs font-bold text-white mb-2.5">Card theme</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {([['minimal', 'Minimal'], ['cinematic', 'Cinematic'], ['poster', 'Poster-first'], ['backdrop', 'Backdrop-first']] as [ShareTheme, string][]).map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setShareTheme(value)} className={`rounded-xl border px-3.5 py-3 text-left text-[11px] font-bold transition active:scale-[0.98] ${shareTheme === value ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/80'}`}>{label}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-white mb-2.5">Review text</p>
                      <div className="grid grid-cols-3 gap-2.5">
                        {([['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] as [ShareTextSize, string][]).map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setShareTextSize(value)} className={`rounded-xl border px-3 py-3 text-center text-[11px] font-bold transition active:scale-[0.98] ${shareTextSize === value ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/80'}`}>{label}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-white mb-1.5">Artwork</p>
                      <p className="text-[10px] text-white/40 mb-3">Choose, randomize, or reset your poster and backdrop</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button type="button" onClick={() => setShareArtworkSelector('poster')} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3.5 text-[11px] font-bold text-white/75 transition hover:bg-white/[0.08] hover:text-white active:scale-95">
                        <ImageIcon className="h-4 w-4 text-amber-300" />Poster
                      </button>
                      <button type="button" onClick={() => setShareArtworkSelector('backdrop')} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3.5 text-[11px] font-bold text-white/75 transition hover:bg-white/[0.08] hover:text-white active:scale-95">
                        <ImageIcon className="h-4 w-4 text-sky-300" />Backdrop
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button type="button" onClick={randomizeShareArtwork} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 text-[11px] font-bold text-emerald-300 transition hover:bg-emerald-400/20 active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                        <Sparkles className="h-4 w-4" />Randomize
                      </button>
                      <button type="button" onClick={resetShareArtwork} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] font-bold text-white/55 transition hover:bg-white/[0.08] hover:text-white active:scale-95">
                        <RotateCcw className="h-4 w-4" />Reset
                      </button>
                    </div>

                    {shareReview.rating !== undefined && (
                      <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Your rating</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <Star className="h-5 w-5 fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                              <span className="text-xl font-black tabular-nums text-white">{shareReview.rating.toFixed(1)}</span>
                            </div>
                          </div>
                          {shareIsFavorite && (
                            <div className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-red-500 to-red-600 px-3.5 py-2.5 text-[11px] font-bold text-white shadow-[0_8px_20px_-5px_rgba(239,68,68,0.5),inset_0_1px_0_rgba(255,255,255,0.3)]">
                              <Heart className="h-4 w-4 fill-current" /> Favorite
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <button type="button" onClick={handleDownloadImage} disabled={isDownloading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-200 via-emerald-300 to-emerald-400 px-5 py-4 text-sm font-black text-emerald-950 shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50">
                      {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                      {isDownloading ? 'Exporting…' : 'Save Review Card'}
                    </button>
                    <button type="button" onClick={() => setShareReview(null)} className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-xs font-bold text-white/60 transition hover:bg-white/[0.06] hover:text-white active:scale-95">
                      Close
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden="true">
              {renderShareCard(true)}
            </div>

            {shareArtworkSelector && (
              <div className="fixed inset-0 z-[10080] flex items-end justify-center bg-black/80 p-0 backdrop-blur-lg sm:items-center sm:p-5" onClick={() => setShareArtworkSelector(null)}>
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} onClick={(event) => event.stopPropagation()} className="flex h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[32px] border border-white/[0.12] bg-[#0a0a0a]/95 shadow-[0_-20px_60px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-3xl sm:h-[80vh] sm:rounded-[32px]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6">
                    <div>
                      <h3 className="text-base font-bold text-white">Choose {shareArtworkSelector === 'poster' ? 'Poster' : 'Backdrop'}</h3>
                      <p className="text-[11px] text-white/40 mt-0.5">{shareArtworkChoices.length} TMDB images available</p>
                    </div>
                    <button type="button" onClick={() => setShareArtworkSelector(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 hover:text-white active:scale-90 transition"><X className="h-4 w-4" /></button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    {shareArtworkLoading ? (
                      <div className="flex h-full items-center justify-center gap-3 text-sm text-white/50"><Loader2 className="h-5 w-5 animate-spin text-amber-300" />Loading artwork…</div>
                    ) : shareArtworkChoices.length ? (
                      <div className={shareArtworkSelector === 'poster' ? 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'}>
                        {shareArtworkChoices.map((url) => {
                          const selected = shareArtworkSelector === 'poster' ? shareSelectedPoster === url : shareSelectedBackdrop === url;
                          return (
                            <button
                              key={url}
                              type="button"
                              onClick={() => shareArtworkSelector === 'poster' ? setShareSelectedPoster(url) : setShareSelectedBackdrop(url)}
                              className={`relative overflow-hidden rounded-[16px] border bg-zinc-900 transition-all duration-300 active:scale-[0.98] ${shareArtworkSelector === 'poster' ? 'aspect-[2/3]' : 'aspect-video'} ${selected ? 'border-emerald-400 ring-2 ring-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-white/10 hover:border-white/30'}`}
                            >
                              <img src={url.replace('/original/', shareArtworkSelector === 'poster' ? '/w342/' : '/w500/')} alt="" loading="lazy" className="h-full w-full object-cover" />
                              {selected && <span className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-lg"><Check className="h-4 w-4 stroke-[3]" /></span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center"><ImageIcon className="mb-3 h-10 w-10 text-white/20" /><p className="text-sm font-medium text-white/60">No additional images found</p></div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-4 sm:px-6">
                    <button type="button" onClick={resetShareArtwork} className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-[11px] font-bold text-white/55 hover:text-white transition"><RotateCcw className="h-4 w-4" />Reset</button>
                    <button type="button" onClick={randomizeShareArtwork} className="flex h-10 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 text-[11px] font-bold text-emerald-300 hover:bg-emerald-400/20 transition"><Sparkles className="h-4 w-4" />Randomize</button>
                    <button type="button" onClick={() => setShareArtworkSelector(null)} className="ml-auto h-10 rounded-xl bg-gradient-to-b from-emerald-200 to-emerald-400 px-6 text-[11px] font-black text-emerald-950 shadow-[0_5px_15px_-5px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.5)] hover:brightness-110 active:scale-95 transition">Done</button>
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
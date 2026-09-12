import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Calendar, Check, ChevronDown, Clapperboard, Copy, Download, Eye, Flame, Heart, Image as ImageIcon, Link2, Loader2, Pencil, RotateCcw, Search, Share2, Sparkles, Star, Trash2, Tv, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toPng } from "html-to-image";
import axios from "axios";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase.ts";
import { RatedMovie } from "./Recommendation.tsx";

type MediaTypeFilter = "movie" | "tv";
type SortKey = "highest" | "lowest" | "recent" | "year" | "az";
type RatingRange = "all" | "10" | "9+" | "8+" | "7+";
type DecadeFilter = "all" | "2020s" | "2010s" | "2000s" | "older";

type RatedMovieExt = RatedMovie & {
  releaseDate?: string;
  release_date?: string;
  firstAirDate?: string;
  first_air_date?: string;
  year?: string | number;
  ratedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  favorite?: boolean;
  movieId?: string | number;
  mediaId?: string | number;
  tmdbId?: string | number;
  vote_average?: number;
};

type SharePayload = {
  item: RatedMovieExt;
  year: string;
  posterUrl: string;
};

type ShareMediaImage = {
  file_path: string;
  vote_count?: number;
  vote_average?: number;
  aspect_ratio?: number;
  width?: number;
  height?: number;
};

type ArtworkTab = "poster" | "backdrop";
type ShareStatus = "now_watching" | "just_watched" | "recommended" | "favorite" | "rewatch";

const STATUS_OPTIONS = [
  { id: "now_watching" as ShareStatus, label: "NOW WATCHING", icon: Eye },
  { id: "just_watched" as ShareStatus, label: "JUST WATCHED", icon: Check },
  { id: "recommended" as ShareStatus, label: "RECOMMENDED", icon: Star },
  { id: "favorite" as ShareStatus, label: "MY FAVORITE", icon: Heart },
  { id: "rewatch" as ShareStatus, label: "REWATCH", icon: RotateCcw },
];

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

const tmdbAPIKey = "859afbb4b98e3b467da9c99ac390e950";
const releaseYearCache = new Map<string, string>();

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "highest", label: "Highest Rated" },
  { key: "lowest", label: "Lowest Rated" },
  { key: "recent", label: "Recently Rated" },
  { key: "year", label: "Release Year" },
  { key: "az", label: "A–Z" },
];

const ratingOptions: RatingRange[] = ["all", "10", "9+", "8+", "7+"];
const decadeOptions: { key: DecadeFilter; label: string }[] = [
  { key: "all", label: "All decades" },
  { key: "2020s", label: "2020s" },
  { key: "2010s", label: "2010s" },
  { key: "2000s", label: "2000s" },
  { key: "older", label: "Older" },
];

const tabVariants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

const gridItemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

const getPosterUrl = (path: string | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("//")) return `https:${path}`;
  return `https://image.tmdb.org/t/p/w780${path.startsWith("/") ? "" : "/"}${path}`;
};

const normalizeShareImageUrl = (value?: string | null, size = "original") => {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
};

const uniqueUrls = (urls: string[]) => Array.from(new Set(urls.filter(Boolean)));

const fallbackCopy = (text: string) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};

const preloadImage = (src?: string) =>
  new Promise<void>((resolve) => {
    if (!src) {
      resolve();
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });

const ExactRatingStars = ({ rating, size = 18, gap = 3 }: { rating: number; size?: number; gap?: number }) => (
  <div className="flex items-center" style={{ gap }}>
    {Array.from({ length: 10 }, (_, index) => {
      const starNumber = index + 1;
      const fill = rating >= starNumber ? 1 : rating >= starNumber - 0.5 ? 0.5 : 0;
      return (
        <div key={starNumber} className="relative shrink-0" style={{ width: size, height: size }}>
          <Star className="absolute inset-0 text-white/20 fill-white/[0.08]" style={{ width: size, height: size }} strokeWidth={1.7} />
          {fill > 0 && (
            <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="absolute left-0 top-0 text-amber-300 fill-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.34)]" style={{ width: size, height: size, maxWidth: "none" }} strokeWidth={1.7} />
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const getMediaType = (item: RatedMovieExt): MediaTypeFilter => {
  const rawType = String(item.mediaType || "").toLowerCase();
  if (rawType === "tv" || rawType === "series") return "tv";
  if (/^tv[-_]/i.test(String(item.id))) return "tv";
  return "movie";
};

const getTmdbId = (item: RatedMovieExt) => {
  const candidates = [item.movieId, item.mediaId, item.tmdbId, item.id];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const raw = String(candidate).trim();
    const prefixed = raw.match(/^(?:movie|tv)[-_](\d+)$/i);
    const numeric = prefixed?.[1] ?? (/^\d+$/.test(raw) ? raw : null);
    if (numeric && Number(numeric) > 0) return numeric;
  }
  return String(item.id);
};

const mediaKey = (item: RatedMovieExt) => `${getMediaType(item)}-${getTmdbId(item)}`;

const extractRawDate = (item: RatedMovieExt) =>
  item.releaseDate || item.release_date || item.firstAirDate || item.first_air_date || undefined;

const getYearFromDate = (value: unknown) => {
  if (!value) return null;
  const match = String(value).match(/(19|20)\d{2}/);
  return match?.[0] ?? null;
};

const getYearFromTmdbDetails = (mediaType: MediaTypeFilter, data: any) => {
  const primary = mediaType === "tv"
    ? data?.first_air_date || data?.last_air_date
    : data?.release_date;
  const primaryYear = getYearFromDate(primary);
  if (primaryYear) return primaryYear;

  if (mediaType === "movie") {
    const dates = (data?.release_dates?.results || [])
      .flatMap((entry: any) => entry?.release_dates || [])
      .map((entry: any) => entry?.release_date)
      .map(getYearFromDate)
      .filter(Boolean) as string[];
    if (dates.length) return dates.sort()[0];
  }

  if (mediaType === "tv") {
    const seasonYears = (data?.seasons || [])
      .filter((season: any) => Number(season?.season_number) > 0)
      .map((season: any) => getYearFromDate(season?.air_date))
      .filter(Boolean) as string[];
    if (seasonYears.length) return seasonYears.sort()[0];
  }

  return null;
};

const normalizePosterPath = (value: unknown) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const match = raw.match(/image\.tmdb\.org\/t\/p\/(?:w\d+|original)(\/[^?]+)/i);
  const path = match?.[1] || raw;
  return path.startsWith("/") ? path : `/${path.replace(/^\/+/, "")}`;
};

const requestTmdb = async (url: string, params: Record<string, unknown>) => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await axios.get(url, { params, timeout: 12000 });
    } catch (error: any) {
      lastError = error;
      const status = Number(error?.response?.status || 0);
      if (attempt === 0 && (status === 429 || status >= 500 || status === 0)) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        continue;
      }
      break;
    }
  }
  throw lastError;
};

const pickBestSearchResult = (item: RatedMovieExt, mediaType: MediaTypeFilter, results: any[]) => {
  if (!results.length) return null;
  const targetTitle = getDisplayTitle(item).trim().toLowerCase();
  const targetPoster = normalizePosterPath(item.posterPath);

  const scored = results
    .filter((result) => !result?.media_type || result.media_type === mediaType)
    .map((result) => {
      const resultTitle = String(mediaType === "tv" ? result?.name || result?.original_name : result?.title || result?.original_title).trim().toLowerCase();
      const resultPoster = normalizePosterPath(result?.poster_path);
      let score = 0;
      if (targetPoster && resultPoster === targetPoster) score += 100;
      if (resultTitle === targetTitle) score += 40;
      if (resultTitle.includes(targetTitle) || targetTitle.includes(resultTitle)) score += 12;
      score += Math.min(10, Number(result?.popularity || 0) / 20);
      return { result, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.result || results[0];
};

const fetchReleaseYearFromTmdb = async (item: RatedMovieExt) => {
  const mediaType = getMediaType(item);
  const tmdbId = getTmdbId(item);

  if (/^\d+$/.test(tmdbId)) {
    try {
      const response = await requestTmdb(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}`, {
        api_key: tmdbAPIKey,
        language: "en-US",
        ...(mediaType === "movie" ? { append_to_response: "release_dates" } : {}),
      });
      const year = getYearFromTmdbDetails(mediaType, response.data);
      if (year) return year;
    } catch {
    }
  }

  try {
    const response = await requestTmdb(`https://api.themoviedb.org/3/search/${mediaType}`, {
      api_key: tmdbAPIKey,
      language: "en-US",
      query: getDisplayTitle(item),
      include_adult: false,
    });
    const matched = pickBestSearchResult(item, mediaType, response.data?.results || []);
    const year = getYearFromDate(mediaType === "tv" ? matched?.first_air_date : matched?.release_date);
    if (year) return year;
  } catch {
  }

  try {
    const response = await requestTmdb("https://api.themoviedb.org/3/search/multi", {
      api_key: tmdbAPIKey,
      language: "en-US",
      query: getDisplayTitle(item),
      include_adult: false,
    });
    const matched = pickBestSearchResult(item, mediaType, response.data?.results || []);
    return getYearFromDate(mediaType === "tv" ? matched?.first_air_date : matched?.release_date);
  } catch {
    return null;
  }
};

const extractRatedAt = (item: RatedMovieExt) => item.ratedAt || item.updatedAt || item.createdAt || "";

const getDisplayTitle = (item: RatedMovieExt) => item.title || (item as RatedMovieExt & { name?: string }).name || "Untitled";

const extractYearNumber = (year: string) => {
  const value = Number(year);
  return Number.isFinite(value) ? value : 0;
};

const decadeMatch = (year: string, decade: DecadeFilter) => {
  const value = extractYearNumber(year);
  if (!value) return decade === "all";
  if (decade === "2020s") return value >= 2020;
  if (decade === "2010s") return value >= 2010 && value < 2020;
  if (decade === "2000s") return value >= 2000 && value < 2010;
  if (decade === "older") return value < 2000;
  return true;
};

const ratingRangeMatch = (rating: number, range: RatingRange) => {
  if (range === "all") return true;
  if (range === "10") return rating >= 10;
  if (range === "9+") return rating >= 9;
  if (range === "8+") return rating >= 8;
  if (range === "7+") return rating >= 7;
  return true;
};

const LoadingPoster = ({ className = "" }: { className?: string }) => (
  <div className={`absolute inset-0 overflow-hidden bg-zinc-900 ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

const ShareSheet = ({
  payload,
  onClose,
}: {
  payload: SharePayload | null;
  onClose: () => void;
}) => {
  const storyCardRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [artworkSelector, setArtworkSelector] = useState<ArtworkTab | null>(null);
  const [selectedPoster, setSelectedPoster] = useState("");
  const [selectedBackdrop, setSelectedBackdrop] = useState("");
  const [remotePosters, setRemotePosters] = useState<ShareMediaImage[]>([]);
  const [remoteBackdrops, setRemoteBackdrops] = useState<ShareMediaImage[]>([]);
  const [artworkLoading, setArtworkLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ShareStatus | null>(null);
  const [shareGenres, setShareGenres] = useState<string[]>([]);
  const [shareOverview, setShareOverview] = useState("");
  const [baseBackdrop, setBaseBackdrop] = useState("");
  const [tmdbRating, setTmdbRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");

  const open = Boolean(payload);
  const item = payload?.item ?? null;
  const title = item ? getDisplayTitle(item) : "";
  const mediaType = item ? getMediaType(item) : "movie";
  const mediaId = item ? getTmdbId(item) : "";
  const rating = Number(item?.rating ?? 0);
  const year = payload?.year || "";
  const medium = mediaType === "tv" ? "Series" : "Movie";
  const MediumIcon = mediaType === "tv" ? Tv : Clapperboard;
  const shareUrl = typeof window !== "undefined" && mediaId
    ? `${window.location.origin}/${mediaType}/${mediaId}`
    : "";
  const payloadKey = item ? mediaKey(item) : "";
  const itemTmdbRating = item && Number.isFinite(Number(item.vote_average)) ? Number(item.vote_average) : null;
  const displayedTmdbRating = tmdbRating ?? itemTmdbRating;

  useEffect(() => {
    if (!open) return;
    setSelectedPoster(payload?.posterUrl || "");
    setSelectedBackdrop("");
    setRemotePosters([]);
    setRemoteBackdrops([]);
    setShareGenres([]);
    setShareOverview("");
    setBaseBackdrop("");
    setTmdbRating(null);
    setSelectedStatus(null);
    setFeedback("");
  }, [open, payloadKey, payload?.posterUrl]);

  useEffect(() => {
    if (!open || !mediaId) return;
    let cancelled = false;

    const loadShareMedia = async () => {
      setArtworkLoading(true);
      try {
        const [detailsResponse, imagesResponse] = await Promise.all([
          requestTmdb(`https://api.themoviedb.org/3/${mediaType}/${mediaId}`, {
            api_key: tmdbAPIKey,
            language: "en-US",
          }),
          requestTmdb(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/images`, {
            api_key: tmdbAPIKey,
            include_image_language: "en,null",
          }),
        ]);

        if (cancelled) return;

        const details = detailsResponse.data || {};
        const images = imagesResponse.data || {};
        const rank = (items: ShareMediaImage[]) => [...items].sort((a, b) => {
          const aScore = (a.vote_average || 0) * 100 + (a.vote_count || 0) * 4 + ((a.width || 0) * (a.height || 0)) / 1000000;
          const bScore = (b.vote_average || 0) * 100 + (b.vote_count || 0) * 4 + ((b.width || 0) * (b.height || 0)) / 1000000;
          return bScore - aScore;
        });

        setRemotePosters(rank(Array.isArray(images.posters) ? images.posters : []));
        setRemoteBackdrops(rank(Array.isArray(images.backdrops) ? images.backdrops : []));
        setShareGenres(Array.isArray(details.genres) ? details.genres.map((genre: any) => String(genre?.name || "")).filter(Boolean) : []);
        setShareOverview(String(details.overview || ""));
        const fetchedTmdbRating = Number(details.vote_average);
        setTmdbRating(Number.isFinite(fetchedTmdbRating) ? fetchedTmdbRating : null);
        setBaseBackdrop(normalizeShareImageUrl(details.backdrop_path));
        setSelectedPoster((current) => current || normalizeShareImageUrl(details.poster_path) || payload?.posterUrl || "");
        setSelectedBackdrop((current) => current || normalizeShareImageUrl(details.backdrop_path));
      } catch {
        if (!cancelled) {
          setBaseBackdrop("");
          setTmdbRating(null);
        }
      } finally {
        if (!cancelled) setArtworkLoading(false);
      }
    };

    loadShareMedia();
    return () => {
      cancelled = true;
    };
  }, [open, mediaId, mediaType, payload?.posterUrl]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (artworkSelector) setArtworkSelector(null);
      else onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, artworkSelector, onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const posterChoices = useMemo(
    () => uniqueUrls([
      payload?.posterUrl || "",
      ...remotePosters.map((image) => normalizeShareImageUrl(image.file_path)),
    ]),
    [payload?.posterUrl, remotePosters],
  );

  const backdropChoices = useMemo(
    () => uniqueUrls([
      baseBackdrop,
      ...remoteBackdrops.map((image) => normalizeShareImageUrl(image.file_path)),
    ]),
    [baseBackdrop, remoteBackdrops],
  );

  useEffect(() => {
    if (!open) return;
    if (!selectedPoster) setSelectedPoster(payload?.posterUrl || posterChoices[0] || "");
    if (!selectedBackdrop) setSelectedBackdrop(baseBackdrop || backdropChoices[0] || "");
  }, [open, payload?.posterUrl, posterChoices, baseBackdrop, backdropChoices, selectedPoster, selectedBackdrop]);

  const previewPoster = selectedPoster || payload?.posterUrl || posterChoices[0] || "";
  const previewBackdrop = selectedBackdrop || baseBackdrop || backdropChoices[0] || previewPoster;
  const artworkChoices = artworkSelector === "backdrop" ? backdropChoices : posterChoices;
  const statusMeta = STATUS_OPTIONS.find((status) => status.id === selectedStatus) || null;

  const rankedPosterChoices = useMemo(() => {
    const ranked = [...remotePosters]
      .sort((a, b) => ((b.vote_average || 0) * 100 + (b.vote_count || 0) * 4) - ((a.vote_average || 0) * 100 + (a.vote_count || 0) * 4))
      .map((image) => normalizeShareImageUrl(image.file_path));
    return uniqueUrls([...ranked, ...posterChoices]);
  }, [remotePosters, posterChoices]);

  const rankedBackdropChoices = useMemo(() => {
    const ranked = [...remoteBackdrops]
      .sort((a, b) => ((b.vote_average || 0) * 100 + (b.vote_count || 0) * 4) - ((a.vote_average || 0) * 100 + (a.vote_count || 0) * 4))
      .map((image) => normalizeShareImageUrl(image.file_path));
    return uniqueUrls([...ranked, ...backdropChoices]);
  }, [remoteBackdrops, backdropChoices]);

  const resetArtwork = () => {
    setSelectedPoster(payload?.posterUrl || posterChoices[0] || "");
    setSelectedBackdrop(baseBackdrop || backdropChoices[0] || "");
  };

  const selectArtwork = (url: string) => {
    if (artworkSelector === "poster") setSelectedPoster(url);
    if (artworkSelector === "backdrop") setSelectedBackdrop(url);
  };

  const randomizeArtwork = () => {
    const pickDifferent = (choices: string[], current: string) => {
      const pool = choices.slice(0, Math.min(14, choices.length)).filter((url) => url !== current);
      if (!pool.length) return current || choices[0] || "";
      return pool[Math.floor(Math.random() * pool.length)];
    };
    setSelectedPoster((current) => pickDifferent(rankedPosterChoices, current));
    setSelectedBackdrop((current) => pickDifferent(rankedBackdropChoices, current));
  };

  const thumbnailUrl = (url: string, size: "w342" | "w500" = "w342") => url.replace("/original/", `/${size}/`);

  const copyLink = async () => {
    if (!shareUrl) return;
    setCopying(true);
    let copiedSuccessfully = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        copiedSuccessfully = true;
      }
    } catch {
      copiedSuccessfully = false;
    }
    if (!copiedSuccessfully) copiedSuccessfully = fallbackCopy(shareUrl);
    setCopied(copiedSuccessfully);
    setCopying(false);
    setFeedback(copiedSuccessfully ? "Link copied" : "Could not copy link");
  };

  const generateCardBlob = async (): Promise<Blob | null> => {
    if (!storyCardRef.current) return null;
    try {
      await Promise.all([preloadImage(previewBackdrop), preloadImage(previewPoster)]);
      const dataUrl = await toPng(storyCardRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: 1080,
        height: 1920,
      });
      const response = await fetch(dataUrl);
      return await response.blob();
    } catch {
      return null;
    }
  };

  const safeFilename = `${title || "cinescape-rating"}`.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-");

  const saveImage = async () => {
    if (!item) return;
    setDownloadingImage(true);
    try {
      const blob = await generateCardBlob();
      if (!blob) {
        setFeedback("Failed to generate image");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFilename}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setFeedback("Story image saved");
    } finally {
      setDownloadingImage(false);
    }
  };

  const shareStory = async () => {
    if (!item) return;
    setGeneratingCard(true);
    try {
      const blob = await generateCardBlob();
      if (!blob) {
        setFeedback("Failed to generate story image");
        return;
      }
      const file = new File([blob], `${safeFilename}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: `I rated ${title} ${rating.toFixed(1)}/10 on Cinescape`,
        });
        setFeedback("Story shared");
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${safeFilename}.png`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        setFeedback("Story image saved");
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") setFeedback("Could not share story");
    } finally {
      setGeneratingCard(false);
    }
  };

  const nativeShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} | Cinescape`,
          text: `I rated ${title} ${rating.toFixed(1)}/10 on Cinescape`,
          url: shareUrl,
        });
      } catch {
      }
    } else {
      await copyLink();
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && Boolean(navigator.share);

  return (
    <AnimatePresence>
      {open && item && payload && (
        <>
          <motion.div
            className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 p-0 backdrop-blur-xl sm:items-center sm:bg-black/30 sm:p-5 sm:backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`Share rating for ${title}`}
          >
            <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden="true">
              <div
                ref={storyCardRef}
                className="relative isolate flex h-[1920px] w-[1080px] flex-col items-center overflow-hidden bg-black px-20 pb-24 pt-24 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]"
                style={{ transform: "translateZ(0)" }}
              >
                {previewBackdrop && (
                  <img
                    src={previewBackdrop}
                    crossOrigin="anonymous"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover scale-110"
                    style={{ filter: "blur(40px) brightness(0.6)" }}
                  />
                )}
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/90" />
                <div className="relative z-10 flex w-full items-center justify-between">
                  <div className="flex items-center gap-3 rounded-full border border-white/30 bg-black/70 px-7 py-3.5 shadow-2xl">
                    <MediumIcon className="h-7 w-7 text-white" />
                    <span className="text-2xl font-bold uppercase tracking-[0.12em] text-white">{medium}</span>
                  </div>

                  <div className="flex items-center gap-3 rounded-full border border-amber-400/40 bg-black/80 px-7 py-3.5 shadow-2xl">
                    <span className="rounded bg-[#0d253f] px-2.5 py-1 text-xs font-black tracking-wider text-[#01b4e4]">TMDB</span>
                    <Star className="h-7 w-7 fill-amber-300 text-amber-300" />
                    <span className="text-2xl font-black tabular-nums text-white">
                      {displayedTmdbRating !== null ? displayedTmdbRating.toFixed(1) : "—"}
                    </span>
                  </div>
                </div>
                <div className="relative z-10 my-auto flex flex-col items-center">
                  <div className="relative rounded-[62px] border border-white/30 bg-white/10 p-3 shadow-[0_42px_110px_rgba(0,0,0,0.85)]">
                    <div className="relative h-[1050px] w-[700px] overflow-hidden rounded-[52px] bg-black/60">
                      {previewPoster ? (
                        <img src={previewPoster} crossOrigin="anonymous" alt={title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <MediumIcon className="h-36 w-36 text-white/20" />
                        </div>
                      )}
                    </div>
                  </div>
                  {statusMeta && (
                    <div className="mt-12 flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-950/60 px-6 py-2.5 text-xl font-black tracking-[0.18em] text-amber-200 shadow-xl">
                      <statusMeta.icon className="h-5 w-5" />
                      {statusMeta.label}
                    </div>
                  )}
                  <h1 className="mt-10 max-w-[900px] text-center text-[58px] font-black leading-[1.04] tracking-tight text-white drop-shadow-2xl">
                    {title}
                  </h1>
                  <div className="mt-6 flex items-center justify-center">
                    <ExactRatingStars rating={rating} size={46} gap={10} />
                  </div>
                  <div className="mt-5 flex items-center gap-4 text-[24px] font-semibold text-white/80">
                    {year && <span>{year}</span>}
                    {year && shareGenres.length > 0 && <span className="text-white/40">•</span>}
                    {shareGenres.length > 0 && <span>{shareGenres.slice(0, 3).join(", ")}</span>}
                  </div>
                  <div className="mt-5 flex items-center gap-2.5 text-[28px] font-black text-amber-300">
                    <span className="text-white/70 text-2xl font-bold">Your rating:</span>
                    <span>{rating.toFixed(1)} / 10</span>
                  </div>
                </div>
                <div className="relative z-10 flex w-full flex-col items-center gap-4">
                  <div className="flex w-full max-w-[520px] items-center gap-6">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/40" />
                    <span className="whitespace-nowrap text-lg font-bold uppercase tracking-[0.3em] text-white/60">Shared from</span>
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/40" />
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <img src="/Logo.png" alt="Logo" className="h-10 w-auto object-contain drop-shadow-lg" />
                    <img src="/Cinescape.png" alt="Cinescape" className="h-8 w-auto object-contain drop-shadow-lg" />
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 120, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.985 }}
              transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.25 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 700) onClose();
              }}
              className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[34px] border border-white/15 bg-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,0.9)] sm:max-h-[86vh] sm:rounded-[34px] sm:border-white/20 sm:bg-zinc-950/62 sm:shadow-[0_32px_100px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)] sm:backdrop-blur-3xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.055] via-transparent to-black/30" />
              <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

              <div className="relative flex w-full justify-center pb-1 pt-3 sm:hidden">
                <div className="h-1.5 w-12 rounded-full bg-white/25" />
              </div>

              <div className="relative overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                      <Share2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-black tracking-tight text-white sm:text-lg">Share Rating</h2>
                      <p className="truncate text-[10px] font-medium text-white/40">Create a Cinescape story card</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/60 transition hover:bg-white/10 hover:text-white active:scale-90" aria-label="Close share dialog">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="group relative aspect-video w-full overflow-hidden rounded-[22px] border border-white/15 bg-black shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
                  {previewBackdrop ? (
                    <img src={previewBackdrop} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-zinc-950 to-black" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />

                  <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
                    <button type="button" onClick={() => setArtworkSelector("backdrop")} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/55 text-amber-300 shadow-md backdrop-blur-md transition hover:scale-105 hover:bg-black/75 active:scale-95" aria-label="Change backdrop">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={randomizeArtwork} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/55 text-amber-300 shadow-md backdrop-blur-md transition hover:scale-105 hover:bg-black/75 active:scale-95" aria-label="Randomize artwork">
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-xs font-black text-white shadow-md backdrop-blur-xl">
                    <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                    {displayedTmdbRating !== null ? displayedTmdbRating.toFixed(1) : "—"}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-3.5">
                    <div className="relative shrink-0">
                      {previewPoster ? (
                        <img src={previewPoster} alt={title} className="h-20 w-14 rounded-xl border border-white/20 object-cover shadow-xl" />
                      ) : (
                        <div className="flex h-20 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5"><MediumIcon className="h-5 w-5 text-amber-300" /></div>
                      )}
                      <button type="button" onClick={() => setArtworkSelector("poster")} className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-black/80 text-amber-300 shadow-lg transition hover:scale-105 active:scale-95" aria-label="Change poster">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      {statusMeta && (
                        <div className="mb-1.5 flex">
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/25 bg-amber-300/15 px-2 py-0.5 text-[8px] font-black tracking-wider text-amber-200 backdrop-blur-xl"><statusMeta.icon className="h-2.5 w-2.5" />{statusMeta.label}</span>
                        </div>
                      )}
                      <span className="mb-1 inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200 backdrop-blur-xl"><MediumIcon className="h-2.5 w-2.5" />{medium}</span>
                      <h3 className="line-clamp-1 text-sm font-black leading-tight tracking-tight text-white sm:text-base">{title}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <ExactRatingStars rating={rating} size={11} gap={1} />
                        <span className="text-[10px] font-semibold tabular-nums text-amber-200">{rating.toFixed(1)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[10px] font-medium text-white/60">
                        {year && <span>{year}</span>}
                        {shareGenres.slice(0, 2).map((genre) => <React.Fragment key={genre}><span className="text-white/30">•</span><span>{genre}</span></React.Fragment>)}
                      </div>
                    </div>
                  </div>
                </div>

                <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2.5 backdrop-blur-xl">
                  <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                    <div><p className="text-[11px] font-bold leading-tight text-white">Share status</p><p className="text-[9px] font-medium leading-tight text-white/40">Add context to your story</p></div>
                    {selectedStatus && <button type="button" onClick={() => setSelectedStatus(null)} className="text-[9px] font-semibold text-amber-300/80 hover:text-amber-200">Clear</button>}
                  </div>
                  <div className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {STATUS_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = selectedStatus === option.id;
                      return (
                        <button type="button" key={option.id} onClick={() => setSelectedStatus(active ? null : option.id)} className={`flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-bold tracking-wide transition active:scale-95 ${active ? "border-amber-300 bg-amber-300 text-black shadow-[0_0_16px_rgba(252,211,77,0.22)]" : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"}`}>
                          <Icon className={`h-3 w-3 ${active ? "text-black" : "text-amber-300/90"}`} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {shareOverview && <p className="mt-3 line-clamp-2 px-1 text-xs leading-relaxed text-white/55">{shareOverview}</p>}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={shareStory} disabled={generatingCard || downloadingImage} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-3 text-xs font-black text-black shadow-[0_8px_24px_rgba(245,158,11,0.2)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50">
                    {generatingCard ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    <span>{generatingCard ? "Creating…" : "Share Story"}</span>
                  </button>
                  <button onClick={saveImage} disabled={generatingCard || downloadingImage} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-3 py-3 text-xs font-bold text-white transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-50">
                    {downloadingImage ? <Loader2 className="h-4 w-4 animate-spin text-amber-300" /> : <Download className="h-4 w-4 text-amber-300" />}
                    <span>{downloadingImage ? "Saving…" : "Save Image"}</span>
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 pl-3 backdrop-blur-xl">
                  <Link2 className="h-4 w-4 shrink-0 text-white/35" />
                  <span className="min-w-0 flex-1 truncate select-all text-xs font-medium text-white/70">{shareUrl}</span>
                  <button onClick={copyLink} disabled={copying} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 active:scale-95 disabled:opacity-50">
                    {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" /> : copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>

                {canNativeShare && (
                  <button onClick={nativeShare} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.07] active:scale-[0.98]">
                    <Share2 className="h-3.5 w-3.5 text-amber-300" />
                    More Share Options
                  </button>
                )}

                <AnimatePresence>
                  {feedback && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-center text-[10px] font-semibold text-white/70">
                      {feedback}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>

          <AnimatePresence>
            {artworkSelector && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[11000] flex items-end justify-center bg-black/80 p-0 backdrop-blur-xl sm:items-center sm:p-4" onClick={() => setArtworkSelector(null)}>
                <motion.div initial={{ opacity: 0, y: 40, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.99 }} transition={{ duration: 0.2 }} onClick={(event) => event.stopPropagation()} className="flex h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[30px] border border-white/15 bg-zinc-950 shadow-2xl sm:h-[82vh] sm:rounded-[32px] sm:bg-zinc-950/78 sm:backdrop-blur-3xl">
                  <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
                    <div><h3 className="text-sm font-bold text-white">Select {artworkSelector === "poster" ? "Poster" : "Backdrop"}</h3><p className="text-[11px] text-white/45">{artworkChoices.length} images available</p></div>
                    <button type="button" onClick={() => setArtworkSelector(null)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white active:scale-90"><X className="h-4 w-4" /></button>
                  </div>

                  <div className="shrink-0 border-b border-white/10 px-3 py-3 sm:px-5 sm:py-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="relative aspect-[9/16] w-[74px] shrink-0 overflow-hidden rounded-[15px] border border-white/15 bg-black shadow-xl sm:w-[94px]">
                        {previewBackdrop ? <img src={thumbnailUrl(previewBackdrop, "w500")} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-zinc-900" />}
                        <div className="absolute inset-0 bg-black/55" />
                        <div className="absolute left-1/2 top-[43%] aspect-[2/3] w-[54%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[7px] border border-white/25 bg-black/50 shadow-lg">{previewPoster ? <img src={thumbnailUrl(previewPoster, "w342")} alt={title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><MediumIcon className="h-4 w-4 text-white/20" /></div>}</div>
                        <div className="absolute inset-x-2 bottom-2 text-center"><p className="line-clamp-2 text-[6px] font-black leading-tight text-white">{title}</p><p className="mt-0.5 text-[4.5px] font-medium text-white/50">{year}{shareGenres[0] ? ` · ${shareGenres[0]}` : ""}</p></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="flex items-center gap-1.5 text-xs font-black text-white"><ImageIcon className="h-3.5 w-3.5 text-amber-300" />Live story preview</p><p className="mt-1 text-[10px] leading-relaxed text-white/45">Artwork updates instantly while you browse.</p></div>
                          <button type="button" onClick={randomizeArtwork} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-amber-300 transition hover:bg-amber-400/20 active:scale-95" aria-label="Randomize artwork"><Sparkles className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5"><button type="button" onClick={resetArtwork} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-bold text-white/50 transition hover:text-white"><RotateCcw className="h-3 w-3" />Reset</button>{statusMeta && <span className="rounded-lg border border-amber-300/15 bg-amber-300/10 px-2 py-1.5 text-[9px] font-black text-amber-200">{statusMeta.label}</span>}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2 border-b border-white/10 bg-zinc-900/40 p-2 sm:px-5">
                    <button type="button" onClick={() => setArtworkSelector("poster")} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${artworkSelector === "poster" ? "bg-amber-400 text-black" : "text-white/60 hover:text-white"}`}>Posters ({posterChoices.length})</button>
                    <button type="button" onClick={() => setArtworkSelector("backdrop")} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${artworkSelector === "backdrop" ? "bg-amber-400 text-black" : "text-white/60 hover:text-white"}`}>Backdrops ({backdropChoices.length})</button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                    {artworkLoading ? (
                      <div className="flex h-full items-center justify-center gap-2 text-xs text-white/50"><Loader2 className="h-4 w-4 animate-spin text-amber-300" /><span>Loading artwork options…</span></div>
                    ) : artworkChoices.length ? (
                      <div className={artworkSelector === "poster" ? "grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5" : "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"}>
                        {artworkChoices.map((url) => {
                          const selected = artworkSelector === "poster" ? selectedPoster === url : selectedBackdrop === url;
                          return (
                            <button type="button" key={url} onClick={() => selectArtwork(url)} className={`group relative overflow-hidden rounded-xl border bg-zinc-900 transition active:scale-[0.98] ${artworkSelector === "poster" ? "aspect-[2/3]" : "aspect-video"} ${selected ? "border-amber-400 ring-2 ring-amber-400/40" : "border-white/10 hover:border-white/30"}`}>
                              <img src={thumbnailUrl(url, artworkSelector === "poster" ? "w342" : "w500")} alt="" loading="lazy" className="h-full w-full object-cover" />
                              {selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black shadow-md"><Check className="h-3.5 w-3.5 stroke-[3]" /></span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center"><ImageIcon className="mb-2 h-8 w-8 text-white/20" /><p className="text-xs font-medium text-white/60">No additional images found</p></div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-zinc-900/50 px-3 py-3 sm:px-5">
                    <button type="button" onClick={resetArtwork} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-bold text-white/55 transition hover:text-white active:scale-95"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
                    <button type="button" onClick={randomizeArtwork} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 text-[10px] font-black text-amber-300 transition hover:bg-amber-400/15 active:scale-95"><Sparkles className="h-3.5 w-3.5" />Randomize</button>
                    <button type="button" onClick={() => setArtworkSelector(null)} className="ml-auto h-9 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 text-[10px] font-black text-black shadow-lg transition hover:brightness-110 active:scale-95">Done</button>
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

export const UserRatingSection = ({
  ratedMovies,
  onMediaClick,
}: {
  ratedMovies: RatedMovie[];
  onMediaClick: (id: string, mediaType: string) => void;
}) => {
  const [activeFilter, setActiveFilter] = useState<MediaTypeFilter>("movie");
  const [releaseYears, setReleaseYears] = useState<Map<string, string>>(new Map());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("highest");
  const [showSorts, setShowSorts] = useState(false);
  const [ratingRange, setRatingRange] = useState<RatingRange>("all");
  const [decade, setDecade] = useState<DecadeFilter>("all");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [editedRatings, setEditedRatings] = useState<Record<string, number>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<RatedMovieExt | null>(null);
  const [ratingEditorPosition, setRatingEditorPosition] = useState({ top: 0, left: 0 });
  const [savingRatingKey, setSavingRatingKey] = useState<string | null>(null);
  const [deletingRatingKey, setDeletingRatingKey] = useState<string | null>(null);
  const [deletedRatingKeys, setDeletedRatingKeys] = useState<Set<string>>(new Set());
  const [ratingSaveError, setRatingSaveError] = useState<string | null>(null);
  const [favoriteKeys, setFavoriteKeys] = useState<Record<string, boolean>>({});
  const [favoriteBusyKey, setFavoriteBusyKey] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<HTMLDivElement[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeFavorites: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      unsubscribeFavorites?.();
      unsubscribeFavorites = null;
      setFavoriteKeys({});

      if (!currentUser) return;

      const favoritesRef = collection(db, `users/${currentUser.uid}/favouriteMedia`);
      unsubscribeFavorites = onSnapshot(
        favoritesRef,
        (snapshot) => {
          const next: Record<string, boolean> = {};
          snapshot.docs.forEach((favoriteDoc) => {
            const data = favoriteDoc.data();
            const mediaType = data.mediaType === "tv" ? "tv" : "movie";
            const mediaId = data.mediaId ?? data.movieId ?? favoriteDoc.id.replace(/^(movie|tv)-/, "");
            next[`${mediaType}-${mediaId}`] = true;
          });
          setFavoriteKeys(next);
        },
        () => setFavoriteKeys({}),
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeFavorites?.();
    };
  }, []);

  const typedRatedMovies = ratedMovies as RatedMovieExt[];
  const visibleRatedMovies = typedRatedMovies.filter((item) => !deletedRatingKeys.has(mediaKey(item)));
  const movieItems = visibleRatedMovies.filter((item) => getMediaType(item) === "movie");
  const seriesItems = visibleRatedMovies.filter((item) => getMediaType(item) === "tv");
  const activeBaseList = activeFilter === "movie" ? movieItems : seriesItems;

  useEffect(() => {
    let cancelled = false;

    const loadReleaseYears = async () => {
      const initial = new Map<string, string>();
      const missing: RatedMovieExt[] = [];

      visibleRatedMovies.forEach((item) => {
        const key = mediaKey(item);
        const localYear = getYearFromDate(extractRawDate(item)) || (item.year ? getYearFromDate(item.year) : null);
        const cachedYear = releaseYearCache.get(key);

        if (localYear) {
          releaseYearCache.set(key, localYear);
          initial.set(key, localYear);
        } else if (cachedYear) {
          initial.set(key, cachedYear);
        } else {
          missing.push(item);
        }
      });

      if (!cancelled && initial.size) {
        setReleaseYears((current) => new Map([...current, ...initial]));
      }

      for (let index = 0; index < missing.length; index += 5) {
        const batch = missing.slice(index, index + 5);
        const results = await Promise.all(
          batch.map(async (item) => [mediaKey(item), await fetchReleaseYearFromTmdb(item)] as const),
        );

        if (cancelled) return;

        setReleaseYears((current) => {
          const updated = new Map(current);
          results.forEach(([key, year]) => {
            if (year) {
              releaseYearCache.set(key, year);
              updated.set(key, year);
            } else {
              updated.set(key, "TBD");
            }
          });
          return updated;
        });
      }
    };

    loadReleaseYears();

    return () => {
      cancelled = true;
    };
  }, [ratedMovies, deletedRatingKeys]);

  const getReleaseYear = (item: RatedMovieExt) => {
    const direct = getYearFromDate(extractRawDate(item)) || (item.year ? getYearFromDate(item.year) : null);
    return direct || releaseYears.get(mediaKey(item)) || releaseYearCache.get(mediaKey(item)) || "…";
  };

  const withComputedRating = (item: RatedMovieExt) => editedRatings[mediaKey(item)] ?? item.rating;

  const filteredList = useMemo(() => {
    return activeBaseList.filter((item) => {
      const title = getDisplayTitle(item).toLowerCase();
      const year = getReleaseYear(item);
      return title.includes(searchTerm.trim().toLowerCase()) && ratingRangeMatch(withComputedRating(item), ratingRange) && decadeMatch(year, decade);
    });
  }, [activeBaseList, searchTerm, ratingRange, decade, releaseYears, editedRatings]);

  const sortedList = useMemo(() => {
    const list = [...filteredList];
    if (sortKey === "highest") list.sort((a, b) => withComputedRating(b) - withComputedRating(a));
    if (sortKey === "lowest") list.sort((a, b) => withComputedRating(a) - withComputedRating(b));
    if (sortKey === "year") list.sort((a, b) => extractYearNumber(getReleaseYear(b)) - extractYearNumber(getReleaseYear(a)));
    if (sortKey === "az") list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    if (sortKey === "recent") list.sort((a, b) => new Date(extractRatedAt(b)).getTime() - new Date(extractRatedAt(a)).getTime());
    return list;
  }, [filteredList, sortKey, releaseYears, editedRatings]);

  const avgRating = sortedList.length ? (sortedList.reduce((acc, item) => acc + withComputedRating(item), 0) / sortedList.length).toFixed(1) : "0.0";

  const spotlightMovie = useMemo(() => {
    if (!sortedList.length) return null;
    return [...sortedList].sort((a, b) => {
      const ra = withComputedRating(a);
      const rb = withComputedRating(b);
      if (rb !== ra) return rb - ra;
      const ya = extractYearNumber(getReleaseYear(a));
      const yb = extractYearNumber(getReleaseYear(b));
      if (yb !== ya) return yb - ya;
      return new Date(extractRatedAt(b)).getTime() - new Date(extractRatedAt(a)).getTime();
    })[0];
  }, [sortedList, releaseYears, editedRatings]);

  const remainingMovies = spotlightMovie ? sortedList.filter((item) => item.id !== spotlightMovie.id) : sortedList;

  useEffect(() => {
    setFocusedIndex(0);
    cardRefs.current = [];
  }, [activeFilter, sortKey, searchTerm, ratingRange, decade, density]);

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!remainingMovies.length) return;
    const desktopCols = density === "compact" ? 6 : 5;
    let next = focusedIndex;
    if (event.key === "ArrowRight") next = Math.min(remainingMovies.length - 1, focusedIndex + 1);
    if (event.key === "ArrowLeft") next = Math.max(0, focusedIndex - 1);
    if (event.key === "ArrowDown") next = Math.min(remainingMovies.length - 1, focusedIndex + desktopCols);
    if (event.key === "ArrowUp") next = Math.max(0, focusedIndex - desktopCols);
    if (event.key === "Enter") {
      const item = remainingMovies[focusedIndex];
      if (item) onMediaClick(item.id, activeFilter);
      return;
    }
    if (next !== focusedIndex) {
      event.preventDefault();
      setFocusedIndex(next);
      cardRefs.current[next]?.focus();
    }
  };

  const toggleFavorite = async (item: RatedMovieExt) => {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return;

    const key = mediaKey(item);
    if (favoriteBusyKey === key) return;

    const wasFavorite = Boolean(favoriteKeys[key]);
    const favoriteRef = doc(db, `users/${currentUser.uid}/favouriteMedia`, key);

    setFavoriteBusyKey(key);
    setFavoriteKeys((prev) => ({ ...prev, [key]: !wasFavorite }));

    try {
      if (wasFavorite) {
        await deleteDoc(favoriteRef);
      } else {
        await setDoc(favoriteRef, {
          mediaId: String(item.id),
          movieId: Number.isFinite(Number(item.id)) ? Number(item.id) : item.id,
          title: getDisplayTitle(item),
          posterPath: item.posterPath ?? null,
          mediaType: item.mediaType === "tv" ? "tv" : "movie",
          rating: withComputedRating(item),
          releaseYear: getReleaseYear(item),
          addedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      setFavoriteKeys((prev) => ({ ...prev, [key]: wasFavorite }));
      console.error("Failed to update favourite:", error);
    } finally {
      setFavoriteBusyKey(null);
    }
  };

  const openShare = (item: RatedMovieExt) => {
    setSharePayload({
      item: { ...item, title: getDisplayTitle(item), rating: withComputedRating(item) },
      year: getReleaseYear(item),
      posterUrl: getPosterUrl(item.posterPath),
    });
  };

  const openRatingEditor = (item: RatedMovieExt, target: HTMLButtonElement) => {
    const key = mediaKey(item);
    const rect = target.getBoundingClientRect();
    const editorWidth = 204;
    const editorHeight = 236;
    const left = Math.min(window.innerWidth - editorWidth - 12, Math.max(12, rect.right - editorWidth));
    const top = rect.bottom + editorHeight + 12 <= window.innerHeight
      ? rect.bottom + 8
      : Math.max(12, rect.top - editorHeight - 8);
    setRatingSaveError(null);
    setEditingItem(item);
    setEditingKey(key);
    setRatingEditorPosition({ top, left });
  };

  const saveQuickRating = async (item: RatedMovieExt, score: number) => {
    const key = mediaKey(item);
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      setRatingSaveError("Sign in to edit your rating");
      return;
    }

    setSavingRatingKey(key);
    setRatingSaveError(null);

    try {
      const tmdbId = getTmdbId(item);
      await setDoc(
        doc(db, `users/${currentUser.uid}/ratings`, tmdbId),
        {
          movieId: Number.isFinite(Number(tmdbId)) ? Number(tmdbId) : tmdbId,
          title: getDisplayTitle(item),
          posterPath: item.posterPath ?? null,
          rating: score,
          mediaType: getMediaType(item),
          timestamp: new Date(),
        },
        { merge: true },
      );

      setEditedRatings((prev) => ({ ...prev, [key]: score }));
      setEditingKey(null);
      setEditingItem(null);
    } catch (error) {
      console.error("Failed to update rating:", error);
      setRatingSaveError("Couldn’t save rating");
    } finally {
      setSavingRatingKey(null);
    }
  };

  const deleteRating = async (item: RatedMovieExt) => {
    const key = mediaKey(item);
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      setRatingSaveError("Sign in to delete your rating");
      return;
    }

    if (deletingRatingKey === key) return;
    setDeletingRatingKey(key);
    setRatingSaveError(null);

    try {
      const tmdbId = getTmdbId(item);
      const mediaType = getMediaType(item);
      const ratingsRef = collection(db, `users/${currentUser.uid}/ratings`);
      const refs = new Map<string, any>();

      const addMatchingDocs = async (value: string | number) => {
        const snapshot = await getDocs(query(ratingsRef, where("movieId", "==", value)));
        snapshot.docs.forEach((ratingDoc) => {
          const data = ratingDoc.data();
          const storedType = data.mediaType === "tv" ? "tv" : "movie";
          if (storedType === mediaType) refs.set(ratingDoc.ref.path, ratingDoc.ref);
        });
      };

      if (/^\d+$/.test(tmdbId)) {
        await Promise.all([addMatchingDocs(Number(tmdbId)), addMatchingDocs(tmdbId)]);
      } else {
        await addMatchingDocs(tmdbId);
      }

      const directIds = new Set([
        String(item.id || "").trim(),
        String(item.id || "").replace(/^(movie|tv)[-_]/i, "").trim(),
        tmdbId,
      ].filter(Boolean));

      directIds.forEach((directId) => {
        const directRef = doc(db, `users/${currentUser.uid}/ratings`, directId);
        refs.set(directRef.path, directRef);
      });

      await Promise.all([...refs.values()].map((ratingRef) => deleteDoc(ratingRef)));

      setDeletedRatingKeys((current) => {
        const next = new Set(current);
        next.add(key);
        return next;
      });
      setEditedRatings((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setEditingKey(null);
      setEditingItem(null);
    } catch (error) {
      console.error("Failed to delete rating:", error);
      setRatingSaveError("Couldn’t delete rating");
    } finally {
      setDeletingRatingKey(null);
    }
  };

  useEffect(() => {
    if (!editingKey) return;

    const closeEditor = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-rating-editor]") && !target.closest("[data-rating-trigger]")) {
        setEditingKey(null);
        setEditingItem(null);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditingKey(null);
        setEditingItem(null);
      }
    };

    const closeOnViewportChange = () => {
      setEditingKey(null);
      setEditingItem(null);
    };

    document.addEventListener("pointerdown", closeEditor);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", closeEditor);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [editingKey]);

  const gridClass = density === "compact"
    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-4"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4";

  return (
    <motion.div key="ratings" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-6xl mx-auto px-3 sm:px-4 space-y-4 sm:space-y-6 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif] tracking-tight antialiased">
      <div className="sticky top-[84px] sm:top-[82px] lg:top-[86px] z-40 -mx-0.5 px-0.5 sm:mx-0 sm:px-0">
        <div className="relative isolate space-y-3 overflow-visible rounded-[26px] border border-white/[0.06] bg-black/85 px-2.5 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transform-gpu">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="relative flex w-full min-w-0 items-center overflow-hidden rounded-xl border border-white/[0.04] bg-white/5 p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-xl sm:w-auto sm:min-w-[220px]">
              <button onClick={() => setActiveFilter("movie")} className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 font-bold text-xs tracking-wide transition-all duration-300 rounded-lg ${activeFilter === "movie" ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
                <Clapperboard className={`w-3.5 h-3.5 ${activeFilter === "movie" ? "text-red-400" : ""}`} />
                <span>Movies</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeFilter === "movie" ? "bg-white/10 text-white" : "bg-white/[0.05] text-zinc-400"}`}>{movieItems.length}</span>
                {activeFilter === "movie" && <motion.div layoutId="liquid-pill" className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" transition={{ type: "spring", stiffness: 320, damping: 26 }} />}
              </button>
              <button onClick={() => setActiveFilter("tv")} className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 font-bold text-xs tracking-wide transition-all duration-300 rounded-lg ${activeFilter === "tv" ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
                <Tv className={`w-3.5 h-3.5 ${activeFilter === "tv" ? "text-cyan-400" : ""}`} />
                <span>Series</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeFilter === "tv" ? "bg-white/10 text-white" : "bg-white/[0.05] text-zinc-400"}`}>{seriesItems.length}</span>
                {activeFilter === "tv" && <motion.div layoutId="liquid-pill" className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" transition={{ type: "spring", stiffness: 320, damping: 26 }} />}
              </button>
            </div>

            <div className="flex w-full min-w-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto">
              <button onClick={() => setSearchOpen((prev) => !prev)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:text-white">
                {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>
              <div className={`min-w-0 overflow-hidden transition-all duration-300 ${searchOpen ? "flex-1 opacity-100 sm:w-[240px] sm:flex-none" : "w-0 flex-none opacity-0"}`}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                  <input ref={searchRef} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={`Search ${activeFilter === "movie" ? "movies" : "series"}...`} className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/20" />
                </div>
              </div>
              <button onClick={() => setDensity((prev) => (prev === "comfortable" ? "compact" : "comfortable"))} className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white">{density === "comfortable" ? "Comfortable" : "Compact"}</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button onClick={() => setShowSorts((prev) => !prev)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white">
                <span>{sortOptions.find((s) => s.key === sortKey)?.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSorts ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showSorts && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute left-0 top-full mt-2 w-48 rounded-2xl border border-white/10 bg-[#0c0c0d] p-1.5 shadow-2xl">
                    {sortOptions.map((option) => (
                      <button key={option.key} onClick={() => { setSortKey(option.key); setShowSorts(false); }} className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-semibold ${sortKey === option.key ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>{option.label}</button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {ratingOptions.map((option) => (
                <button key={option} onClick={() => setRatingRange(option)} className={`rounded-xl px-3 py-2 text-[11px] font-bold whitespace-nowrap border ${ratingRange === option ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}>{option === "all" ? "All ratings" : option}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {decadeOptions.map((option) => (
                <button key={option.key} onClick={() => setDecade(option.key)} className={`rounded-xl px-3 py-2 text-[11px] font-bold whitespace-nowrap border ${decade === option.key ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}>{option.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeFilter} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
          {sortedList.length === 0 ? (
            <div className="relative overflow-hidden rounded-[28px] border border-amber-500/20 bg-black p-8 sm:p-12 text-center shadow-2xl">
              <div className="relative z-10 flex flex-col items-center max-w-sm mx-auto">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-black shadow-lg shadow-amber-500/30 mb-4">
                  {activeFilter === "movie" ? <Clapperboard className="w-6 h-6 stroke-[2]" /> : <Tv className="w-6 h-6 stroke-[2]" />}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">No Rated {activeFilter === "movie" ? "Movies" : "Series"} Found</h3>
                <p className="text-xs text-amber-200/60 mt-1.5 leading-relaxed font-medium">Start rating {activeFilter === "movie" ? "movies" : "series"} and build your personalized gallery.</p>
                <Link to="/explore" className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-300">Start rating {activeFilter === "movie" ? "movies" : "series"}</Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <div className="relative overflow-hidden rounded-[28px] border border-amber-500/30 bg-black p-5 sm:p-6 flex flex-col justify-between shadow-2xl min-h-[180px] sm:min-h-[220px]">
                  <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_22%_18%,rgba(251,191,36,0.16),transparent_30%),radial-gradient(circle_at_78%_78%,rgba(251,191,36,0.08),transparent_35%)]" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-black shadow-md shadow-amber-500/30 shrink-0">
                        <Star className="w-5 h-5 fill-current" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold tracking-tight text-white">Curated</h2>
                        <span className="text-[10px] font-medium tracking-wider text-amber-400 uppercase block">Rated {activeFilter === "movie" ? "Movies" : "Series"}</span>
                      </div>
                    </div>
                    <div className="mt-6 sm:mt-8 space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{sortedList.length}</span>
                        <span className="text-xs font-semibold text-amber-200/70">{activeFilter === "movie" ? "Movies Rated" : "Series Rated"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium pt-1">
                        <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span>Average rating: <strong className="text-amber-300 font-bold">{avgRating}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {spotlightMovie && (
                  <div onClick={() => onMediaClick(spotlightMovie.id, activeFilter)} className="group relative min-h-[248px] cursor-pointer overflow-hidden rounded-[28px] border border-amber-500/30 bg-black p-3.5 shadow-2xl transition-all duration-300 active:scale-[0.99] sm:min-h-[220px] sm:p-5 md:col-span-2">
                    {spotlightMovie.posterPath && (
                      <div className="absolute inset-0 z-0">
                        <img src={getPosterUrl(spotlightMovie.posterPath)} alt={getDisplayTitle(spotlightMovie)} className="h-full w-full scale-[1.02] object-cover opacity-25 transition-all duration-500 pointer-events-none sm:opacity-35 sm:group-hover:scale-105 sm:group-hover:opacity-45" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/30 sm:via-black/70 sm:to-transparent" />
                      </div>
                    )}
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_24%,rgba(245,158,11,0.18),transparent_28%)]" />
                    <div className="relative z-10 flex h-full flex-col justify-between gap-4 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex min-w-0 items-start gap-3.5 sm:items-center sm:gap-4">
                        <div className="relative h-32 w-[86px] shrink-0 overflow-hidden rounded-2xl border border-amber-500/40 shadow-xl sm:h-36 sm:w-24">
                          {spotlightMovie.posterPath ? <img src={getPosterUrl(spotlightMovie.posterPath)} alt={getDisplayTitle(spotlightMovie)} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <div className="flex h-full w-full items-center justify-center bg-zinc-900">{activeFilter === "movie" ? <Clapperboard className="w-6 h-6 text-red-400/70" /> : <Tv className="w-6 h-6 text-sky-400/70" />}</div>}
                          <div className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg border backdrop-blur-md ${activeFilter === "movie" ? "border-red-400/30 bg-red-500/15 text-red-400" : "border-sky-400/30 bg-sky-500/15 text-sky-400"}`}>{activeFilter === "movie" ? <Clapperboard className="w-3 h-3" /> : <Tv className="w-3 h-3" />}</div>
                        </div>
                        <div className="min-w-0 flex-1 pt-1 sm:pt-0">
                          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 px-2.5 py-0.5 text-[10px] font-bold text-black shadow-sm shadow-amber-500/30"><Award className="w-3 h-3 fill-current" /><span>Top Choice</span></div>
                          <h3 className="line-clamp-2 text-xl font-extrabold leading-tight tracking-tight text-white transition-colors duration-200 sm:text-2xl sm:group-hover:text-amber-300">{getDisplayTitle(spotlightMovie)}</h3>
                          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-amber-200/70"><Calendar className="h-3.5 w-3.5" />{getReleaseYear(spotlightMovie)}</p>
                          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-white/45 sm:hidden"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><span>Your highest-rated pick</span></div>
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-between gap-2 border-t border-white/[0.08] pt-3 sm:w-auto sm:shrink-0 sm:justify-end sm:border-t-0 sm:pt-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openShare(spotlightMovie);
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-zinc-100 transition-all duration-200 hover:bg-white/15 active:scale-95 touch-manipulation"
                            aria-label="Share spotlight item"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(spotlightMovie);
                            }}
                            className="transition-all duration-200 active:scale-90 touch-manipulation"
                            aria-label="Toggle favorite for spotlight item"
                          >
                            {favoriteKeys[mediaKey(spotlightMovie)] ? (
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-500/30">
                                <Heart className="h-4 w-4 fill-current" />
                              </div>
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-zinc-100 backdrop-blur-md transition-colors hover:bg-white/15">
                                <Heart className="h-4 w-4" />
                              </div>
                            )}
                          </button>
                        </div>
                        <button
                          data-rating-trigger
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openRatingEditor(spotlightMovie, e.currentTarget);
                          }}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 px-3 py-2 text-xs font-extrabold text-black shadow-md shadow-amber-500/30 transition-transform active:scale-95"
                          aria-label={`Edit rating for ${getDisplayTitle(spotlightMovie)}`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{withComputedRating(spotlightMovie).toFixed(1)}</span>
                          <Pencil className="h-3 w-3 opacity-55" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {remainingMovies.length > 0 && (
                  <motion.div ref={gridRef} onKeyDown={handleGridKeyDown} tabIndex={0} className={`md:col-span-3 w-full pt-1 outline-none ${gridClass}`}>
                    {remainingMovies.map((item, index) => (
                      <motion.div key={mediaKey(item)} variants={gridItemVariants} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
                        <div ref={(el) => { if (el) cardRefs.current[index] = el; }} onFocus={() => setFocusedIndex(index)} onClick={() => onMediaClick(item.id, activeFilter)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMediaClick(item.id, activeFilter); } }} className="group block w-full text-left cursor-pointer min-w-0 active:scale-[0.98] transition-transform duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded-[24px]">
                          <div className="relative pb-0">
                            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[22px] border border-amber-500/25 bg-black shadow-xl">
                              {!item.posterPath && <LoadingPoster />}
                              {item.posterPath ? (
                                <img
                                  src={getPosterUrl(item.posterPath)}
                                  alt={getDisplayTitle(item)}
                                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-zinc-950">
                                  {activeFilter === "movie" ? (
                                    <Clapperboard className="h-7 w-7 text-red-400/50" />
                                  ) : (
                                    <Tv className="h-7 w-7 text-sky-400/50" />
                                  )}
                                </div>
                              )}

                              <div className={`absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg border bg-black/65 backdrop-blur-md ${activeFilter === "movie" ? "border-red-400/30 text-red-400" : "border-sky-400/30 text-sky-400"}`}>
                                {activeFilter === "movie" ? <Clapperboard className="h-3.5 w-3.5" /> : <Tv className="h-3.5 w-3.5" />}
                              </div>

                              <button
                                data-rating-trigger
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openRatingEditor(item, e.currentTarget);
                                }}
                                className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 px-2 py-1 text-[10px] font-extrabold text-black shadow-md shadow-amber-500/30 active:scale-95 transition-transform touch-manipulation"
                                aria-label={`Edit rating for ${getDisplayTitle(item)}`}
                              >
                                <Star className="h-2.5 w-2.5 fill-current" />
                                <span>{withComputedRating(item).toFixed(1)}</span>
                                <Pencil className="h-2.5 w-2.5 opacity-55" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openShare(item);
                                }}
                                className="absolute right-2 bottom-2 z-10 hidden sm:flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/45 text-white/85 opacity-0 transition-all duration-200 group-hover:opacity-100 active:scale-95 touch-manipulation"
                                aria-label="Share"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleFavorite(item);
                                }}
                                className="absolute left-2 bottom-2 z-10 transition-all duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:scale-90 touch-manipulation"
                                aria-label="Toggle favorite"
                              >
                                {favoriteKeys[mediaKey(item)] ? (
                                  <div className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-500/30">
                                    <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                                  </div>
                                ) : (
                                  <div className="p-1.5 sm:p-2 rounded-xl border border-white/10 bg-black/65 text-white/85 backdrop-blur-md hover:text-white">
                                    <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </div>
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="px-1 pt-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="line-clamp-2 text-xs font-bold text-white transition-colors group-hover:text-amber-300 sm:text-sm">{getDisplayTitle(item)}</h4>
                                <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-zinc-500 sm:text-[11px]"><Calendar className="h-3 w-3" />{getReleaseYear(item)}</span>
                              </div>
                              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openShare(item); }} className="lg:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300"><Share2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {editingKey && editingItem && (
          <motion.div
            data-rating-editor
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-[140] w-[204px] rounded-2xl border border-white/10 bg-[#0b0b0d]/95 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            style={{ top: ratingEditorPosition.top, left: ratingEditorPosition.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <span className="text-[10px] font-semibold text-zinc-400">Your rating</span>
              <span className="text-xs font-extrabold text-amber-300">{withComputedRating(editingItem).toFixed(1)}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 20 }, (_, i) => (i + 1) * 0.5).map((score) => {
                const active = Math.abs(withComputedRating(editingItem) - score) < 0.001;
                const saving = savingRatingKey === editingKey;
                return (
                  <button
                    key={score}
                    type="button"
                    disabled={saving}
                    onClick={() => saveQuickRating(editingItem, score)}
                    className={`h-7 rounded-lg text-[10px] font-black transition-all active:scale-95 disabled:cursor-wait disabled:opacity-60 ${active
                      ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[0_3px_10px_rgba(245,158,11,0.25)]"
                      : "border border-white/[0.06] bg-white/[0.05] text-zinc-200 hover:bg-white/10"
                      }`}
                    aria-label={`Rate ${getDisplayTitle(editingItem)} ${score} out of 10`}
                  >
                    {Number.isInteger(score) ? score : score.toFixed(1)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={deletingRatingKey === editingKey || savingRatingKey === editingKey}
              onClick={() => deleteRating(editingItem)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-bold text-rose-400 transition-all hover:bg-rose-500/15 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{deletingRatingKey === editingKey ? "Deleting…" : "Delete rating"}</span>
            </button>
            <div className="mt-2 min-h-4 px-1 text-[9px] font-medium">
              {savingRatingKey === editingKey ? (
                <span className="text-zinc-400">Saving rating…</span>
              ) : deletingRatingKey === editingKey ? (
                <span className="text-rose-400">Removing rating…</span>
              ) : ratingSaveError ? (
                <span className="text-red-400">{ratingSaveError}</span>
              ) : (
                <span className="text-zinc-600">0.5–10 in half-point steps</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ShareSheet payload={sharePayload} onClose={() => setSharePayload(null)} />
      <style>{`@keyframes shimmer{100%{transform:translateX(200%)}}`}</style>
    </motion.div>
  );
};

export default UserRatingSection;
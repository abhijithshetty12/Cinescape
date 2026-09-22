import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { Heart, HeartOff, ImageOff, ChartNoAxesCombined, Clapperboard, Tv, Layers, Flame, CalendarDays, Calendar, ChevronDown, Check, Network, Images, Download, X, ChevronLeft, ChevronRight, User, Film, Crown, Star, CalendarCheck, Bookmark, ListChecks, Trophy, MoreHorizontal, History, Plus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Toast from "../components/Toast.tsx";
import Loading from "../components/Loading.tsx";
import { AuthContext } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, addDoc, query, where, getDoc, getDocs, deleteDoc, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import confetti from 'canvas-confetti';
import GlassSweep from "../components/GlassSweep.tsx";
import Lenis from '@studio-freight/lenis';

interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

interface MyListFolder {
  id: string;
  name: string;
}

const getDominantColor = (imageUrl: string): Promise<ColorRGB> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve({ r: 220, g: 38, b: 38 });
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      try {
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < imageData.length; i += 16) {
          if (imageData[i + 3] > 128) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }
        if (count === 0) return resolve({ r: 220, g: 38, b: 38 });
        resolve({
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count)
        });
      } catch {
        resolve({ r: 220, g: 38, b: 38 });
      }
    };
    img.onerror = () => resolve({ r: 220, g: 38, b: 38 });
  });
};


const storedMediaKey = (data: any, fallbackId?: string) => {
  const fallbackMatch = typeof fallbackId === 'string' ? fallbackId.match(/^(movie|tv)[-_](\d+)$/i) : null;
  const rawId = data?.movieId ?? data?.mediaId ?? data?.id ?? fallbackMatch?.[2] ?? fallbackId;
  const numericId = Number(rawId);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  const rawType = data?.mediaType ?? data?.type ?? fallbackMatch?.[1];
  const mediaType = rawType === 'tv' ? 'tv' : 'movie';
  return `${mediaType}-${numericId}`;
};

type MediaStatusIconsProps = {
  favorite?: boolean;
  watched?: boolean;
  inMyList?: boolean;
  inWatchlist?: boolean;
  userRating?: number;
  compact?: boolean;
};

const MediaStatusIcons = ({
  favorite = false,
  watched = false,
  inMyList = false,
  inWatchlist = false,
  userRating,
  compact = false,
}: MediaStatusIconsProps) => {
  const hasRating = typeof userRating === 'number' && Number.isFinite(userRating);
  if (!favorite && !watched && !inMyList && !inWatchlist && !hasRating) return null;

  const circleSize = compact ? 'h-5 min-w-5' : 'h-6 min-w-6';
  const iconSize = compact ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <div className="relative flex w-full items-center justify-end">
      {hasRating && (
        <span
          className="flex items-center justify-center rounded-xl border-[1.5px] border-black bg-gradient-to-b from-amber-400 to-orange-700 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] shadow-[0_2px_6px_rgba(245,158,11,0.3)] [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display',sans-serif]"
          title={`Your rating: ${userRating!.toFixed(1)}`}
        >
          {userRating!.toFixed(1)}
        </span>
      )}
      <div className="flex items-center -space-x-1">
        {favorite && (
          <span
            className={`${circleSize} flex items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_2px_6px_rgba(239,68,68,0.28),inset_0_1px_1px_rgba(255,255,255,0.32)]`}
            title="Favorite"
          >
            <Heart className={`${iconSize} fill-current stroke-[2.6]`} />
          </span>
        )}
        {inMyList && (
          <span
            className={`${circleSize} flex items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-fuchsia-500 to-purple-700 text-white shadow-[0_2px_6px_rgba(168,85,247,0.22),inset_0_1px_1px_rgba(255,255,255,0.32)]`}
            title="In My List"
          >
            <ListChecks className={`${iconSize} stroke-[2.8]`} />
          </span>
        )}
        {inWatchlist && (
          <span
            className={`${circleSize} flex items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_2px_6px_rgba(59,130,246,0.22),inset_0_1px_1px_rgba(255,255,255,0.32)]`}
            title="In Watchlist"
          >
            <Bookmark className={`${iconSize} fill-current stroke-[2.6]`} />
          </span>
        )}
        {watched && (
          <span
            className={`${circleSize} flex items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_2px_6px_rgba(16,185,129,0.22),inset_0_1px_1px_rgba(255,255,255,0.32)]`}
            title="Watched"
          >
            <Check className={`${iconSize} stroke-[3.5]`} />
          </span>
        )}
      </div>
    </div>
  );
};

const Talentsdetails = () => {
  const { id } = useParams();
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const [talent, setTalent] = useState<any>(null);
  const [works, setWorks] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'popularity'>('latest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteDocId, setFavoriteDocId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({ message: '', type: 'success', isVisible: false });
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [dominantColor, setDominantColor] = useState<ColorRGB>({ r: 220, g: 38, b: 38 });
  const [activeNavSection, setActiveNavSection] = useState<'overview' | 'bio' | 'watched' | 'known-for' | 'gallery' | 'filmography'>('overview');
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(false);
  const [watchedHistory, setWatchedHistory] = useState<Map<string, string>>(new Map());
  const [historyDocIds, setHistoryDocIds] = useState<Map<string, string>>(new Map());
  const [watchlistKeys, setWatchlistKeys] = useState<Set<string>>(new Set());
  const [watchlistDocIds, setWatchlistDocIds] = useState<Map<string, string>>(new Map());
  const [myListKeys, setMyListKeys] = useState<Set<string>>(new Set());
  const [myListFolders, setMyListFolders] = useState<MyListFolder[]>([]);
  const [myListFolderKeys, setMyListFolderKeys] = useState<Map<string, Set<string>>>(new Map());
  const [favoriteMediaKeys, setFavoriteMediaKeys] = useState<Set<string>>(new Set());
  const [favoriteMediaDocIds, setFavoriteMediaDocIds] = useState<Map<string, string>>(new Map());
  const [userRatings, setUserRatings] = useState<Map<string, number>>(new Map());
  const [careerMilestones, setCareerMilestones] = useState<any[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [quickActionWork, setQuickActionWork] = useState<any | null>(null);
  const [showQuickMyListFolders, setShowQuickMyListFolders] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const bioRef = useRef<HTMLDivElement>(null);
  const watchedRef = useRef<HTMLDivElement>(null);
  const knownForRef = useRef<HTMLDivElement>(null);
  const gallerySectionRef = useRef<HTMLDivElement>(null);
  const filmographyRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const pendingNavTargetRef = useRef<{
    id: 'overview' | 'watched' | 'known-for' | 'gallery' | 'filmography';
    ref: React.RefObject<HTMLDivElement | null>;
    expiresAt: number;
  } | null>(null);

  const noImageSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 150"><rect width="100%" height="100%" fill="%2327272a"/><g transform="translate(38, 50) scale(1)" stroke="%2371717a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M10.41 4.41A2 2 0 0 1 11 4h9a2 2 0 0 1 2 2v9a2 2 0 0 1-.42 1.15"/><path d="M16 16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 .42-1.15"/><path d="m2 18 5.58-5.58a1 1 0 0 1 1.41 0l3.41 3.41"/><path d="m16 11.5 1-1a1 1 0 0 1 .18-.15"/></g><text x="50%" y="95" fill="%2371717a" font-size="6" font-family="sans-serif" text-anchor="middle" font-weight="500">No Image Available</text></svg>`;
  const tmdbAPIKey = "859afbb4b98e3b467da9c99ac390e950";

  const sortOptions = [
    { id: 'latest', label: 'Latest Release', icon: CalendarDays },
    { id: 'oldest', label: 'Oldest Release', icon: Calendar },
    { id: 'popularity', label: 'Most Popular', icon: Flame }
  ] as const;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

    if (prefersReducedMotion || coarsePointer) {
      lenisRef.current = null;
      return;
    }

    const lenis = new Lenis({
      duration: 0.78,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.92,
      touchMultiplier: 1,
    });
    lenisRef.current = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lenis.stop();
      } else {
        lenis.start();
      }
    };

    rafId = requestAnimationFrame(raf);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    let rafId: number | null = null;

    const updateActiveSection = () => {
      rafId = null;
      const navigationOffset = window.innerWidth < 640 ? 132 : 146;
      const triggerY = navigationOffset + 8;
      const pendingTarget = pendingNavTargetRef.current;

      if (pendingTarget) {
        const targetElement = pendingTarget.ref.current;
        const targetTop = targetElement?.getBoundingClientRect().top;
        const stillNavigating =
          performance.now() < pendingTarget.expiresAt &&
          typeof targetTop === 'number' &&
          Math.abs(targetTop - navigationOffset) > 14;

        if (stillNavigating) {
          setActiveNavSection((current) => current === pendingTarget.id ? current : pendingTarget.id);
          return;
        }

        pendingNavTargetRef.current = null;
      }

      const sections = [
        { id: 'overview', ref: heroRef },
        { id: 'watched', ref: watchedRef },
        { id: 'known-for', ref: knownForRef },
        { id: 'gallery', ref: gallerySectionRef },
        { id: 'filmography', ref: filmographyRef }
      ] as const;

      let nextSection: typeof sections[number]['id'] = 'overview';

      for (const section of sections) {
        const element = section.ref.current;
        if (!element) continue;

        if (element.getBoundingClientRect().top <= triggerY) {
          nextSection = section.id;
        } else {
          break;
        }
      }

      setActiveNavSection((current) => current === nextSection ? current : nextSection);
    };

    const handleScroll = () => {
      if (rafId === null) rafId = requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [loading, works.length, watchedHistory.size, images.length]);

  useEffect(() => {
    const fetchTalentData = async () => {
      try {
        const talentRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}?api_key=${tmdbAPIKey}&language=en-US`
        );
        setTalent(talentRes.data);

        if (talentRes.data?.profile_path) {
          getDominantColor(`https://image.tmdb.org/t/p/w185${talentRes.data.profile_path}`)
            .then(color => setDominantColor(color));
        }

        const creditsRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}/combined_credits?api_key=${tmdbAPIKey}&language=en-US`
        );

        const imagesRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}/images?api_key=${tmdbAPIKey}`
        );
        setImages(imagesRes.data.profiles || []);

        const castContributions = (creditsRes.data.cast || []).map((item: any) => ({
          ...item,
          displayRole: item.character ? `as ${item.character}` : "Cast",
          uniqueKey: `cast-${item.id}-${item.character || ''}`
        }));

        const crewContributions = (creditsRes.data.crew || []).map((item: any) => ({
          ...item,
          displayRole: item.job || item.department || "Crew",
          uniqueKey: `crew-${item.id}-${item.job || ''}`
        }));

        const combinedWorksMap = new Map();
        [...castContributions, ...crewContributions].forEach((item) => {
          const workKey = `${item.media_type === 'tv' ? 'tv' : 'movie'}-${item.id}`;
          if (combinedWorksMap.has(workKey)) {
            const existing = combinedWorksMap.get(workKey);
            if (!existing.displayRole.includes(item.displayRole)) {
              existing.displayRole += `, ${item.displayRole}`;
            }
          } else {
            combinedWorksMap.set(workKey, { ...item });
          }
        });

        const sortedWorks = Array.from(combinedWorksMap.values());
        setWorks(sortedWorks);

        const socialRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}/external_ids?api_key=${tmdbAPIKey}`
        );
        setTalent((prevTalent: any) => ({
          ...prevTalent,
          ...socialRes.data,
        }));

        if (user?.uid) {
          if (talentRes.data.id) {
            const favRef = collection(db, `users/${user.uid}/favouriteTalents`);
            const favQuery = query(favRef, where("talentId", "==", talentRes.data.id));
            const favSnap = await getDocs(favQuery);
            if (!favSnap.empty) {
              setIsFavorite(true);
              setFavoriteDocId(favSnap.docs[0].id);
            } else {
              setIsFavorite(false);
              setFavoriteDocId(null);
            }
          }
        }
      } catch (err: any) {
        console.error("Error fetching talent data:", err);
      } finally {
        if (loading) setLoading(false);
      }
    };

    fetchTalentData();
  }, [id, user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setWatchedHistory(new Map());
      setHistoryDocIds(new Map());
      return;
    }

    const historyRef = collection(db, `users/${user.uid}/history`);
    const unsubscribe = onSnapshot(
      historyRef,
      (snapshot) => {
        const entries = new Map<string, string>();
        const docIds = new Map<string, string>();

        snapshot.forEach((historyDoc) => {
          const data = historyDoc.data();
          const key = storedMediaKey(data, historyDoc.id);
          if (!key) return;

          let watchedDate = '';
          if (Array.isArray(data.watchedDates) && data.watchedDates.length) {
            const latest = data.watchedDates
              .map((value: any) => value?.toDate ? value.toDate() : new Date(value))
              .filter((value: Date) => !Number.isNaN(value.getTime()))
              .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
            watchedDate = latest ? latest.toISOString() : '';
          } else if (typeof data.watchedDate === 'string') {
            watchedDate = data.watchedDate;
          } else if (data.watchedDate && typeof data.watchedDate.toDate === 'function') {
            watchedDate = data.watchedDate.toDate().toISOString();
          }

          entries.set(key, watchedDate);
          docIds.set(key, historyDoc.id);
        });

        setWatchedHistory(entries);
        setHistoryDocIds(docIds);
      },
      (error) => {
        console.error('Error fetching watch history:', error);
        setWatchedHistory(new Map());
        setHistoryDocIds(new Map());
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setWatchlistKeys(new Set());
      setWatchlistDocIds(new Map());
      return;
    }

    const watchlistRef = collection(db, `users/${user.uid}/watchlist`);
    const unsubscribe = onSnapshot(
      watchlistRef,
      (snapshot) => {
        const keys = new Set<string>();
        const docIds = new Map<string, string>();
        snapshot.docs.forEach((watchlistDoc) => {
          const key = storedMediaKey(watchlistDoc.data(), watchlistDoc.id);
          if (key) {
            keys.add(key);
            docIds.set(key, watchlistDoc.id);
          }
        });
        setWatchlistKeys(keys);
        setWatchlistDocIds(docIds);
      },
      () => {
        setWatchlistKeys(new Set());
        setWatchlistDocIds(new Map());
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setFavoriteMediaKeys(new Set());
      setFavoriteMediaDocIds(new Map());
      return;
    }

    const favoritesRef = collection(db, `users/${user.uid}/favouriteMedia`);
    return onSnapshot(
      favoritesRef,
      (snapshot) => {
        const keys = new Set<string>();
        const docIds = new Map<string, string>();
        snapshot.docs.forEach((favoriteDoc) => {
          const key = storedMediaKey(favoriteDoc.data(), favoriteDoc.id);
          if (key) {
            keys.add(key);
            docIds.set(key, favoriteDoc.id);
          }
        });
        setFavoriteMediaKeys(keys);
        setFavoriteMediaDocIds(docIds);
      },
      () => {
        setFavoriteMediaKeys(new Set());
        setFavoriteMediaDocIds(new Map());
      }
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setUserRatings(new Map());
      return;
    }

    const ratingsRef = collection(db, `users/${user.uid}/ratings`);
    const unsubscribe = onSnapshot(
      ratingsRef,
      (snapshot) => {
        const ratings = new Map<string, number>();
        snapshot.docs.forEach((ratingDoc) => {
          const data = ratingDoc.data();
          const key = storedMediaKey(data, ratingDoc.id);
          const rating = data.rating === null || data.rating === undefined ? NaN : Number(data.rating);
          if (key && Number.isFinite(rating)) ratings.set(key, rating);
        });
        setUserRatings(ratings);
      },
      () => setUserRatings(new Map())
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setMyListKeys(new Set());
      setMyListFolders([]);
      setMyListFolderKeys(new Map());
      return;
    }

    const legacyKeysByFolder = new Map<string, Set<string>>();
    const itemKeysByFolder = new Map<string, Set<string>>();
    const itemUnsubscribes = new Map<string, () => void>();

    const emit = () => {
      const keys = new Set<string>();
      const folderKeys = new Map<string, Set<string>>();
      const folderIds = new Set<string>([
        ...legacyKeysByFolder.keys(),
        ...itemKeysByFolder.keys(),
      ]);

      folderIds.forEach((folderId) => {
        const merged = new Set<string>();
        legacyKeysByFolder.get(folderId)?.forEach((key) => merged.add(key));
        itemKeysByFolder.get(folderId)?.forEach((key) => merged.add(key));
        merged.forEach((key) => keys.add(key));
        folderKeys.set(folderId, merged);
      });

      setMyListKeys(keys);
      setMyListFolderKeys(folderKeys);
    };

    const rootRef = collection(db, `users/${user.uid}/customWatchlists`);
    const rootUnsubscribe = onSnapshot(
      rootRef,
      (snapshot) => {
        const liveFolderIds = new Set<string>();
        const folders: MyListFolder[] = [];

        snapshot.docs.forEach((folderDoc) => {
          const folderId = folderDoc.id;
          const folderData = folderDoc.data();
          folders.push({ id: folderId, name: folderData.name || folderData.title || folderData.listName || 'Untitled List' });
          const legacyKeys = new Set<string>();

          if (Array.isArray(folderData.items)) {
            folderData.items.forEach((item: any) => {
              const key = storedMediaKey(item);
              if (key) legacyKeys.add(key);
            });
          }

          legacyKeysByFolder.set(folderId, legacyKeys);
          liveFolderIds.add(folderId);

          if (!itemUnsubscribes.has(folderId)) {
            const itemsRef = collection(db, `users/${user.uid}/customWatchlists/${folderId}/items`);
            const unsubscribeItems = onSnapshot(
              itemsRef,
              (itemsSnapshot) => {
                const keys = new Set<string>();
                itemsSnapshot.docs.forEach((itemDoc) => {
                  const key = storedMediaKey(itemDoc.data(), itemDoc.id);
                  if (key) keys.add(key);
                });
                itemKeysByFolder.set(folderId, keys);
                emit();
              },
              () => {
                itemKeysByFolder.set(folderId, new Set());
                emit();
              }
            );
            itemUnsubscribes.set(folderId, unsubscribeItems);
          }
        });

        [...itemUnsubscribes.entries()].forEach(([folderId, unsubscribeItems]) => {
          if (!liveFolderIds.has(folderId)) {
            unsubscribeItems();
            itemUnsubscribes.delete(folderId);
            itemKeysByFolder.delete(folderId);
            legacyKeysByFolder.delete(folderId);
          }
        });

        setMyListFolders(folders);
        emit();
      },
      () => {
        setMyListKeys(new Set());
        setMyListFolders([]);
        setMyListFolderKeys(new Map());
      }
    );

    return () => {
      rootUnsubscribe();
      itemUnsubscribes.forEach((unsubscribeItems) => unsubscribeItems());
      itemUnsubscribes.clear();
    };
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;

    if (works.length === 0) {
      setCareerMilestones([]);
      setMilestonesLoading(false);
      return;
    }

    const buildCareerMilestones = async () => {
      setMilestonesLoading(true);

      const movieCandidates = [...works]
        .filter((work) => work.media_type !== 'tv' && work.id && (work.poster_path || work.backdrop_path))
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, 14);

      const detailedMovies = await Promise.all(
        movieCandidates.map(async (work) => {
          try {
            const response = await axios.get(
              `https://api.themoviedb.org/3/movie/${work.id}?api_key=${tmdbAPIKey}&language=en-US`
            );

            return {
              ...work,
              milestoneRevenue: Number(response.data?.revenue) || 0,
              milestoneVoteAverage: Number(response.data?.vote_average ?? work.vote_average) || 0,
              milestoneVoteCount: Number(response.data?.vote_count ?? work.vote_count) || 0
            };
          } catch {
            return {
              ...work,
              milestoneRevenue: 0,
              milestoneVoteAverage: Number(work.vote_average) || 0,
              milestoneVoteCount: Number(work.vote_count) || 0
            };
          }
        })
      );

      const revenueMilestones = detailedMovies
        .filter((work) => work.milestoneRevenue > 0)
        .sort((a, b) => b.milestoneRevenue - a.milestoneRevenue)
        .slice(0, 5);

      const selectedKeys = new Set(
        revenueMilestones.map((work) => `${work.media_type === 'tv' ? 'tv' : 'movie'}-${work.id}`)
      );

      const fallbackMilestones = [...works]
        .filter((work) => {
          const key = `${work.media_type === 'tv' ? 'tv' : 'movie'}-${work.id}`;
          return !selectedKeys.has(key) && (work.poster_path || work.backdrop_path);
        })
        .sort((a, b) => {
          const scoreA = (Number(a.vote_average) || 0) * Math.log10((Number(a.vote_count) || 0) + 10) + (Number(a.popularity) || 0) * 0.08;
          const scoreB = (Number(b.vote_average) || 0) * Math.log10((Number(b.vote_count) || 0) + 10) + (Number(b.popularity) || 0) * 0.08;
          return scoreB - scoreA;
        });

      const combined = [...revenueMilestones];

      for (const work of fallbackMilestones) {
        if (combined.length >= 5) break;
        const key = `${work.media_type === 'tv' ? 'tv' : 'movie'}-${work.id}`;
        if (selectedKeys.has(key)) continue;
        selectedKeys.add(key);
        combined.push({
          ...work,
          milestoneRevenue: 0,
          milestoneVoteAverage: Number(work.vote_average) || 0,
          milestoneVoteCount: Number(work.vote_count) || 0
        });
      }

      const ordered = combined
        .slice(0, 5)
        .sort((a, b) => {
          const dateA = new Date(a.release_date || a.first_air_date || '9999-12-31').getTime();
          const dateB = new Date(b.release_date || b.first_air_date || '9999-12-31').getTime();
          return dateA - dateB;
        });

      if (!cancelled) {
        setCareerMilestones(ordered);
        setMilestonesLoading(false);
      }
    };

    buildCareerMilestones();

    return () => {
      cancelled = true;
    };
  }, [works, id]);

  const handleNextImage = useCallback(() => {
    if (selectedImageIndex === null || images.length === 0) return;
    setSelectedImageIndex((prev) => (prev !== null ? (prev + 1) % images.length : 0));
  }, [selectedImageIndex, images.length]);

  const handlePrevImage = useCallback(() => {
    if (selectedImageIndex === null || images.length === 0) return;
    setSelectedImageIndex((prev) => (prev !== null ? (prev - 1 + images.length) % images.length : 0));
  }, [selectedImageIndex, images.length]);

  const handleCloseLightbox = useCallback(() => {
    setSelectedImageIndex(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageIndex === null) return;
      if (e.key === "ArrowRight") {
        handleNextImage();
      } else if (e.key === "ArrowLeft") {
        handlePrevImage();
      } else if (e.key === "Escape") {
        handleCloseLightbox();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImageIndex, handleNextImage, handlePrevImage, handleCloseLightbox]);

  const handleFavoriteToggle = async () => {
    if (!talent || !user) return;

    try {
      const favoritesRef = collection(db, `users/${user.uid}/favouriteTalents`);
      if (isFavorite && favoriteDocId) {
        const { doc } = await import('firebase/firestore');
        const docRef = doc(db, `users/${user.uid}/favouriteTalents/${favoriteDocId}`);
        await deleteDoc(docRef);
        setIsFavorite(false);
        setFavoriteDocId(null);
        setToast({ message: `${talent.name} removed from favorites.`, type: 'info', isVisible: true });
      } else {
        const talentData = {
          talentId: talent.id,
          name: talent.name,
          profile_path: talent.profile_path,
        };
        const docRef = await addDoc(favoritesRef, talentData);
        setIsFavorite(true);
        setFavoriteDocId(docRef.id);

        const count = 200;
        const defaults = {
          origin: { y: 0.7 },
          colors: ['#EF4444', '#EC4899', '#F43F5E', '#FB7185', '#D946EF']
        };

        const fire = (particleRatio: number, opts: any) => {
          confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio)
          });
        };

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });

        setToast({ message: `${talent.name} added to favorites.`, type: 'success', isVisible: true });
      }
    } catch (error) {
      console.error("Error toggling favorite talent:", error);
      setToast({ message: "Failed to update favorites.", type: 'error', isVisible: true });
    }
  };

  const handleDownloadImage = async (filePath: string, index: number) => {
    try {
      const imageUrl = `https://image.tmdb.org/t/p/original${filePath}`;
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${talent?.name || 'talent'}-photo-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      window.open(`https://image.tmdb.org/t/p/original${filePath}`, '_blank');
    }
  };

  const scrollToSection = (
    ref: React.RefObject<HTMLDivElement | null>,
    sectionId: 'overview' | 'watched' | 'known-for' | 'gallery' | 'filmography'
  ) => {
    if (ref.current) {
      const offset = window.innerWidth < 640 ? 132 : 146;
      const elementPosition = ref.current.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - offset;

      pendingNavTargetRef.current = {
        id: sectionId,
        ref,
        expiresAt: performance.now() + 1600
      };
      setActiveNavSection(sectionId);

      if (lenisRef.current) {
        lenisRef.current.scrollTo(offsetPosition, { duration: 1.2 });
      } else {
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  const workHistoryKey = useCallback(
    (work: any) => `${work.media_type === 'tv' ? 'tv' : 'movie'}-${work.id}`,
    []
  );

  const workMediaData = (work: any) => {
    const mediaType: 'movie' | 'tv' = work.media_type === 'tv' ? 'tv' : 'movie';
    const title = work.title || work.name || 'Untitled';
    const releaseDate = work.release_date || work.first_air_date || '';
    const genres = Array.isArray(work.genres)
      ? work.genres.map((genre: any) => typeof genre === 'string' ? genre : genre?.name).filter(Boolean)
      : [];
    return { mediaType, title, releaseDate, genres };
  };

  const closeQuickActions = () => {
    setQuickActionWork(null);
    setShowQuickMyListFolders(false);
  };

  const openQuickActions = (event: React.MouseEvent, work: any) => {
    event.preventDefault();
    event.stopPropagation();
    setQuickActionWork(work);
    setShowQuickMyListFolders(false);
  };

  const toggleWorkWatchlist = async (work: any) => {
    if (!user?.uid) {
      setToast({ message: 'Please sign in to update your watchlist.', type: 'error', isVisible: true });
      return;
    }
    const key = workHistoryKey(work);
    const existingId = watchlistDocIds.get(key);
    try {
      if (existingId) {
        await deleteDoc(doc(db, `users/${user.uid}/watchlist/${existingId}`));
        setToast({ message: `${work.title || work.name || 'Title'} removed from watchlist.`, type: 'info', isVisible: true });
      } else {
        const { mediaType, title, releaseDate, genres } = workMediaData(work);
        await setDoc(doc(db, `users/${user.uid}/watchlist/${key}`), {
          movieId: Number(work.id),
          mediaId: Number(work.id),
          mediaType,
          title,
          name: mediaType === 'tv' ? title : '',
          posterPath: work.poster_path || '',
          releaseDate: mediaType === 'movie' ? releaseDate : '',
          first_air_date: mediaType === 'tv' ? releaseDate : '',
          genres,
          addedAt: serverTimestamp(),
          priority: null,
        }, { merge: true });
        setToast({ message: `${title} added to watchlist.`, type: 'success', isVisible: true });
      }
      closeQuickActions();
    } catch {
      setToast({ message: 'Failed to update watchlist.', type: 'error', isVisible: true });
    }
  };

  const toggleWorkHistory = async (work: any) => {
    if (!user?.uid) {
      setToast({ message: 'Please sign in to update your history.', type: 'error', isVisible: true });
      return;
    }
    const key = workHistoryKey(work);
    const existingId = historyDocIds.get(key);
    try {
      if (existingId) {
        await deleteDoc(doc(db, `users/${user.uid}/history/${existingId}`));
        setToast({ message: `${work.title || work.name || 'Title'} removed from history.`, type: 'info', isVisible: true });
      } else {
        const { mediaType, title, releaseDate, genres } = workMediaData(work);
        const watchedDate = new Date().toISOString();
        await setDoc(doc(db, `users/${user.uid}/history/${key}`), {
          movieId: Number(work.id),
          mediaId: Number(work.id),
          mediaType,
          title,
          name: mediaType === 'tv' ? title : '',
          posterPath: work.poster_path || '',
          releaseDate: mediaType === 'movie' ? releaseDate : '',
          first_air_date: mediaType === 'tv' ? releaseDate : '',
          genres,
          watchedDate,
          watchedDates: [watchedDate],
          timestamp: serverTimestamp(),
        }, { merge: true });
        setToast({ message: `${title} added to history.`, type: 'success', isVisible: true });
      }
      closeQuickActions();
    } catch {
      setToast({ message: 'Failed to update watch history.', type: 'error', isVisible: true });
    }
  };

  const toggleWorkFavorite = async (work: any) => {
    if (!user?.uid) {
      setToast({ message: 'Please sign in to update favourites.', type: 'error', isVisible: true });
      return;
    }
    const key = workHistoryKey(work);
    const existingId = favoriteMediaDocIds.get(key);
    try {
      if (existingId) {
        await deleteDoc(doc(db, `users/${user.uid}/favouriteMedia/${existingId}`));
        setToast({ message: `${work.title || work.name || 'Title'} removed from favourites.`, type: 'info', isVisible: true });
      } else {
        const { mediaType, title } = workMediaData(work);
        await setDoc(doc(db, `users/${user.uid}/favouriteMedia/${key}`), {
          movieId: Number(work.id),
          mediaId: Number(work.id),
          mediaType,
          title,
          posterPath: work.poster_path || '',
          addedAt: serverTimestamp(),
        }, { merge: true });
        setToast({ message: `${title} added to favourites.`, type: 'success', isVisible: true });
      }
      closeQuickActions();
    } catch {
      setToast({ message: 'Failed to update favourites.', type: 'error', isVisible: true });
    }
  };

  const setOptimisticFolderMembership = (folderId: string, key: string, included: boolean) => {
    setMyListFolderKeys((current) => {
      const next = new Map(current);
      const folderKeys = new Set(next.get(folderId) || []);
      if (included) folderKeys.add(key);
      else folderKeys.delete(key);
      next.set(folderId, folderKeys);
      return next;
    });
  };

  const addWorkToMyListFolder = async (work: any, folderId: string) => {
    if (!user?.uid || !folderId) return;
    const key = workHistoryKey(work);
    const folder = myListFolders.find((item) => item.id === folderId);
    const { mediaType, title, releaseDate, genres } = workMediaData(work);

    setOptimisticFolderMembership(folderId, key, true);

    try {
      await setDoc(doc(db, `users/${user.uid}/customWatchlists/${folderId}/items/${key}`), {
        id: Number(work.id),
        movieId: Number(work.id),
        mediaId: Number(work.id),
        type: mediaType,
        mediaType,
        title,
        poster: work.poster_path || '',
        posterPath: work.poster_path || '',
        releaseYear: releaseDate ? String(releaseDate).slice(0, 4) : '',
        voteAverage: Number(work.vote_average) || 0,
        runtimeMinutes: 0,
        genres,
        addedAt: serverTimestamp(),
      }, { merge: true });
      setToast({ message: `${title} added to ${folder?.name || 'My List'}.`, type: 'success', isVisible: true });
    } catch {
      setOptimisticFolderMembership(folderId, key, false);
      setToast({ message: 'Failed to update My List.', type: 'error', isVisible: true });
    }
  };

  const removeWorkFromMyListFolder = async (work: any, folderId: string) => {
    if (!user?.uid || !folderId) return;
    const key = workHistoryKey(work);
    const folder = myListFolders.find((item) => item.id === folderId);

    setOptimisticFolderMembership(folderId, key, false);

    try {
      const folderRef = doc(db, `users/${user.uid}/customWatchlists/${folderId}`);
      const folderSnapshot = await getDoc(folderRef);
      const tasks: Promise<unknown>[] = [];

      if (folderSnapshot.exists()) {
        const folderData = folderSnapshot.data();
        if (Array.isArray(folderData.items)) {
          const nextItems = folderData.items.filter((storedItem: any) => storedMediaKey(storedItem) !== key);
          if (nextItems.length !== folderData.items.length) {
            tasks.push(updateDoc(folderRef, { items: nextItems }));
          }
        }
      }

      const itemsSnapshot = await getDocs(collection(db, `users/${user.uid}/customWatchlists/${folderId}/items`));
      itemsSnapshot.docs.forEach((itemDoc) => {
        if (storedMediaKey(itemDoc.data(), itemDoc.id) === key) {
          tasks.push(deleteDoc(doc(db, `users/${user.uid}/customWatchlists/${folderId}/items/${itemDoc.id}`)));
        }
      });

      await Promise.all(tasks);
      setToast({ message: `${work.title || work.name || 'Title'} removed from ${folder?.name || 'My List'}.`, type: 'info', isVisible: true });
    } catch {
      setOptimisticFolderMembership(folderId, key, true);
      setToast({ message: 'Failed to update My List.', type: 'error', isVisible: true });
    }
  };

  const toggleWorkMyListFolder = async (work: any, folderId: string) => {
    const key = workHistoryKey(work);
    const isInFolder = myListFolderKeys.get(folderId)?.has(key) || false;

    if (isInFolder) {
      await removeWorkFromMyListFolder(work, folderId);
    } else {
      await addWorkToMyListFolder(work, folderId);
    }
  };

  const handleQuickMyList = () => {
    setShowQuickMyListFolders((current) => !current);
  };

  const watchedWorks = useMemo(() => {
    return [...works]
      .filter((work) => watchedHistory.has(workHistoryKey(work)))
      .sort((a, b) => {
        const dateA = watchedHistory.get(workHistoryKey(a));
        const dateB = watchedHistory.get(workHistoryKey(b));
        const timeA = dateA ? new Date(dateA).getTime() : 0;
        const timeB = dateB ? new Date(dateB).getTime() : 0;
        return timeB - timeA;
      });
  }, [works, watchedHistory, workHistoryKey]);

  const knownForWorks = useMemo(() => {
    return [...works]
      .filter((w) => w.poster_path || w.backdrop_path)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 6);
  }, [works]);

  const watchedCount = watchedWorks.length;

  const totalWorksCount = works.length;
  const watchedPercentage = totalWorksCount > 0 ? Math.round((watchedCount / totalWorksCount) * 100) : 0;

  const formatMilestoneRevenue = (value: number) => {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : 1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 100_000_000 ? 0 : 1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  if (loading) {
    return <Loading />;
  }

  const trendingWork = [...works]
    .filter((w) => w.backdrop_path || w.poster_path)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];

  const backgroundImageUrl = trendingWork
    ? `url(https://image.tmdb.org/t/p/original${trendingWork.backdrop_path || trendingWork.poster_path})`
    : '';
  const talentImageUrl = `https://image.tmdb.org/t/p/w500${talent?.profile_path ?? ''}`;
  const talentName = talent?.name ?? 'Unknown Filmography';
  const talentPopularity = talent?.popularity ?? 0;
  const formattedPopularity = talentPopularity.toFixed(1);

  const filteredWorks = works
    .filter((work) => {
      if (activeTab === 'all') return true;
      const mediaType = work.media_type === "tv" ? "tv" : "movie";
      return mediaType === activeTab;
    })
    .sort((a, b) => {
      if (sortBy === 'latest') {
        const dateA = new Date(a.release_date || a.first_air_date || 0).getTime();
        const dateB = new Date(b.release_date || b.first_air_date || 0).getTime();
        return dateB - dateA;
      }
      if (sortBy === 'oldest') {
        const dateA = new Date(a.release_date || a.first_air_date || '9999-12-31').getTime();
        const dateB = new Date(b.release_date || b.first_air_date || '9999-12-31').getTime();
        return dateA - dateB;
      }
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    });

  const ActiveSortIcon = sortOptions.find(opt => opt.id === sortBy)?.icon || CalendarDays;

  const gridContainerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: isMobileViewport ? 0.004 : 0.012,
        delayChildren: 0
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: isMobileViewport ? 8 : 12, scale: isMobileViewport ? 1 : 0.985 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: isMobileViewport ? 0.16 : 0.22, ease: [0.16, 1, 0.3, 1] }
    },
    exit: {
      opacity: 0,
      scale: 0.985,
      y: -6,
      transition: { duration: 0.12 }
    }
  };

  const isBioLong = talent?.biography && talent.biography.length > 300;
  const quickActionKey = quickActionWork ? workHistoryKey(quickActionWork) : '';
  const quickActionWatched = Boolean(quickActionKey && watchedHistory.has(quickActionKey));
  const quickActionWatchlisted = Boolean(quickActionKey && watchlistKeys.has(quickActionKey));
  const quickActionListCount = quickActionKey ? myListFolders.filter((folder) => myListFolderKeys.get(folder.id)?.has(quickActionKey)).length : 0;
  const quickActionInMyList = quickActionListCount > 0;
  const quickActionFavorite = Boolean(quickActionKey && favoriteMediaKeys.has(quickActionKey));
  const quickActionMediaType = quickActionWork?.media_type === 'tv' ? 'tv' : 'movie';
  const quickActionReleaseDate = quickActionWork?.release_date || quickActionWork?.first_air_date || '';
  const quickActionYear = quickActionReleaseDate ? String(quickActionReleaseDate).slice(0, 4) : 'TBD';

  return (
    <div className="relative min-h-screen font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',sans-serif]">
      <style>{`
        .filmography-card-static:hover,
        .filmography-card-static:hover > a,
        .filmography-card-static:hover > a > div,
        .filmography-card-static:hover > a > div > div,
        .filmography-card-static:hover > a > div > div > :last-child {
          transform: none !important;
          translate: none !important;
          scale: 1 !important;
          rotate: none !important;
        }
        .filmography-poster-clean [class*="bg-gradient"][class*="from-black"] {
          background-image: none !important;
          background-color: transparent !important;
        }
        html.lenis,
        html.lenis body {
          height: auto;
        }
        .lenis.lenis-smooth {
          scroll-behavior: auto !important;
        }
        .lenis.lenis-smooth [data-lenis-prevent] {
          overscroll-behavior: contain;
        }
        .lenis.lenis-stopped {
          overflow: hidden;
        }
        [data-lenis-prevent] {
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-25 transform-gpu"
        style={{
          background: `radial-gradient(1200px circle at 50% -10%, rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.35), transparent 70%)`
        }}
      />

      <div className="relative z-10 container mx-auto px-4 py-6 md:py-12 max-w-7xl">
        <div ref={heroRef} className="relative mb-6 md:mb-10 rounded-[32px] sm:rounded-[40px] overflow-hidden p-0.5 bg-gradient-to-b from-white/30 via-white/10 to-transparent shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)]">
          <div className="relative min-h-none sm:min-h-[380px] md:h-[420px] rounded-[30px] sm:rounded-[38px] overflow-hidden bg-black/60 backdrop-blur-md sm:backdrop-blur-xl md:backdrop-blur-2xl transform-gpu">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 blur-md sm:blur-xl opacity-50 transform-gpu"
              style={{ backgroundImage: backgroundImageUrl }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div
              className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen"
              style={{
                background: `radial-gradient(800px circle at 20% 40%, rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.5), transparent 60%)`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none" />

            <div className="relative h-full flex flex-col sm:flex-row items-center sm:items-end justify-between p-5 sm:p-7 md:p-8 gap-5 z-10 pt-8 sm:pt-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-6 w-full sm:w-auto">
                <div className="relative flex-shrink-0 group">
                  <div className="relative w-32 h-44 sm:w-36 sm:h-52 md:w-44 md:h-60 rounded-[28px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.5)] p-1 bg-gradient-to-b from-white/40 via-white/10 to-transparent backdrop-blur-2xl">
                    <div className="w-full h-full rounded-[24px] overflow-hidden relative bg-zinc-900">
                      {talent?.profile_path ? (
                        <img
                          src={talentImageUrl}
                          alt={`${talentName} profile`}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-500">
                          <ImageOff className="w-10 h-10 mb-2 opacity-40" />
                          <span className="text-xs font-medium px-4 text-center">No Image</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left text-white w-full">
                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-2 sm:mb-3 leading-[1.05] drop-shadow-md">
                    {talentName}
                  </h1>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-2.5 mb-4 sm:mb-5">
                    <Link
                      to={`/talent/${talent?.id}/connections`}
                      className="group flex items-center justify-center gap-2 bg-gradient-to-b from-white/25 to-white/10 hover:from-white/35 hover:to-white/15 backdrop-blur-2xl px-3.5 py-1.5 rounded-full border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.12)] transition-all active:scale-95 text-white"
                    >
                      <Network className="w-3.5 h-3.5 shrink-0 text-blue-400 transition-transform duration-300 group-hover:scale-110" />
                      <span className="font-semibold text-xs tracking-wide">Connections</span>
                    </Link>

                    <div className="flex items-center gap-2 bg-gradient-to-b from-white/25 to-white/10 backdrop-blur-2xl px-3.5 py-1.5 rounded-full border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
                      <ChartNoAxesCombined className="w-4 h-4 text-amber-300 shrink-0" />
                      <span className="font-semibold text-xs tracking-wide text-white">{formattedPopularity}</span>
                      <span className="text-white/60 text-xs font-medium hidden xs:inline">Popularity</span>
                    </div>

                    {images.length > 0 && (
                      <button
                        onClick={() => setIsGalleryOpen(true)}
                        className="flex items-center gap-2 bg-gradient-to-b from-white/25 to-white/10 hover:from-white/35 hover:to-white/15 backdrop-blur-2xl px-3.5 py-1.5 rounded-full border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-all active:scale-95 text-white"
                      >
                        <Images className="w-4 h-4 text-sky-300 shrink-0" />
                        <span className="font-semibold text-xs tracking-wide">{images.length} Photos</span>
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <motion.button
                      onClick={handleFavoriteToggle}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      className={`w-full sm:w-auto flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-6 py-3 rounded-2xl font-semibold text-xs tracking-wide transition-all duration-300 shadow-2xl border ${isFavorite
                        ? "bg-gradient-to-b from-rose-500 to-rose-700 text-white border-rose-400/40 shadow-rose-950/50"
                        : "bg-gradient-to-b from-white/95 to-white/80 text-black border-white shadow-black/20 hover:from-white hover:to-white/90"
                        }`}
                      aria-label={isFavorite ? `Remove ${talentName} from favorites` : `Add ${talentName} to favorites`}
                    >
                      <AnimatePresence mode="wait">
                        {isFavorite ? (
                          <motion.div
                            key="heart-on"
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.7, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <HeartOff className="w-4 h-4 flex-shrink-0" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="heart-off"
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.7, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Heart className="w-4 h-4 flex-shrink-0 fill-current" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <span>
                        {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                      </span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.075] to-white/[0.025] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:mb-8 sm:px-5 sm:py-4"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <div className="mb-2.5 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/10">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wide text-zinc-200 sm:text-xs">Completion Progress</p>
                <p className="truncate text-[9px] font-medium text-zinc-500 sm:text-[10px]">
                  {watchedCount} of {totalWorksCount} credited titles watched
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-sm font-bold tracking-tight text-white sm:text-base">{watchedPercentage}%</span>
              <span className="ml-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-400/80 sm:text-[10px]">Completed</span>
            </div>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full border border-white/[0.05] bg-black/45 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, watchedPercentage))}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-green-300 shadow-[0_0_12px_rgba(52,211,153,0.36)]"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-white/45" />
            </motion.div>
          </div>
        </motion.div>

        <div className="sticky top-[72px] sm:top-[80px] lg:top-[84px] z-40 mb-8 w-full max-w-fit mx-auto sm:mx-0 px-2 sm:px-0">
          <nav className="flex items-center gap-1 sm:gap-2 p-1.5 bg-zinc-950/90 backdrop-blur-md sm:backdrop-blur-xl border border-white/10 rounded-full shadow-xl overflow-x-auto no-scrollbar max-w-[calc(100vw-2rem)] sm:max-w-none touch-pan-x overscroll-x-contain -webkit-overflow-scrolling-touch transform-gpu">
            <button
              onClick={() => scrollToSection(heroRef, 'overview')}
              className={`h-10 w-10 sm:h-auto sm:w-auto sm:px-3.5 sm:py-2 sm:min-h-[44px] rounded-full text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 active:scale-95 ${activeNavSection === 'overview'
                ? 'bg-white text-black shadow-lg scale-105'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Overview</span>
            </button>
            {watchedWorks.length > 0 && (
              <button
                onClick={() => scrollToSection(watchedRef, 'watched')}
                className={`h-10 w-10 sm:h-auto sm:w-auto sm:px-3.5 sm:py-2 sm:min-h-[44px] rounded-full text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 active:scale-95 ${activeNavSection === 'watched'
                  ? 'bg-emerald-400 text-black shadow-lg scale-105'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Watched</span>
              </button>
            )}
            {knownForWorks.length > 0 && (
              <button
                onClick={() => scrollToSection(knownForRef, 'known-for')}
                className={`h-10 w-10 sm:h-auto sm:w-auto sm:px-3.5 sm:py-2 sm:min-h-[44px] rounded-full text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 active:scale-95 ${activeNavSection === 'known-for'
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Known For</span>
              </button>
            )}
            {images.length > 0 && (
              <button
                onClick={() => scrollToSection(gallerySectionRef, 'gallery')}
                className={`h-10 w-10 sm:h-auto sm:w-auto sm:px-3.5 sm:py-2 sm:min-h-[44px] rounded-full text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 active:scale-95 ${activeNavSection === 'gallery'
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Images className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Gallery</span>
              </button>
            )}
            <button
              onClick={() => scrollToSection(filmographyRef, 'filmography')}
              className={`h-10 w-10 sm:h-auto sm:w-auto sm:px-3.5 sm:py-2 sm:min-h-[44px] rounded-full text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 active:scale-95 ${activeNavSection === 'filmography'
                ? 'bg-white text-black shadow-lg scale-105'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Film className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Filmography</span>
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8 mb-12">
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="bg-zinc-900/40 backdrop-blur-md rounded-3xl p-6 border border-zinc-800/60 shadow-xl">
              <h2 className="text-lg font-bold mb-5 text-white tracking-tight">Personal Info</h2>
              <dl className="space-y-4">
                {[
                  { label: 'Born', value: talent?.birthday ?? 'N/A' },
                  { label: 'Place of Birth', value: talent?.place_of_birth ?? 'N/A' },
                  { label: 'Known For', value: talent?.known_for_department ?? 'N/A' },
                  { label: 'Watched', value: `${watchedCount} / ${totalWorksCount} (${watchedPercentage}%)` },
                  { label: 'Total Credits', value: `${works.length} titles` }
                ].map(({ label, value }) => (
                  <div key={label} className="border-b border-zinc-800/40 pb-3 last:border-b-0 last:pb-0">
                    <dt className="text-zinc-500 text-xs font-semibold tracking-wider uppercase mb-1">{label}</dt>
                    <dd className="text-zinc-200 text-sm font-medium leading-relaxed">{value}</dd>
                  </div>
                ))}

                {((talent?.instagram_id || talent?.twitter_id || talent?.youtube_id) && (
                  <div className="pt-4 border-t border-zinc-800/40">
                    <dt className="text-zinc-500 text-xs font-semibold tracking-wider uppercase mb-4">Social Connect</dt>
                    <div className="flex flex-wrap gap-3">
                      {talent?.instagram_id && (
                        <a
                          href={`https://instagram.com/${talent.instagram_id}`}
                          rel="noopener noreferrer"
                          aria-label={`${talentName} on Instagram`}
                          className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-all duration-200 hover:scale-105 group active:scale-95 min-h-[44px] min-w-[44px]"
                        >
                          <img src="/insta-icon.png" alt="Instagram" className="w-9 h-9 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                      {talent?.twitter_id && (
                        <a
                          href={`https://twitter.com/${talent.twitter_id}`}
                          rel="noopener noreferrer"
                          aria-label={`${talentName} on Twitter`}
                          className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-all duration-200 hover:scale-105 group active:scale-95 min-h-[44px] min-w-[44px]"
                        >
                          <img src="/twitter-icon.png" alt="Twitter" className="w-9 h-9 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                      {talent?.youtube_id && (
                        <a
                          href={`https://youtube.com/${talent.youtube_id}`}
                          rel="noopener noreferrer"
                          aria-label={`${talentName} on YouTube`}
                          className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-all duration-200 hover:scale-105 group active:scale-95 min-h-[44px] min-w-[44px]"
                        >
                          <img src="/yt-icon.png" alt="YouTube" className="w-9 h-9 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div ref={bioRef} className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-zinc-900/30 backdrop-blur-sm rounded-3xl p-6 sm:p-8 border border-zinc-800/40 shadow-xl h-full flex flex-col justify-start">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white tracking-tight">Biography</h2>
              <div className="relative">
                <p className={`text-zinc-300 text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal transition-all duration-500 ${!isBioExpanded ? 'line-clamp-4 max-h-28 overflow-hidden' : ''}`}>
                  {talent?.biography ?? "Biography not available for this individual."}
                </p>
                {!isBioExpanded && isBioLong && (
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-900/90 via-zinc-900/40 to-transparent pointer-events-none" />
                )}
              </div>
              {isBioLong && (
                <button
                  onClick={() => setIsBioExpanded(!isBioExpanded)}
                  className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors w-fit focus:outline-none min-h-[44px] min-w-[44px] py-2"
                >
                  <span>{isBioExpanded ? "Read Less" : "Read More"}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isBioExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>

        {(milestonesLoading || careerMilestones.length > 0) && (
          <section className="mb-12">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-gradient-to-b from-amber-400/20 to-orange-500/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <Trophy className="h-4 w-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Career Milestones</h2>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-500 sm:text-xs">
                    Major box-office and standout projects across {talentName}&apos;s career
                  </p>
                </div>
              </div>
            </div>

            {milestonesLoading && careerMilestones.length === 0 ? (
              <div className="flex gap-3.5 overflow-hidden sm:gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="w-[210px] shrink-0 sm:w-[238px]">
                    <div className="mb-3 h-4 w-12 animate-pulse rounded bg-white/[0.07]" />
                    <div className="h-[116px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.035]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="-mx-4 overflow-x-auto px-4 pb-2 no-scrollbar touch-pan-x overscroll-x-contain sm:mx-0 sm:px-0" data-lenis-prevent>
                <div className="relative flex min-w-max gap-3.5 pt-5 sm:gap-4">
                  <div className="pointer-events-none absolute left-3 right-3 top-[27px] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  {careerMilestones.map((work, index) => {
                    const mediaType = work.media_type === 'tv' ? 'tv' : 'movie';
                    const releaseDate = work.release_date || work.first_air_date;
                    const year = releaseDate && releaseDate.trim() !== '' ? releaseDate.split('-')[0] : 'TBD';
                    const revenue = Number(work.milestoneRevenue) || 0;
                    const rating = Number(work.milestoneVoteAverage ?? work.vote_average) || 0;
                    const milestoneLabel = revenue > 0 ? 'Box Office' : rating >= 7.5 ? 'Top Rated' : 'Career Highlight';
                    const milestoneMetric = revenue > 0
                      ? formatMilestoneRevenue(revenue)
                      : rating > 0
                        ? `${rating.toFixed(1)}/10`
                        : `${Math.round(Number(work.popularity) || 0)} popularity`;
                    const statusKey = workHistoryKey(work);
                    const isWatched = watchedHistory.has(statusKey);
                    const isInMyList = myListKeys.has(statusKey);
                    const isInWatchlist = watchlistKeys.has(statusKey);
                    const isFavoriteMedia = favoriteMediaKeys.has(statusKey);
                    const userRating = userRatings.get(statusKey);

                    return (
                      <div key={`milestone-${mediaType}-${work.id}`} className="group relative w-[210px] shrink-0 snap-start sm:w-[238px]">
                        <Link to={`/${mediaType}/${work.id}`} className="block">
                          <div className="relative z-10 mb-3 flex items-center gap-2 pl-2">
                            <div className="flex h-4 w-4 items-center justify-center rounded-full border border-amber-300/40 bg-black shadow-[0_0_0_4px_rgba(0,0,0,0.75)]">
                              <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            </div>
                            <span className="text-[10px] font-bold tracking-[0.12em] text-zinc-400">{year}</span>
                          </div>

                          <div className="relative overflow-hidden rounded-2xl border border-white/[0.10] bg-gradient-to-b from-white/[0.07] to-white/[0.025] p-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.10),0_10px_28px_rgba(0,0,0,0.24)] transition-colors duration-300 group-hover:border-white/20">
                            <div className="flex min-w-0 gap-3">
                              <div className="relative h-[92px] w-[62px] shrink-0">
                                <div className="h-full w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                                  <img
                                    src={work.poster_path ? `https://image.tmdb.org/t/p/w342${work.poster_path}` : noImageSvg}
                                    alt={work.title || work.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    draggable={false}
                                  />
                                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-white/[0.14] via-transparent to-transparent" />
                                </div>
                                <div className="absolute -bottom-2 inset-x-0 z-30 px-0.5">
                                  <MediaStatusIcons
                                    favorite={isFavoriteMedia}
                                    watched={isWatched}
                                    inMyList={isInMyList}
                                    inWatchlist={isInWatchlist}
                                    userRating={userRating}
                                    compact
                                  />
                                </div>
                              </div>

                              <div className="flex min-w-0 flex-1 flex-col py-0.5 pr-5 sm:pr-6">
                                <div className="mb-1.5 flex items-center gap-1.5">
                                  <span className="rounded-md border border-amber-400/15 bg-amber-400/[0.08] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-amber-300">
                                    {milestoneLabel}
                                  </span>
                                  <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
                                    {mediaType === 'tv' ? 'Series' : 'Movie'}
                                  </span>
                                </div>

                                <p className="line-clamp-2 text-xs font-semibold leading-snug tracking-tight text-zinc-100 sm:text-[13px]">
                                  {work.title || work.name}
                                </p>

                                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                                  <div className="flex min-w-0 items-center gap-1 text-[9px] font-semibold text-zinc-400">
                                    {revenue > 0 ? (
                                      <ChartNoAxesCombined className="h-3 w-3 shrink-0 text-emerald-400" />
                                    ) : (
                                      <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                                    )}
                                    <span className="truncate">{milestoneMetric}</span>
                                  </div>
                                  <span className="text-[9px] font-bold text-white/25">#{index + 1}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={(event) => openQuickActions(event, work)}
                          className="absolute right-1.5 top-[39px] z-40 flex h-6 w-6 items-center justify-center rounded-lg border border-white/20 bg-black/40 text-zinc-200 shadow-md backdrop-blur-md backdrop-saturate-150 transition hover:bg-black/80 hover:text-white active:scale-90 sm:right-2 sm:top-[41px] sm:h-7 sm:w-7 sm:rounded-xl sm:bg-black/60"
                          aria-label={`Quick actions for ${work.title || work.name || 'title'}`}
                          title="Quick actions"
                        >
                          <MoreHorizontal className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {watchedWorks.length > 0 && (
          <div ref={watchedRef} className="mb-12">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-gradient-to-b from-emerald-400/25 to-emerald-600/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.24),0_8px_24px_rgba(16,185,129,0.12)] backdrop-blur-2xl">
                  <Check className="h-4 w-4 text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight text-white">Watched</h2>
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-zinc-300 backdrop-blur-xl">
                      {watchedWorks.length}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-zinc-500 sm:text-xs">
                    Movies and series featuring {talentName} from your watch history
                  </p>
                </div>
              </div>
              <div className="hidden items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-semibold text-emerald-300 sm:flex">
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span>{watchedPercentage}% of credits</span>
              </div>
            </div>

            <div className="-mx-4 flex snap-x snap-proximity gap-3.5 overflow-x-auto px-4 pb-4 no-scrollbar touch-pan-x -webkit-overflow-scrolling-touch sm:mx-0 sm:gap-4 sm:px-0" data-lenis-prevent>
              {watchedWorks.map((work) => {
                const mediaType = work.media_type === 'tv' ? 'tv' : 'movie';
                const watchedDate = watchedHistory.get(workHistoryKey(work));
                const releaseDate = work.release_date || work.first_air_date;
                const workYear = releaseDate && releaseDate.trim() !== '' ? releaseDate.split('-')[0] : 'TBD';
                const rating = work.vote_average ? work.vote_average.toFixed(1) : null;
                const watchedLabel = watchedDate
                  ? new Date(watchedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Watched';
                const statusKey = workHistoryKey(work);
                const isInMyList = myListKeys.has(statusKey);
                const isInWatchlist = watchlistKeys.has(statusKey);
                const isFavoriteMedia = favoriteMediaKeys.has(statusKey);
                const userRating = userRatings.get(statusKey);

                return (
                  <div key={`watched-${mediaType}-${work.id}`} className="group relative w-[142px] shrink-0 snap-start sm:w-[164px] md:w-[184px]">
                    <Link
                      to={`/${mediaType}/${work.id}`}
                      className="block"
                    >
                      <div className="relative">
                        <div className="relative aspect-[2/3] overflow-hidden rounded-[24px] border border-white/[0.13] bg-zinc-950 shadow-[0_12px_34px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.10)] transition-colors duration-300 group-hover:border-white/25">
                          <img
                            src={work.poster_path ? `https://image.tmdb.org/t/p/w500${work.poster_path}` : noImageSvg}
                            alt={work.title || work.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/[0.16] via-transparent to-transparent" />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                          {rating && (
                            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 shadow-md backdrop-blur-md sm:right-2.5 sm:top-2.5 sm:px-2.5 sm:py-1">
                              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400 sm:h-3 sm:w-3" />
                              <span className="text-[10px] font-semibold leading-none text-white sm:text-[11px]">{rating}</span>
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-2 inset-x-0 z-30 px-2">
                          <MediaStatusIcons
                            favorite={isFavoriteMedia}
                            watched
                            inMyList={isInMyList}
                            inWatchlist={isInWatchlist}
                            userRating={userRating}
                          />
                        </div>
                      </div>
                      <div className="px-1 pt-2">
                        <p className="line-clamp-2 text-sm font-semibold leading-tight tracking-tight text-zinc-100 transition-colors group-hover:text-white sm:text-[15px]">
                          {work.title || work.name}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-medium text-zinc-500 sm:text-[10px]">
                          <span>{workYear}</span>
                          <span className="text-white/20">•</span>
                          <span>{mediaType === 'tv' ? 'Series' : 'Movie'}</span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 truncate text-[9px] font-medium text-zinc-500 sm:text-[10px]">
                          <CalendarCheck className="h-3 w-3 shrink-0 text-emerald-500" />
                          <span className="truncate">{watchedLabel}</span>
                        </p>
                        <p className="mt-0.5 truncate text-[9px] font-medium capitalize text-zinc-600 sm:text-[10px]">
                          {work.displayRole}
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={(event) => openQuickActions(event, work)}
                      className="absolute left-2 top-2 z-40 flex h-7 w-7 items-center justify-center rounded-xl border border-white/20 bg-black/40 text-zinc-200 shadow-lg backdrop-blur-md backdrop-saturate-150 transition hover:bg-black/70 hover:text-white active:scale-90 sm:left-2.5 sm:top-2.5 sm:h-8 sm:w-8 sm:bg-black/60"
                      aria-label={`Quick actions for ${work.title || work.name || 'title'}`}
                      title="Quick actions"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {knownForWorks.length > 0 && (
          <div ref={knownForRef} className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Crown className="w-5 h-5 text-amber-500 shrink-0" />
              <h2 className="text-2xl font-bold text-white tracking-tight">Known For</h2>
            </div>
            <div className="flex overflow-x-auto gap-4 snap-x snap-proximity no-scrollbar touch-pan-x -webkit-overflow-scrolling-touch pb-4 px-4 sm:px-0 -mx-4 sm:mx-0" data-lenis-prevent>
              {knownForWorks.map((work) => {
                const mediaType = work.media_type === "tv" ? "tv" : "movie";
                const rating = work.vote_average ? work.vote_average.toFixed(1) : null;
                const releaseDate = work.release_date || work.first_air_date;
                const workYear = releaseDate && releaseDate.trim() !== "" ? releaseDate.split("-")[0] : "TBD";
                const statusKey = workHistoryKey(work);
                const isWatched = watchedHistory.has(statusKey);
                const isInMyList = myListKeys.has(statusKey);
                const isInWatchlist = watchlistKeys.has(statusKey);
                const isFavoriteMedia = favoriteMediaKeys.has(statusKey);
                const userRating = userRatings.get(statusKey);

                return (
                  <div key={`${mediaType}-${work.id}`} className="group relative shrink-0 w-[140px] sm:w-[160px] md:w-[180px] snap-start">
                    <Link to={`/${mediaType}/${work.id}`} className="block">
                      <div className="relative aspect-[2/3] rounded-3xl overflow-hidden bg-gradient-to-b from-white/20 via-white/5 to-transparent p-[1px] shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
                        <div className="relative w-full h-full rounded-[23px] overflow-hidden bg-zinc-950">
                          <img
                            src={work.poster_path ? `https://image.tmdb.org/t/p/w342${work.poster_path}` : noImageSvg}
                            alt={work.title || work.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/25 via-transparent to-transparent pointer-events-none z-10" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
                          {rating && (
                            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-none md:backdrop-blur-sm border border-white/15 shadow-md">
                              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 fill-amber-400" />
                              <span className="text-[10px] sm:text-[11px] font-semibold text-white leading-none tracking-tight">{rating}</span>
                            </div>
                          )}
                          <div className="absolute top-2.5 right-2.5 z-20 flex items-center justify-center px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-none md:backdrop-blur-sm border border-white/15 shadow-md">
                            <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-200 leading-none tracking-tight">{workYear}</span>
                          </div>

                          <div className="absolute bottom-0 inset-x-0 p-3 z-20 flex flex-col justify-end">
                            <span className="text-xs font-bold text-white line-clamp-1 tracking-tight">{work.title || work.name}</span>
                            <span className="text-[10px] text-zinc-300 line-clamp-1 font-medium">{work.displayRole}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => openQuickActions(event, work)}
                            className="absolute left-2 bottom-12 sm:bottom-14 z-40 flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-black/70 text-zinc-200 shadow-lg backdrop-blur-md transition hover:bg-black/90 hover:text-white active:scale-90"
                            aria-label={`Quick actions for ${work.title || work.name || 'title'}`}
                            title="Quick actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="absolute -bottom-2 inset-x-0 z-30 px-2">
                        <MediaStatusIcons
                          favorite={isFavoriteMedia}
                          watched={isWatched}
                          inMyList={isInMyList}
                          inWatchlist={isInWatchlist}
                          userRating={userRating}
                        />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {images.length > 0 && (
          <div ref={gallerySectionRef} className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Images className="w-5 h-5 text-sky-400 shrink-0" />
                <h2 className="text-2xl font-bold text-white tracking-tight">Gallery Preview</h2>
              </div>
              <button
                onClick={() => setIsGalleryOpen(true)}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-end"
              >
                View All ({images.length})
              </button>
            </div>
            <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-6 gap-4 overflow-x-auto no-scrollbar touch-pan-x -webkit-overflow-scrolling-touch -mx-4 px-4 sm:mx-0 sm:px-0" data-lenis-prevent>
              {images.slice(0, 6).map((img, idx) => (
                <div
                  key={img.file_path || idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className="group relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 cursor-pointer shadow-lg active:scale-95 transition-all shrink-0 w-[140px] sm:w-auto"
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w342${img.file_path}`}
                    alt={`${talentName} preview ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Images className="w-6 h-6 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <section ref={filmographyRef}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <h2 className="text-xl md:text-2xl font-bold text-white whitespace-nowrap">Filmography</h2>
              <div className="h-px min-w-8 flex-1 bg-gradient-to-r from-zinc-700 via-zinc-800/80 to-transparent" />
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-2.5">
              <div className="flex min-w-0 flex-1 items-center sm:flex-initial">
                <div className="inline-flex min-w-0 flex-1 items-center bg-white/10 dark:bg-white/[0.06] backdrop-blur-2xl p-1 rounded-xl border border-white/15 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] sm:flex-initial">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 px-2.5 py-1.5 sm:flex-initial sm:gap-1.5 sm:px-3.5 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all duration-300 z-10 ${activeTab === 'all' ? 'text-white font-semibold' : 'text-white/60 hover:text-white'}`}
                  >
                    <Layers className="w-3 h-3 relative z-10" />
                    <span className="relative z-10">All</span>
                    {activeTab === 'all' && (
                      <motion.div
                        layoutId="filmographyActive"
                        className="absolute inset-0 bg-gradient-to-b from-[#FF3B30] to-[#E02B20] rounded-lg -z-10 shadow-[0_4px_15px_rgba(255,59,48,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('movie')}
                    className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 px-2.5 py-1.5 sm:flex-initial sm:gap-1.5 sm:px-3.5 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all duration-300 z-10 ${activeTab === 'movie' ? 'text-white font-semibold' : 'text-white/60 hover:text-white'}`}
                  >
                    <Clapperboard className="w-3 h-3 relative z-10" />
                    <span className="relative z-10">Movies</span>
                    {activeTab === 'movie' && (
                      <motion.div
                        layoutId="filmographyActive"
                        className="absolute inset-0 bg-gradient-to-b from-[#FF3B30] to-[#E02B20] rounded-lg -z-10 shadow-[0_4px_15px_rgba(255,59,48,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('tv')}
                    className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 px-2.5 py-1.5 sm:flex-initial sm:gap-1.5 sm:px-3.5 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all duration-300 z-10 ${activeTab === 'tv' ? 'text-white font-semibold' : 'text-white/60 hover:text-white'}`}
                  >
                    <Tv className="w-3 h-3 relative z-10" />
                    <span className="relative z-10">Series</span>
                    {activeTab === 'tv' && (
                      <motion.div
                        layoutId="filmographyActive"
                        className="absolute inset-0 bg-gradient-to-b from-[#FF3B30] to-[#E02B20] rounded-lg -z-10 shadow-[0_4px_15px_rgba(255,59,48,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                </div>
              </div>
              <div className="relative shrink-0">
                <button
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="flex min-h-[38px] items-center justify-between gap-1.5 rounded-xl border border-t-white/[0.15] border-x-white/[0.08] border-b-white/[0.03] bg-gradient-to-b from-white/[0.07] to-white/[0.01] px-2.5 py-1.5 text-[10px] font-medium text-white shadow-[0_4px_20px_0_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-2xl transition-all duration-300 hover:border-white/20 active:scale-98 sm:gap-2 sm:px-3 sm:text-xs"
                >
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <ActiveSortIcon className="h-3 w-3 shrink-0 text-red-500 sm:h-3.5 sm:w-3.5" />
                    <span className="sm:hidden">
                      {sortBy === 'latest' ? 'Latest' : sortBy === 'oldest' ? 'Oldest' : 'Popular'}
                    </span>
                    <span className="hidden sm:inline">{sortOptions.find(o => o.id === sortBy)?.label}</span>
                  </div>
                  <ChevronDown className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-300 sm:h-3.5 sm:w-3.5 ${isSortOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isSortOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.95 }}
                      className="absolute right-0 mt-1.5 w-44 z-50 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1 backdrop-blur-xl"
                    >
                      {sortOptions.map((option) => {
                        const Icon = option.icon;
                        const isSelected = sortBy === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => {
                              setSortBy(option.id);
                              setIsSortOpen(false);
                            }}
                            className={`w-full flex items-center justify-between min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${isSelected ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-rose-500" />
                              <span>{option.label}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-rose-400" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <motion.div
            key={`${activeTab}-${sortBy}`}
            variants={gridContainerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6"
          >
            <AnimatePresence mode={isMobileViewport ? "sync" : "popLayout"}>
              {filteredWorks.map((work) => {
                const workTitle = work.title || work.name || "Untitled Project";
                const mediaType = work.media_type === "tv" ? "tv" : "movie";
                const releaseDate = work.release_date || work.first_air_date;

                const hasYear = releaseDate && releaseDate.trim() !== "";
                const workYear = hasYear ? releaseDate.split("-")[0] : "TBD";
                const rating = work.vote_average ? work.vote_average.toFixed(1) : null;
                const statusKey = workHistoryKey(work);
                const isWatched = watchedHistory.has(statusKey);
                const isInMyList = myListKeys.has(statusKey);
                const isInWatchlist = watchlistKeys.has(statusKey);
                const isFavoriteMedia = favoriteMediaKeys.has(statusKey);
                const userRating = userRatings.get(statusKey);

                return (
                  <motion.div
                    key={work.uniqueKey || work.id}
                    variants={cardVariants}
                    layout={isMobileViewport ? false : "position"}
                    className="filmography-card-static relative"
                  >
                    <Link to={`/${mediaType}/${work.id}`} className="relative block h-full group">
                      <div className="h-full relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-b from-white/25 via-white/10 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-colors duration-300 group-hover:from-white/40 group-hover:via-white/20 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                        <div className="filmography-poster-clean relative w-full h-full rounded-[15px] overflow-hidden bg-zinc-950">
                          {rating && (
                            <div className="absolute top-2 left-2 md:top-3 md:left-3 z-30 pointer-events-none">
                              <div className="flex items-center gap-1 h-5 md:h-6 px-2 rounded-full bg-black/70 backdrop-blur-none md:backdrop-blur-sm border border-white/15 shadow-md">
                                <Star className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-400 fill-amber-400" />
                                <span className="text-[9px] md:text-[10px] font-semibold text-white leading-none tracking-tight">
                                  {rating}
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 md:top-3 md:right-3 z-30 pointer-events-none">
                            <div
                              className={`flex items-center justify-center h-5 md:h-6 px-2 rounded-full backdrop-blur-md border shadow-md transition-colors duration-300 ${hasYear
                                ? "bg-black/50 border-white/15 group-hover:bg-black/60 group-hover:border-white/25"
                                : "bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20 group-hover:border-amber-500/30"
                                }`}
                            >
                              <span
                                className={`text-[9px] md:text-[10px] font-semibold leading-none tracking-tight transition-colors duration-300 ${hasYear
                                  ? "text-zinc-200 group-hover:text-white"
                                  : "text-amber-400 font-bold group-hover:text-amber-300"
                                  }`}
                              >
                                {workYear}
                              </span>
                            </div>
                          </div>

                          <GlassSweep
                            posterUrl={work.poster_path ? `https://image.tmdb.org/t/p/w780${work.poster_path}` : noImageSvg}
                            title={workTitle}
                            subtitle={
                              <span className="block text-zinc-400 text-xs font-normal truncate mt-0.5 capitalize">
                                {work.displayRole}
                              </span>
                            }
                          />
                        </div>
                      </div>
                      <div className="absolute -bottom-2 inset-x-0 z-40 px-2">
                        <MediaStatusIcons
                          favorite={isFavoriteMedia}
                          watched={isWatched}
                          inMyList={isInMyList}
                          inWatchlist={isInWatchlist}
                          userRating={userRating}
                        />
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={(event) => openQuickActions(event, work)}
                      className="absolute left-2 bottom-20 z-50 flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-black/70 text-zinc-200 shadow-lg backdrop-blur-md transition hover:bg-black/90 hover:text-white active:scale-90 md:left-3 md:bottom-24"
                      aria-label={`Quick actions for ${workTitle}`}
                      title="Quick actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {filteredWorks.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-zinc-500"
            >
              <Clapperboard className="w-12 h-12 stroke-[1.5] mb-3 opacity-40" />
              <p className="text-sm font-medium">No results found in this category.</p>
            </motion.div>
          )}

          <div className="flex flex-col items-center mt-12">
            <div className="w-full h-px bg-gradient-to-r from-zinc-800 via-zinc-700/40 to-transparent mb-3" />
            <span className="text-zinc-500 text-xs uppercase tracking-widest font-medium">End of filmography</span>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {isGalleryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-xl"
          >
            <motion.div
              initial={isMobileViewport ? { y: "100%" } : { scale: 0.9, opacity: 0 }}
              animate={isMobileViewport ? { y: 0 } : { scale: 1, opacity: 1 }}
              exit={isMobileViewport ? { y: "100%" } : { scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`relative w-full ${isMobileViewport
                ? "h-[85vh] rounded-t-[32px] border-t border-white/20"
                : "max-w-5xl max-h-[85vh] rounded-3xl border border-white/10"
                } bg-zinc-950/95 overflow-hidden flex flex-col shadow-2xl`}
            >
              {isMobileViewport && (
                <div className="w-full py-3 flex items-center justify-center cursor-grab active:cursor-grabbing">
                  <div className="w-12 h-1.5 rounded-full bg-zinc-700/80" />
                </div>
              )}

              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Images className="w-5 h-5 text-sky-400 shrink-0" />
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">
                    {talentName} - Gallery
                  </h3>
                  <span className="text-xs text-zinc-400 font-medium shrink-0">({images.length})</span>
                </div>
                <button
                  onClick={() => setIsGalleryOpen(false)}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4 auto-rows-max" data-lenis-prevent>
                {images.map((img, idx) => (
                  <div
                    key={img.file_path || idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className="group relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 aspect-[2/3] cursor-pointer active:scale-95 transition-transform"
                  >
                    <img
                      src={`https://image.tmdb.org/t/p/w500${img.file_path}`}
                      alt={`${talentName} ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                      <span className="text-[10px] font-mono text-zinc-300">{img.width}x{img.height}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadImage(img.file_path, idx);
                        }}
                        className="p-2 rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Download Image"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedImageIndex !== null && images[selectedImageIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseLightbox}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-6"
          >
            <motion.div
              drag={isMobileViewport ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={(_: any, info: PanInfo) => {
                if (info.offset.y > 100 || info.offset.y < -100) {
                  handleCloseLightbox();
                }
              }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="relative w-full h-full sm:max-w-5xl sm:max-h-[90vh] flex flex-col items-center justify-center"
            >
              <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-mono text-white">
                {selectedImageIndex + 1} / {images.length}
              </div>

              <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => handleDownloadImage(images[selectedImageIndex].file_path, selectedImageIndex)}
                  className="p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                  title="Download Image"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={handleCloseLightbox}
                  className="p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                  title="Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <motion.div
                key={selectedImageIndex}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_: any, info: PanInfo) => {
                  if (info.offset.x < -50) handleNextImage();
                  if (info.offset.x > 50) handlePrevImage();
                }}
                className="w-full h-full flex items-center justify-center p-2 sm:p-4"
              >
                <img
                  src={`https://image.tmdb.org/t/p/original${images[selectedImageIndex].file_path}`}
                  alt="Enlarged view"
                  className="max-w-full max-h-[75vh] sm:max-h-[85vh] object-contain rounded-2xl shadow-2xl select-none"
                />
              </motion.div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all flex items-center justify-center min-h-[44px] min-w-[44px] active:scale-95 z-20"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all flex items-center justify-center min-h-[44px] min-w-[44px] active:scale-95 z-20"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quickActionWork && (
          <div className="fixed inset-0 z-[10020] flex items-end justify-center sm:items-center sm:p-5">
            <motion.button
              type="button"
              aria-label="Close quick actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeQuickActions}
              className="absolute inset-0 h-full w-full border-0 bg-black/70 p-0 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, y: 36, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="relative z-10 w-full rounded-t-[30px] border border-white/10 bg-zinc-950/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_70px_rgba(0,0,0,0.62)] backdrop-blur-3xl sm:max-w-md sm:rounded-[28px] sm:p-4"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
              <div className="mb-4 flex items-center gap-3">
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                  <img
                    src={quickActionWork.poster_path ? `https://image.tmdb.org/t/p/w185${quickActionWork.poster_path}` : noImageSvg}
                    alt={quickActionWork.title || quickActionWork.name || ''}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Quick actions</p>
                  <p className="mt-1 truncate text-sm font-black tracking-tight text-white">{quickActionWork.title || quickActionWork.name || 'Untitled'}</p>
                  <p className="mt-1 text-[10px] font-medium text-zinc-500">{quickActionMediaType === 'tv' ? 'Series' : 'Movie'} · {quickActionYear}</p>
                </div>
                <button
                  type="button"
                  onClick={closeQuickActions}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:bg-white/[0.08] hover:text-white active:scale-90"
                  aria-label="Close quick actions"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toggleWorkWatchlist(quickActionWork)}
                  className={`group/action flex min-h-[50px] items-center gap-2.5 rounded-2xl border px-3 py-3 text-left text-[11px] font-bold transition-all duration-200 active:scale-[0.98] ${quickActionWatchlisted ? 'border-blue-400/30 bg-blue-500/[0.11] text-blue-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]' : 'border-blue-500/15 bg-blue-500/[0.035] text-zinc-200 hover:border-blue-400/25 hover:bg-blue-500/[0.08]'}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 ring-1 ring-white/10 transition-transform duration-200 group-hover/action:scale-105"><Bookmark className="h-4 w-4 fill-current stroke-[2.4]" /></span>
                  <span>{quickActionWatchlisted ? 'Remove Watchlist' : 'Add Watchlist'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleWorkHistory(quickActionWork)}
                  className={`group/action flex min-h-[50px] items-center gap-2.5 rounded-2xl border px-3 py-3 text-left text-[11px] font-bold transition-all duration-200 active:scale-[0.98] ${quickActionWatched ? 'border-emerald-400/30 bg-emerald-500/[0.11] text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]' : 'border-emerald-500/15 bg-emerald-500/[0.035] text-zinc-200 hover:border-emerald-400/25 hover:bg-emerald-500/[0.08]'}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-500/30 ring-1 ring-white/10 transition-transform duration-200 group-hover/action:scale-105"><History className="h-4 w-4 stroke-[2.5]" /></span>
                  <span>{quickActionWatched ? 'Remove History' : 'Mark Watched'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickMyList}
                  className={`group/action flex min-h-[50px] items-center gap-2.5 rounded-2xl border px-3 py-3 text-left text-[11px] font-bold transition-all duration-200 active:scale-[0.98] ${showQuickMyListFolders || quickActionInMyList ? 'border-violet-400/30 bg-violet-500/[0.11] text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]' : 'border-violet-500/15 bg-violet-500/[0.035] text-zinc-200 hover:border-violet-400/25 hover:bg-violet-500/[0.08]'}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white shadow-md shadow-purple-500/30 ring-1 ring-white/10 transition-transform duration-200 group-hover/action:scale-105"><ListChecks className="h-4 w-4 stroke-[2.6]" /></span>
                  <span className="min-w-0">
                    <span className="block">Manage Lists</span>
                    {quickActionListCount > 0 && <span className="mt-0.5 block text-[9px] font-semibold text-violet-300/70">{quickActionListCount} selected</span>}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleWorkFavorite(quickActionWork)}
                  className={`group/action flex min-h-[50px] items-center gap-2.5 rounded-2xl border px-3 py-3 text-left text-[11px] font-bold transition-all duration-200 active:scale-[0.98] ${quickActionFavorite ? 'border-red-400/30 bg-red-500/[0.11] text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]' : 'border-red-500/15 bg-red-500/[0.035] text-zinc-200 hover:border-red-400/25 hover:bg-red-500/[0.08]'}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-500/30 ring-1 ring-white/10 transition-transform duration-200 group-hover/action:scale-105"><Heart className="h-4 w-4 fill-current stroke-[2.4]" /></span>
                  <span>{quickActionFavorite ? 'Unfavorite' : 'Favorite'}</span>
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showQuickMyListFolders && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 border-t border-white/[0.06] pt-3">
                      <div className="mb-2 flex items-center justify-between gap-3 px-1">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Manage Lists</p>
                          <p className="mt-0.5 text-[9px] font-medium text-zinc-600">Tap a list to add or remove this title.</p>
                        </div>
                        {quickActionListCount > 0 && (
                          <span className="shrink-0 rounded-full border border-violet-400/15 bg-violet-500/10 px-2 py-1 text-[9px] font-bold text-violet-300">
                            {quickActionListCount}/{myListFolders.length}
                          </span>
                        )}
                      </div>

                      {myListFolders.length > 0 ? (
                        <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1 no-scrollbar">
                          {myListFolders.map((folder) => {
                            const isInFolder = Boolean(quickActionKey && myListFolderKeys.get(folder.id)?.has(quickActionKey));
                            return (
                              <button
                                key={folder.id}
                                type="button"
                                onClick={() => toggleWorkMyListFolder(quickActionWork, folder.id)}
                                className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${isInFolder ? 'border-violet-400/20 bg-violet-500/10 text-white' : 'border-white/[0.06] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white'}`}
                              >
                                <div className="min-w-0">
                                  <span className="block truncate text-[11px] font-bold">{folder.name}</span>
                                  <span className={`mt-0.5 block text-[9px] font-medium ${isInFolder ? 'text-violet-300/80' : 'text-zinc-600'}`}>
                                    {isInFolder ? 'In this list' : 'Not in this list'}
                                  </span>
                                </div>
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${isInFolder ? 'border-violet-300/30 bg-violet-400 text-zinc-950 shadow-[0_4px_14px_rgba(167,139,250,0.24)]' : 'border-white/10 bg-white/[0.04] text-violet-300'}`}>
                                  {isInFolder ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5 stroke-[2.5]" />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-3 py-4 text-center">
                          <p className="text-[10px] font-semibold text-zinc-400">No My List folders yet</p>
                          <p className="mt-1 text-[9px] text-zinc-600">Create a list first, then manage membership here.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
};

export default Talentsdetails;
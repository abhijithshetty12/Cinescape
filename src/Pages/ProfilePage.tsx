import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext.tsx';
import { getAuth, signOut } from 'firebase/auth';
import { db } from '../firebase.ts';
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import ReviewList from '../components/ReviewList.tsx';
import {
  User, ChevronRight, LogOut, Star, Heart, Settings, Film,
  Bookmark, History, SquarePen, Tv, Camera, Loader2, Check,
  ImageOff, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import BingeWatchStats from '../components/BingeWatchStats.tsx';
import Toast from '../components/Toast.tsx';

const BASE_POSTER_URL = 'https://image.tmdb.org/t/p/original/';
const TMDB_API_KEY = '859afbb4b98e3b467da9c99ac390e950';
const MAX_PHOTO_PX = 256;
const PHOTO_QUALITY = 0.72;

const GENRE_MAP: Record<string, number> = {
  Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
  Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36,
  Horror: 27, Music: 10402, Mystery: 9648, Romance: 10749, 'Sci-Fi': 878,
  'TV Movie': 10770, Thriller: 53, War: 10752, Western: 37,
};
const ALL_GENRES = Object.keys(GENRE_MAP);

const compressImageToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (evt) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = MAX_PHOTO_PX;
        canvas.height = MAX_PHOTO_PX;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas unavailable')); return; }
        const scale = Math.max(MAX_PHOTO_PX / img.width, MAX_PHOTO_PX / img.height);
        const scaledW = img.width * scale;
        const scaledH = img.height * scale;
        const offsetX = (MAX_PHOTO_PX - scaledW) / 2;
        const offsetY = (MAX_PHOTO_PX - scaledH) / 2;
        ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
        resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

type RecommendedItem = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: string;
  overview: string;
  voteAverage: number;
};

type WatchlistItem = { id: string; title: string; posterPath: string; mediaType: string };
type HistoryItem = {
  id: string; title: string; posterPath: string;
  mediaType: string; genres: string[]; watchedDate: string;
};
type FavouriteActor = { id: string; name: string; profilePath: string };
type RatedMovie = { id: string; title: string; posterPath: string; rating: number };

export const RecommendationSection = ({
  watchlist,
  history,
  favouriteActors,
  selectedGenres,
  ratedMovies,
  onMediaClick,
}: {
  watchlist: WatchlistItem[];
  history: HistoryItem[];
  favouriteActors: FavouriteActor[];
  selectedGenres: string[];
  ratedMovies: RatedMovie[];
  onMediaClick: (id: string, mediaType: string) => void;
}) => {
  const [items, setItems] = useState<RecommendedItem[]>([]);
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [loading, setLoading] = useState(false);

  const seqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchRecommendations = useCallback(
    async (type: "movie" | "tv") => {
      const seq = ++seqRef.current;
      setLoading(true);

      const filterType = <T extends { mediaType: string; id: string }>(arr: T[]) =>
        arr.filter((x) => x.mediaType === type).map((x) => x.id);

      const watchedOrWatchlistIds = new Set([
        ...filterType(history),
        ...filterType(watchlist),
      ]);

      const highlyRated = ratedMovies.filter((m) => m.rating >= 7).map((m) => m.id);
      const watchlistIds = filterType(watchlist);
      const historyIds = filterType(history);
      const genreIdsSet = new Set<number>(
        selectedGenres.map((g) => GENRE_MAP[g.trim()]).filter(Boolean)
      );

      let recommended: any[] = [];

      const fetchBatch = async (ids: string[], endpointFn: (id: string) => string, limit: number) => {
        const results = await Promise.all(
          ids.slice(0, 5).map(async (id) => {
            try {
              const res = await axios.get(endpointFn(id));
              return res.data.results ?? [];
            } catch { return []; }
          })
        );
        results.forEach((r) => recommended.push(...r.slice(0, limit)));
      };

      try {
        if (highlyRated.length > 0) {
          await Promise.all(
            highlyRated.slice(0, 3).map(async (movieId) => {
              try {
                const res = await axios.get(`https://api.themoviedb.org/3/${type}/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`);
                (res.data.genres ?? []).forEach((g: any) => genreIdsSet.add(g.id));
              } catch {}
            })
          );
          await fetchBatch(highlyRated, (id) => `https://api.themoviedb.org/3/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`, 12);
        }

        if (watchlistIds.length > 0 && recommended.length < 20) {
          await fetchBatch(watchlistIds, (id) => `https://api.themoviedb.org/3/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`, 10);
        }

        if (historyIds.length > 0 && recommended.length < 20) {
          await fetchBatch(historyIds, (id) => `https://api.themoviedb.org/3/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`, 8);
        }

        if (favouriteActors.length > 0 && recommended.length < 20) {
          const results = await Promise.all(
            favouriteActors.slice(0, 10).map(async (actor) => {
              try {
                const res = await axios.get(`https://api.themoviedb.org/3/person/${actor.id}/${type}_credits?api_key=${TMDB_API_KEY}&language=en-US`);
                return res.data.cast ?? [];
              } catch { return []; }
            })
          );
          results.forEach((r) => recommended.push(...r.slice(0, 10)));
        }

        const genreIds = Array.from(genreIdsSet);
        if (genreIds.length > 0 && recommended.length < 20) {
          await fetchBatch(genreIds.map(String), (id) => `https://api.themoviedb.org/3/discover/${type}?api_key=${TMDB_API_KEY}&language=en-US&with_genres=${id}&sort_by=popularity.desc&page=1`, 8);
        }

        const fetchFallback = async (endpoint: string, limit: number) => {
          try {
            const res = await axios.get(endpoint);
            recommended.push(...(res.data.results ?? []).slice(0, limit));
          } catch {}
        };

        await fetchFallback(`https://api.themoviedb.org/3/trending/${type}/week?api_key=${TMDB_API_KEY}`, 15);
        await fetchFallback(`https://api.themoviedb.org/3/${type}/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`, 15);

        if (recommended.length === 0) {
          await fetchFallback(`https://api.themoviedb.org/3/${type}/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`, 20);
        }
      } catch {}

      if (!mountedRef.current || seq !== seqRef.current) return;

      const unique = new Map<string, RecommendedItem>();
      recommended.forEach((m: any) => {
        const mid = m.id?.toString();
        const mType = m.media_type || type;
        if (mid && !unique.has(mid) && !watchedOrWatchlistIds.has(mid) && mType === type) {
          unique.set(mid, {
            id: mid,
            title: m.title ?? m.name ?? "",
            posterPath: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
            mediaType: mType,
            overview: m.overview ?? "",
            voteAverage: m.vote_average ?? 0,
          });
        }
      });

      const sorted = Array.from(unique.values()).sort((a, b) => b.voteAverage - a.voteAverage);
      setItems(sorted.slice(0, 50));
      setLoading(false);
    },
    [watchlist, history, favouriteActors, selectedGenres, ratedMovies]
  );

  useEffect(() => {
    setItems([]);
    fetchRecommendations(mediaType);
  }, [mediaType, fetchRecommendations]);

  useEffect(() => {
    const refresh = () => { setItems([]); fetchRecommendations(mediaType); };
    const onVisible = () => { if (!document.hidden) refresh(); };
    
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [mediaType, fetchRecommendations]);

  const switchType = (t: "movie" | "tv") => {
    if (t === mediaType) return;
    setItems([]);
    setMediaType(t);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-3xl bg-neutral-900/40 border border-white/[0.08] backdrop-blur-2xl p-4 xs:p-5 sm:p-7 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      <div className="absolute top-0 left-1/4 -translate-y-1/2 w-72 sm:w-96 h-32 bg-red-600/10 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-72 sm:w-96 h-32 bg-amber-500/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-500/25 blur-md rounded-full animate-pulse" />
            <img
              src="/recommendation-icon.png"
              alt="Recommendations"
              className="relative z-10 w-9 h-9 sm:w-11 sm:h-11 object-contain filter brightness-110 drop-shadow-[0_4px_20px_rgba(124,58,237,0.7)]"
            />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Recommendations
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium">
              Curated based on your preferences
            </p>
          </div>
        </div>

        <div className="relative self-stretch sm:self-auto flex items-center bg-black/40 border border-white/10 backdrop-blur-2xl rounded-2xl p-1 shadow-inner">
          <button
            onClick={() => switchType("movie")}
            className={`relative z-10 flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-colors duration-300 ${
              mediaType === "movie" ? "text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Movies</span>
          </button>

          <button
            onClick={() => switchType("tv")}
            className={`relative z-10 flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-colors duration-300 ${
              mediaType === "tv" ? "text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Series</span>
          </button>

          <motion.div
            className="absolute inset-y-1 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-xl shadow-lg shadow-red-600/30"
            layoutId="recommendation-toggle"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              left: mediaType === "movie" ? "4px" : "calc(50% + 2px)",
              width: "calc(50% - 6px)",
            }}
          />
        </div>
      </div>

      <div className="relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-white/10" />
              <div className="absolute inset-0 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-zinc-400 text-xs font-medium tracking-wide uppercase">
              Curating {mediaType === "movie" ? "movies" : "series"}…
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
              <Film className="w-6 h-6 text-zinc-500" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              No Recommendations Yet
            </h3>
            <p className="text-zinc-400 text-xs max-w-xs mx-auto">
              Watch more to get personalised picks
            </p>
          </div>
        ) : (
          <div>
            <div
              className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-3 pt-1 px-1 -mx-1 scrollbar-none"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onMediaClick(item.id, item.mediaType)}
                  className="group relative flex-shrink-0 w-28 sm:w-32 bg-neutral-900/60 border border-white/[0.08] hover:border-white/20 rounded-xl overflow-hidden shadow-lg cursor-pointer transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950">
                    {item.posterPath ? (
                      <img
                        src={item.posterPath}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                        <Film className="w-6 h-6 text-zinc-700" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent opacity-60 group-hover:opacity-30 transition-opacity duration-300" />

                    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-[-20deg] transition-transform duration-1000 ease-in-out" />
                    </div>

                    {/* Fixed Badge Header Overlay */}
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 z-10 pointer-events-none">
                      {item.voteAverage > 0 ? (
                        <div className="h-5 shrink-0 flex items-center gap-0.5 bg-black/70 border border-white/10 backdrop-blur-md px-1.5 rounded-md shadow-md">
                          <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                          <span className="text-[9px] font-bold text-amber-300 leading-none">
                            {item.voteAverage.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <div />
                      )}

                      <div className="h-5 shrink-0 flex items-center justify-center bg-black/70 border border-white/10 backdrop-blur-md px-1.5 rounded-md shadow-md">
                        <span
                          className={`text-[8px] font-black uppercase tracking-wider leading-none ${
                            item.mediaType === "tv" ? "text-cyan-400" : "text-amber-400"
                          }`}
                        >
                          {item.mediaType === "tv" ? "TV" : "FILM"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-neutral-900/90 border-t border-white/[0.04] transition-colors duration-300 group-hover:bg-neutral-900">
                    <h3 className="text-xs font-semibold text-white/90 group-hover:text-white transition-colors duration-300 truncate leading-snug">
                      {item.title}
                    </h3>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-2 px-1 pt-2 border-t border-white/[0.04] text-[11px] text-zinc-500 font-medium">
              <span>Swipe for more</span>
              <span>
                {items.length} {mediaType === "movie" ? "movies" : "series"}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const MediaRow = ({
  items,
  emptyLabel,
  accentClass,
  to,
}: {
  items: { id: string; title: string; posterPath: string; mediaType: string }[];
  emptyLabel: string;
  accentClass: string;
  to: (item: { id: string; mediaType: string }) => string;
}) => (
  items.length === 0 ? (
    <p className="text-zinc-500 text-center py-4 text-sm">{emptyLabel}</p>
  ) : (
    <div className="overflow-x-auto -mx-1 px-1 pb-2 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="flex gap-2.5 sm:gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={to(item)}
            className={`group relative flex-shrink-0 w-[95px] sm:w-[110px] rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors duration-200 ${accentClass}`}
          >
            <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
              {item.posterPath ? (
                <img
                  src={item.posterPath}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                  <ImageOff className="w-5 h-5 text-zinc-600" />
                </div>
              )}

              <div className="absolute inset-0 -translate-x-full -translate-y-full bg-gradient-to-br from-transparent via-white/25 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full group-hover:translate-y-full pointer-events-none -rotate-45 scale-150 z-10" />
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950/80 to-transparent" />
            </div>

            <div className="p-1.5 sm:p-2">
              <p className="text-[11px] sm:text-xs font-medium truncate text-zinc-200 group-hover:text-white transition-colors">
                {item.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
);

const TogglePill = ({
  value,
  onChange,
  options,
  layoutId,
  activeColor,
}: {
  value: string;
  onChange: (v: any) => void;
  options: { value: string; label: string }[];
  layoutId: string;
  activeColor: string;
}) => (
  <div className="flex justify-center mb-4">
    <div className="relative flex items-center bg-zinc-800/60 border border-white/10 rounded-full p-0.5 shadow-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`relative z-10 px-4 py-1.5 font-semibold text-xs rounded-full transition-all duration-300 ${value === opt.value ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
        >
          {opt.label}
        </button>
      ))}
      <motion.div
        className={`absolute inset-y-1 ${activeColor} rounded-full shadow-lg`}
        layoutId={layoutId}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          left: value === options[0].value ? 2 : '50%',
          right: value === options[1].value ? 2 : '50%',
        }}
      />
    </div>
  </div>
);

const ProfilePage = () => {
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user;
  const navigate = useNavigate();

  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    user?.preferences?.split(',').filter(Boolean) ?? [],
  );
  const [ratedMovies, setRatedMovies] = useState<RatedMovie[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favouriteActors, setFavouriteActors] = useState<FavouriteActor[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'movie' | 'tv'>('movie');
  const [watchlistFilter, setWatchlistFilter] = useState<'movie' | 'tv'>('movie');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({
    message: '', type: 'success', isVisible: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, isVisible: true });
  };

  useEffect(() => {
    if (!user?.uid) return;

    const fetchProfile = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUsername(data.username ?? '');
        setBio(data.bio ?? '');
        setSelectedGenres(data.preferences?.split(',').filter(Boolean) ?? []);
        if (data.photoDataUrl) setPhotoDataUrl(data.photoDataUrl);
      }
    };
    fetchProfile();

    const unsubs = [
      onSnapshot(collection(db, `users/${user.uid}/watchlist`), (snap) => {
        setWatchlist(snap.docs.map((d) => ({
          id: d.data().movieId?.toString(),
          title: d.data().title,
          posterPath: `${BASE_POSTER_URL}${d.data().posterPath}`,
          mediaType: d.data().mediaType || 'movie',
        })));
      }),

      onSnapshot(collection(db, `users/${user.uid}/ratings`), (snap) => {
        const seen = new Map<string, RatedMovie>();
        snap.docs.forEach((d) => {
          const data = d.data();
          if (!seen.has(data.title)) {
            seen.set(data.title, {
              id: d.id,
              title: data.title,
              posterPath: `${BASE_POSTER_URL}${data.posterPath}`,
              rating: data.rating,
            });
          }
        });
        setRatedMovies(Array.from(seen.values()));
      }),

      onSnapshot(
        query(collection(db, `users/${user.uid}/history`), orderBy('watchedDate', 'desc')),
        (snap) => {
          setHistory(snap.docs.map((d) => {
            const data = d.data();
            return {
              id: data.movieId?.toString(),
              title: data.title ?? data.name ?? '',
              posterPath: `${BASE_POSTER_URL}${data.posterPath}`,
              mediaType: data.mediaType || 'movie',
              genres: data.genres ?? [],
              watchedDate: data.watchedDate ?? new Date().toISOString(),
            };
          }));
        },
      ),

      onSnapshot(collection(db, `users/${user.uid}/favouriteActors`), (snap) => {
        const seen = new Map<string, FavouriteActor>();
        snap.docs.forEach((d) => {
          const data = d.data();
          const id = data.actorId ?? data.id;
          if (id && data.name && !seen.has(id)) {
            seen.set(id, {
              id,
              name: data.name,
              profilePath: data.profile_path
                ? `${BASE_POSTER_URL}${data.profile_path}`
                : data.profilePath
                  ? `${BASE_POSTER_URL}${data.profilePath}`
                  : '',
            });
          }
        });
        setFavouriteActors(Array.from(seen.values()));
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const dataUrl = await compressImageToBase64(file);
      const sizeBytes = Math.round((dataUrl.length * 3) / 4);
      if (sizeBytes > 900_000) {
        showToast('Image too large even after compression. Try a smaller photo.', 'error');
        setIsUploadingPhoto(false);
        return;
      }
      setPhotoPreview(dataUrl);
      await setDoc(doc(db, 'users', user.uid), { photoDataUrl: dataUrl }, { merge: true });
      setPhotoDataUrl(dataUrl);
      setPhotoPreview(null);
      showToast('Profile photo updated!', 'success');
    } catch {
      showToast('Failed to update photo. Please try again.', 'error');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.uid) return;
    setIsUploadingPhoto(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { photoDataUrl: null }, { merge: true });
      setPhotoDataUrl(null);
      setPhotoPreview(null);
      showToast('Photo removed', 'info');
    } catch {
      showToast('Failed to remove photo', 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid) { showToast('You must be logged in', 'error'); return; }
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { username, bio, preferences: selectedGenres.join(',') },
        { merge: true },
      );
      showToast('Profile updated!', 'success');
      setIsEditingUsername(false);
      setIsEditingBio(false);
    } catch {
      showToast('Error updating profile, please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => navigate('/login'))
      .catch(() => { });
  };

  const handleMediaClick = (id: string, mediaType: string) => navigate(`/${mediaType}/${id}`);

  const filteredHistory = useMemo(
    () => history.filter((h) => h.mediaType === historyFilter),
    [history, historyFilter],
  );
  const filteredWatchlist = useMemo(
    () => watchlist.filter((w) => w.mediaType === watchlistFilter),
    [watchlist, watchlistFilter],
  );

  const displayPhoto = photoPreview ?? photoDataUrl;

  return (
    <div className="bg-black text-white min-h-screen">
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((t) => ({ ...t, isVisible: false }))}
      />

      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 pb-6 mb-8 px-4 border-b border-white/[0.06]"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 flex items-center justify-center shrink-0 group hover:scale-[1.05] transition-transform duration-300">
              <img
                src="cd.jpg"
                alt="Settings"
                className="w-full h-full object-contain rounded-[22px]"
              />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Profile
              </h1>
              <p className="text-zinc-400 text-xs sm:text-sm font-medium tracking-wide">
                Manage your account and preferences
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all duration-300 active:scale-[0.98] bg-gradient-to-r from-red-500 via-red-600 to-orange-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4),0_0_40px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6),0_0_50px_rgba(239,68,68,0.3)] hover:brightness-110 flex items-center justify-center gap-2.5 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:-translate-x-full hover:before:animate-[shimmer_1.5s_infinite]"
          >
            <LogOut className="w-4 h-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
            <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">Logout</span>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="bg-zinc-950/40 backdrop-blur-xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.06] shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.05]">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <User className="w-5 h-5 text-white/70" />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                  Profile Information
                </h2>
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                <div className="flex flex-col items-center gap-3 flex-shrink-0">
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-red-500/30 to-orange-500/20 blur-lg opacity-60 group-hover:opacity-90 transition-opacity duration-300" />

                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-white/20 overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-2xl">
                      <AnimatePresence mode="wait">
                        {displayPhoto ? (
                          <motion.img
                            key="photo"
                            src={displayPhoto}
                            alt={username}
                            className="w-full h-full object-cover"
                            initial={{ opacity: 0, scale: 1.08 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                          />
                        ) : (
                          <motion.img
                            key="default"
                            src="/user-icon.jpg"
                            alt="Default Profile"
                            className="w-full h-full object-cover"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          />
                        )}
                      </AnimatePresence>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 hover:bg-black/55 transition-all duration-300 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer"
                        aria-label="Change profile picture"
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-6 h-6 text-white mb-0.5" />
                            <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">
                              Change
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-full flex items-center justify-center shadow-lg border-2 border-black transition-all duration-200 hover:scale-110 active:scale-95 z-10"
                      aria-label="Upload photo"
                    >
                      {isUploadingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5 text-white" />
                      )}
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />

                  <div className="text-center">
                    <p className="font-semibold text-sm text-white/90 truncate max-w-[140px]">
                      {username || 'Anonymous'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">Cinescape Member</p>
                  </div>

                  {displayPhoto && (
                    <button
                      onClick={handleRemovePhoto}
                      disabled={isUploadingPhoto}
                      className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 text-xs font-medium transition-colors duration-200"
                    >
                      <X className="w-3 h-3" />
                      Remove photo
                    </button>
                  )}
                </div>

                <div className="flex-1 w-full space-y-6">
                  <div className="group/edit relative">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Username
                      </label>
                      {!isEditingUsername && (
                        <button
                          onClick={() => setIsEditingUsername(true)}
                          className="opacity-0 group-hover/edit:opacity-100 transition-all duration-200 p-1.5 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10"
                          title="Edit Username"
                        >
                          <SquarePen className="w-3.5 h-3.5 text-zinc-400 hover:text-white" />
                        </button>
                      )}
                    </div>

                    {isEditingUsername ? (
                      <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
                        <input
                          type="text"
                          autoFocus
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                          placeholder="Enter your username"
                          className="w-full bg-zinc-900/50 border border-zinc-700 text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 placeholder:text-zinc-600 transition-all duration-300 text-sm"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => setIsEditingUsername(true)}
                        className="cursor-pointer py-1 group-hover/edit:text-zinc-200 transition-colors duration-300"
                      >
                        <p className="text-sm text-white font-medium tracking-tight">
                          {username || 'Anonymous'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="group/edit relative">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Bio
                      </label>
                      {!isEditingBio && (
                        <button
                          onClick={() => setIsEditingBio(true)}
                          className="opacity-0 group-hover/edit:opacity-100 transition-all duration-200 p-1.5 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10"
                          title="Edit Bio"
                        >
                          <SquarePen className="w-3.5 h-3.5 text-zinc-400 hover:text-white" />
                        </button>
                      )}
                    </div>

                    {isEditingBio ? (
                      <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
                        <textarea
                          autoFocus
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Tell us about yourself..."
                          rows={4}
                          className="w-full bg-zinc-900/50 border border-zinc-700 text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 placeholder:text-zinc-600 transition-all duration-300 text-sm resize-none"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => setIsEditingBio(true)}
                        className="cursor-pointer py-1 group-hover/edit:text-zinc-200 transition-colors duration-300"
                      >
                        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {bio || 'No bio provided. Write something about yourself!'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 active:scale-[0.98] bg-white text-black hover:bg-zinc-100 shadow-xl shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Changes…</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Update Profile</span>
                        </>
                      )}
                    </button>

                    {(isEditingUsername || isEditingBio) && (
                      <button
                        onClick={() => {
                          setIsEditingUsername(false);
                          setIsEditingBio(false);
                        }}
                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 active:scale-[0.98] bg-zinc-900 text-zinc-400 hover:text-white border border-white/5 hover:bg-zinc-800 shadow-xl"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            <BingeWatchStats history={history} />

            <RecommendationSection
              watchlist={watchlist}
              history={history}
              favouriteActors={favouriteActors}
              selectedGenres={selectedGenres}
              ratedMovies={ratedMovies}
              onMediaClick={handleMediaClick}
            />

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-zinc-950/50 backdrop-blur-xl rounded-2xl p-5 sm:p-6 md:p-8 border border-white/[0.05] shadow-2xl"
            >
              <h2 className="text-lg sm:text-xl font-extrabold flex items-center gap-2.5 text-white mb-4">
                <SquarePen className="w-5 h-5 sm:w-6 sm:h-6 text-violet-500" />
                Your Reviews
              </h2>
              <ReviewList userId={user?.uid ?? ''} />
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-zinc-950/60 p-3 sm:p-4 backdrop-blur-xl shadow-xl"
            >
              <div className="relative z-10 flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md shadow-cyan-500/30">
                    <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                  </div>
                  <h2 className="text-sm sm:text-base font-semibold tracking-tight text-white/90">
                    Watchlist
                  </h2>
                </div>

                <Link
                  to="/watchlist"
                  className="p-1 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors duration-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="relative z-10 space-y-2.5 sm:space-y-3">
                <TogglePill
                  value={watchlistFilter}
                  onChange={setWatchlistFilter}
                  options={[
                    { value: 'movie', label: 'Movies' },
                    { value: 'tv', label: 'Series' }
                  ]}
                  layoutId="watchlist-pill"
                  activeColor="bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20"
                />

                <MediaRow
                  items={filteredWatchlist.slice().reverse()}
                  emptyLabel={`No ${watchlistFilter === 'movie' ? 'movies' : 'series'} in watchlist`}
                  accentClass="group/card relative overflow-hidden border-cyan-500/20 shadow-cyan-500/10 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-700 before:ease-in-out hover:before:translate-x-full"
                  to={(item) => `/${item.mediaType}/${item.id}`}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-zinc-950/60 p-3 sm:p-4 backdrop-blur-xl shadow-xl"
            >
              <div className="relative z-10 flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30">
                    <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  <h2 className="text-sm sm:text-base font-semibold tracking-tight text-white/90">
                    History
                  </h2>
                </div>

                <Link
                  to="/history"
                  className="p-1 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors duration-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="relative z-10 space-y-2.5 sm:space-y-3">
                <TogglePill
                  value={historyFilter}
                  onChange={setHistoryFilter}
                  options={[
                    { value: 'movie', label: 'Movies' },
                    { value: 'tv', label: 'Series' }
                  ]}
                  layoutId="history-pill"
                  activeColor="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-500/20"
                />

                <MediaRow
                  items={filteredHistory.slice(0, 10)}
                  emptyLabel="No history yet"
                  accentClass="group/card relative overflow-hidden border-emerald-500/20 shadow-emerald-500/10 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-700 before:ease-in-out hover:before:translate-x-full"
                  to={(item) => `/${item.mediaType || 'movie'}/${item.id}`}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-zinc-950/60 p-3 sm:p-4 backdrop-blur-xl shadow-xl"
            >
              <div className="relative z-10 flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30">
                    <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                  </div>
                  <h2 className="text-sm sm:text-base font-semibold tracking-tight text-white/90">
                    Rated Movies
                  </h2>
                </div>

                <Link
                  to="/top-rated"
                  className="p-1 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors duration-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {ratedMovies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 gap-1.5 border border-dashed border-white/5 rounded-lg sm:rounded-xl bg-white/[0.01]">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30">
                    <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                  </div>
                  <p className="text-xs font-medium text-zinc-300">No rated movies yet</p>
                  <p className="text-[10px] text-zinc-500 text-center px-4">Rate media across the app to see them here</p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[300px] sm:max-h-[340px] space-y-1.5 pr-1 custom-scrollbar">
                  {ratedMovies.map((movie, idx) => {
                    const raw = movie.posterPath ?? '';
                    const posterUrl = raw.startsWith('http')
                      ? raw
                      : raw.startsWith('//')
                        ? `https:${raw}`
                        : raw
                          ? `https://image.tmdb.org/t/p/w185${raw.startsWith('/') ? '' : '/'}${raw}`
                          : '';

                    return (
                      <div
                        key={movie.id}
                        onClick={() => handleMediaClick(movie.id, 'movie')}
                        className="group relative flex items-center gap-2.5 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-amber-500/20 transition-all duration-200 cursor-pointer overflow-hidden"
                      >
                        <div className="w-5 h-5 shrink-0 rounded-md bg-zinc-900/80 border border-white/5 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-zinc-500 group-hover:text-amber-400 transition-colors">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="relative group/poster w-7 sm:w-8 h-10 sm:h-11 shrink-0 rounded-md overflow-hidden border border-white/10 bg-zinc-900">
                          {posterUrl ? (
                            <img
                              src={posterUrl}
                              alt={movie.title}
                              loading="lazy"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                              <Film className="w-3 h-3 text-zinc-700" />
                            </div>
                          )}
                          <div className="absolute inset-0 -translate-x-full -translate-y-full bg-gradient-to-br from-transparent via-white/25 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full group-hover:translate-y-full pointer-events-none -rotate-45 scale-150" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-zinc-200 group-hover:text-amber-300 transition-colors truncate">
                            {movie.title}
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-zinc-500 mt-0.5">Movie</p>
                        </div>

                        <div className="shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] sm:text-[11px] font-bold group-hover:bg-amber-500 group-hover:text-black group-hover:border-transparent transition-all duration-200">
                          <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                          {movie.rating}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-zinc-950/60 p-3 sm:p-4 backdrop-blur-xl shadow-xl"
            >
              <div className="relative z-10 flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-500/30">
                    <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                  </div>
                  <h2 className="text-sm sm:text-base font-semibold tracking-tight text-white/90">
                    Favourite Talents
                  </h2>
                </div>

                <Link
                  to="/fav-talents"
                  className="p-1 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors duration-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {favouriteActors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 gap-1.5 border border-dashed border-white/5 rounded-lg sm:rounded-xl bg-white/[0.01]">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <p className="text-xs font-medium text-zinc-300">No favourite talents yet</p>
                  <p className="text-[10px] text-zinc-500 text-center px-4">Save actor profiles to see them featured here</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-1 px-1 pb-1 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="flex gap-2.5 sm:gap-3">
                    {favouriteActors.map((actor, idx) => (
                      <Link
                        key={actor.id}
                        to={`/actor/${actor.id}`}
                        className="group relative flex-shrink-0 w-[85px] sm:w-[95px] rounded-lg sm:rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-red-500/30 transition-all duration-200 cursor-pointer"
                      >
                        <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900 group/poster">
                          <div className="absolute top-1 left-1 z-10 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md border border-white/10 rounded px-1 py-0.5 min-w-[18px]">
                            <span className="text-[9px] sm:text-[10px] font-bold leading-none text-zinc-400 group-hover:text-red-400 transition-colors">
                              #{idx + 1}
                            </span>
                          </div>
                          <div className="absolute top-1 right-1 z-10 bg-red-500 p-1 rounded-full shadow-md shadow-red-500/30">
                            <Heart className="w-2 h-2 text-white fill-current" />
                          </div>

                          {actor.profilePath ? (
                            <img
                              src={actor.profilePath}
                              alt={actor.name}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover/poster:scale-105"
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                              <User className="w-5 h-5 text-zinc-600" />
                            </div>
                          )}

                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                            <div className="w-0 h-0 rounded-full bg-gradient-to-tr from-white/20 via-white/5 to-transparent border border-white/30 shadow-[inset_0_0_20px_rgba(255,255,255,0.25)] opacity-0 group-hover/poster:w-[160%] group-hover/poster:h-[160%] group-hover/poster:opacity-100 transition-all duration-700 ease-out" />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-zinc-950/80 to-transparent" />
                        </div>

                        <div className="p-1.5">
                          <p className="text-[11px] sm:text-xs font-medium text-zinc-200 group-hover:text-red-400 transition-colors truncate">
                            {actor.name}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
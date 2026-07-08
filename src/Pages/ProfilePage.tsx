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

const RecommendationSection = ({
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
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [loading, setLoading] = useState(false);

  const seqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchRecommendations = useCallback(async (type: 'movie' | 'tv') => {
    const seq = ++seqRef.current;
    setLoading(true);

    const watchedOrWatchlistIds = new Set<string>();
    history.forEach((h) => { if (h.mediaType === type) watchedOrWatchlistIds.add(h.id); });
    watchlist.forEach((w) => { if (w.mediaType === type) watchedOrWatchlistIds.add(w.id); });

    const highlyRated = ratedMovies.filter((m) => m.rating >= 7).map((m) => m.id);
    const watchlistIds = watchlist.filter((m) => m.mediaType === type).map((m) => m.id);
    const historyIds = history.filter((h) => h.mediaType === type).map((h) => h.id);

    const genreIdsSet = new Set<number>(
      selectedGenres.map((g) => GENRE_MAP[g.trim()]).filter(Boolean),
    );

    let recommended: any[] = [];

    try {
      if (highlyRated.length > 0) {
        await Promise.all(
          highlyRated.slice(0, 3).map(async (movieId) => {
            try {
              const res = await axios.get(
                `https://api.themoviedb.org/3/${type}/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`,
              );
              (res.data.genres ?? []).forEach((g: any) => genreIdsSet.add(g.id));
            } catch {}
          }),
        );

        const results = await Promise.all(
          highlyRated.slice(0, 5).map(async (movieId) => {
            try {
              const res = await axios.get(
                `https://api.themoviedb.org/3/${type}/${movieId}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`,
              );
              return res.data.results ?? [];
            } catch { return []; }
          }),
        );
        results.forEach((r) => recommended.push(...r.slice(0, 12)));
      }

      if (watchlistIds.length > 0 && recommended.length < 20) {
        const results = await Promise.all(
          watchlistIds.slice(0, 5).map(async (movieId) => {
            try {
              const res = await axios.get(
                `https://api.themoviedb.org/3/${type}/${movieId}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`,
              );
              return res.data.results ?? [];
            } catch { return []; }
          }),
        );
        results.forEach((r) => recommended.push(...r.slice(0, 10)));
      }

      if (historyIds.length > 0 && recommended.length < 20) {
        const results = await Promise.all(
          historyIds.slice(0, 5).map(async (movieId) => {
            try {
              const res = await axios.get(
                `https://api.themoviedb.org/3/${type}/${movieId}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`,
              );
              return res.data.results ?? [];
            } catch { return []; }
          }),
        );
        results.forEach((r) => recommended.push(...r.slice(0, 8)));
      }

      if (favouriteActors.length > 0 && recommended.length < 20) {
        const results = await Promise.all(
          favouriteActors.slice(0, 10).map(async (actor) => {
            try {
              const res = await axios.get(
                `https://api.themoviedb.org/3/person/${actor.id}/${type}_credits?api_key=${TMDB_API_KEY}&language=en-US`,
              );
              return res.data.cast ?? [];
            } catch { return []; }
          }),
        );
        results.forEach((r) => recommended.push(...r.slice(0, 10)));
      }

      const genreIds = Array.from(genreIdsSet);
      if (genreIds.length > 0 && recommended.length < 20) {
        const results = await Promise.all(
          genreIds.slice(0, 3).map(async (genreId) => {
            try {
              const res = await axios.get(
                `https://api.themoviedb.org/3/discover/${type}?api_key=${TMDB_API_KEY}&language=en-US&with_genres=${genreId}&sort_by=popularity.desc&page=1`,
              );
              return res.data.results ?? [];
            } catch { return []; }
          }),
        );
        results.forEach((r) => recommended.push(...r.slice(0, 8)));
      }

      try {
        const res = await axios.get(
          `https://api.themoviedb.org/3/trending/${type}/week?api_key=${TMDB_API_KEY}`,
        );
        recommended.push(...(res.data.results ?? []).slice(0, 15));
      } catch {}

      try {
        const res = await axios.get(
          `https://api.themoviedb.org/3/${type}/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`,
        );
        recommended.push(...(res.data.results ?? []).slice(0, 15));
      } catch {}

      if (recommended.length === 0) {
        try {
          const res = await axios.get(
            `https://api.themoviedb.org/3/${type}/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`,
          );
          recommended.push(...(res.data.results ?? []).slice(0, 20));
        } catch {}
      }
    } catch {}

    if (!mountedRef.current || seq !== seqRef.current) return;

    const unique = new Map<string, RecommendedItem>();
    recommended.forEach((m: any) => {
      const mid = m.id?.toString();
      if (mid && !unique.has(mid) && !watchedOrWatchlistIds.has(mid)) {
        const mType = m.media_type || type;
        if (mType === type) {
          unique.set(mid, {
            id: mid,
            title: m.title ?? m.name ?? '',
            posterPath: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
            mediaType: mType,
            overview: m.overview ?? '',
            voteAverage: m.vote_average ?? 0,
          });
        }
      }
    });

    const sorted = Array.from(unique.values()).sort((a, b) => b.voteAverage - a.voteAverage);
    setItems(sorted.slice(0, 50));
    setLoading(false);
  }, [watchlist, history, favouriteActors, selectedGenres, ratedMovies]);

  useEffect(() => {
    setItems([]);
    fetchRecommendations(mediaType);
  }, [mediaType, fetchRecommendations]);

  useEffect(() => {
    const refresh = () => {
      setItems([]);
      fetchRecommendations(mediaType);
    };
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [mediaType, fetchRecommendations]);

  const switchType = (t: 'movie' | 'tv') => {
    if (t === mediaType) return;
    setItems([]);
    setMediaType(t);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl p-5 sm:p-6 md:p-8 border border-zinc-700/50 shadow-2xl"
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <img src="/recommendation-icon.png" alt="Recommendations" className="w-9 h-10 shadow-lg" />
          Recommendations
        </h2>
      </div>

      <div className="flex justify-center mb-5">
        <div className="relative flex items-center bg-white/10 border border-white/20 backdrop-blur-xl rounded-full p-0.5 shadow-lg">
          {(['movie', 'tv'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchType(t)}
              className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 font-semibold text-xs sm:text-sm transition-all duration-300 rounded-full ${
                mediaType === t ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t === 'movie' ? <Film className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
              {t === 'movie' ? 'Movies' : 'Series'}
            </button>
          ))}
          <motion.div
            className="absolute inset-y-0.5 bg-gradient-to-r from-red-600 to-red-500 rounded-full shadow-lg shadow-red-500/40"
            layoutId="rec-media-toggle"
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              left: mediaType === 'movie' ? 2 : '50%',
              right: mediaType === 'tv' ? 2 : '50%',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-10 h-10 border-4 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading {mediaType === 'movie' ? 'movies' : 'series'}…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <Film className="w-14 h-14 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-semibold mb-1">No recommendations yet</p>
          <p className="text-zinc-500 text-sm">Watch more to get personalised picks</p>
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto pb-3 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-3">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.04, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onMediaClick(item.id, item.mediaType)}
                  className="group flex-shrink-0 w-28 sm:w-32 bg-zinc-800/50 border border-zinc-700/40 rounded-2xl overflow-hidden shadow-lg cursor-pointer"
                >
                  <div className="relative aspect-[2/3]">
                    {item.posterPath ? (
                      <img
                        src={item.posterPath}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Film className="w-8 h-8 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-sm border border-white/10 rounded-md px-1.5 py-0.5">
                      <span className={`text-[9px] font-bold uppercase ${item.mediaType === 'tv' ? 'text-cyan-400' : 'text-zinc-300'}`}>
                        {item.mediaType === 'tv' ? 'TV' : 'Film'}
                      </span>
                    </div>
                    {item.voteAverage > 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm border border-amber-500/20 rounded-md px-1.5 py-0.5 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                        <span className="text-[9px] font-bold text-amber-300">{item.voteAverage.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold leading-tight line-clamp-2 text-white/90 group-hover:text-white">
                      {item.title}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <p className="text-center text-zinc-600 text-xs mt-2">
            {items.length} {mediaType === 'movie' ? 'movies' : 'series'}
          </p>
        </div>
      )}
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
    <div className="overflow-x-auto -mx-1 px-1 pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="flex gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={to(item)}
            className={`group flex-shrink-0 w-[110px] sm:w-[120px] rounded-2xl overflow-hidden border border-white/5 hover:${accentClass} transition-all duration-500 bg-zinc-900/60`}
          >
            <div className="relative aspect-[2/3]">
              {item.posterPath ? (
                <img
                  src={item.posterPath}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                  <ImageOff className="w-6 h-6 text-zinc-600" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <div className="p-2">
              <p className="text-xs font-semibold truncate text-white/80 group-hover:text-white">
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
          className={`relative z-10 px-4 py-1.5 font-semibold text-xs rounded-full transition-all duration-300 ${
            value === opt.value ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
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
        { username, preferences: selectedGenres.join(',') },
        { merge: true },
      );
      showToast('Profile updated!', 'success');
    } catch {
      showToast('Error updating profile, please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => navigate('/login'))
      .catch(() => {});
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
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl shadow-lg">
              <Settings className="text-white w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Profile</h1>
              <p className="text-gray-400 text-sm">Manage your account and preferences</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="self-start sm:self-auto bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-105 shadow-lg shadow-red-500/25 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            Logout
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

                <div className="flex-1 w-full space-y-5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      className="w-full bg-zinc-900/50 border border-zinc-800 text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 placeholder:text-zinc-600 transition-all duration-300 text-sm"
                    />
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full sm:w-auto px-7 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 active:scale-95 bg-white text-black hover:bg-zinc-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Update Profile'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>

            <BingeWatchStats history={history} />

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

            <RecommendationSection
              watchlist={watchlist}
              history={history}
              favouriteActors={favouriteActors}
              selectedGenres={selectedGenres}
              ratedMovies={ratedMovies}
              onMediaClick={handleMediaClick}
            />
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-zinc-950/50 backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/[0.05] shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-cyan-400 fill-current" />
                  Watchlist
                </h2>
                <Link to="/watchlist" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              <TogglePill
                value={watchlistFilter}
                onChange={setWatchlistFilter}
                options={[{ value: 'movie', label: 'Movies' }, { value: 'tv', label: 'Series' }]}
                layoutId="watchlist-pill"
                activeColor="bg-gradient-to-r from-cyan-600 to-cyan-500 shadow-cyan-500/30"
              />

              <MediaRow
                items={filteredWatchlist.slice().reverse()}
                emptyLabel={`No ${watchlistFilter === 'movie' ? 'movies' : 'series'} in watchlist`}
                accentClass="border-cyan-500/30 shadow-cyan-500/10"
                to={(item) => `/${item.mediaType}/${item.id}`}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-zinc-950/50 backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/[0.05] shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-500" />
                  History
                </h2>
                <Link to="/history" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              <TogglePill
                value={historyFilter}
                onChange={setHistoryFilter}
                options={[{ value: 'movie', label: 'Movies' }, { value: 'tv', label: 'Series' }]}
                layoutId="history-pill"
                activeColor="bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-emerald-500/30"
              />

              <MediaRow
                items={filteredHistory.slice(0, 10)}
                emptyLabel="No history yet"
                accentClass="border-emerald-500/30 shadow-emerald-500/10"
                to={(item) => `/${item.mediaType || 'movie'}/${item.id}`}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="bg-zinc-950/40 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-amber-500/10 shadow-xl"
            >
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-amber-500/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                  </div>
                  <h2 className="text-base font-semibold text-white tracking-tight">Rated Movies</h2>
                </div>
                <Link
                  to="/top-rated"
                  className="p-1.5 rounded-lg hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 transition-all duration-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {ratedMovies.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center">
                    <Star className="w-4 h-4 text-amber-500/30" />
                  </div>
                  <p className="text-zinc-300 text-sm font-medium">No rated movies yet</p>
                  <p className="text-zinc-500 text-xs text-center">Rate media across the app to see them here</p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[360px] space-y-2 pr-1">
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
                        className="group flex items-center gap-3 bg-zinc-900/20 hover:bg-amber-500/5 rounded-2xl p-2.5 border border-transparent hover:border-amber-500/20 transition-all duration-300 cursor-pointer"
                      >
                        <div className="w-6 h-6 shrink-0 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-zinc-400 group-hover:text-amber-400 transition-colors">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="w-8 h-11 shrink-0 rounded-md overflow-hidden border border-amber-500/10 bg-zinc-900">
                          {posterUrl ? (
                            <img
                              src={posterUrl}
                              alt={movie.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                              <Film className="w-3 h-3 text-zinc-700" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-zinc-200 group-hover:text-amber-300 transition-colors truncate">
                            {movie.title}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Movie</p>
                        </div>

                        <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-bold group-hover:bg-amber-500 group-hover:text-black group-hover:border-transparent transition-all duration-300">
                          <Star className="w-3 h-3 fill-current" />
                          {movie.rating}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="bg-zinc-950/50 backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/[0.05] shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2.5 text-white">
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 fill-current" />
                  Favourite Talents
                </h2>
                <Link to="/fav-talents" className="text-red-400 hover:text-red-300 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              {favouriteActors.length === 0 ? (
                <p className="text-zinc-500 text-center text-sm py-4">No favourite talents yet</p>
              ) : (
                <div className="overflow-x-auto -mx-1 px-1 pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="flex gap-3">
                    {favouriteActors.map((actor, idx) => (
                      <Link
                        key={actor.id}
                        to={`/actor/${actor.id}`}
                        className="group flex-shrink-0 w-[90px] sm:w-[100px] rounded-2xl overflow-hidden border border-white/5 hover:border-red-500/30 transition-all duration-500 bg-zinc-900/60"
                      >
                        <div className="relative aspect-[3/4]">
                          <div className="absolute top-1.5 left-1.5 z-10 bg-black/60 backdrop-blur-sm border border-white/10 rounded-md px-1.5 py-0.5">
                            <span className="text-[9px] font-bold text-zinc-300">#{idx + 1}</span>
                          </div>
                          <div className="absolute top-1.5 right-1.5 z-10 bg-red-500 p-1 rounded-full shadow-lg shadow-red-500/30">
                            <Heart className="w-2.5 h-2.5 text-white fill-current" />
                          </div>
                          {actor.profilePath ? (
                            <img
                              src={actor.profilePath}
                              alt={actor.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                              <User className="w-7 h-7 text-zinc-500" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-semibold truncate group-hover:text-red-400 transition-colors">
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
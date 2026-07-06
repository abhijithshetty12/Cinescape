import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Star, Calendar, TvMinimalPlay, Clock, ImageOff, Image, Bookmark, BookmarkCheck, Check, Plus, Loader2, Play, Globe, Users, MessageCircle, ImageOff as ImageOff2, Image as Image2, Award as Award2, Users as Users2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { collection, addDoc, getDocs, query, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import Toast from '../components/Toast.tsx';
import Loading from '../components/Loading.tsx';
import { useWatchedStatus, WatchedItemData } from './History.tsx';
import confetti from 'canvas-confetti';

interface Tvdetails {
  id: number;
  name: string;
  overview: string;
  language: string;
  creators: { id: number; name: string }[];
  first_air_date: string;
  genres: { id: number; name: string }[];
  seasons: { season_number: number; episode_count: number }[];
  vote_average: number;
  poster_path: string;
  cast: { id: number; name: string; role: string; profile_path: string }[] | null;
  reviews: { id: string; author: string; content: string }[];
  trailers: any;
  images: { backdrops: { file_path: string }[] };

  country: string[];
  age_rating: string;
}

const SpatialMediaCard = ({
  children,
  containerRef,
  index,
}: {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement>;
  index: number;
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const { scrollXProgress } = useScroll({
    container: containerRef,
    target: itemRef,
    axis: 'x',
    offset: ['start end', 'end start'],
  });

  const x = useTransform(scrollXProgress, [0, 1], [20, -20]);

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
      className="flex-shrink-0"
    >
      <div className="relative overflow-hidden rounded-2xl group">
        <motion.div style={{ x }} className="w-full h-full">
          {children}
        </motion.div>
      </div>
    </motion.div>
  );
};

const Tvdetails = () => {
  const { id } = useParams<{ id: string }>();
  const showId = id;
  const { user } = useAuth();



  const [Tvdetails, setTvdetails] = useState<Tvdetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState<boolean>(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [isInWatchlist, setIsInWatchlist] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false,
  });
  const playerRef = useRef<HTMLDivElement>(null);

  const [activeGenreId, setActiveGenreId] = useState<number | null>(null);

  const castContainerRef = useRef<HTMLDivElement>(null);
  const crewContainerRef = useRef<HTMLDivElement>(null);
  const [crew, setCrew] = useState<any[]>([]);

  const languageMap: Record<string, string> = {
    en: 'English', kn: 'Kannada', te: 'Telugu', hi: 'Hindi', ta: 'Tamil', ml: 'Malayalam',
    ko: 'Korean', fr: 'French', de: 'German', es: 'Spanish', ru: 'Russian', ja: 'Japanese', zh: 'Chinese', ar: 'Arabic', it: 'Italian',
    pt: 'Portuguese', sv: 'Swedish', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', vi: 'Vietnamese', id: 'Indonesian', fa: 'Persian', ur: 'Urdu',
    bg: 'Bulgarian', cs: 'Czech', da: 'Danish', el: 'Greek', et: 'Estonian', fi: 'Finnish', hu: 'Hungarian', is: 'Icelandic', lt: 'Lithuanian',
    lv: 'Latvian', mk: 'Macedonian', no: 'Norwegian', sr: 'Serbian', sk: 'Slovak', sl: 'Slovenian', th: 'Thai', uk: 'Ukrainian', he: 'Hebrew', ro: 'Romanian',
    nb: 'Norwegian Bokmål', ca: 'Catalan', hr: 'Croatian', eu: 'Basque', gl: 'Galician', af: 'Afrikaans', sq: 'Albanian', am: 'Amharic', hy: 'Armenian', az: 'Azerbaijani',
    be: 'Belarusian', bn: 'Bengali', bs: 'Bosnian', ceb: 'Cebuano', co: 'Corsican', cy: 'Welsh', eo: 'Esperanto', fj: 'Fijian', fo: 'Faroese', fy: 'Frisian', ga: 'Irish',
    gd: 'Scots Gaelic', gu: 'Gujarati', ha: 'Hausa', haw: 'Hawaiian', hmn: 'Hmong'
  };

  const showLanguage = languageMap[Tvdetails?.language ?? ''] || Tvdetails?.language || 'Unknown';
  const showRating = Tvdetails?.vote_average?.toFixed(1) ?? 'N/A';
  const showFirstAirDate = Tvdetails?.first_air_date ?? 'Unknown';
  const creators = Tvdetails?.creators ?? [];
  const posterImageUrl = `https://image.tmdb.org/t/p/original/${Tvdetails?.poster_path ?? ''}`;
  const posterThumbnailUrl = `https://image.tmdb.org/t/p/w500/${Tvdetails?.poster_path ?? ''}`;

  const WatchedButtonInline = () => {
    const movieData: WatchedItemData = {
      movieId: Tvdetails!.id,
      title: Tvdetails!.name,
      posterPath: Tvdetails!.poster_path ?? '',
      releaseDate: Tvdetails!.first_air_date,
      genres: Tvdetails!.genres.map((genre) => genre.name),
      mediaType: 'tv',
    };

    const { isWatched, loading: watchedLoading, toggleWatched } = useWatchedStatus(movieData.movieId, movieData.mediaType);
    const [showWatchedToast, setShowWatchedToast] = useState(false);
    const [watchedToastMessage, setWatchedToastMessage] = useState('');

    const handleClick = async () => {
      const result = await toggleWatched(movieData);

      if (result.success) {
        const message = isWatched
          ? `Removed ${movieData.title} from watch history`
          : `Added ${movieData.title} to watch history`;
        setWatchedToastMessage(message);
        setShowWatchedToast(true);
      }
    };

    return (
      <>
        <button
          onClick={handleClick}
          disabled={watchedLoading}
          className={`flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[44px] shadow-lg ${isWatched
            ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-green-500/25'
            : 'bg-gradient-to-r from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500 text-gray-300 hover:text-white shadow-zinc-500/25'
            } ${watchedLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {watchedLoading ? (
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
          ) : isWatched ? (
            <Check className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
          <span className="hidden xs:inline sm:inline">
            {watchedLoading ? 'Loading...' : isWatched ? 'Watched' : 'Mark as Watched'}
          </span>
          <span className="xs:hidden sm:hidden">
            {watchedLoading ? '...' : isWatched ? 'Watched' : 'Mark as Watch'}
          </span>
        </button>

        <Toast
          message={watchedToastMessage}
          type="success"
          isVisible={showWatchedToast}
          onClose={() => setShowWatchedToast(false)}
        />
      </>
    );
  };

  const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
  const API_URL = `https://api.themoviedb.org/3/tv/${showId}?api_key=${API_KEY}&append_to_response=credits,reviews,videos,images`;

  useEffect(() => {
    const fetchTvdetails = async () => {
      try {
        const response = await axios.get(API_URL);
        const showData = response.data;

        const creditsResp = await axios.get(`https://api.themoviedb.org/3/tv/${showId}/credits?api_key=${API_KEY}`);
        const fullCast = creditsResp.data?.cast || [];

        const creators = showData.created_by?.map((creator: any) => ({
          id: creator.id,
          name: creator.name,
        })) || [];

        const fullCrew = creditsResp.data?.crew || [];

        setCrew(fullCrew);

        setTvdetails({
          id: showData.id,
          name: showData.name,
          language: showData.original_language,
          creators: creators,
          overview: showData.overview,
          first_air_date: showData.first_air_date,
          genres: showData.genres,
          seasons: showData.seasons.map((season: any) => ({
            season_number: season.season_number,
            episode_count: season.episode_count,
          })),
          vote_average: showData.vote_average,
          poster_path: showData.poster_path,
          cast: fullCast.map((member: any) => ({
            id: member.id,
            name: member.name,
            role: member.character,
            profile_path: member.profile_path,
          })),
          reviews: showData.reviews?.results
            .filter((review: any) => review.content.length < 300)
            .map((review: any) => ({
              id: review.id,
              author: review.author,
              content: review.content,
            })) || [],
          trailers: showData.videos?.results || [],
          images: showData.images?.backdrops || [],

          country: Array.isArray(showData.origin_country) ? showData.origin_country : [],
          age_rating:
            showData.content_ratings?.results?.[0]?.rating ||
            showData.age_rating ||
            'Unknown',
        });


        if (showData.seasons.length > 0) {
          const latestSeason = showData.seasons.reduce((max: any, s: any) =>
            s.season_number > max.season_number ? s : max,
            showData.seasons[0]
          );
          setSelectedSeason(latestSeason.season_number);
          setSelectedEpisode(latestSeason.episode_count);
        }
      } catch (err) {
        setError('Failed to fetch TV show details');
      } finally {
        setLoading(false);
      }
    };

    fetchTvdetails();
  }, [API_URL]);

  const fetchEpisodes = async (seasonNumber: number) => {
    setEpisodesLoading(true);
    setEpisodesError(null);
    try {
      const response = await axios.get(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${API_KEY}`);
      const eps = response.data.episodes || [];
      const mapped = eps.map((ep: any) => ({
        ...ep,
        still_url: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null,
      }));
      setEpisodes(mapped);
    } catch (err) {
      setEpisodesError('Failed to fetch episodes');
    } finally {
      setEpisodesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSeason !== null) {
      fetchEpisodes(selectedSeason);
    } else {
      setEpisodes([]);
      setSelectedEpisode(null);
    }
  }, [selectedSeason]);

  const handleWatchlistToggle = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      const userId = user.uid;
      const watchlistCollectionRef = collection(db, 'users', userId, 'watchlist');

      try {
        const querySnapshot = await getDocs(query(watchlistCollectionRef, where('movieId', '==', Tvdetails?.id)));
        if (querySnapshot.docs.length > 0) {
          const docToDelete = querySnapshot.docs[0];
          await deleteDoc(docToDelete.ref);
          setIsInWatchlist(false);
          setToast({
            message: 'TV show removed from watchlist!',
            type: 'info',
            isVisible: true,
          });
        } else {
          await addDoc(watchlistCollectionRef, {
            movieId: Tvdetails?.id,
            title: Tvdetails?.name,
            releaseDate: Tvdetails?.first_air_date,
            genres: Tvdetails?.genres.map((genre) => genre.name),
            posterPath: Tvdetails?.poster_path,
            mediaType: 'tv',
          });
          setIsInWatchlist(true);

          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.8 },
            colors: ['#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8'],
            ticks: 200,
            gravity: 1.2,
            scalar: 1.2,
          });

          setToast({
            message: 'TV show added to watchlist!',
            type: 'success',
            isVisible: true,
          });
        }
      } catch (error) {
        console.error('Error toggling watchlist: ', error);
        setToast({
          message: 'Failed to update watchlist',
          type: 'error',
          isVisible: true,
        });
      }
    } else {
      setToast({
        message: 'Please log in to add to watchlist',
        type: 'error',
        isVisible: true,
      });
    }
  };

  useEffect(() => {
    if (selectedEpisode !== null && playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedEpisode]);

  useEffect(() => {
    const checkWatchlistStatus = async () => {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user && Tvdetails?.id) {
        const userId = user.uid;
        const watchlistCollectionRef = collection(db, 'users', userId, 'watchlist');

        try {
          const querySnapshot = await getDocs(query(watchlistCollectionRef, where('movieId', '==', Tvdetails.id)));
          setIsInWatchlist(querySnapshot.docs.length > 0);
        } catch (error) {
          console.error('Error checking watchlist status: ', error);
        }
      }
    };

    checkWatchlistStatus();
  }, [Tvdetails?.id]);

  if (loading) return <Loading />;
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />

      <div className="relative min-h-[70vh] md:min-h-[85vh] flex items-end">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
            style={{
              backgroundImage:
                window.innerWidth >= 768
                  ? Tvdetails?.images && Array.isArray(Tvdetails.images) && Tvdetails.images.length > 0
                    ? `url(https://image.tmdb.org/t/p/original/${Tvdetails.images[Math.floor(Math.random() * Tvdetails.images.length)].file_path})`
                    : `url(${posterImageUrl})`
                  : `url(${posterImageUrl})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-transparent to-black/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
          <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-12">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
            className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-12"
          >
            <div className="w-full md:w-auto flex-shrink-0 flex justify-center md:justify-start md:-mt-20 md:mr-8 order-1 md:order-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="relative"
              >
                <div className="relative ring-1 ring-white/10 bg-white/5 rounded-2xl p-1.5 sm:p-2 shadow-2xl shadow-black/50">
                  {Tvdetails?.poster_path ? (
                    <img
                      src={posterThumbnailUrl}
                      alt={Tvdetails?.name}
                      className="w-40 h-56 xs:w-48 xs:h-64 sm:w-52 sm:h-72 md:w-56 md:h-80 lg:w-64 lg:h-96 object-cover rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-40 h-56 xs:w-48 xs:h-64 sm:w-52 sm:h-72 md:w-56 md:h-80 lg:w-64 lg:h-96 bg-zinc-900/80 flex flex-col items-center justify-center text-gray-500 rounded-lg">
                      <ImageOff className="w-10 h-10 sm:w-12 sm:h-12 mb-2 opacity-50" />
                      <span className="text-xs text-center px-3">No Image</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            <div className="flex-1 flex flex-col justify-end w-full text-center md:text-left order-2 md:order-none">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="flex flex-wrap justify-center md:justify-start items-center gap-2 md:gap-3 mb-4 md:mb-6"
              >
                <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-white font-semibold text-sm sm:text-base">{showRating}</span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                  <Calendar className="w-4 h-4 text-green-600" />
                  <span className="text-white/80 font-medium text-sm">
                    {showFirstAirDate}
                  </span>
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-4 md:mb-6 leading-tight tracking-tight text-white"
              >
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  {Tvdetails?.name}
                </span>
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap justify-center md:justify-start gap-2 md:gap-2.5 mb-6 md:mb-8"
              >
                {Tvdetails?.genres?.map((genre) => (
                  <span
                    key={genre.id}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs sm:text-sm font-medium text-white/80 transition-all duration-300 hover:bg-white/10 hover:text-white hover:border-white/20"
                  >
                    {genre.name}
                  </span>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start"
              >
                <WatchedButtonInline />
                <button
                  onClick={handleWatchlistToggle}
                  className={`relative group flex items-center gap-3 px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[52px] shadow-xl overflow-hidden ${isInWatchlist
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/30'
                    }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  {isInWatchlist ? (
                    <BookmarkCheck className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
                  ) : (
                    <Bookmark className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
                  )}
                  <span className="relative z-10">
                    {isInWatchlist ? 'Saved to Watchlist' : 'Add to Watchlist'}
                  </span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8 md:space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="lg:col-span-5 relative overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-950/40 p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] hover:bg-zinc-950/50 sm:p-8"
          >
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 mb-8 flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">
                  Vibe Chart
                </h2>
              </div>
              <p className="text-xs text-zinc-500 font-medium">Hover a segment</p>
            </div>

            {(() => {
              const genres = Tvdetails?.genres ?? [];
              const segments = genres.map((g) => ({
                id: g.id,
                name: g.name,
                value: genres.length ? 100 / genres.length : 0,
              }));

              const highestGenre = segments.length > 0
                ? segments.reduce((max, seg) => (seg.value > max.value ? seg : max))
                : null;

              const active = segments.find((s) => s.id === activeGenreId) ?? null;
              const centerTitle = active ? active.name : (highestGenre ? highestGenre.name : 'Genre Mix');
              const centerPct = active ? active.value : (highestGenre ? highestGenre.value : 0);

              const size = 220;
              const stroke = 26;
              const r = size / 2 - stroke;
              const cx = size / 2;
              const cy = size / 2;
              const circumference = 2 * Math.PI * r;

              const gapSize = 4;

              const colors = [
                '#8400ff', '#FF5500', '#00F0FF', '#ffcc00', '#ff0080',
                '#F4C2C2', '#995a2d', '#F97316', '#14B8A6', '#EF4444',
              ];

              let offset = 0;

              return (
                <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row md:justify-start lg:gap-10">
                  <div className="relative flex flex-shrink-0 items-center justify-center w-full max-w-[220px]" style={{ aspectRatio: '1/1' }}>
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${size} ${size}`}
                      role="img"
                      aria-label="Genre distribution donut chart"
                      className="drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="transparent"
                        stroke="rgba(255,255,255,0.02)"
                        strokeWidth={stroke}
                      />

                      {segments.map((seg, idx) => {
                        // Base length of the segment
                        const baseDash = (circumference * seg.value) / 100;

                        // Subtract the gapSize from the visible line segment length
                        const adjustedDash = Math.max(0, baseDash - gapSize);

                        // The remaining space becomes the rest of the circumference + the gap
                        const dashArray = `${adjustedDash} ${circumference - adjustedDash}`;

                        // Standard offset handling
                        const dashOffset = -offset;
                        offset += baseDash;

                        const isActive = seg.id === activeGenreId;
                        const isAnyActive = activeGenreId !== null;
                        const color = colors[idx % colors.length];

                        return (
                          <circle
                            key={seg.id}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="transparent"
                            stroke={color}
                            strokeWidth={isActive ? stroke + 4 : stroke}
                            strokeLinecap="butt"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            transform={`rotate(-90 ${cx} ${cy})`}
                            style={{
                              filter: isActive ? `drop-shadow(0 0 16px ${color}50)` : 'none',
                              opacity: !isAnyActive || isActive ? 1 : 0.25,
                              transition: 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={() => setActiveGenreId(seg.id)}
                            onMouseLeave={() => setActiveGenreId(null)}
                            onFocus={() => setActiveGenreId(seg.id)}
                            onBlur={() => setActiveGenreId(null)}
                            tabIndex={0}
                            aria-label={`${seg.name}: ${seg.value.toFixed(1)}%`}
                          />
                        );
                      })}
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-6">
                      <span className="w-full text-[11px] font-medium tracking-wider text-zinc-400 uppercase transition-all duration-300 max-w-[140px] truncate">
                        {centerTitle}
                      </span>
                      <span className="text-3xl font-bold tracking-tight text-white mt-0.5 font-sans tabular-nums">
                        {centerPct.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full flex-1">
                    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2">
                      {segments.map((s, idx) => {
                        const color = colors[idx % colors.length];
                        const isActive = s.id === activeGenreId;
                        const isAnyActive = activeGenreId !== null;

                        return (
                          <li
                            key={s.id}
                            className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ${isActive
                              ? 'border-white/[0.08] bg-white/[0.04] shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                              : 'border-transparent bg-transparent hover:bg-white/[0.01]'
                              }`}
                            style={{
                              opacity: !isAnyActive || isActive ? 1 : 0.4,
                            }}
                          >
                            <div
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0 transition-transform duration-300 group-hover:scale-125"
                              style={{
                                backgroundColor: color,
                                boxShadow: isActive ? `0 0 10px ${color}` : `0 0 0px ${color}`,
                              }}
                            />
                            <button
                              type="button"
                              onMouseEnter={() => setActiveGenreId(s.id)}
                              onMouseLeave={() => setActiveGenreId(null)}
                              onFocus={() => setActiveGenreId(s.id)}
                              onBlur={() => setActiveGenreId(null)}
                              className={`text-xs font-semibold tracking-wide text-left transition-colors duration-200 outline-none flex-1 ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
                                }`}
                            >
                              {s.name}
                            </button>
                            <span
                              className={`text-xs font-semibold font-mono tracking-tight transition-colors duration-200 tabular-nums ${isActive ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-400'
                                }`}
                            >
                              {s.value.toFixed(0)}%
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })()}
          </motion.section>

          <div className="lg:col-span-7 space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/[0.06] p-6 md:p-8"
            >
              <div className="mb-4">
                <h2 className="text-xl font-bold tracking-tight text-white mb-3">Synopsis</h2>
                <p className="text-zinc-400 text-sm md:text-base leading-relaxed font-normal">{Tvdetails?.overview}</p>
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 mb-6">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Show Info</h3>
                </div>

                <div className="bg-zinc-900/40 backdrop-blur-xl rounded-2xl p-6 border border-zinc-800/80 relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-zinc-700/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6">
                    <div className="space-y-1">
                      <span className="text-zinc-500 text-xs font-semibold block uppercase tracking-wider">Language</span>
                      <span className="text-zinc-200 font-bold text-sm block tracking-wide">{showLanguage}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-500 text-xs font-semibold block uppercase tracking-wider">First Air Date</span>
                      <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm">
                        <Calendar className="w-4 h-4 text-emerald-500/80" />
                        <span className="tracking-wide">{showFirstAirDate}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-500 text-xs font-semibold block uppercase tracking-wider">Age Rating</span>
                      <span className="inline-block bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 rounded-md px-2 py-0.5 text-xs font-bold mt-0.5">
                        {Tvdetails?.age_rating || 'TBD'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-500 text-xs font-semibold block uppercase tracking-wider">Country</span>
                      <span className="text-zinc-200 font-bold text-sm block truncate tracking-wide">
                        {Tvdetails?.country?.length ? Tvdetails.country.join(', ') : 'Unknown'}
                      </span>
                    </div>

                    <div className="col-span-2 space-y-1">
                      <span className="text-zinc-500 text-xs font-semibold block uppercase tracking-wider">Created By</span>
                      <span className="text-zinc-200 font-bold text-sm block truncate tracking-wide">
                        {creators && creators.length > 0 ? creators.map((c) => c.name).join(', ') : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        </div>

        <div className="w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <div className="relative bg-zinc-950/20 backdrop-blur-3xl rounded-3xl p-6 border border-white/[0.03] shadow-[0_16px_48px_rgba(0,0,0,0.4)] overflow-hidden">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 px-1">
                Production Media & Trailers
              </h3>

              {(!Tvdetails?.trailers || Tvdetails.trailers.length === 0) &&
                (!Tvdetails?.images?.backdrops || Tvdetails.images.backdrops.length === 0) &&
                (!(Tvdetails as any)?.backdrops || (Tvdetails as any).backdrops.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                  <Image className="w-10 h-10 mb-2 stroke-[1.25]" />
                  <span className="text-xs font-medium">No production media captured</span>
                </div>
              ) : (
                <div
                  className="flex gap-4 overflow-x-auto pb-3 pt-1 px-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent snap-x snap-mandatory scroll-smooth"
                  style={{ willChange: 'scroll-position' }}
                >
                  {/* TV Show Trailer Card */}
                  {Tvdetails?.trailers && Tvdetails.trailers.length > 0 && (
                    <div className="flex-shrink-0 w-[85%] sm:w-[45%] lg:w-[32%] snap-start">
                      <div className="aspect-video rounded-xl overflow-hidden border border-white/[0.06] bg-black shadow-lg shadow-black/40 relative">
                        <iframe
                          className="w-full h-full relative z-10"
                          src={`https://www.youtube.com/embed/${Tvdetails.trailers[0].key}`}
                          title="TV Show Trailer"
                          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}

                  {(Tvdetails?.images?.backdrops || []).map((image: any) => (
                    <div key={image.file_path} className="flex-shrink-0 w-[85%] sm:w-[45%] lg:w-[32%] snap-start">
                      <div className="aspect-video rounded-xl overflow-hidden border border-white/[0.06] bg-zinc-900 shadow-lg shadow-black/40 relative group/slide cursor-zoom-in">
                        <img
                          src={`https://image.tmdb.org/t/p/w780/${image.file_path}`}
                          alt="Series production still"
                          className="w-full h-full object-cover opacity-85 transition-opacity duration-300 ease-out group-hover/slide:opacity-100"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none z-20" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          ref={playerRef}
          className="bg-zinc-900/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 lg:p-8 border border-white/[0.06] shadow-2xl shadow-black/40"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <TvMinimalPlay className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              {selectedEpisode !== null ? `Watch Season ${selectedSeason} Episode ${selectedEpisode}` : 'Watch Series'}
            </h2>
          </div>

          <div className="rounded-xl overflow-hidden bg-zinc-950 aspect-video relative w-full border border-white/[0.04] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.7)]">
            <iframe
              src={
                selectedEpisode !== null
                  ? `https://www.vidking.net/embed/tv/${showId}/${selectedSeason}/${selectedEpisode}?color=3b82f6&autoPlay=true&nextEpisode=true&episodeSelector=true`
                  : (() => {
                    const latestSeason = Tvdetails?.seasons[Tvdetails.seasons.length - 1];
                    return `https://www.vidking.net/embed/tv/${showId}/${latestSeason?.season_number}/${latestSeason?.episode_count}?color=3b82f6&nextEpisode=true&episodeSelector=true`;
                  })()
              }
              width="100%"
              height="100%"
              frameBorder="0"
              allowFullScreen
              allow="fullscreen; picture-in-picture; autoplay; orientation-lock"
              title="TV Show Embed"
              className="absolute inset-0 w-full h-full"
              ref={el => {
                if (el && typeof window !== "undefined") {
                  const handleFs = () => {
                    const orientation =
                      (window.screen as any).orientation ||
                      (window.screen as any).mozOrientation ||
                      (window.screen as any).msOrientation;
                    if (
                      document.fullscreenElement &&
                      orientation &&
                      typeof orientation.lock === "function"
                    ) {
                      orientation.lock("landscape").catch(() => { });
                    }
                  };
                  document.removeEventListener("fullscreenchange", handleFs);
                  document.addEventListener("fullscreenchange", handleFs);
                }
              }}
            ></iframe>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-zinc-900/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 lg:p-8 border border-white/[0.06] shadow-2xl shadow-black/40"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <TvMinimalPlay className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Seasons</h2>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">
                  {selectedSeason !== null
                    ? `Season ${selectedSeason} • ${Tvdetails?.seasons.find(s => s.season_number === selectedSeason)?.episode_count || 0} Episodes`
                    : 'Select a season to view episodes'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none snap-x">
            {Tvdetails?.seasons.map((season) => {
              const isSelected = selectedSeason === season.season_number;
              return (
                <button
                  key={season.season_number}
                  onClick={() => {
                    setSelectedSeason(season.season_number);
                    setSelectedEpisode(null);
                  }}
                  className={`snap-start px-4 py-2 rounded-xl font-bold flex-shrink-0 flex items-center gap-2.5 transition-all duration-300 text-xs uppercase tracking-wider border ${isSelected
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/15'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800/60 border-white/[0.04]'
                    }`}
                >
                  <span>Season {season.season_number}</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-black/20 text-blue-100' : 'bg-white/[0.04] text-zinc-500'}`}>
                    {season.episode_count}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedSeason !== null && (
            <div className="min-h-[100px]">
              {episodesLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              )}

              {episodesError && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-red-400 text-center text-xs font-semibold">
                  {episodesError}
                </div>
              )}

              {!episodesLoading && !episodesError && episodes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {episodes.map((episode) => {
                    const isSelected = selectedEpisode === episode.episode_number;
                    return (
                      <div
                        key={episode.id}
                        className={`group flex items-start gap-3.5 p-3 rounded-xl cursor-pointer border transition-all duration-300 ${isSelected
                          ? 'border-blue-500 bg-blue-500/[0.04] shadow-md shadow-blue-500/5'
                          : 'bg-zinc-900/20 border-white/[0.04] hover:border-white/[0.08] hover:bg-zinc-800/30'
                          }`}
                        onClick={() => setSelectedEpisode(episode.episode_number)}
                      >
                        <div className="relative w-24 sm:w-28 md:w-32 flex-shrink-0 aspect-video rounded-lg overflow-hidden bg-zinc-950 border border-white/[0.04]">
                          {episode.still_url ? (
                            <img
                              src={episode.still_url}
                              alt={episode.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 p-2">
                              <ImageOff className="w-5 h-5 stroke-[1.5]" />
                            </div>
                          )}
                          <div className={`absolute inset-0 bg-zinc-950/60 backdrop-blur-[1px] transition-opacity duration-300 flex items-center justify-center ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 scale-90 group-hover:scale-100 ${isSelected ? 'bg-blue-500 text-white' : 'bg-white/10 backdrop-blur-md text-white'}`}>
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute top-2 left-2 bg-zinc-950/40 backdrop-blur-md rounded-md px-2 py-0.5 border border-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-10 flex items-center gap-1">
                            <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase">EP</span>
                            <span className="text-[10px] font-mono font-black text-blue-400">{episode.episode_number}</span>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 pt-0.5">
                          <h4 className={`font-bold text-xs sm:text-sm truncate transition-colors ${isSelected ? 'text-blue-400' : 'text-zinc-200 group-hover:text-white'}`}>
                            {episode.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-500 font-mono mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-zinc-600" />
                              {episode.air_date ? new Date(episode.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                            </span>
                            {episode.runtime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-zinc-600" />
                                {episode.runtime}m
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 font-normal leading-normal line-clamp-2 mt-1.5">
                            {episode.overview || 'No synopsis available.'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.02, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-10 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="flex items-center justify-between mb-6 sm:mb-8 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <Users className="w-5 h-5 text-blue-500 stroke-[1.5]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Top Cast</h2>
                <span className="text-[10px] sm:text-xs text-zinc-500 font-medium tracking-wide uppercase mt-0.5">Performers</span>
              </div>
            </div>
          </div>

          <div
            ref={castContainerRef}
            className="overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory scroll-smooth relative z-10"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-4 sm:gap-6 px-1">
              {Tvdetails?.cast?.map((actor, idx) => (
                <Link
                  key={actor.id}
                  to={`/actor/${actor.id}`}
                  className="flex-shrink-0 snap-start group/card"
                >
                  <SpatialMediaCard containerRef={castContainerRef} index={idx}>
                    <div className="relative bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_12px_32px_rgba(0,0,0,0.4)] overflow-hidden w-[135px] xs:w-[155px] sm:w-[175px] md:w-[185px] transition-all duration-500 ease-[0.22,1,0.36,1] group-hover/card:-translate-y-1.5 group-hover/card:bg-white/[0.05] group-hover/card:border-white/[0.12] group-hover/card:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.6)]">
                      <div className="absolute -top-12 -left-12 w-32 h-32 bg-gradient-to-br from-blue-500/0 to-indigo-500/0 rounded-full blur-2xl opacity-0 group-hover/card:opacity-40 group-hover/card:from-blue-500/20 group-hover/card:to-cyan-400/20 transition-all duration-700 pointer-events-none" />

                      <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950">
                        {actor.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w780${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full h-full object-cover transition-all duration-700 ease-[0.25,1,0.5,1] scale-[1.01] group-hover/card:scale-105 group-hover/card:brightness-[1.05]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                            <ImageOff className="w-7 h-7 mb-1.5 stroke-[1.25] opacity-30" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">No Frame</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
                      </div>

                      <div className="px-3.5 pb-4 pt-2 flex flex-col justify-center text-center">
                        <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight line-clamp-1 group-hover/card:text-blue-500 transition-colors duration-300">
                          {actor.name}
                        </h3>

                        <div className="mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.01)] inline-block mx-auto max-w-full">
                          <p className="text-[10px] text-zinc-400 font-semibold tracking-wide line-clamp-1">
                            {actor.role || 'Character'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </SpatialMediaCard>
                </Link>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="flex items-center justify-center gap-2 mt-2 text-zinc-500 text-[10px] md:hidden font-bold uppercase tracking-widest"
          >
            <span>Swipe to explore</span>
            <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
              <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.08, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-10 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />

          <div className="flex items-center justify-between mb-6 sm:mb-8 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <Award2 className="w-5 h-5 text-amber-400 stroke-[1.5]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Crew</h2>
                <span className="text-[10px] sm:text-xs text-zinc-500 font-bold tracking-wider uppercase mt-0.5">Production Team</span>
              </div>
            </div>
          </div>

          <div
            ref={crewContainerRef}
            className="overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory scroll-smooth relative z-10"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-4 sm:gap-6 px-1">
              {(() => {
                const grouped: Record<string, any> = {};
                crew.forEach((member) => {
                  if (!grouped[member.id]) {
                    grouped[member.id] = {
                      ...member,
                      jobs: [member.job],
                    };
                  } else if (!grouped[member.id].jobs.includes(member.job)) {
                    grouped[member.id].jobs.push(member.job);
                  }
                });

                const crewArr = Object.values(grouped);

                const jobPriority = (jobs: string[]) => {
                  if (jobs.includes('Director')) return 1;
                  if (jobs.includes('Writer')) return 2;
                  if (jobs.includes('Screenplay')) return 3;
                  if (jobs.includes('Story')) return 4;
                  if (jobs.includes('Producer')) return 5;
                  return 6;
                };

                crewArr.sort((a: any, b: any) => {
                  const aPriority = jobPriority(a.jobs);
                  const bPriority = jobPriority(b.jobs);

                  if (aPriority !== bPriority) return aPriority - bPriority;
                  return a.name.localeCompare(b.name);
                });

                return crewArr.map((member: any, idx: number) => (
                  <Link
                    key={member.credit_id}
                    to={`/actor/${member.id}`}
                    className="flex-shrink-0 snap-start group/card"
                  >
                    <SpatialMediaCard containerRef={crewContainerRef} index={idx}>
                      <div className="relative bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_12px_32px_rgba(0,0,0,0.4)] overflow-hidden w-[135px] xs:w-[155px] sm:w-[175px] md:w-[185px] transition-all duration-500 ease-[0.22,1,0.36,1] group-hover/card:-translate-y-1.5 group-hover/card:bg-white/[0.05] group-hover/card:border-white/[0.12] group-hover/card:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.6)]">
                        <div className="absolute -top-12 -left-12 w-32 h-32 bg-gradient-to-br from-amber-500/0 to-orange-500/0 rounded-full blur-2xl opacity-0 group-hover/card:opacity-30 group-hover/card:from-amber-500/10 group-hover/card:to-orange-400/10 transition-all duration-700 pointer-events-none" />

                        <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950">
                          {member.profile_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w780${member.profile_path}`}
                              alt={member.name}
                              className="w-full h-full object-cover transition-all duration-700 ease-[0.25,1,0.5,1] scale-[1.01] group-hover/card:scale-105 group-hover/card:brightness-[1.05]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                              <ImageOff className="w-7 h-7 mb-1.5 stroke-[1.25] opacity-30" />
                              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">No Frame</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
                        </div>

                        <div className="px-3.5 pb-4 pt-2 flex flex-col justify-center text-center">
                          <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight line-clamp-1 group-hover/card:text-amber-300 transition-colors duration-300">
                            {member.name}
                          </h3>

                          <div className="mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.01)] inline-block mx-auto max-w-full">
                            <p className="text-[10px] text-zinc-400 font-semibold tracking-wide line-clamp-1">
                              {member.jobs.slice(0, 2).join(', ')}
                              {member.jobs.length > 2 && ` +${member.jobs.length - 2}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    </SpatialMediaCard>
                  </Link>
                ));
              })()}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="flex items-center justify-center gap-2 mt-2 text-zinc-500 text-[10px] md:hidden font-bold uppercase tracking-widest"
          >
            <span>Swipe to explore</span>
            <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
              <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">User Reviews</h2>
          </div>
          <div className="space-y-4">
            {Tvdetails && Array.isArray(Tvdetails.reviews) && Tvdetails.reviews.length > 0 ? (
              Tvdetails.reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {review.author.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white">{review.author}</h3>
                  </div>
                  <p className="text-white/70 leading-relaxed">{review.content}</p>
                </div>
              ))
            ) : (
              <p className="text-white/50 text-center py-8">No reviews available yet.</p>
            )}
          </div>
        </motion.section>

      </div>
    </div>
  );
};

export default Tvdetails;
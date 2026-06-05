import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Star, Calendar, TvMinimalPlay, Clock, ImageOff, Bookmark, BookmarkCheck, Check, Plus, Loader2, Play, Globe, Users, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { collection, addDoc, getDocs, query, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
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
}

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
      posterPath: Tvdetails!.poster_path,
      first_air_date: Tvdetails!.first_air_date,
      genres: Tvdetails!.genres.map((genre) => genre.name),
      mediaType: 'tv',
      rating: Tvdetails!.vote_average,
    };

    const { isWatched, loading: watchedLoading, toggleWatched } = useWatchedStatus(movieData.movieId, movieData.mediaType);
    const [showWatchedToast, setShowWatchedToast] = useState(false);
    const [watchedToastMessage, setWatchedToastMessage] = useState('');

    const handleClick = async () => {
      const result = await toggleWatched(movieData);

      if (result.success) {
        const message = isWatched
          ? `Removed ${movieData.title || movieData.name} from watch history`
          : `Added ${movieData.title || movieData.name} to watch history`;
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

          // Easter Egg: Blue Confetti Burst for Watchlist
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

      {/* Hero Section - Modern Redesign */}
      <div className="relative min-h-[70vh] md:min-h-[85vh] flex items-end">
        {/* Dynamic Background with gradient overlays */}
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
          {/* Multi-layered gradient overlays for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-transparent to-black/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
          {/* Animated noise texture overlay for modern feel */}
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
            {/* Professional poster frame */}
            <div className="w-full md:w-auto flex-shrink-0 flex justify-center md:justify-start md:-mt-20 md:mr-8 order-1 md:order-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="relative"
              >
                {/* Refined elegant frame */}
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

            {/* Content section */}
            <div className="flex-1 flex flex-col justify-end w-full text-center md:text-left order-2 md:order-none">
              {/* Minimal glassmorphic badges */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="flex flex-wrap justify-center md:justify-start items-center gap-2 md:gap-3 mb-4 md:mb-6"
              >
                {/* Rating badge - Glassmorphic */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-white font-semibold text-sm sm:text-base">{showRating}</span>
                </div>

                {/* First Air Date badge - Glassmorphic */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                  <Calendar className="w-4 h-4 text-green-600" />
                  <span className="text-white/80 font-medium text-sm">
                    {showFirstAirDate}
                  </span>
                </div>
              </motion.div>

              {/* Title with enhanced typography */}
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

              {/* Genre chips - minimal glassmorphic */}
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

              {/* Action buttons */}
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

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-8 md:space-y-12">
        {/* Synopsis Section - Modern Glassmorphic */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/10"
        >
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-white">Synopsis</h2>
          <p className="text-base md:text-lg text-white/70 leading-relaxed">{Tvdetails?.overview}</p>
        </motion.section>

        {/* Player Section - Modern Glassmorphic */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          ref={playerRef}
          className="bg-white/5 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TvMinimalPlay className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">
              {selectedEpisode !== null ? `Watch Season ${selectedSeason} Episode ${selectedEpisode}` : 'Watch All Seasons'}
            </h2>
          </div>
          <div className="rounded-xl overflow-hidden ring-1 ring-white/10">
            <div className="w-full" style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={
                  selectedEpisode !== null
                    ? `https://www.vidking.net/embed/tv/${showId}/${selectedSeason}/${selectedEpisode}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`
                    : (() => {
                      const latestSeason = Tvdetails?.seasons[Tvdetails.seasons.length - 1];
                      return `https://www.vidking.net/embed/tv/${showId}/${latestSeason?.season_number}/${latestSeason?.episode_count}?color=e50914&nextEpisode=true&episodeSelector=true`;
                    })()
                }
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                allow="fullscreen; picture-in-picture; autoplay; orientation-lock"
                title="TV Show Embed"
                className="absolute top-0 left-0 w-full h-full"
                ref={el => {
                  if (el && typeof window !== "undefined") {
                    const handleFs = () => {
                      const orientation: any =
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
          </div>
        </motion.section>

        {/* Seasons & Episodes Section - Modern Glassmorphic */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <TvMinimalPlay className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Seasons</h2>
          </div>
          <p className="text-xs md:text-sm text-white/50 mb-4 md:mb-6">
            {selectedSeason !== null
              ? `Season ${selectedSeason} • ${Tvdetails?.seasons.find(s => s.season_number === selectedSeason)?.episode_count || 0} Episodes`
              : 'Select a season to view episodes'}
          </p>

          <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent snap-x">
            {Tvdetails?.seasons.map((season) => (
              <button
                key={season.season_number}
                onClick={() => {
                  setSelectedSeason(season.season_number);
                  setSelectedEpisode(null);
                }}
                className={`snap-start px-4 py-2 rounded-full font-medium flex-shrink-0 flex items-center gap-2 transition-all duration-300 border text-sm
                  ${selectedSeason === season.season_number
                    ? 'bg-gradient-to-r from-orange-600 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/20'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/10'
                  }`}
              >
                <span>Season {season.season_number}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${selectedSeason === season.season_number ? 'bg-black/20 text-white/80' : 'bg-white/10 text-white/40'}`}>
                  {season.episode_count}
                </span>
              </button>
            ))}
          </div>

          {selectedSeason !== null && (
            <div>
              {episodesLoading && (
                <div className="flex items-center justify-center py-8 md:py-16">
                  <Loader2 className="w-6 h-6 md:w-8 md:h-8 text-orange-500 animate-spin" />
                </div>
              )}
              {episodesError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-center text-sm">
                  {episodesError}
                </div>
              )}
              {!episodesLoading && !episodesError && episodes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {episodes.map((episode) => (
                    <div
                      key={episode.id}
                      className={`group relative flex items-center gap-4 rounded-xl overflow-hidden cursor-pointer border transition-all duration-300
                        ${selectedEpisode === episode.episode_number
                          ? 'ring-2 ring-orange-500 bg-white/10'
                          : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                        }`}
                      onClick={() => setSelectedEpisode(episode.episode_number)}
                    >
                      {/* Thumbnail + Episode Number */}
                      <div className="relative w-28 sm:w-32 md:w-40 flex-shrink-0 aspect-video overflow-hidden">
                        {episode.still_url ? (
                          <img
                            src={episode.still_url}
                            alt={episode.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-600">
                            <ImageOff className="w-8 h-8" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
                          <span className="text-sm font-bold text-white">{episode.episode_number}</span>
                        </div>
                      </div>

                      {/* Episode Details */}
                      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center">
                        <h4 className="font-semibold text-sm text-white/90 truncate">
                          {episode.name}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-white/50 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {episode.air_date ? new Date(episode.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                          </span>
                          {episode.runtime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-blue-400" />
                              {episode.runtime}m
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/50 line-clamp-2 mt-2">
                          {episode.overview || 'No synopsis available.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.section>

        {/* Show Info & Cast Grid - Modern Glassmorphic */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Show Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="lg:col-span-1"
          >
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 h-full">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                <Globe className="w-5 h-5 text-blue-400" />
                Show Info
              </h3>
              <dl className="space-y-5">
                <div className="pb-4 border-b border-white/10">
                  <dt className="text-white/50 text-sm font-medium mb-2">Language</dt>
                  <dd className="text-white font-semibold">{showLanguage}</dd>
                </div>
                <div className="pb-4 border-b border-white/10">
                  <dt className="text-white/50 text-sm font-medium mb-2">First Air Date</dt>
                  <dd className="flex items-center gap-2 text-white font-semibold">
                    <Calendar className="w-4 h-4 text-green-400" />
                    {showFirstAirDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/50 text-sm font-medium mb-2">Created By</dt>
                  <dd className="text-white font-semibold">
                    {creators.length > 0 ? creators.map(c => c.name).join(', ') : 'Unknown'}
                  </dd>
                </div>
              </dl>
            </div>
          </motion.div>

          {/* Cast Section - Modern Glassmorphic */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 1.0 }}
            className="lg:col-span-2"
          >
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/10 h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white">Top Cast</h2>
              </div>
              <div className="overflow-x-auto pb-2 custom-scrollbar">
                <div className="flex gap-4 md:gap-5">
                  {Tvdetails?.cast?.map((actor, idx) => (
                    <Link key={actor.id} to={`/actor/${actor.id}`} className="flex-shrink-0 group">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 + idx * 0.05 }}
                        className="relative bg-gradient-to-b from-gray-800/40 to-gray-900/60 hover:from-gray-700/50 hover:to-gray-800/70 transition-all duration-300 rounded-2xl border border-white/5 hover:border-white/10 shadow-xl hover:shadow-2xl overflow-hidden w-36 sm:w-44"
                      >
                        {/* Image container with aspect ratio */}
                        <div className="relative aspect-[3/4] overflow-hidden">
                          {actor.profile_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w500${actor.profile_path}`}
                              alt={actor.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-b from-zinc-900 to-black flex flex-col items-center justify-center text-gray-500">
                              <ImageOff className="w-10 h-10 sm:w-12 sm:h-12 mb-2 opacity-50" />
                              <span className="text-xs text-center px-2">No Photo</span>
                            </div>
                          )}

                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
                        </div>

                        {/* Info */}
                        <div className="relative p-4 bg-gradient-to-b from-transparent to-black/80">
                          <h3 className="font-bold text-sm sm:text-base text-white mb-1 line-clamp-2 group-hover:text-blue-300 transition-colors duration-300">
                            {actor.name}
                          </h3>
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                            {actor.role || 'Unknown Role'}
                          </p>
                        </div>

                        {/* Hover border glow */}
                        <div className="absolute inset-0 border-2 border-blue-500/0 group-hover:border-blue-500/20 rounded-2xl transition-all duration-300 pointer-events-none" />
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Swipe hint for mobile */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 1.2 }}
                className="flex items-center justify-center gap-2 mt-4 text-gray-500 text-xs md:hidden"
              >
                <span>Swipe to explore</span>
                <div className="w-5 h-5 border-2 border-gray-600 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Reviews Section - Modern Glassmorphic */}
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

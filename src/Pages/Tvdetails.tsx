import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Star, Calendar, TvMinimalPlay, Clock, ImageOff, Bookmark, BookmarkCheck, Check, Plus, Loader2, Play, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { collection, addDoc, getDocs, query, deleteDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import Toast from '../components/Toast.tsx';
import Loading from '../components/Loading.tsx';
import { useWatchedStatus, WatchedItemData } from './History.tsx';

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

      {/* Hero Section */}
      <div className="relative h-[50vh] md:h-[75vh] flex items-end">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              window.innerWidth >= 768
                ? Tvdetails?.images && Array.isArray(Tvdetails.images) && Tvdetails.images.length > 0
                  ? `url(https://image.tmdb.org/t/p/original/${Tvdetails.images[Math.floor(Math.random() * Tvdetails.images.length)].file_path})`
                  : `url(${posterImageUrl})`
                : `url(${posterImageUrl})`,
            filter: window.innerWidth >= 768 ? 'blur(2px) brightness(0.7)' : 'none'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/60" />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-3 md:px-8 pb-6 md:pb-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="flex flex-col md:flex-row items-center md:items-end gap-3 md:gap-10 bg-white/10 backdrop-blur-xl rounded-2xl md:rounded-3xl border-2 border-transparent bg-clip-padding shadow-2xl p-3 md:p-10"
            style={{
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.45)'
            }}
          >
            <div className="hidden md:block">
              <div className="flex-shrink-0 flex items-center justify-center w-auto md:-mt-32 md:w-auto md:mr-6 mb-0 md:mb-0">
                {Tvdetails?.poster_path ? (
                  <motion.img
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                    src={posterThumbnailUrl}
                    alt={Tvdetails?.name}
                    className="w-16 h-24 md:w-48 md:h-72 lg:w-56 lg:h-80 object-cover rounded-xl md:rounded-2xl shadow-2xl border-2 md:border-4 border-white/30"
                    style={{ boxShadow: '0 6px 32px 0 rgba(0,0,0,0.55)' }}
                  />
                ) : (
                  <div className="w-16 h-24 md:w-48 md:h-72 lg:w-56 lg:h-80 bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center text-gray-400 rounded-xl md:rounded-2xl shadow-2xl border-2 md:border-4 border-white/30">
                    <ImageOff className="w-6 h-6 md:w-10 md:h-12 mb-1 md:mb-2 opacity-60" />
                    <span className="text-xs md:text-sm text-center px-2 md:px-4">No Image</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-end w-full px-2 md:px-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="flex flex-wrap items-center gap-1 md:gap-3 mb-1 md:mb-4"
              >
                <div className="flex items-center gap-1 bg-black/70 px-2 md:px-3 py-1 rounded-full border border-white/20 shadow">
                  <Star className="w-3 h-3 md:w-4 md:h-4 text-yellow-400 fill-current" />
                  <span className="text-white font-bold text-xs md:text-sm">{showRating}</span>
                </div>
                <div className="flex items-center gap-1 bg-black/70 px-2 md:px-3 py-1 rounded-full border border-white/20 shadow">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
                  <span className="text-gray-200 text-xs md:text-sm">{showFirstAirDate}</span>
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="text-xl md:text-3xl lg:text-5xl font-extrabold mb-2 md:mb-5 leading-tight drop-shadow-lg"
              >
                {Tvdetails?.name}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-1 md:gap-2 mb-3 md:mb-5"
              >
                {Tvdetails?.genres?.map((genre) => (
                  <span
                    key={genre.id}
                    className="px-2 py-0.5 bg-zinc-900/80 rounded-full text-xs border border-zinc-700/50 shadow"
                  >
                    {genre.name}
                  </span>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="flex flex-col xs:flex-row gap-2 xs:gap-3 w-full"
              >
                <WatchedButtonInline />
                <button
                  onClick={handleWatchlistToggle}
                  className={`flex items-center gap-2 px-3 py-2 sm:px-6 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[44px] shadow-lg ${isInWatchlist
                    ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-green-500/25'
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-blue-500/25'
                    }`}
                >
                  {isInWatchlist ? (
                    <BookmarkCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                  ) : (
                    <Bookmark className="w-3 h-3 sm:w-4 sm:h-4" />
                  )}
                  <span className="hidden xs:inline sm:inline">
                    {isInWatchlist ? 'Saved' : 'Watch Later'}
                  </span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-3 md:px-4 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* Synopsis Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
        >
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Synopsis</h2>
          <p className="text-base md:text-lg text-gray-300 leading-relaxed">{Tvdetails?.overview}</p>
        </motion.section>

        {/* Player Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          ref={playerRef}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <TvMinimalPlay className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
            <h2 className="text-xl md:text-2xl font-bold">
              {selectedEpisode !== null ? `Watch Season ${selectedSeason} Episode ${selectedEpisode}` : 'Watch All Seasons'}
            </h2>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-2xl border-4 border-zinc-900/80">
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
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                  borderRadius: "1rem",
                  background: "#000"
                }}
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

        {/* Seasons & Episodes Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-4 md:p-8 border border-gray-700/50 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <div>
              <h2 className="text-lg md:text-2xl font-extrabold tracking-tight text-white/90 mb-1">Seasons</h2>
              <p className="text-xs md:text-sm text-zinc-400">
                {selectedSeason !== null
                  ? `Season ${selectedSeason} • ${Tvdetails?.seasons.find(s => s.season_number === selectedSeason)?.episode_count || 0} Episodes`
                  : 'Select a season to view episodes'}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5 md:gap-2 mb-4 md:mb-8 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent snap-x">
            {Tvdetails?.seasons.map((season) => (
              <button
                key={season.season_number}
                onClick={() => {
                  setSelectedSeason(season.season_number);
                  setSelectedEpisode(null);
                }}
                className={`snap-start px-3 md:px-5 py-1.5 md:py-2.5 rounded-full font-medium flex-shrink-0 flex items-center gap-1 md:gap-2 transition-all duration-300 border text-xs md:text-sm
                  ${selectedSeason === season.season_number
                    ? 'bg-gradient-to-r from-red-600 to-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/20 scale-105'
                    : 'bg-zinc-900/40 text-zinc-400 hover:text-white hover:bg-zinc-800/60 border-transparent'
                  }`}
              >
                <span>Season {season.season_number}</span>
                <span className={`text-[10px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-full ${selectedSeason === season.season_number ? 'bg-black/10 text-black/70' : 'bg-zinc-800 text-zinc-500'}`}>
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
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 md:p-4 text-red-400 text-center text-sm">
                  {episodesError}
                </div>
              )}
              {!episodesLoading && !episodesError && episodes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 lg:gap-6">
                  {episodes.map((episode) => (
                    <div
                      key={episode.id}
                      className={`group relative flex items-center gap-3 md:gap-4 rounded-xl overflow-hidden shadow-lg cursor-pointer border transition-all duration-300
                        ${selectedEpisode === episode.episode_number
                          ? 'ring-2 ring-orange-500 bg-zinc-800/80 scale-[1.02] shadow-orange-500/20'
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80'
                        }`}
                      onClick={() => setSelectedEpisode(episode.episode_number)}
                    >
                      {/* Thumbnail + Episode Number */}
                      <div className="relative w-20 sm:w-28 md:w-40 flex-shrink-0 aspect-video overflow-hidden">
                        {episode.still_url ? (
                          <img
                            src={episode.still_url}
                            alt={episode.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-800 flex flex-col items-center justify-center text-zinc-500">
                            <ImageOff className="w-4 h-4 sm:w-6 sm:h-6 md:w-8 md:h-8 opacity-50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Play className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                        <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm rounded-sm px-1.5 py-0.5">
                          <span className="text-[9px] sm:text-sm md:text-base font-bold text-white">{episode.episode_number}</span>
                        </div>
                      </div>

                      {/* Episode Details */}
                      <div className="flex-1 min-w-0 p-2 md:p-3 flex flex-col justify-center">
                        <h4 className="font-semibold text-xs sm:text-sm md:text-base text-white/90 truncate">
                          {episode.name}
                        </h4>
                        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 text-[10px] sm:text-xs md:text-sm text-zinc-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                            {episode.air_date ? new Date(episode.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                          </span>
                          {episode.runtime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 md:w-4 md:h-4 text-blue-400" />
                              {episode.runtime}m
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs md:text-sm text-zinc-400 line-clamp-2 mt-1.5 hidden sm:block">
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

        {/* Show Info & Cast Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* Show Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="lg:col-span-1"
          >
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-gray-700/50 shadow-xl">
              <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 flex items-center gap-2">
                <Globe className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                Show Info
              </h3>
              <dl className="space-y-3 md:space-y-4">
                <div className="border-b border-gray-700/30 pb-2 md:pb-3">
                  <dt className="text-gray-400 text-xs md:text-sm font-medium mb-1">Language</dt>
                  <dd className="text-white font-medium text-sm md:text-base">{showLanguage}</dd>
                </div>
                <div className="border-b border-gray-700/30 pb-2 md:pb-3">
                  <dt className="text-gray-400 text-xs md:text-sm font-medium mb-1">First Air Date</dt>
                  <dd className="flex items-center gap-2 text-white font-medium text-sm md:text-base">
                    <Calendar className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
                    {showFirstAirDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs md:text-sm font-medium mb-1">Created By</dt>
                  <dd className="text-white font-medium text-sm md:text-base">
                    {creators.length > 0 ? creators.map(c => c.name).join(', ') : 'Unknown'}
                  </dd>
                </div>
              </dl>
            </div>
          </motion.div>

          {/* Cast Section - spanning 2 columns */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 1.0 }}
            className="lg:col-span-2"
          >
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-4 md:p-8 border border-gray-700/50 shadow-xl h-full">
              <h2 className="text-lg md:text-2xl font-bold mb-4 md:mb-6 text-gray-200">Cast</h2>
              <div className="overflow-x-auto">
                <div className="flex gap-3 md:gap-6 pb-4">
                  {Tvdetails?.cast?.map((actor) => (
                    <Link key={actor.id} to={`/actor/${actor.id}`} className="flex-shrink-0">
                      <div className="bg-gradient-to-b from-gray-700/50 to-gray-800/50 hover:from-gray-600/50 hover:to-gray-700/50 transition-all duration-300 rounded-xl shadow-lg overflow-hidden group w-24 md:w-40 border border-gray-600/30">
                        {actor.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w500${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full h-32 md:h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-32 md:h-48 bg-zinc-800 flex flex-col items-center justify-center text-gray-400">
                            <ImageOff className="w-6 h-6 md:w-8 md:h-12 mb-1 md:mb-2" />
                            <span className="text-xs text-center px-2">No Image</span>
                          </div>
                        )}
                        <div className="p-2 md:p-4 text-center">
                          <h3 className="font-bold text-xs md:text-sm text-gray-200 group-hover:text-yellow-400 transition-colors duration-300 mb-1 line-clamp-2">
                            {actor.name}
                          </h3>
                          <p className="text-xs text-gray-400 line-clamp-2 hidden md:block">{actor.role}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Reviews Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-4 md:p-8 border border-gray-700/50 shadow-xl"
        >
          <h2 className="text-lg md:text-2xl font-bold mb-4 md:mb-6 text-gray-200">User Reviews</h2>
          <div className="space-y-3 md:space-y-4">
            {Tvdetails && Array.isArray(Tvdetails.reviews) && Tvdetails.reviews.length > 0 ? (
              Tvdetails.reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-gradient-to-br from-gray-700/30 to-gray-800/30 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-gray-600/30"
                >
                  <h3 className="font-semibold text-sm md:text-lg text-gray-200 mb-1 md:mb-2">{review.author}</h3>
                  <p className="text-gray-300 text-sm md:text-base leading-relaxed">{review.content}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-6 md:py-8 text-sm md:text-base">No reviews available yet.</p>
            )}
          </div>
        </motion.section>

      </div>
    </div>
  );
};

export default Tvdetails;
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Star, Calendar, TvMinimalIcon, Clock, ImageOff, Bookmark, BookmarkCheck, Check, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { collection, addDoc, getDocs, query, deleteDoc } from 'firebase/firestore';
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
          className={`flex items-center gap-2 px-6 py-2 sm:px-8 sm:py-3 rounded-lg font-semibold transition-all duration-200 ${isWatched
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-zinc-700 hover:bg-zinc-600 text-gray-300 hover:text-white'
            } ${watchedLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'}`}
        >
          {watchedLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isWatched ? (
            <Check className="w-5 h-5" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          <span>
            {watchedLoading ? 'Loading...' : isWatched ? 'Watched' : 'Mark as Watched'}
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

  if (loading) return <Loading />
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-black min-h-screen text-white">
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
      <div className="relative h-[60vh] md:h-[75vh] flex items-end">
        <div
          className="absolute inset-0 bg-cover bg-center md:filter-blur"
          style={{
            backgroundImage:
              window.innerWidth >= 768 && Tvdetails?.images && Array.isArray(Tvdetails.images) && Tvdetails.images.length > 0
                ? `url(https://image.tmdb.org/t/p/original/${Tvdetails.images[Math.floor(Math.random() * Tvdetails.images.length)].file_path})`
                : `url(https://image.tmdb.org/t/p/original/${Tvdetails?.poster_path})`,
            filter: 'blur(0px) brightness(1)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent hidden md:block" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/60 hidden md:block" />
        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 md:px-8 pb-8">
          <div
            className="flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-10 md:bg-white/10 backdrop-blur-xl rounded-3xl border-2 border-transparent bg-clip-padding shadow-2xl p-3 xs:p-4 md:p-10"
            style={{
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.45)'
            }}
          >
            <div className="hidden md:block">
              <div className="flex-shrink-0 flex items-center justify-center w-auto md:-mt-32 md:w-auto md:mr-6 mb-3 md:mb-0 mt-16 xs:mt-20 sm:mt-24 md:mt-0">
                <img
                  src={`https://image.tmdb.org/t/p/w500/${Tvdetails?.poster_path}`}
                  alt={Tvdetails?.name}
                  className="w-20 h-28 xs:w-24 xs:h-32 sm:w-28 sm:h-40 md:w-48 md:h-72 lg:w-56 lg:h-80 object-cover rounded-2xl shadow-2xl border-4 border-white/30"
                  style={{ boxShadow: '0 6px 32px 0 rgba(0,0,0,0.55)' }}
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-end w-full">
              <div className="flex flex-wrap items-center gap-1.5 xs:gap-2 sm:gap-3 mb-2 xs:mb-4">
                <div className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full border border-white/20 shadow">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-white font-bold text-sm">{Tvdetails?.vote_average}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full border border-white/20 shadow">
                  <Calendar className="w-4 h-4 text-green-400" />
                  <span className="text-gray-200 text-sm">{Tvdetails?.first_air_date}</span>
                </div>
              </div>

              <h1 className="text-2xl xs:text-3xl md:text-5xl lg:text-6xl font-extrabold mb-2 xs:mb-3 md:mb-5 leading-tight drop-shadow-lg md:text-left">
                {Tvdetails?.name}
              </h1>

              <div className="flex flex-wrap gap-1 xs:gap-2 mb-3 xs:mb-5 md:justify-start">
                {Tvdetails?.genres.map((g) => (
                  <span
                    key={g.id}
                    className="px-2 py-0.5 xs:px-3 xs:py-1 bg-zinc-900/80 rounded-full text-xs sm:text-sm border border-zinc-700/50 shadow"
                  >
                    {g.name}
                  </span>
                ))}
              </div>

              <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 sm:gap-4 w-full">
                <div className="w-full xs:w-auto">
                  <WatchedButtonInline />
                </div>
                <button
                  onClick={handleWatchlistToggle}
                  className={`w-full xs:w-auto flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[44px] shadow-lg ${isInWatchlist
                    ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-green-500/25'
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-blue-500/25'
                    }`}
                >
                  {isInWatchlist ? (
                    <BookmarkCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span className="hidden xs:inline sm:inline">
                    {isInWatchlist ? 'Saved to Watchlist' : 'Add to Watchlist'}
                  </span>
                  <span className="xs:hidden sm:hidden">
                    {isInWatchlist ? 'Saved' : 'Watch Later'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-12 px-4 my-4" ref={playerRef}>
        <h2 className="text-2xl font-bold mb-2">Synopsis</h2>
        <p className="text-gray-300 mb-8 max-w-3xl">{Tvdetails?.overview}</p>
        <div className="flex items-center gap-2 mb-4">
          <TvMinimalIcon className="w-8 h-8 text-red-600" />
          <h2 className="text-2xl font-bold">
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
      </section>

      <section className="mb-16 px-4">
        <h2 className="text-3xl font-extrabold mb-8 tracking-tight text-white/90">Seasons</h2>
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          {Tvdetails?.seasons.map((season) => (
            <button
              key={season.season_number}
              onClick={() => {
                setSelectedSeason(season.season_number);
                setSelectedEpisode(null);
              }}
              className={`min-w-[160px] px-6 py-2 rounded-2xl font-semibold flex-shrink-0 flex flex-col items-center shadow-lg border-2
          ${selectedSeason === season.season_number
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 border-orange-400 scale-105 text-white'
                  : 'bg-zinc-900/70 hover:bg-zinc-800/90 border-zinc-700 text-zinc-200 hover:shadow-lg'
                }`}
              style={{ backdropFilter: 'blur(6px)' }}
            >
              <span className="font-bold text-lg mb-1">Season {season.season_number}</span>
              <span className="text-xs text-white/70">{season.episode_count} Episodes</span>
            </button>
          ))}
        </div>
        {selectedSeason !== null && (
          <div>
            {episodesLoading && <p className="text-gray-400">Loading episodes...</p>}
            {episodesError && <p className="text-red-500">{episodesError}</p>}
            {!episodesLoading && !episodesError && episodes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-7">
                {episodes.map((episode) => (
                  <div
                    key={episode.id}
                    className={`group bg-gradient-to-br from-zinc-900/80 to-zinc-800/60 rounded-3xl overflow-hidden shadow-xl p-0 cursor-pointer border-2 border-zinc-800 hover:border-orange-500 transition-all duration-200
                ${selectedEpisode === episode.episode_number ? 'ring-2 ring-orange-500 scale-105' : ''}
              `}
                    onClick={() => setSelectedEpisode(episode.episode_number)}
                    style={{ backdropFilter: 'blur(8px)' }}
                  >
                    <div className="relative h-44 md:h-48 w-full overflow-hidden">
                      {episode.still_url ? (
                        <img
                          src={episode.still_url}
                          alt={episode.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex flex-col items-center justify-center text-gray-400">
                          <ImageOff className="w-12 h-12 mb-2" />
                          <span className="text-sm text-center">No Image Available</span>
                        </div>
                      )}
                      {episode.runtime && (
                        <div className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-1 flex items-center text-xs text-white shadow">
                          <Clock className="w-4 h-4 text-blue-400 mr-1" />
                          {episode.runtime}m
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-base mb-1 flex items-center">
                        <span className="text-red-600 mr-2">{episode.episode_number}</span>
                        <span className="truncate">{episode.name}</span>
                      </h4>
                      <p className="text-xs text-gray-400 mb-1">Air Date: {episode.air_date || 'N/A'}</p>
                      <p className="mt-1 text-sm text-gray-300 line-clamp-3">
                        {episode.overview ? (episode.overview.length > 120 ? episode.overview.slice(0, 120) + '...' : episode.overview) : 'No synopsis available.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mb-12 px-4">
        <h2 className="text-3xl font-bold mb-6 text-gray-200">Cast</h2>
        <div className="overflow-x-auto">
          <ul className="flex gap-3 sm:gap-4 md:gap-6 lg:gap-8 pb-2">
            {Tvdetails?.cast?.map((actor) => (
              <li key={actor.id} className="flex-shrink-0">
                <Link to={`/actor/${actor.id}`}>
                  <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-800/60 hover:from-orange-500 hover:to-red-600 transition-all duration-300 rounded-xl sm:rounded-2xl shadow-lg overflow-hidden group w-28 sm:w-44">
                    <img
                      src={
                        actor.profile_path
                          ? `https://image.tmdb.org/t/p/w500${actor.profile_path}`
                          : "/path/to/default-image.jpg"
                      }
                      alt={actor.name}
                      className="w-full h-36 sm:h-56 object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="p-2 sm:p-4 text-center">
                      <h3 className="font-bold text-xs sm:text-base text-gray-200 group-hover:text-yellow-400">
                        {actor.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-400 mt-1">{actor.role}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-12 px-4">
        <h2 className="text-2xl font-bold mb-4">Short Reviews</h2>
        <div className="space-y-6">
          {Tvdetails?.reviews.map((review) => (
            <div key={review.id} className="bg-gradient-to-br from-zinc-900/80 to-zinc-800/60 backdrop-blur-sm p-6 rounded-2xl shadow">
              <h3 className="font-semibold text-lg">{review.author}</h3>
              <p className="text-gray-300 mt-2">{review.content}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Tvdetails;
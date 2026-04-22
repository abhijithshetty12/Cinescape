import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Youtube, Instagram, Star, Twitter, Heart, HeartOff, ImageOff, ChartNoAxesCombined } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Toast from "../components/Toast.tsx";
import Loading from "../components/Loading.tsx";
import { AuthContext } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore'; // Import Firestore functions

const Actordetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [actor, setActor] = useState<any>(null);
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteDocId, setFavoriteDocId] = useState<string | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({ message: '', type: 'success', isVisible: false });
  const sortedMovies = movies.sort((a, b) => b.release_date.localeCompare(a.release_date));

  const tmdbAPIKey = "859afbb4b98e3b467da9c99ac390e950";

  useEffect(() => {
    const fetchActorData = async () => {
      try {
        const actorRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}?api_key=${tmdbAPIKey}&language=en-US`
        );
        setActor(actorRes.data);

        const moviesRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}/movie_credits?api_key=${tmdbAPIKey}&language=en-US`
        );
        setMovies(moviesRes.data.cast);

        if (moviesRes.data.cast.length > 0) {
          const latestMovie = moviesRes.data.cast.sort((a: any, b: any) => b.popularity - a.popularity)[0];
          const videoRes = await axios.get(
            `https://api.themoviedb.org/3/movie/${latestMovie.id}/videos?api_key=${tmdbAPIKey}&language=en-US`
          );
          const trailer = videoRes.data.results.find((video: any) => video.type === 'Trailer' && video.site === 'YouTube');
          if (trailer) {
            setTrailerKey(trailer.key);
          }
        }

        const socialRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}/external_ids?api_key=${tmdbAPIKey}`
        );
        setActor((prevActor: any) => ({
          ...prevActor,
          ...socialRes.data,
        }));

        if (user?.uid && actorRes.data.id) {
          const favRef = collection(db, `users/${user.uid}/favouriteActors`);
          const favQuery = query(favRef, where("actorId", "==", actorRes.data.id));
          const favSnap = await getDocs(favQuery);
          if (!favSnap.empty) {
            setIsFavorite(true);
            setFavoriteDocId(favSnap.docs[0].id);
          } else {
            setIsFavorite(false);
            setFavoriteDocId(null);
          }
        }
      } catch (err: any) {
        console.error("Error fetching actor data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActorData();
  }, [id]);

  const handleFavoriteToggle = async () => {
    if (!actor || !user) return;

    try {
      const favoritesRef = collection(db, `users/${user.uid}/favouriteActors`);
      if (isFavorite && favoriteDocId) {
        const { doc } = await import('firebase/firestore');
        const docRef = doc(db, `users/${user.uid}/favouriteActors/${favoriteDocId}`);
        await deleteDoc(docRef);
        setIsFavorite(false);
        setFavoriteDocId(null);
        setToast({ message: `${actor.name} removed from favorites.`, type: 'info', isVisible: true });
      } else {
        const actorData = {
          actorId: actor.id,
          name: actor.name,
          profile_path: actor.profile_path,
        };
        const docRef = await addDoc(favoritesRef, actorData);
        setIsFavorite(true);
        setFavoriteDocId(docRef.id);
        setToast({ message: `${actor.name} added to favorites.`, type: 'success', isVisible: true });
      }
    } catch (error) {
      console.error("Error toggling favorite actor:", error);
      setToast({ message: "Failed to update favorites.", type: 'error', isVisible: true });
    }
  };

  if (loading) {
    return <Loading />;
  }

  const trendingMovie = [...movies]
    .filter((movie) => movie.backdrop_path || movie.poster_path)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];

  const backgroundImageUrl = trendingMovie
    ? `url(https://image.tmdb.org/t/p/original${trendingMovie.backdrop_path || trendingMovie.poster_path})`
    : '';
  const actorImageUrl = `https://image.tmdb.org/t/p/w500${actor?.profile_path ?? ''}`;
  const actorName = actor?.name ?? 'Unknown Actor';
  const actorPopularity = actor?.popularity ?? 0;
  const formattedPopularity = actorPopularity.toFixed(1);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl">
      <div className="relative h-[350px] sm:h-[400px] md:h-[500px] mb-6 md:mb-8 lg:mb-12 rounded-xl md:rounded-2xl overflow-hidden shadow-xl md:shadow-2xl">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-105"
          style={{ backgroundImage: backgroundImageUrl }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 md:via-black/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40 md:from-black/50 md:to-black/30" />
        </div>

        <div className="relative h-full flex flex-col sm:flex-row items-center sm:items-end justify-center sm:justify-start p-4 sm:p-6 md:p-8">
          <div className="flex-shrink-0 mb-4 sm:mb-6 md:mb-0">
            <div className="w-32 h-40 sm:w-40 sm:h-52 md:w-48 md:h-64 lg:w-56 lg:h-72 rounded-xl md:rounded-2xl overflow-hidden shadow-lg md:shadow-xl border-2 md:border-4 border-white/20 backdrop-blur-sm">
              {actor?.profile_path ? (
                <img
                  src={actorImageUrl}
                  alt={`${actorName} profile`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center text-gray-400">
                  <ImageOff className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 mb-2 md:mb-3 opacity-60" />
                  <span className="text-xs sm:text-sm text-center px-2 md:px-4">No Image Available</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left sm:ml-4 md:ml-6 lg:ml-8 text-white max-w-full">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-5xl xl:text-6xl font-bold mb-2 sm:mb-3 md:mb-4 leading-tight break-words">
              {actorName}
            </h1>

            <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-4 mb-4 sm:mb-5 md:mb-6 text-sm sm:text-base md:text-lg lg:text-xl">
              <div className="flex items-center gap-1.5 sm:gap-2 bg-white/10 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                <ChartNoAxesCombined className="w-5 h-5 sm:w-7 sm:h-7 text-amber-400 flex-shrink-0" />
                <span className="font-semibold whitespace-nowrap">{formattedPopularity}</span>
                <span className="text-white/80 hidden sm:inline">Popularity</span>
                <span className="text-white/80 sm:hidden text-xs">Pop</span>
              </div>
            </div>

            <button
              onClick={handleFavoriteToggle}
              className={`group relative px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 rounded-full font-medium sm:font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[44px] min-w-[44px] ${isFavorite
                ? "bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg shadow-red-500/25"
                : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25"
                }`}
              aria-label={isFavorite ? `Remove ${actorName} from favorites` : `Add ${actorName} to favorites`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                {isFavorite ? (
                  <>
                    <HeartOff className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110 flex-shrink-0" />
                    <span className="hidden xs:inline sm:inline">Remove from Favorites</span>
                    <span className="xs:hidden sm:hidden">Remove</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110 flex-shrink-0" />
                    <span className="hidden xs:inline sm:inline">Add to Favorites</span>
                    <span className="xs:hidden sm:hidden">Add</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl">
            <h2 className="text-xl font-bold mb-6 text-white">Personal Info</h2>
            <dl className="space-y-4">
              {[
                { label: 'Born', value: actor?.birthday ?? 'N/A' },
                { label: 'Place of Birth', value: actor?.place_of_birth ?? 'N/A' },
                { label: 'Movies', value: `${movies.length} titles` }
              ].map(({ label, value }) => (
                <div key={label} className="border-b border-gray-700/30 pb-3 last:border-b-0">
                  <dt className="text-gray-400 text-sm font-medium mb-1">{label}</dt>
                  <dd className="text-white font-medium">{value}</dd>
                </div>
              ))}

              <div className="pt-2">
                <dt className="text-gray-400 text-sm font-medium mb-3">Social Media</dt>
                <div className="flex gap-3">
                  {actor?.instagram_id && (
                    <a
                      href={`https://instagram.com/${actor.instagram_id}`}
                      className="p-3 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl hover:scale-110 transition-transform duration-200 shadow-lg"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${actorName} on Instagram`}
                    >
                      <Instagram className="w-5 h-5 text-white" />
                    </a>
                  )}
                  {actor?.twitter_id && (
                    <a
                      href={`https://twitter.com/${actor.twitter_id}`}
                      className="p-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl hover:scale-110 transition-transform duration-200 shadow-lg"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${actorName} on Twitter`}
                    >
                      <Twitter className="w-5 h-5 text-white" />
                    </a>
                  )}
                  {actor?.youtube_id && (
                    <a
                      href={`https://youtube.com/${actor.youtube_id}`}
                      className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl hover:scale-110 transition-transform duration-200 shadow-lg"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${actorName} on YouTube`}
                    >
                      <Youtube className="w-5 h-5 text-white" />
                    </a>
                  )}
                </div>
              </div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-gradient-to-br from-gray-800/30 to-gray-900/30 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 shadow-xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white">Biography</h2>
            <p className="text-gray-300 text-base md:text-lg leading-relaxed">
              {actor?.biography ?? "Biography not available for this actor."}
            </p>
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center gap-3 mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Filmography</h2>
          <div className="h-px bg-gradient-to-r from-gray-600 to-transparent flex-1" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {movies.map((movie) => {
            const movieImageUrl = `https://image.tmdb.org/t/p/w300${movie.poster_path ?? ''}`;
            const movieTitle = movie.title ?? 'Untitled';
            const movieCharacter = movie.character ?? 'Unknown Role';
            const movieYear = movie.release_date?.split("-")[0] ?? 'N/A';
            const movieRating = movie.vote_average?.toFixed(1) ?? 'N/A';

            return (
              <Link key={movie.id} to={`/movie/${movie.id}`}>
                <div className="group bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700/30 hover:border-gray-600/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  <div className="relative aspect-[2/3] overflow-hidden">
                    {movie.poster_path ? (
                      <img
                        src={movieImageUrl}
                        alt={`${movieTitle} poster`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center text-gray-400">
                        <ImageOff className="w-12 h-12 mb-2 opacity-60" />
                        <span className="text-xs text-center px-2">No Image</span>
                      </div>
                    )}

                    <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-white font-bold text-xs">{movieRating}</span>
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-sm md:text-base text-white mb-1 line-clamp-2 transition-colors">
                      {movieTitle}
                    </h3>
                    <p className="text-gray-400 text-xs md:text-sm mb-1">
                      as {movieCharacter}
                    </p>
                    <p className="text-gray-500 text-xs font-medium">
                      {movieYear}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col items-center mt-12">
          <div className="w-full h-px bg-gradient-to-r from-gray-600 via-gray-700 to-transparent mb-3" />
          <span className="text-gray-400 text-sm font-medium tracking-wide">End of filmography</span>
        </div>
      </section>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
};

export default Actordetails;

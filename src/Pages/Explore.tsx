import { Star, Clapperboard, Tv } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { motion } from 'framer-motion';
import { fetchPopularMovies } from '../api.ts';
import Loading from '../components/Loading.tsx';

const genreMap: { [key: number]: string } = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

type Actor = {
  id: number;
  name: string;
};

type Movie = {
  id: number;
  title: string;
  rating: number;
  image: string;
  year: number;
  genre: string[];
  videoUrl: string;
  cast?: { name: string }[];
};

const MovieList = () => {
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search");

  const [Movies, setMovies] = useState<Movie[]>([]);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(false);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');

  const handleMediaTypeChange = (type: 'movie' | 'tv') => {
    setMediaType(type);
    setMovies([]);
    setPage(1);
  };

  useEffect(() => {
    const loadMovies = async () => {
      setInitialLoading(true);
      if (mediaType === 'movie') {
        const fetchedMovies = await fetchPopularMovies(1);
        setMovies(fetchedMovies);
      } else {
        const response = await axios.get(`https://api.themoviedb.org/3/tv/popular?api_key=859afbb4b98e3b467da9c99ac390e950&page=1`);
        const {data} = response;
        const fetchedTVShows = await Promise.all(data.results.map(async (tv: any) => {
          let videoUrl = '';
          let genres: string[] = [];

          try {
            const detailsResponse = await axios.get(`https://api.themoviedb.org/3/tv/${tv.id}?api_key=859afbb4b98e3b467da9c99ac390e950`);
            genres = detailsResponse.data.genres.map((g: { id: number; name: string }) => g.name);
          } catch (detailsError) {
            console.error('Error fetching details for tv:', tv.id, detailsError);
            genres = tv.genre_ids.map((id: number) => genreMap[id] || 'Unknown');
          }

          try {
            const videoResponse = await axios.get(`https://api.themoviedb.org/3/tv/${tv.id}/videos?api_key=859afbb4b98e3b467da9c99ac390e950&language=en-US`);
            const videos = videoResponse.data.results;
            const trailer = videos.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
            if (trailer) {
              videoUrl = `https://www.youtube.com/embed/${trailer.key}`;
            }
          } catch (videoError) {
            console.error('Error fetching video for tv:', tv.id, videoError);
          }
          return {
            id: tv.id,
            title: tv.name,
            rating: tv.vote_average,
            image: tv.poster_path ? `https://image.tmdb.org/t/p/w500${tv.poster_path}` : '',
            year: tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : 0,
            genre: genres,
            videoUrl,
            cast: [],
          };
        }));
        setMovies(fetchedTVShows);
      }
      setInitialLoading(false);
    };
    loadMovies();
  }, [mediaType]);

  const loadMoreMovies = async () => {
    setLoading(true);
    const nextPage = page + 1;
    if (mediaType === 'movie') {
      const fetchedMovies = await fetchPopularMovies(nextPage);
      setMovies(prevMovies => [...prevMovies, ...fetchedMovies]);
    } else {
      const response = await axios.get(`https://api.themoviedb.org/3/tv/popular?api_key=859afbb4b98e3b467da9c99ac390e950&page=${nextPage}`);
      const {data} = response;
      const fetchedTVShows = await Promise.all(data.results.map(async (tv: any) => {
        let videoUrl = '';
        let genres: string[] = [];

        try {
          const detailsResponse = await axios.get(`https://api.themoviedb.org/3/tv/${tv.id}?api_key=859afbb4b98e3b467da9c99ac390e950`);
          genres = detailsResponse.data.genres.map((g: { id: number; name: string }) => g.name);
        } catch (detailsError) {
          console.error('Error fetching details for tv:', tv.id, detailsError);
          genres = tv.genre_ids.map((id: number) => genreMap[id] || 'Unknown');
        }

        try {
          const videoResponse = await axios.get(`https://api.themoviedb.org/3/tv/${tv.id}/videos?api_key=859afbb4b98e3b467da9c99ac390e950&language=en-US`);
          const videos = videoResponse.data.results;
          const trailer = videos.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
          if (trailer) {
            videoUrl = `https://www.youtube.com/embed/${trailer.key}`;
          }
        } catch (videoError) {
          console.error('Error fetching video for tv:', tv.id, videoError);
        }
        return {
          id: tv.id,
          title: tv.name,
          rating: tv.vote_average,
          image: tv.poster_path ? `https://image.tmdb.org/t/p/w500${tv.poster_path}` : '',
          year: tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : 0,
          genre: genres,
          videoUrl,
          cast: [],
        };
      }));
      setMovies(prevMovies => [...prevMovies, ...fetchedTVShows]);
    }
    setPage(nextPage);
    setLoading(false);
  };



  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleMouseEnter = (index: number) => {
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  if (initialLoading) {
    return <Loading />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-2">
        <motion.h1 initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-extrabold text-white mb-4 md:mb-2"
        >
          <div className="flex items-center gap-2">
            {mediaType === 'movie' ? <Clapperboard className="w-8 h-8 text-red-700" /> : <Tv className="w-8 h-8 text-red-700" />}
            {search ? `Search Results for "${search}"` : mediaType === 'movie' ? "Popular Movies" : "Popular Series"}
          </div>
        </motion.h1>
      </div>

      <div className="hidden md:flex items-center p-1 bg-zinc-900 rounded-full w-fit">
        <div className="relative flex items-center rounded-full">
          <button
            onClick={() => handleMediaTypeChange('movie')}
            className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${mediaType === 'movie' ? 'text-white' : 'text-gray-400'
              }`}
          >
            Movies
          </button>
          <button
            onClick={() => handleMediaTypeChange('tv')}
            className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${mediaType === 'tv' ? 'text-white' : 'text-gray-400'
              }`}
          >
            Series
          </button>
          <motion.div
            className="absolute inset-0 bg-red-600 rounded-full"
            animate={{
              width: mediaType === 'movie' ? '85px' : '80px',
              x: mediaType === 'movie' ? 0 : 85,
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />
        </div>
      </div>

      <div className="md:hidden">
        <div className="inline-flex items-center gap-2 bg-zinc-900 rounded-full p-1">
          <button
            onClick={() => handleMediaTypeChange('movie')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${mediaType === 'movie' ? 'bg-red-600 text-white' : 'text-gray-300'
              }`}
          >
            Movies
          </button>
          <button
            onClick={() => handleMediaTypeChange('tv')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${mediaType === 'tv' ? 'bg-red-600 text-white' : 'text-gray-300'
              }`}
          >
            Series
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {Movies.map((movie, index) => (
            <Link key={movie.id} to={mediaType === 'movie' ? `/movie/${movie.id}` : `/tv/${movie.id}`}>
              <div
                className="group bg-gradient-to-br from-zinc-900/60 to-zinc-800/60 backdrop-blur-xl border border-zinc-700/40 shadow-xl rounded-2xl overflow-hidden hover:scale-105 hover:shadow-2xl transition-all duration-300"
                onMouseEnter={() => handleMouseEnter(index)}
                onMouseLeave={handleMouseLeave}
              >
                <div className="relative aspect-video">
                  <img
                    src={movie.image}
                    alt={movie.title}
                    className="w-full h-full object-cover transition-all duration-300"
                  />
                  <div className="absolute top-3 right-3 bg-black/70 rounded backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-white font-bold text-xs">{movie.rating}</span>
                  </div>
                  {movie.videoUrl && (
                    <iframe
                      className={`absolute top-0 left-0 w-full h-full transition-opacity duration-300 ${hoveredIndex === index ? "opacity-100" : "opacity-0"}`}
                      src={hoveredIndex === index ? `${movie.videoUrl}?autoplay=1` : movie.videoUrl}
                      frameBorder="0"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      title={movie.title}
                    ></iframe>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-bold text-white mb-2 truncate transition-colors">{movie.title}</h2>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs">{movie.year}</span>
                    <div className="flex gap-2">
                      {movie.genre.slice(0, 2).map((g: string) => (
                        <span
                          key={g}
                          className="text-[10px] px-2 py-1 bg-zinc-900/80 border border-zinc-700/40 rounded-full text-zinc-300 font-semibold"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMoreMovies}
            disabled={loading}
            className="
              px-4 py-2 sm:px-6 sm:py-3
              bg-gradient-to-r from-red-700/95 via-pink-600/90 to-red-500/95
              text-white font-sans font-extrabold uppercase text-base sm:text-lg tracking-widest
              rounded-xl sm:rounded-2xl
              shadow-2xl
              border border-red-500/80
              backdrop-blur-xl
              transition-all duration-300
              hover:from-pink-700/95 hover:via-red-600/90 hover:to-red-400/95
              hover:scale-105
              disabled:opacity-60
              relative
              overflow-hidden
            "
            style={{
              WebkitBackdropFilter: 'blur(20px)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <span className="relative z-10 drop-shadow-lg">{loading ? 'Loading...' : 'Load More'}</span>
            <span
              className="absolute inset-0 pointer-events-none animate-pulse"
              style={{
                background: 'linear-gradient(120deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.12) 100%)',
                opacity: 0.6,
              }}
            />
            <span
              className="absolute left-1/2 top-0 w-2/3 h-2/3 -translate-x-1/2 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(255,80,80,0.28) 0%, transparent 70%)',
                filter: 'blur(12px)',
                opacity: 0.5,
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MovieList;
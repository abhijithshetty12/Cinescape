import React, { useEffect, useState } from "react";
import { Play, Star, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios";

interface Movie {
  backdrop_path: string | null;
  vote_average: number | null;
  release_date: string | null;
  first_air_date?: string | null;
  title?: string;
  name?: string;
  overview: string | null;
  id: number;
  trailers: { key: string }[];
  media_type?: 'movie' | 'tv';
}

const Hero = () => {
  const [currentMovie, setCurrentMovie] = useState(0);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
  const TRENDING_MOVIES_URL = `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}`;
  const POPULAR_TV_URL = `https://api.themoviedb.org/3/tv/popular?api_key=${API_KEY}`;

  useEffect(() => {
    const fetchTrendingContent = async () => {
      try {
        const moviesResponse = await axios.get(TRENDING_MOVIES_URL);
        const movies = moviesResponse.data.results.slice(0, 5);

        const tvResponse = await axios.get(POPULAR_TV_URL);
        const tvShows = tvResponse.data.results.slice(0, 5);

        const moviesWithTrailers = await Promise.all(movies.map(async (movie: Movie) => {
          const trailerResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${API_KEY}`);
          return { ...movie, trailers: trailerResponse.data.results, media_type: 'movie' as const };
        }));

        const tvWithTrailers = await Promise.all(tvShows.map(async (tv: Movie) => {
          const trailerResponse = await axios.get(`https://api.themoviedb.org/3/tv/${tv.id}/videos?api_key=${API_KEY}`);
          return { ...tv, trailers: trailerResponse.data.results, media_type: 'tv' as const };
        }));

        const allContent: Movie[] = [];
        const maxLength = Math.max(tvWithTrailers.length, moviesWithTrailers.length);

        for (let i = 0; i < maxLength; i++) {
          if (i < tvWithTrailers.length) {
            allContent.push(tvWithTrailers[i]);
          }
          if (i < moviesWithTrailers.length) {
            allContent.push(moviesWithTrailers[i]);
          }
        }

        setTrendingMovies(allContent);
      } catch (error) {
        console.error("Failed to fetch trending content", error);
      }
    };

    fetchTrendingContent();
    const timer = setInterval(() => {
      setCurrentMovie((prev) => (prev + 1) % trendingMovies.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [trendingMovies.length]);

  const prevMovie = () => {
    setCurrentMovie((prev) => (prev === 0 ? trendingMovies.length - 1 : prev - 1));
  };

  const nextMovie = () => {
    setCurrentMovie((prev) => (prev + 1) % trendingMovies.length);
  };

  const movie: Movie | undefined = trendingMovies[currentMovie];

  return (
    <div className="relative h-[70vh] min-h-[320px] sm:h-[90vh] sm:min-h-[500px] bg-gradient-to-b from-zinc-950/80 via-zinc-900/60 to-black flex flex-col overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 gradient-mask"
        style={{
          backgroundImage: `url('${movie?.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : ''}')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />
      </div>

      <div className="relative container mx-auto px-2 xs:px-4 flex-grow flex items-center">
        <div className="max-w-full sm:max-w-2xl sm:ml-16 z-10">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-1 sm:gap-2 bg-black/60 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" />
              <span className="text-white font-bold text-sm sm:text-base">
                {movie?.vote_average} Rating
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 bg-black/60 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              <span className="text-zinc-200 text-sm sm:text-base">{movie?.release_date || movie?.first_air_date}</span>
            </div>
            <div className={`${movie?.media_type === 'tv' ? 'bg-blue-600' : 'bg-gradient-to-r from-orange-500 to-red-600'} px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow`}>
              <span className="text-white font-bold text-xs sm:text-sm">
                {movie?.media_type === 'tv' ? 'TV' : 'Movie'}
              </span>
            </div>
          </div>
          <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-7xl font-extrabold mb-4 sm:mb-6 text-white drop-shadow-lg leading-tight">
            {movie?.title || movie?.name}
          </h1>
          <p className="text-zinc-300 text-base xs:text-lg mb-6 sm:mb-10 line-clamp-4 max-w-full sm:max-w-xl">
            {movie?.overview}
          </p>
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3 sm:gap-6 w-full max-w-xs xs:max-w-none">
            <Link
              to="#"
              onClick={() => window.open(`https://www.youtube.com/watch?v=${movie?.trailers[0]?.key}`, '_blank')}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-bold flex items-center justify-center gap-2 shadow-lg hover:from-orange-600 hover:to-red-700 hover:scale-105 transition-all duration-300 no-underline text-base sm:text-lg"
            >
              <Play className="w-5 h-5" />
              Watch Trailer
            </Link>
            <Link
              to={movie?.media_type === 'tv' ? `/tv/${movie?.id}` : `/movie/${movie?.id}`}
              className="bg-white/10 border border-white/20 backdrop-blur-md text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-bold hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-lg no-underline text-base sm:text-lg flex items-center justify-center"
              style={{
                boxShadow: '0 4px 32px 0 rgba(0,0,0,0.25), 0 1.5px 8px 0 rgba(255,255,255,0.05) inset',
                backdropFilter: 'blur(12px)'
              }}
            >
              More Info
            </Link>
          </div>
        </div>

        {trendingMovies.length > 1 && (
          <>
            <button
              onClick={prevMovie}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-orange-500/80 text-white p-2 sm:p-3 rounded-full shadow-lg transition-all duration-300 z-20"
              aria-label="Previous"
            >
              <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
            <button
              onClick={nextMovie}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-orange-500/80 text-white p-2 sm:p-3 rounded-full shadow-lg transition-all duration-300 z-20"
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          </>
        )}
      </div>
      {trendingMovies.length > 1 && (
        <div className="absolute bottom-4 sm:bottom-8 flex gap-1.5 sm:gap-2 left-1/2 -translate-x-1/2 z-20">
          {trendingMovies.map((_, index) => (
            <button
              key={index}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={currentMovie === index}
              onClick={() => setCurrentMovie(index)}
              className={`h-2 rounded-full transition-all duration-300 ${currentMovie === index ? 'w-6 sm:w-8 bg-gradient-to-r from-orange-500 to-red-600' : 'w-2 sm:w-2 bg-white/50'
                }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Hero;
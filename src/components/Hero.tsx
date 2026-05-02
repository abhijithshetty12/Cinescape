import React, { useEffect, useState, useCallback } from "react";
import { Play, Star, Calendar, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  media_type?: "movie" | "tv";
}

const FADE_VARIANTS = {
  enter: { opacity: 0, y: 24 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const BG_VARIANTS = {
  enter: { opacity: 0, scale: 1.06 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
};

const Hero = () => {
  const [currentMovie, setCurrentMovie] = useState(0);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [direction, setDirection] = useState(1);

  const API_KEY = "859afbb4b98e3b467da9c99ac390e950";
  const TRENDING_MOVIES_URL = `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}`;
  const POPULAR_TV_URL = `https://api.themoviedb.org/3/tv/popular?api_key=${API_KEY}`;

  useEffect(() => {
    const fetchTrendingContent = async () => {
      try {
        const [moviesResponse, tvResponse] = await Promise.all([
          axios.get(TRENDING_MOVIES_URL),
          axios.get(POPULAR_TV_URL),
        ]);
        const movies = moviesResponse.data.results.slice(0, 5);
        const tvShows = tvResponse.data.results.slice(0, 5);

        const [moviesWithTrailers, tvWithTrailers] = await Promise.all([
          Promise.all(
            movies.map(async (movie: Movie) => {
              const res = await axios.get(
                `https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${API_KEY}`
              );
              return { ...movie, trailers: res.data.results, media_type: "movie" as const };
            })
          ),
          Promise.all(
            tvShows.map(async (tv: Movie) => {
              const res = await axios.get(
                `https://api.themoviedb.org/3/tv/${tv.id}/videos?api_key=${API_KEY}`
              );
              return { ...tv, trailers: res.data.results, media_type: "tv" as const };
            })
          ),
        ]);

        const allContent: Movie[] = [];
        const maxLength = Math.max(tvWithTrailers.length, moviesWithTrailers.length);
        for (let i = 0; i < maxLength; i++) {
          if (i < tvWithTrailers.length) allContent.push(tvWithTrailers[i]);
          if (i < moviesWithTrailers.length) allContent.push(moviesWithTrailers[i]);
        }

        setTrendingMovies(allContent);
      } catch (error) {
        console.error("Failed to fetch trending content", error);
      }
    };

    fetchTrendingContent();
  }, []);

  useEffect(() => {
    if (trendingMovies.length === 0) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentMovie((prev) => (prev + 1) % trendingMovies.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [trendingMovies.length]);

  const prevMovie = useCallback(() => {
    setDirection(-1);
    setCurrentMovie((prev) => (prev === 0 ? trendingMovies.length - 1 : prev - 1));
  }, [trendingMovies.length]);

  const nextMovie = useCallback(() => {
    setDirection(1);
    setCurrentMovie((prev) => (prev + 1) % trendingMovies.length);
  }, [trendingMovies.length]);

  const goToMovie = useCallback(
    (index: number) => {
      setDirection(index > currentMovie ? 1 : -1);
      setCurrentMovie(index);
    },
    [currentMovie]
  );

  const movie: Movie | undefined = trendingMovies[currentMovie];
  const backdropUrl = movie?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : "";

  return (
    <div className="relative h-[72vh] min-h-[360px] sm:h-[92vh] sm:min-h-[520px] flex flex-col overflow-hidden bg-black">
      {/* ── Animated backdrop ── */}
      <AnimatePresence mode="sync">
        <motion.div
          key={`bg-${currentMovie}`}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${backdropUrl}')` }}
          variants={BG_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />
      </AnimatePresence>

      {/* ── Cinematic gradient overlays ── */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

      {/* ── Red ambient glow at bottom-left ── */}
      <div
        className="absolute bottom-0 left-0 w-96 h-48 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at bottom left, rgba(220,38,38,0.18) 0%, transparent 70%)",
        }}
      />

      {/* ── Thin red accent line ── */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-red-600/60 via-red-500/30 to-transparent" />

      {/* ── Main content ── */}
      <div className="relative flex-grow flex items-center px-4 sm:px-8 lg:px-16 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${currentMovie}`}
            className="max-w-2xl ml-10 sm:ml-14 lg:ml-16"
            variants={FADE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            {/* ── Badges ── */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              {/* Rating badge */}
              <div className="hero-glass-badge flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span className="text-white font-semibold text-xs sm:text-sm">
                  {movie?.vote_average?.toFixed(1)} Rating
                </span>
              </div>

              {/* Date badge */}
              <div className="hero-glass-badge flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-green-600" />
                <span className="text-zinc-200 text-xs sm:text-sm">
                  {movie?.release_date || movie?.first_air_date}
                </span>
              </div>

              {/* Media type badge */}
              <div
                className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold shadow-lg ${
                  movie?.media_type === "tv"
                    ? "bg-blue-600/80 text-white border border-blue-400/30"
                    : "bg-red-600/80 text-white border border-red-400/30"
                }`}
                style={{
                  boxShadow:
                    movie?.media_type === "tv"
                      ? "0 0 12px rgba(37,99,235,0.4)"
                      : "0 0 12px rgba(220,38,38,0.4)",
                }}
              >
                {movie?.media_type === "tv" ? "TV Series" : "Movie"}
              </div>
            </div>

            {/* ── Title ── */}
            <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-4 sm:mb-5 text-white leading-tight tracking-tight drop-shadow-2xl">
              {movie?.title || movie?.name}
            </h1>

            {/* ── Overview ── */}
            <p className="text-zinc-300 text-sm sm:text-base md:text-lg mb-7 sm:mb-10 line-clamp-3 max-w-xl leading-relaxed">
              {movie?.overview}
            </p>

            {/* ── CTA Buttons ── */}
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3 sm:gap-4">
              {/* Watch Trailer — glowy red button */}
              <button
                onClick={() =>
                  window.open(
                    `https://www.youtube.com/watch?v=${movie?.trailers?.[0]?.key}`,
                    "_blank"
                  )
                }
                className="hero-btn-glow group relative flex items-center justify-center gap-2.5 px-7 sm:px-8 py-3 sm:py-3.5 rounded-full font-bold text-white text-sm sm:text-base overflow-hidden"
                aria-label="Watch Trailer"
              >
                {/* Shine sweep */}
                <span className="hero-btn-shine" aria-hidden="true" />
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white relative z-10 group-hover:scale-110 transition-transform duration-200" />
                <span className="relative z-10">Watch Trailer</span>
              </button>

              {/* More Info — glass button */}
              <Link
                to={
                  movie?.media_type === "tv"
                    ? `/tv/${movie?.id}`
                    : `/movie/${movie?.id}`
                }
                className="hero-btn-glass group flex items-center justify-center gap-2.5 px-7 sm:px-8 py-3 sm:py-3.5 rounded-full font-bold text-white text-sm sm:text-base no-underline"
                aria-label="More Info"
              >
                <Info className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 group-hover:text-red-400 transition-colors duration-200" />
                <span>More Info</span>
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Nav arrows ── */}
        {trendingMovies.length > 1 && (
          <>
            <button
              onClick={prevMovie}
              className="hero-nav-btn absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20"
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>
            <button
              onClick={nextMovie}
              className="hero-nav-btn absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20"
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>
          </>
        )}
      </div>

      {/* ── Dot pagination ── */}
      {trendingMovies.length > 1 && (
        <div className="absolute bottom-5 sm:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {trendingMovies.map((_, index) => (
            <button
              key={index}
              onClick={() => goToMovie(index)}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={currentMovie === index}
              className={`h-2 rounded-full transition-all duration-400 ${
                currentMovie === index
                  ? "w-8 sm:w-10 bg-red-500 hero-dot-glow"
                  : "w-2 bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Hero;

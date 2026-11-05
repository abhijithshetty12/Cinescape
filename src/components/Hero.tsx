import React, { useEffect, useState, useCallback } from "react";
import { Play, Star, Calendar, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

interface Movie {
  backdrop_path: string | null;
  poster_path: string | null;
  vote_average: number | null;
  release_date: string | null;
  first_air_date?: string | null;
  title?: string;
  name?: string;
  overview: string | null;
  id: number;
  trailers: { key: string }[];
  logoPath?: string | null;
  media_type?: "movie" | "tv";
}

const BG_VARIANTS = {
  enter: { opacity: 0, scale: 1.06 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
};

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 60 : -60,
    opacity: 0,
  }),
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

        const fetchMediaDetails = async (item: Movie, type: "movie" | "tv") => {
          const [videoRes, imageRes] = await Promise.all([
            axios.get(`https://api.themoviedb.org/3/${type}/${item.id}/videos?api_key=${API_KEY}`),
            axios.get(`https://api.themoviedb.org/3/${type}/${item.id}/images?api_key=${API_KEY}&include_image_language=en,null`)
          ]);

          const logos = imageRes.data.logos || [];
          const logoPath = logos.length > 0 ? logos[0].file_path : null;

          return {
            ...item,
            trailers: videoRes.data.results,
            logoPath,
            media_type: type
          };
        };

        const [moviesWithDetails, tvWithDetails] = await Promise.all([
          Promise.all(movies.map((m: Movie) => fetchMediaDetails(m, "movie"))),
          Promise.all(tvShows.map((t: Movie) => fetchMediaDetails(t, "tv")))
        ]);

        const allContent: Movie[] = [];
        const maxLength = Math.max(tvWithDetails.length, moviesWithDetails.length);
        for (let i = 0; i < maxLength; i++) {
          if (i < tvWithDetails.length) allContent.push(tvWithDetails[i]);
          if (i < moviesWithDetails.length) allContent.push(moviesWithDetails[i]);
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

  const handleDragEnd = (e: any, { offset, velocity }: any) => {
    const swipe = offset.x;
    if (swipe < -50) {
      nextMovie();
    } else if (swipe > 50) {
      prevMovie();
    }
  };

  const movie: Movie | undefined = trendingMovies[currentMovie];
  const backdropUrl = movie?.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : "";
  const posterUrl = movie?.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : backdropUrl;

  return (
    <motion.div
      className="relative h-[72vh] min-h-[360px] sm:h-[92vh] sm:min-h-[520px] flex flex-col overflow-hidden bg-black"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      dragDirectionLock
      onDragEnd={handleDragEnd}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={`bg-${currentMovie}`}
          className="absolute inset-0 pointer-events-none"
          initial="enter"
          animate="center"
          exit="exit"
          variants={BG_VARIANTS}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        >
          <div
            className="absolute inset-0 bg-cover bg-top md:hidden"
            style={{ backgroundImage: `url('${posterUrl}')` }}
          />
          <div
            className="absolute inset-0 bg-cover bg-center hidden md:block"
            style={{ backgroundImage: `url('${backdropUrl}')` }}
          />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent md:hidden pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent hidden md:block pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent hidden md:block pointer-events-none" />

      <div className="absolute bottom-0 left-0 w-96 h-48 pointer-events-none" style={{ background: "radial-gradient(ellipse at bottom left, rgba(220,38,38,0.15) 0%, transparent 60%)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-red-600/40 via-red-500/20 to-transparent pointer-events-none" />

      <div className="relative flex-grow flex items-end sm:items-center px-4 sm:px-8 lg:px-16 z-10 pb-20 sm:pb-0">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`content-${currentMovie}`}
            className="max-w-2xl ml-1 sm:ml-6 lg:ml-12 pointer-events-auto w-full"
            custom={direction}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Added lg:mt-20 here to push the content down on desktop */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 mb-3 sm:mb-6 lg:mt-20">
              <div className="hero-glass-badge flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 sm:px-3 sm:py-1.5 rounded-full">
                <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-400 fill-yellow-400" />
                <span className="text-white font-semibold text-[10px] sm:text-sm">
                  {movie?.vote_average?.toFixed(1)}
                </span>
              </div>

              <div className="hero-glass-badge flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 sm:px-3 sm:py-1.5 rounded-full">
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400" />
                <span className="text-zinc-200 text-[10px] sm:text-sm">
                  {movie?.release_date || movie?.first_air_date}
                </span>
              </div>

              <div
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-sm font-bold shadow-lg backdrop-blur-md ${movie?.media_type === "tv"
                  ? "bg-blue-600/60 text-white border border-blue-400/30"
                  : "bg-red-600/60 text-white border border-red-400/30"
                  }`}
              >
                {movie?.media_type === "tv" ? "TV Series" : "Movie"}
              </div>
            </div>

            {movie?.logoPath ? (
              <img
                src={`https://image.tmdb.org/t/p/w500${movie.logoPath}`}
                alt={movie?.title || movie?.name}
                className="max-h-[50px] xs:max-h-[60px] sm:max-h-[120px] w-auto max-w-[70%] sm:max-w-full object-contain object-left mb-3 sm:mb-5 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] pointer-events-none"
              />
            ) : (
              <h1 className="text-2xl xs:text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-3 sm:mb-5 text-white leading-tight tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] line-clamp-2">
                {movie?.title || movie?.name}
              </h1>
            )}

            <p className="text-white/80 text-[11px] xs:text-xs sm:text-base md:text-lg mb-5 sm:mb-10 line-clamp-2 sm:line-clamp-3 max-w-xl leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-medium">
              {movie?.overview}
            </p>

            <div className="flex items-center gap-3 sm:gap-4 w-full xs:w-auto">
              <button
                onClick={() => window.open(`https://www.youtube.com/watch?v=${movie?.trailers?.[0]?.key}`, "_blank")}
                className="group relative flex items-center justify-center gap-2 h-12 sm:h-auto px-6 sm:px-8 sm:py-3.5 rounded-full font-bold text-black text-sm sm:text-base bg-[#E50914] hover:bg-[#ff0f1a] transition-all duration-300 shadow-[0_0_30px_rgba(229,9,20,0.5)] hover:shadow-[0_0_40px_rgba(229,9,20,0.8)] active:scale-95 shrink-0"
                aria-label="Watch Trailer"
              >
                <Play className="w-5 h-5 fill-black text-black relative z-10 group-hover:scale-110 transition-transform duration-300" />
                <span className="relative z-10 hidden sm:inline">Watch Trailer</span>
                <span className="relative z-10 sm:hidden">Trailer</span>
              </button>

              <Link
                to={movie?.media_type === "tv" ? `/tv/${movie?.id}` : `/movie/${movie?.id}`}
                className="hero-btn-glass group flex flex-1 xs:flex-none items-center justify-center gap-2 h-12 sm:h-auto px-5 sm:px-8 sm:py-3.5 rounded-full font-bold text-white text-xs sm:text-base no-underline bg-black/40 backdrop-blur-md border border-white/20 hover:bg-black/60 hover:border-white/40 transition-all"
                aria-label="More Info"
              >
                <Info className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 group-hover:text-red-400 transition-colors duration-200" />
                <span>See More</span>
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {trendingMovies.length > 1 && (
        <div className="flex md:hidden absolute bottom-5 left-1/2 -translate-x-1/2 z-20 items-center gap-3 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 pointer-events-auto shadow-xl">
          <button
            onClick={prevMovie}
            className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-1">
            {trendingMovies.map((_, index) => (
              <button
                key={index}
                onClick={() => goToMovie(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${currentMovie === index
                  ? "w-4 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                  : "w-1.5 bg-white/30"
                  }`}
              />
            ))}
          </div>

          <button
            onClick={nextMovie}
            className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {trendingMovies.length > 1 && (
        <div className="hidden md:flex absolute bottom-10 right-4 lg:right-8 z-20 items-center gap-4 pointer-events-auto">
          <button
            onClick={prevMovie}
            className="flex items-center justify-center w-10 h-10 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all duration-300"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2">
            {trendingMovies.map((item, index) => {
              const isActive = currentMovie === index;
              return (
                <button
                  key={index}
                  onClick={() => goToMovie(index)}
                  className={`relative w-[72px] aspect-[16/9] rounded-md overflow-hidden transition-all duration-300 ${isActive
                    ? "ring-2 ring-white scale-110 z-10 shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                    : "opacity-40 hover:opacity-80 hover:scale-105 grayscale hover:grayscale-0"
                    }`}
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w300${item.backdrop_path}`}
                    alt={item.title || item.name || "Movie thumbnail"}
                    className="w-full h-full object-cover"
                  />
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={nextMovie}
            className="flex items-center justify-center w-10 h-10 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all duration-300"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default Hero;
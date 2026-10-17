import React, { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import MovieCard from "./MovieCard.tsx";

const MovieCarousel = ({ movies, mediaType }: { movies: any[]; mediaType?: 'movie' | 'tv' }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const totalScroll = container.scrollWidth - container.clientWidth;
    if (totalScroll <= 0) return;

    const currentScroll = container.scrollLeft;
    setScrollProgress((currentScroll / totalScroll) * 100);
  };

  useEffect(() => {
    handleScroll();

    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [movies]);

  return (
    <div className="relative group/carousel w-full flex flex-col gap-4">

      <div className="absolute left-0 top-0 bottom-3 w-14 bg-gradient-to-r from-white/10 dark:from-zinc-950/40 to-transparent z-10 pointer-events-none rounded-l-2xl hidden md:block backdrop-blur-[1px]" />
      <div className="absolute right-0 top-0 bottom-3 w-14 bg-gradient-to-l from-white/10 dark:from-zinc-950/40 to-transparent z-10 pointer-events-none rounded-r-2xl hidden md:block backdrop-blur-[1px]" />

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex overflow-x-scroll overflow-y-hidden select-none touch-pan-x snap-x snap-mandatory scrollbar-none gap-1 py-1 px-2 scroll-smooth rounded-2xl w-full"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none"
        }}
      >
        {movies.map((movie) => {
          const resolvedType =
            mediaType ||
            movie.media_type ||
            (movie.name && !movie.title ? 'tv' : 'movie');

          const to = resolvedType === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`;

          return (
            <div
              key={movie.id}
              className="w-[78%] sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5 shrink-0 snap-start p-1.5 transform-gpu"
            >
              <Link
                to={to}
                aria-label={`Open ${movie.title || movie.name || 'title'}`}
                className="block rounded-2xl transition-transform duration-300 ease-out active:scale-95 md:hover:scale-[1.02]"
              >
                <MovieCard {...movie} media_type={resolvedType} />
              </Link>
            </div>
          );
        })}
      </div>

      {movies.length > 4 && (
        <div className="w-24 h-[3px] bg-black/5 dark:bg-zinc-800/60 rounded-full mx-auto overflow-hidden border border-black/5 dark:border-white/5">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-150 ease-out"
            style={{ width: `${Math.min(Math.max(scrollProgress, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default MovieCarousel;
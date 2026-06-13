import React, { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import MovieCard from "./MovieCard.tsx";

const MovieCarousel = ({ movies, mediaType }: { movies: any[]; mediaType?: 'movie' | 'tv' }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Track scroll position to update the progress bar
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const totalScroll = container.scrollWidth - container.clientWidth;
    if (totalScroll <= 0) return;

    const currentScroll = container.scrollLeft;
    setScrollProgress((currentScroll / totalScroll) * 100);
  };

  return (
    <div className="relative group/carousel w-full flex flex-col gap-4">
      {/* Subtle edge fades for desktop, hidden on mobile for better visibility */}
      <div className="absolute left-0 top-0 bottom-6 w-12 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none rounded-l-xl hidden md:block" />
      <div className="absolute right-0 top-0 bottom-6 w-12 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none rounded-r-xl hidden md:block" />

      {/* Scroll Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto overflow-y-hidden scrollbar-none snap-x snap-mandatory scroll-smooth rounded-xl pb-2"
        style={{ WebkitOverflowScrolling: "touch" }} // Smooth iOS momentum scrolling
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
              // Responsiveness: 1.2 cards visible on mobile (gives a hint to swipe), graduating up to 4 on desktop
              className="w-[80%] sm:w-1/2 md:w-1/3 lg:w-1/4 flex-shrink-0 p-2 snap-start"
            >
              <Link to={to} className="block hover:scale-[1.02] transition-transform duration-300">
                <MovieCard {...movie} media_type={resolvedType} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MovieCarousel;
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import MovieCard from "./MovieCard.tsx";

const MovieCarousel = ({ movies, mediaType }: { movies: any[]; mediaType?: 'movie' | 'tv' }) => {
  const [startIndex, setStartIndex] = useState(0);
  const visibleMovies = 4;

  const nextSlide = () => {
    setStartIndex((prev) =>
      prev + visibleMovies >= movies.length ? 0 : prev + 1
    );
  };

  const prevSlide = () => {
    setStartIndex((prev) =>
      prev === 0 ? Math.max(0, movies.length - visibleMovies) : prev - 1
    );
  };

  return (
    <div className="relative group/carousel">
      {/* Left edge fade */}
      <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none rounded-l-xl" />
      {/* Right edge fade */}
      <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none rounded-r-xl" />

      <div className="overflow-hidden rounded-xl">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${startIndex * (100 / visibleMovies)}%)`,
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
                className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 flex-shrink-0 p-2"
              >
                <Link to={to}>
                  <MovieCard {...movie} media_type={resolvedType} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {movies.length > visibleMovies && (
        <>
          {/* Left nav button */}
          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-black/80 backdrop-blur-md border border-white/[0.08] hover:border-red-500/40 hover:bg-red-950/70 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 group/btn opacity-0 group-hover/carousel:opacity-100"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-300 group-hover/btn:text-red-400 transition-colors duration-200" />
          </button>

          {/* Right nav button */}
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-black/80 backdrop-blur-md border border-white/[0.08] hover:border-red-500/40 hover:bg-red-950/70 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 group/btn opacity-0 group-hover/carousel:opacity-100"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-300 group-hover/btn:text-red-400 transition-colors duration-200" />
          </button>
        </>
      )}
    </div>
  );
};

export default MovieCarousel;

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
    <div className="relative group">
      <div className="overflow-hidden">
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

      {/* Navigation buttons - glowy with liquid glass */}
      {movies.length > visibleMovies && (
        <>
          {/* Left arrow */}
          <button
            onClick={prevSlide}
            className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 glassmorphic-button liquid-glass group p-2.5 sm:p-3 rounded-full shadow-xl hover:shadow-orange-500/40 transition-all duration-300 z-10 flex items-center justify-center"
            aria-label="Previous slide"
          >
            <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white relative z-10 drop-shadow-lg group-hover:scale-110 transition-transform" />
          </button>

          {/* Right arrow */}
          <button
            onClick={nextSlide}
            className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 glassmorphic-button liquid-glass group p-2.5 sm:p-3 rounded-full shadow-xl hover:shadow-orange-500/40 transition-all duration-300 z-10 flex items-center justify-center"
            aria-label="Next slide"
          >
            <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white relative z-10 drop-shadow-lg group-hover:scale-110 transition-transform" />
          </button>
        </>
      )}
    </div>
  );
};

export default MovieCarousel;
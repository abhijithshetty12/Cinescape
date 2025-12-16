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

      {movies.length > visibleMovies && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/30 backdrop-blur-md p-3 rounded-full transition-opacity"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/30 backdrop-blur-md p-3 rounded-full transition-opacity"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        </>
      )}
    </div>
  );
};

export default MovieCarousel;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Clock, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import Loading from '../components/Loading.tsx';

const UpcomingMovies = () => {
  const [upcomingMovies, setUpcomingMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');

  const API_KEY = '859afbb4b98e3b467da9c99ac390e950';

  useEffect(() => {
    const fetchUpcomingMovies = async () => {
      setLoading(true);
      try {
        const API_URL = mediaType === 'movie'
          ? `https://api.themoviedb.org/3/movie/upcoming?api_key=${API_KEY}&page=${page}`
          : `https://api.themoviedb.org/3/tv/on_the_air?api_key=${API_KEY}&page=${page}`;

        const response = await axios.get(API_URL);
        setUpcomingMovies((prevMovies) => page === 1 ? response.data.results : [...prevMovies, ...response.data.results]);
      } catch (error) {
        console.error('Error fetching upcoming:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingMovies();
  }, [page, mediaType]);

  const handleMediaTypeChange = (type: 'movie' | 'tv') => {
    if (type !== mediaType) {
      setMediaType(type);
      setUpcomingMovies([]);
      setPage(1);
    }
  };

  const loadMoreMovies = () => {
    setPage((prevPage) => prevPage + 1);
  };

  return (
    <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-black min-h-screen py-8">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-4 mb-6">
            <Clock className="w-10 h-10 text-blue-500 drop-shadow" />
            <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow">Upcoming</h1>
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
        </motion.div>

        {loading && page === 1 && <Loading />}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-8">
          {upcomingMovies.map((item) => {
            const title = item.title || item.name;
            const releaseDate = item.release_date || item.first_air_date;

            return (
              <Link to={mediaType === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`} key={item.id}>
                <motion.div
                  className="group bg-gradient-to-br from-zinc-900/80 to-zinc-800/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-zinc-700 hover:border-blue-500"
                  whileHover={{ scale: 1.04, y: -4 }}
                >
                  <div className="relative">
                    <img
                      src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                      alt={title}
                      className="w-full h-72 object-cover object-center transition-all duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-3 right-3 bg-black/70 rounded backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-white font-bold text-xs">{item.vote_average?.toFixed(1) ?? 'N/A'}</span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-1">
                    <h2 className="text-lg font-bold text-white truncate">{title}</h2>
                    <span className="text-gray-400 text-sm">
                      {releaseDate ? new Date(releaseDate).getFullYear() : 'N/A'}
                    </span>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>

        <div className="flex justify-center mt-12">
          <button
            onClick={loadMoreMovies}
            disabled={loading}
            className="
              px-4 py-2 sm:px-6 sm:py-3
              bg-gradient-to-r from-blue-700/90 via-blue-500/80 to-cyan-400/90
              text-white font-bold text-base sm:text-lg tracking-wide
              rounded-xl sm:rounded-2xl
              shadow-2xl
              border border-cyan-400/60
              backdrop-blur-xl
              transition-all duration-300
              hover:from-blue-500/80 hover:via-blue-400/70 hover:to-cyan-300/80
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
                background: 'linear-gradient(120deg, rgba(173,216,230,0.22) 0%, rgba(255,255,255,0.12) 100%)',
                opacity: 0.7,
              }}
            />
            <span
              className="absolute left-1/2 top-0 w-2/3 h-2/3 -translate-x-1/2 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(0,255,255,0.25) 0%, transparent 70%)',
                filter: 'blur(10px)',
                opacity: 0.5,
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpcomingMovies;
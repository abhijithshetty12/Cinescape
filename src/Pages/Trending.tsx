import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Star, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TrendingMovies = () => {
    const [trendingMovies, setTrendingMovies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
    const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
    const BASE_TRENDING_URL = 'https://api.themoviedb.org/3/trending';

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const url = `${BASE_TRENDING_URL}/${mediaType}/week?api_key=${API_KEY}&page=${page}`;
                const response = await axios.get(url);
                const {data} = response;
                setTrendingMovies((prevMovies) => page === 1 ? data.results : [...prevMovies, ...data.results]);
            } catch (error) {
                console.error('Error fetching trending content:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrending();
    }, [page, mediaType]);

    const handleMediaTypeChange = (type: 'movie' | 'tv') => {
        if (type === mediaType) return;
        setMediaType(type);
        setTrendingMovies([]);
        setPage(1);
        setLoading(true);
    }

    const loadMoreMovies = () => {
        setPage((prevPage) => prevPage + 1);
    };

    return (
        <div className="container mx-auto px-2 py-6 max-w-7xl">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-6">
                    <TrendingUp className="w-9 h-9 text-orange-500 drop-shadow-lg" />
                    <h1 className="text-4xl font-extrabold text-white tracking-tight">{mediaType === 'movie' ? 'Trending Movies' : 'Trending Series'}</h1>
                </div>
                <div className="flex items-center justify-start">
                    <div className="relative flex bg-zinc-800/80 rounded-full shadow-inner overflow-hidden">
                        <button
                            onClick={() => handleMediaTypeChange('movie')}
                            className={`z-10 px-6 py-2 font-semibold transition-colors duration-300 rounded-full focus:outline-none ${mediaType === 'movie' ? 'text-white' : 'text-gray-400'}`}
                        >
                            Movies
                        </button>
                        <button
                            onClick={() => handleMediaTypeChange('tv')}
                            className={`z-10 px-6 py-2 font-semibold transition-colors duration-300 rounded-full focus:outline-none ${mediaType === 'tv' ? 'text-white' : 'text-gray-400'}`}
                        >
                            Series
                        </button>
                        <motion.div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-500 to-red-600 rounded-full shadow-lg"
                            animate={{
                                width: mediaType === 'movie' ? 110 : 100,
                                x: mediaType === 'movie' ? 0 : 110,
                            }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            style={{ zIndex: 1 }}
                        />
                    </div>
                </div>
            </motion.div>
            <AnimatePresence>
                {loading && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex justify-center items-center py-10"
                    >
                        <span className="text-lg text-gray-400 font-medium">Loading...</span>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-6">
                {trendingMovies.map((item: any) => {
                    const title = item.title || item.name || 'Untitled';
                    const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '/path/to/default-image.jpg';
                    const dateStr = item.release_date || item.first_air_date || '';
                    const year = dateStr ? new Date(dateStr).getFullYear() : 'N/A';
                    const to = mediaType === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`;

                    return (
                        <Link to={to} key={item.id}>
                            <motion.div
                                className="group bg-gradient-to-br from-zinc-900/80 to-zinc-800/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-zinc-700 hover:border-orange-500"
                                whileHover={{ scale: 1.04, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="relative">
                                    <img
                                        src={poster}
                                        alt={title}
                                        className="w-full h-auto object-cover object-center transition-all duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute top-3 right-3 bg-black/70 rounded backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                        <span className="text-white font-bold text-xs">{item.vote_average?.toFixed(1) ?? 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="p-4 flex flex-col gap-1">
                                    <h2 className="text-lg font-bold text-white truncate">{title}</h2>
                                    <div className="flex items-center justify-between text-xs text-gray-400">
                                        <span>{year}</span>
                                        <span className="uppercase">{mediaType}</span>
                                    </div>
                                </div>
                            </motion.div>
                        </Link>
                    );
                })}
            </div>
            <div className="flex justify-center mt-10">
                <button
                    onClick={loadMoreMovies}
                    disabled={loading}
                    className="
                        px-4 py-2 sm:px-6 sm:py-3
                        bg-gradient-to-r from-orange-600/90 via-orange-400/90 to-red-600/90
                        text-white font-bold text-base sm:text-lg tracking-wide
                        rounded-xl sm:rounded-2xl
                        shadow-2xl
                        border border-orange-400/70
                        backdrop-blur-xl
                        transition-all duration-300
                        hover:from-orange-500/80 hover:via-yellow-400/70 hover:to-red-400/80
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
                            background: 'linear-gradient(120deg, rgba(255,220,180,0.22) 0%, rgba(255,255,255,0.14) 100%)',
                            opacity: 0.7,
                        }}
                    />
                    <span
                        className="absolute left-1/2 top-0 w-2/3 h-2/3 -translate-x-1/2 rounded-full pointer-events-none"
                        style={{
                            background: 'radial-gradient(circle, rgba(255,200,80,0.22) 0%, transparent 70%)',
                            filter: 'blur(10px)',
                            opacity: 0.5,
                        }}
                    />
                </button>
            </div>
        </div>
    );
};

export default TrendingMovies;
import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Trophy, Star, Clapperboard, Tv, ChevronUp, Sparkles, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import Loading from "../components/Loading.tsx";

const TopRated = () => {
  const [media, setMedia] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [mediaType, setMediaType] = useState("movie");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll();
  const headerOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0.95]);

  const API_KEY = "859afbb4b98e3b467da9c99ac390e950";

  useEffect(() => {
    const fetchTopRated = async () => {
      setLoading(true);
      try {
        const API_URL = `https://api.themoviedb.org/3/${mediaType}/top_rated?api_key=${API_KEY}&language=en-US&page=${page}`;
        const response = await axios.get(API_URL);
        setMedia((prevMedia) =>
          page === 1
            ? response.data.results
            : [...prevMedia, ...response.data.results]
        );
      } catch (error) {
        console.error(`Error fetching top-rated ${mediaType}:`, error);
      }
      setLoading(false);
      setInitialLoading(false);
    };

    fetchTopRated();
  }, [page, mediaType]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMediaTypeChange = (type) => {
    if (type !== mediaType) {
      setMediaType(type);
      setMedia([]);
      setPage(1);
      setInitialLoading(true);
    }
  };

  const loadMore = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getRankStyle = (index) => {
    if (index === 0) return "bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-black";
    if (index === 1) return "bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 text-black";
    if (index === 2) return "bg-gradient-to-br from-orange-300 via-amber-600 to-amber-700 text-white";
    return "bg-zinc-800/90 text-zinc-300 border border-zinc-700/50";
  };

  const getRankIcon = (index) => {
    if (index === 0) return <Crown className="w-3 h-3" />;
    if (index === 1) return <Sparkles className="w-3 h-3" />;
    if (index === 2) return <Star className="w-3 h-3" />;
    return <span className="text-xs font-bold">{index + 1}</span>;
  };

  if (initialLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Hero Header Section */}
        <motion.div
          ref={containerRef}
          style={{ opacity: headerOpacity }}
          className="relative pt-12 pb-8 px-4"
        >
          <div className="container mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="text-center mb-10"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-6"
              >
                <Trophy className="w-4 h-4" />
                <span>All Time Best</span>
              </motion.div>

              {/* Title */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight mb-4">
                Top Rated{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">
                  {mediaType === "movie" ? "Movies" : "Series"}
                </span>
              </h1>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
                Discover the highest-rated {mediaType === "movie" ? "films" : "TV shows"} of all time, 
                curated by millions of viewers worldwide.
              </p>
            </motion.div>

            {/* Media Type Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex justify-center"
            >
              <div className="relative flex items-center p-1.5 bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800/60 shadow-2xl">
                <button
                  onClick={() => handleMediaTypeChange("movie")}
                  className={`relative z-10 flex items-center gap-2 px-6 py-3 font-semibold transition-all duration-300 rounded-xl ${
                    mediaType === "movie"
                      ? "text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Clapperboard className="w-4 h-4" />
                  <span>Movies</span>
                </button>
                <button
                  onClick={() => handleMediaTypeChange("tv")}
                  className={`relative z-10 flex items-center gap-2 px-6 py-3 font-semibold transition-all duration-300 rounded-xl ${
                    mediaType === "tv"
                      ? "text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Tv className="w-4 h-4" />
                  <span>Series</span>
                </button>
                <motion.div
                  className="absolute inset-1.5 bg-gradient-to-r from-amber-600 to-orange-600 rounded-xl shadow-lg"
                  animate={{
                    width: mediaType === "movie" ? "calc(50% - 6px)" : "calc(50% - 6px)",
                    x: mediaType === "movie" ? 0 : "100%",
                  }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  style={{ zIndex: 0 }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Content Grid */}
        <div className="container mx-auto px-4 max-w-7xl pb-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={mediaType}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5 md:gap-6">
                {media.map((item, index) => {
                  const title = item.title || item.name || "Untitled";
                  const poster = item.poster_path
                    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                    : "/path/to/default-image.jpg";
                  const dateStr = item.release_date || item.first_air_date || "";
                  const year = dateStr ? new Date(dateStr).getFullYear() : "N/A";
                  const to =
                    mediaType === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`;
                  const rank = index;

                  return (
                    <motion.div
                      key={`${mediaType}-${item.id}`}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        delay: index * 0.05,
                        ease: [0.4, 0, 0.2, 1],
                      }}
                    >
                      <Link to={to} className="block group">
                        <div className="relative bg-zinc-900/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-zinc-800/50 hover:border-amber-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-2">
                          {/* Rank Badge */}
                          <div className="absolute top-3 left-3 z-20">
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-lg shadow-lg backdrop-blur-md ${getRankStyle(
                                rank
                              )}`}
                            >
                              {getRankIcon(rank)}
                            </div>
                          </div>

                          {/* Rating Badge */}
                          <div className="absolute top-3 right-3 z-20">
                            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span className="text-white font-bold text-sm">
                                {item.vote_average?.toFixed(1) ?? "N/A"}
                              </span>
                            </div>
                          </div>

                          {/* Poster */}
                          <div className="relative aspect-[2/3] overflow-hidden">
                            <img
                              src={poster}
                              alt={title}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                              loading="lazy"
                            />
                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                            
                            {/* Hover Info */}
                            <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                              <p className="text-white/90 text-sm font-medium line-clamp-2 mb-2">
                                {item.overview || "No description available."}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                                  View Details
                                </span>
                                <motion.div
                                  animate={{ x: [0, 4, 0] }}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                  <ChevronUp className="w-4 h-4 text-amber-400 rotate-90" />
                                </motion.div>
                              </div>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="p-4">
                            <h2 className="text-white font-bold text-base truncate mb-2 group-hover:text-amber-400 transition-colors duration-300">
                              {title}
                            </h2>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-500 text-sm font-medium">
                                {year}
                              </span>
                              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800/80 text-zinc-400 font-medium uppercase tracking-wide border border-zinc-700/50">
                                {mediaType}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Load More Button - Liquid Glass */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex justify-center mt-16"
          >
            <motion.button
              onClick={loadMore}
              disabled={loading}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="group relative px-10 py-4 rounded-2xl overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-500"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Inner liquid highlight */}
              <div 
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0) 100%)",
                }}
              />
              
              {/* Top edge light reflection */}
              <div 
                className="absolute top-0 left-4 right-4 h-[1px] opacity-40 group-hover:opacity-70 transition-opacity duration-500"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                }}
              />
              
              {/* Bottom inner glow on hover */}
              <div 
                className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-16 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-700 blur-2xl"
                style={{
                  background: "radial-gradient(ellipse, rgba(255,200,100,0.4), transparent)",
                }}
              />
              
              {/* Content */}
              <span className="relative z-10 flex items-center gap-3 text-white/90 font-medium text-base tracking-wide">
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full"
                    />
                    <span className="text-white/60">Loading...</span>
                  </>
                ) : (
                  <>
                    <span className="text-white/90 group-hover:text-white transition-colors duration-300">Load More</span>
                    <motion.svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="text-white/40 group-hover:text-white/70 transition-colors duration-300"
                      animate={{ y: [0, 3, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <path d="M12 5v14M5 12l7 7 7-7"/>
                    </motion.svg>
                  </>
                )}
              </span>
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 p-3 bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl hover:bg-zinc-800/80 transition-all duration-300 hover:scale-110 group"
          >
            <ChevronUp className="w-6 h-6 text-zinc-400 group-hover:text-amber-400 transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopRated;


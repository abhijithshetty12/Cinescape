import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  Trophy,
  Star,
  Clapperboard,
  Tv,
  ChevronUp,
  Sparkles,
  Crown,
  Play,
  ArrowRight,
  Flame,
  Award,
} from "lucide-react";
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

  const loadMore = useCallback(() => {
    if (!loading) {
      setPage((prevPage) => prevPage + 1);
    }
  }, [loading]);

  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, loading, mediaType]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getRankStyle = (index) => {
    if (index === 0)
      return "bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black shadow-amber-500/20";
    if (index === 1)
      return "bg-gradient-to-r from-zinc-200 to-zinc-400 text-black font-black";
    if (index === 2)
      return "bg-gradient-to-r from-amber-600 to-orange-500 text-white font-black";
    return "bg-zinc-900/90 text-zinc-300 border border-zinc-800 font-bold";
  };

  const getRankIcon = (index) => {
    if (index === 0) return <Crown className="w-3.5 h-3.5" />;
    if (index === 1) return <Sparkles className="w-3.5 h-3.5" />;
    if (index === 2) return <Star className="w-3.5 h-3.5" />;
    return <span className="text-xs">{index + 1}</span>;
  };

  if (initialLoading) {
    return <Loading />;
  }

  const champion = media[0];
  const runnersUp = media.slice(1, 3);
  const remainingMedia = media.slice(3);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent blur-3xl opacity-60" />
        <div className="absolute top-1/3 left-[-150px] w-[450px] h-[450px] bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-[-150px] w-[450px] h-[450px] bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <motion.div
          ref={containerRef}
          style={{ opacity: headerOpacity }}
          className="pt-8 sm:pt-16 pb-4 sm:pb-8 px-4 sm:px-6 lg:px-8"
        >
          <div className="container mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 border-b border-zinc-900 pb-4 sm:pb-8"
            >
              <div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-2 sm:mb-3"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Curated Hall of Fame</span>
                </motion.div>

                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight">
                  Top Rated{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500">
                    {mediaType === "movie" ? "Movies" : "Series"}
                  </span>
                </h1>
              </div>

              <div className="relative flex items-center p-1 bg-zinc-950 rounded-2xl border border-zinc-900 shadow-2xl self-start md:self-auto">
                <button
                  onClick={() => handleMediaTypeChange("movie")}
                  className={`relative z-10 flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 font-semibold text-xs sm:text-sm transition-all duration-300 rounded-xl ${
                    mediaType === "movie"
                      ? "text-black font-bold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Clapperboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Movies</span>
                </button>
                <button
                  onClick={() => handleMediaTypeChange("tv")}
                  className={`relative z-10 flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 font-semibold text-xs sm:text-sm transition-all duration-300 rounded-xl ${
                    mediaType === "tv"
                      ? "text-black font-bold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Series</span>
                </button>
                <motion.div
                  className="absolute inset-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl shadow-md"
                  animate={{
                    width: "calc(50% - 4px)",
                    x: mediaType === "movie" ? 0 : "100%",
                  }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  style={{ zIndex: 0 }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pb-16 sm:pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={mediaType}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 sm:space-y-12"
            >
              {champion && (
                <section className="space-y-4 sm:space-y-6">
                  <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-900 bg-zinc-950 shadow-2xl group">
                    {champion.backdrop_path && (
                      <div className="absolute inset-0 z-0 overflow-hidden">
                        <img
                          src={`https://image.tmdb.org/t/p/w1280${champion.backdrop_path}`}
                          alt={champion.title || champion.name}
                          className="w-full h-full object-cover filter blur-lg opacity-20 scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/95 to-black/75" />
                      </div>
                    )}

                    <div className="relative z-10 p-4 sm:p-8 md:p-10 flex flex-row md:grid md:grid-cols-12 gap-4 sm:gap-8 items-center">
                      <div className="w-28 sm:w-auto flex-shrink-0 md:col-span-4 lg:col-span-3 aspect-[2/3] relative rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                        <img
                          src={
                            champion.poster_path
                              ? `https://image.tmdb.org/t/p/w780${champion.poster_path}`
                              : "/path/to/default-image.jpg"
                          }
                          alt={champion.title || champion.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-gradient-to-r from-amber-400 to-orange-500 text-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 sm:gap-1.5 shadow-xl">
                          <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>Rank #1</span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 md:col-span-8 lg:col-span-9 flex flex-col justify-center space-y-2 sm:space-y-4">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="text-amber-300 font-bold text-xs sm:text-sm">
                              {champion.vote_average?.toFixed(1)} Rating
                            </span>
                          </div>
                          <span className="text-zinc-400 text-xs sm:text-sm font-semibold">
                            {new Date(
                              champion.release_date ||
                                champion.first_air_date ||
                                ""
                            ).getFullYear() || "N/A"}
                          </span>
                          <span className="hidden sm:inline-block text-xs px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium">
                            Global Top Pick
                          </span>
                        </div>

                        <h2 className="text-xl sm:text-4xl lg:text-5xl font-black text-white leading-tight truncate md:whitespace-normal">
                          {champion.title || champion.name}
                        </h2>

                        <p className="text-zinc-400 text-xs sm:text-base leading-relaxed line-clamp-2 sm:line-clamp-3 max-w-3xl">
                          {champion.overview || "No description available."}
                        </p>

                        <div className="pt-1 sm:pt-2">
                          <Link
                            to={
                              mediaType === "movie"
                                ? `/movie/${champion.id}`
                                : `/tv/${champion.id}`
                            }
                            className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold text-xs sm:text-sm hover:brightness-110 transition-all shadow-lg shadow-amber-500/20"
                          >
                            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black" />
                            <span>View Details</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>

                  {runnersUp.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {runnersUp.map((item, idx) => {
                        const rankIndex = idx + 1;
                        const title = item.title || item.name;
                        const poster = item.poster_path
                          ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
                          : "/path/to/default-image.jpg";
                        const year = new Date(
                          item.release_date || item.first_air_date || ""
                        ).getFullYear();

                        return (
                          <div
                            key={item.id}
                            className="relative group rounded-xl sm:rounded-2xl border border-zinc-900 bg-zinc-950 p-3 sm:p-4 flex gap-3 sm:gap-4 items-center hover:border-amber-500/30 transition-all shadow-xl"
                          >
                            <div className="relative aspect-[2/3] w-16 sm:w-24 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 border border-white/5">
                              <img
                                src={poster}
                                alt={title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-10">
                                <span
                                  className={`px-1.5 py-0.5 sm:px-2 rounded-md text-[10px] sm:text-xs ${getRankStyle(
                                    rankIndex
                                  )}`}
                                >
                                  #{rankIndex + 1}
                                </span>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                                <Award
                                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                                    rankIndex === 1
                                      ? "text-zinc-300"
                                      : "text-amber-500"
                                  }`}
                                />
                                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500">
                                  {rankIndex === 1
                                    ? "Runner-Up (#2)"
                                    : "Third Rank (#3)"}
                                </span>
                              </div>

                              <h3 className="text-base sm:text-lg font-bold text-white truncate group-hover:text-amber-400 transition-colors">
                                {title}
                              </h3>

                              <div className="flex items-center gap-2 sm:gap-3 my-1 text-[11px] sm:text-xs text-zinc-400">
                                <span className="flex items-center gap-1 text-amber-400 font-bold">
                                  <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400" />
                                  {item.vote_average?.toFixed(1)}
                                </span>
                                <span>•</span>
                                <span>{year}</span>
                              </div>

                              <p className="text-zinc-500 text-[11px] sm:text-xs line-clamp-1 sm:line-clamp-2 mb-1.5 sm:mb-2">
                                {item.overview}
                              </p>

                              <Link
                                to={
                                  mediaType === "movie"
                                    ? `/movie/${item.id}`
                                    : `/tv/${item.id}`
                                }
                                className="inline-flex items-center gap-1 text-xs text-amber-400 font-semibold group-hover:translate-x-1 transition-transform"
                              >
                                <span>Explore Title</span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              <section className="space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3 sm:pb-4">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    <h2 className="text-base sm:text-xl font-bold tracking-wide uppercase text-zinc-200">
                      Rankings Leaderboard
                    </h2>
                  </div>
                  <span className="text-xs text-zinc-600 font-medium">
                    Showing {media.length} items
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5 md:gap-6">
                  {remainingMedia.map((item, index) => {
                    const actualIndex = index + 3;
                    const title = item.title || item.name || "Untitled";
                    const poster = item.poster_path
                      ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
                      : "/path/to/default-image.jpg";
                    const dateStr =
                      item.release_date || item.first_air_date || "";
                    const year = dateStr
                      ? new Date(dateStr).getFullYear()
                      : "N/A";
                    const to =
                      mediaType === "movie"
                        ? `/movie/${item.id}`
                        : `/tv/${item.id}`;

                    return (
                      <motion.div
                        key={`${mediaType}-${item.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.4,
                          delay: (index % 10) * 0.03,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                      >
                        <Link to={to} className="block group">
                          <div className="relative bg-zinc-950 rounded-xl sm:rounded-2xl overflow-hidden border border-zinc-900 hover:border-amber-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-2">
                            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20">
                              <div
                                className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg shadow-lg backdrop-blur-md ${getRankStyle(
                                  actualIndex
                                )}`}
                              >
                                {getRankIcon(actualIndex)}
                              </div>
                            </div>

                            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20">
                              <div className="flex items-center gap-1 sm:gap-1.5 bg-black/70 backdrop-blur-md px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-white/10">
                                <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 fill-amber-400" />
                                <span className="text-white font-bold text-xs sm:text-sm">
                                  {item.vote_average?.toFixed(1) ?? "N/A"}
                                </span>
                              </div>
                            </div>

                            <div className="relative aspect-[2/3] overflow-hidden">
                              <img
                                src={poster}
                                alt={title}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                loading="lazy"
                              />

                              <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                                <div className="absolute top-0 -inset-full h-full w-1/2 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-none transition-opacity duration-300 group-hover:left-full group-hover:transition-all group-hover:duration-1000 group-hover:ease-out" />
                              </div>

                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

                              <div className="absolute inset-0 flex flex-col justify-end p-2.5 sm:p-4 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0 z-20">
                                <p className="text-white/90 text-xs sm:text-sm font-medium line-clamp-2 mb-1.5 sm:mb-2">
                                  {item.overview || "No description available."}
                                </p>
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <span className="text-[10px] sm:text-xs text-amber-400 font-semibold uppercase tracking-wider">
                                    View Details
                                  </span>
                                  <motion.div
                                    animate={{ x: [0, 4, 0] }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: "linear",
                                    }}
                                  >
                                    <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 rotate-90" />
                                  </motion.div>
                                </div>
                              </div>
                            </div>

                            <div className="p-2.5 sm:p-4 bg-black">
                              <h2 className="text-white font-bold text-xs sm:text-base truncate mb-1 sm:mb-2 group-hover:text-amber-400 transition-colors duration-300">
                                {title}
                              </h2>
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-500 text-xs sm:text-sm font-medium">
                                  {year}
                                </span>
                                <span className="text-[10px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-zinc-900 text-zinc-400 font-medium uppercase tracking-wide border border-zinc-800">
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
              </section>
            </motion.div>
          </AnimatePresence>

          <div ref={sentinelRef} className="h-px w-full mt-8 sm:mt-16" />

          {loading && page > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex justify-center items-center gap-3 py-6 sm:py-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/10 border-t-amber-400 rounded-full"
              />
              <span className="text-zinc-500 text-xs sm:text-sm font-medium">
                Loading more...
              </span>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 p-2.5 sm:p-3 bg-zinc-950 backdrop-blur-xl border border-zinc-800 rounded-xl sm:rounded-2xl shadow-2xl hover:bg-zinc-900 transition-all duration-300 hover:scale-110 group"
          >
            <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-400 group-hover:text-amber-400 transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopRated;
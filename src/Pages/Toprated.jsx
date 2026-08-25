import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
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
            : [...prevMedia, ...response.data.results],
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
      { rootMargin: "200px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, loading, mediaType]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getRankStyle = (index) => {
    if (index === 0)
      return "bg-amber-400/20 text-amber-300 border border-amber-400/30 backdrop-blur-md shadow-lg shadow-amber-500/10 font-bold";
    if (index === 1)
      return "bg-white/10 text-zinc-100 border border-white/20 backdrop-blur-md font-bold";
    if (index === 2)
      return "bg-amber-600/20 text-amber-300 border border-amber-500/30 backdrop-blur-md font-bold";
    return "bg-black/60 text-zinc-300 border border-white/10 backdrop-blur-md font-semibold";
  };

  const getRankIcon = (index) => {
    if (index === 0) return <Crown className="w-3.5 h-3.5" />;
    if (index === 1) return <Sparkles className="w-3.5 h-3.5" />;
    if (index === 2) return <Star className="w-3.5 h-3.5" />;
    return <span className="text-xs font-semibold">{index + 1}</span>;
  };

  if (initialLoading) {
    return <Loading />;
  }

  const champion = media[0];
  const runnersUp = media.slice(1, 3);
  const remainingMedia = media.slice(3);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Segoe_UI',Roboto,sans-serif] tracking-tight selection:bg-amber-500/30">
      {/* Pitch Black Ambient Golden Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[500px] sm:w-[800px] h-[350px] bg-amber-500/10 blur-[140px] rounded-full opacity-60" />
        <div className="absolute top-1/3 -left-32 w-72 sm:w-80 h-72 sm:h-80 bg-amber-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-72 sm:w-80 h-72 sm:h-80 bg-amber-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10">
        <motion.div
          ref={containerRef}
          style={{ opacity: headerOpacity }}
          className="pt-6 sm:pt-14 pb-4 sm:pb-8 px-4 sm:px-6 lg:px-8"
        >
          <div className="container mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 border-b border-white/10 pb-5 sm:pb-8"
            >
              <div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl text-amber-300 text-xs font-medium tracking-wide mb-2 sm:mb-3 shadow-inner"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Curated Hall of Fame</span>
                </motion.div>

                <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
                  Top Rated{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500">
                    {mediaType === "movie" ? "Movies" : "Series"}
                  </span>
                </h1>
              </div>

              {/* Media Type Toggle */}
              <div className="relative flex items-center p-1 bg-black/80 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl self-start md:self-auto">
                <button
                  onClick={() => handleMediaTypeChange("movie")}
                  className={`relative z-10 flex items-center gap-2 px-5 sm:px-6 py-2 sm:py-2.5 font-medium text-xs sm:text-sm transition-all duration-300 rounded-xl ${
                    mediaType === "movie"
                      ? "text-black font-semibold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Clapperboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Movies</span>
                </button>
                <button
                  onClick={() => handleMediaTypeChange("tv")}
                  className={`relative z-10 flex items-center gap-2 px-5 sm:px-6 py-2 sm:py-2.5 font-medium text-xs sm:text-sm transition-all duration-300 rounded-xl ${
                    mediaType === "tv"
                      ? "text-black font-semibold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Series</span>
                </button>
                <motion.div
                  className="absolute inset-1 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 rounded-xl shadow-lg shadow-amber-500/20"
                  animate={{
                    width: "calc(50% - 4px)",
                    x: mediaType === "movie" ? 0 : "100%",
                  }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
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
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 sm:space-y-12"
            >
              {champion && (
                <section className="space-y-4 sm:space-y-6">
                  <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-black/70 backdrop-blur-2xl shadow-2xl group transition-all duration-500 hover:border-amber-500/30">
                    {champion.backdrop_path && (
                      <div className="absolute inset-0 z-0 overflow-hidden">
                        <img
                          src={`https://image.tmdb.org/t/p/w1280${champion.backdrop_path}`}
                          alt={champion.title || champion.name}
                          className="w-full h-full object-cover filter blur-2xl opacity-20 scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t via-black/80 from-black to-transparent md:bg-gradient-to-r md:from-black md:via-black/90 md:to-transparent" />
                      </div>
                    )}

                    <div className="relative z-10 p-5 sm:p-8 md:p-10 flex flex-col md:flex-row md:grid md:grid-cols-12 gap-5 sm:gap-8 items-center">
                      <div className="w-36 sm:w-48 md:w-auto flex-shrink-0 md:col-span-4 lg:col-span-3 aspect-[2/3] relative rounded-2xl overflow-hidden shadow-2xl border border-white/15">
                        <img
                          src={
                            champion.poster_path
                              ? `https://image.tmdb.org/t/p/w780${champion.poster_path}`
                              : "/path/to/default-image.jpg"
                          }
                          alt={champion.title || champion.name}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 bg-gradient-to-r from-amber-400 to-amber-500 text-black px-2.5 py-1 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-xl">
                          <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>Rank #1</span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 md:col-span-8 lg:col-span-9 flex flex-col justify-center space-y-3 sm:space-y-4 text-center md:text-left">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3">
                          <div className="flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/30 backdrop-blur-md px-3 py-1 rounded-xl shadow-inner">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="text-amber-300 font-bold text-xs sm:text-sm">
                              {champion.vote_average?.toFixed(1)} Rating
                            </span>
                          </div>
                          <span className="text-zinc-400 text-xs sm:text-sm font-medium">
                            {new Date(
                              champion.release_date ||
                                champion.first_air_date ||
                                "",
                            ).getFullYear() || "N/A"}
                          </span>
                          <span className="hidden sm:inline-block text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300 font-medium backdrop-blur-md">
                            Global Top Pick
                          </span>
                        </div>

                        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
                          {champion.title || champion.name}
                        </h2>

                        <p className="text-zinc-300/90 text-xs sm:text-base leading-relaxed line-clamp-3 max-w-3xl">
                          {champion.overview || "No description available."}
                        </p>

                        <div className="pt-2 flex justify-center md:justify-start">
                          <Link
                            to={
                              mediaType === "movie"
                                ? `/movie/${champion.id}`
                                : `/tv/${champion.id}`
                            }
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-semibold text-xs sm:text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
                          >
                            <Play className="w-4 h-4 fill-black" />
                            <span>View Details</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>

                  {runnersUp.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {runnersUp.map((item, idx) => {
                        const rankIndex = idx + 1;
                        const title = item.title || item.name;
                        const poster = item.poster_path
                          ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
                          : "/path/to/default-image.jpg";
                        const year = new Date(
                          item.release_date || item.first_air_date || "",
                        ).getFullYear();

                        return (
                          <div
                            key={item.id}
                            className="relative group rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-3.5 sm:p-4 flex gap-4 items-center hover:border-amber-400/30 transition-all duration-500 shadow-xl overflow-hidden"
                          >
                            <div className="relative aspect-[2/3] w-20 sm:w-24 rounded-xl overflow-hidden flex-shrink-0 border border-white/15">
                              <img
                                src={poster}
                                alt={title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute top-2 left-2 z-10">
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-xs ${getRankStyle(
                                    rankIndex,
                                  )}`}
                                >
                                  #{rankIndex + 1}
                                </span>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Award
                                  className={`w-3.5 h-3.5 ${
                                    rankIndex === 1
                                      ? "text-slate-300"
                                      : "text-amber-400"
                                  }`}
                                />
                                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                  {rankIndex === 1
                                    ? "Runner-Up (#2)"
                                    : "Third Rank (#3)"}
                                </span>
                              </div>

                              <h3 className="text-base sm:text-lg font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                                {title}
                              </h3>

                              <div className="flex items-center gap-2.5 my-1 text-[11px] sm:text-xs text-zinc-400">
                                <span className="flex items-center gap-1 text-amber-300 font-semibold">
                                  <Star className="w-3 h-3 fill-amber-300" />
                                  {item.vote_average?.toFixed(1)}
                                </span>
                                <span>•</span>
                                <span>{year}</span>
                              </div>

                              <p className="text-zinc-400 text-[11px] sm:text-xs line-clamp-2 mb-2">
                                {item.overview}
                              </p>

                              <Link
                                to={
                                  mediaType === "movie"
                                    ? `/movie/${item.id}`
                                    : `/tv/${item.id}`
                                }
                                className="inline-flex items-center gap-1 text-xs text-amber-300 font-semibold group-hover:translate-x-1 transition-transform"
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
                <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    <h2 className="text-base sm:text-xl font-bold tracking-tight text-zinc-100">
                      Rankings Leaderboard
                    </h2>
                  </div>
                  <span className="text-xs text-zinc-400 font-medium">
                    Showing {media.length} items
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-5 md:gap-6">
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
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <Link to={to} className="block group">
                          <div className="group relative bg-black/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10 hover:border-amber-400/40 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1.5">
                            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-30">
                              <div className="absolute top-0 -left-[120%] w-[70%] h-full transform -skew-x-12 bg-gradient-to-r from-transparent via-white/10 via-white/25 to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[220%] transition-[left,opacity] duration-[1600ms] ease-[cubic-bezier(0.25,1,0.5,1)] backdrop-blur-[2px]" />
                              <div className="absolute inset-0 rounded-2xl border border-amber-400/0 group-hover:border-amber-300/30 transition-colors duration-700 pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]" />
                            </div>
                            <div className="absolute top-2.5 left-2.5 z-20">
                              <div
                                className={`flex items-center justify-center w-7 h-7 rounded-xl shadow-md backdrop-blur-md ${getRankStyle(
                                  actualIndex,
                                )}`}
                              >
                                {getRankIcon(actualIndex)}
                              </div>
                            </div>

                            <div className="absolute top-2.5 right-2.5 z-20">
                              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-xl border border-white/15">
                                <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                                <span className="text-white font-semibold text-xs">
                                  {item.vote_average?.toFixed(1) ?? "N/A"}
                                </span>
                              </div>
                            </div>

                            <div className="relative aspect-[2/3] overflow-hidden">
                              <img
                                src={poster}
                                alt={title}
                                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                loading="lazy"
                              />

                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-85 transition-opacity duration-500" />

                              <div className="absolute inset-0 flex flex-col justify-end p-3.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20">
                                <p className="text-zinc-200 text-xs font-normal line-clamp-3 mb-2 leading-snug">
                                  {item.overview || "No description available."}
                                </p>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-amber-300 font-semibold uppercase tracking-wider">
                                    View Details
                                  </span>
                                  <motion.div
                                    animate={{ x: [0, 3, 0] }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: "linear",
                                    }}
                                  >
                                    <ChevronUp className="w-3.5 h-3.5 text-amber-300 rotate-90" />
                                  </motion.div>
                                </div>
                              </div>
                            </div>

                            <div className="p-3 bg-black/40 backdrop-blur-md border-t border-white/5">
                              <h2 className="text-white font-semibold text-xs sm:text-sm truncate mb-1 group-hover:text-amber-300 transition-colors duration-300">
                                {title}
                              </h2>
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-xs font-medium">
                                  {year}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-medium uppercase tracking-wider border border-white/10">
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
                className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/20 border-t-amber-400 rounded-full"
              />
              <span className="text-zinc-400 text-xs sm:text-sm font-medium">
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
            className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-50 p-3 bg-black/80 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl hover:border-amber-400/50 active:scale-95 transition-all duration-300 group"
          >
            <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-300 group-hover:text-amber-300 transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopRated;
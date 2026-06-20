import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, LayoutGroup } from "framer-motion";
import Hero from "../components/Hero.tsx";
import { Youtube, Clock, Star, TrendingUp, Bookmark, History, ChevronRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import MovieCarousel from "../components/MovieCarousel.tsx";
import Loading from "../components/Loading.tsx";

type TrailerMovie = {
  id: number;
  title: string;
  release_date?: string;
  trailerKey: string;
  name?: string;
  first_air_date?: string;
};

const Home = () => {
  const [trending, setTrending] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  const [upcomingType, setUpcomingType] = useState<'movie' | 'tv'>('movie');
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [trailers, setTrailers] = useState<TrailerMovie[]>([]);
  const [trailersCategory, setTrailersCategory] = useState<'popular' | 'intheaters' | 'tv'>('popular');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTrailerId, setActiveTrailerId] = useState<number | null>(null);

  const sliderRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const isMobileRef = useRef<boolean>(false);

  const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
  const UPCOMING_URL = `https://api.themoviedb.org/3/movie/upcoming?api_key=${API_KEY}`;
  const UPCOMING_TV_URL = `https://api.themoviedb.org/3/tv/on_the_air?api_key=${API_KEY}`;
  const POPULAR_URL = `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}`;
  const NOW_PLAYING_URL = `https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}`;
  const TV_POPULAR_URL = `https://api.themoviedb.org/3/tv/popular?api_key=${API_KEY}`;

  const menuItems = [
    { icon: TrendingUp, label: "Trending", path: "/trending", accentColor: "#f97316" },
    { icon: Clock, label: "Upcoming", path: "/upcoming", accentColor: "#3b82f6" },
    { icon: Star, label: "Top Rated", path: "/top-rated", accentColor: "#f59e0b" },
    { icon: Bookmark, label: "Watchlist", path: "/watchlist", accentColor: "#06b6d4" },
    { icon: History, label: "History", path: "/history", accentColor: "#10b981" },
  ];

  useEffect(() => {
    const update = () => { isMobileRef.current = window.innerWidth < 768; };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const TRENDING_URL = `https://api.themoviedb.org/3/trending/${mediaType}/week?api_key=${API_KEY}`;
        const trendingResponse = await axios.get(TRENDING_URL);
        const upcomingUrl = upcomingType === 'movie' ? UPCOMING_URL : UPCOMING_TV_URL;
        const upcomingResponse = await axios.get(upcomingUrl);
        setTrending(trendingResponse.data.results);
        setUpcomingMovies(upcomingResponse.data.results);
      } catch (err) {
        setError('Failed to fetch movies');
      } finally {
        setLoading(false);
      }
    };

    const fetchTrailers = async () => {
      try {
        let sourceList: any[] = [];
        if (trailersCategory === 'popular') {
          const res = await axios.get(POPULAR_URL);
          sourceList = res.data.results.slice(0, 20);
        } else if (trailersCategory === 'intheaters') {
          const res = await axios.get(NOW_PLAYING_URL);
          sourceList = res.data.results.slice(0, 20);
        } else {
          const res = await axios.get(TV_POPULAR_URL);
          sourceList = res.data.results.slice(0, 20);
        }

        const trailerPromises = sourceList.map(async (item: any) => {
          try {
            const endpoint = trailersCategory === 'tv' ? 'tv' : 'movie';
            const videoResponse = await axios.get(`https://api.themoviedb.org/3/${endpoint}/${item.id}/videos?api_key=${API_KEY}`);
            const trailer = Array.isArray(videoResponse.data.results)
              ? videoResponse.data.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') || videoResponse.data.results.find((v: any) => v.site === 'YouTube')
              : null;

            if (trailer && trailer.key) {
              return {
                id: item.id,
                title: item.title || item.name || 'Untitled',
                release_date: item.release_date || item.first_air_date,
                trailerKey: trailer.key
              } as TrailerMovie;
            }
            return null;
          } catch {
            return null;
          }
        });

        const trailersData = await Promise.all(trailerPromises);
        setTrailers(trailersData.filter(Boolean) as TrailerMovie[]);
      } catch (err) {
        console.error('Failed to fetch trailers', err);
      }
    };

    fetchMovies();
    fetchTrailers();
  }, [mediaType, trailersCategory, upcomingType]);

  const handleMediaTypeChange = (type: 'movie' | 'tv') => {
    setMediaType(type);
  };

  const handleUpcomingTypeChange = (type: 'movie' | 'tv') => {
    setUpcomingType(type);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const slider = sliderRef.current;
    if (!slider) return;
    isDragging.current = true;
    slider.classList.add("cursor-grabbing");
    startX.current = e.pageX - slider.offsetLeft;
    scrollLeft.current = slider.scrollLeft;
  };

  const handleMouseLeaveOrUp = () => {
    const slider = sliderRef.current;
    if (!slider) return;
    isDragging.current = false;
    slider.classList.remove("cursor-grabbing");
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const slider = sliderRef.current;
    if (!slider || !isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    slider.scrollLeft = scrollLeft.current - walk;
  };

  const MenuItem = ({ icon: Icon, label, path, accentColor }: any) => {
    return (
      <div className="relative group">
        <Link
          to={path}
          className="flex items-center justify-center gap-2 p-2 min-h-[44px] min-w-[44px] md:min-w-0 md:min-h-0 md:p-2.5 md:gap-3 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-xl cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:border-opacity-100 hover:-translate-y-0.5 text-white font-semibold text-[10px] md:text-sm opacity-95 hover:opacity-100 snap-center"
          style={{
            borderColor: `${accentColor}25`,
            boxShadow: `0 4px 20px -4px ${accentColor}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
          }}
        >
          <Icon className="w-4 h-4 md:w-4 md:h-4 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ color: accentColor }} />
          <span className="hidden md:inline whitespace-nowrap">{label}</span>
        </Link>
      </div>
    );
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="bg-[#070709] min-h-screen text-zinc-100">
      <Hero />
      <main className="container mx-auto px-4 py-12 max-w-7xl">

        <div className="flex justify-center gap-3 p-2 m-2 mb-12 overflow-x-auto md:overflow-x-visible md:m-0 md:mb-16 md:p-0 md:grid md:grid-cols-3 lg:grid-cols-5 md:max-w-6xl md:mx-auto no-scrollbar snap-x">
          {menuItems.map((item) => (
            <MenuItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              accentColor={item.accentColor}
            />
          ))}
        </div>

        <LayoutGroup id="mediaToggles">
          <section className="mb-12 md:mb-16">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4 border-b border-zinc-900 pb-4">

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 min-w-0 w-full sm:w-auto">

                <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-orange-950/20 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.08)] shrink-0">
                      <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
                    </div>
                    <h2 className="text-base md:text-2xl font-bold tracking-tight text-white truncate">
                      Trending Now
                    </h2>
                  </div>

                  {/* Mobile-Only Premium 'View All' Link */}
                  <Link
                    to="/trending"
                    className="sm:hidden group/btn inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-orange-400 bg-orange-500/[0.04] border border-orange-500/20 backdrop-blur-md active:scale-[0.98] shrink-0"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Animated Glass Switcher: Under Title on Mobile, Inline on Desktop */}
                <div className="inline-flex items-center bg-zinc-900/60 p-0.5 rounded-xl border border-zinc-800/80 backdrop-blur-md self-start sm:self-auto shrink-0 mt-0.5 sm:mt-0">
                  <button
                    onClick={() => handleMediaTypeChange('movie')}
                    className="relative px-3 py-1 rounded-lg text-[11px] md:text-xs font-semibold transition-colors duration-200 z-10 text-white min-h-[28px] flex items-center"
                  >
                    <span className={mediaType === 'movie' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}>Movies</span>
                    {mediaType === 'movie' && (
                      <motion.div layoutId="trendingActive" className="absolute inset-0 bg-red-600 rounded-lg -z-10 shadow-lg shadow-red-900/20" />
                    )}
                  </button>
                  <button
                    onClick={() => handleMediaTypeChange('tv')}
                    className="relative px-3 py-1 rounded-lg text-[11px] md:text-xs font-semibold transition-colors duration-200 z-10 text-white min-h-[28px] flex items-center"
                  >
                    <span className={mediaType === 'tv' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}>Series</span>
                    {mediaType === 'tv' && (
                      <motion.div layoutId="trendingActive" className="absolute inset-0 bg-red-600 rounded-lg -z-10 shadow-lg shadow-red-900/20" />
                    )}
                  </button>
                </div>
              </div>

              {/* Desktop-Only Premium 'View All' Link */}
              <Link
                to="/trending"
                className="hidden sm:inline-flex group/btn items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold text-orange-400 bg-orange-500/[0.04] hover:bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/40 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] shrink-0 min-h-[32px]"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-1" />
              </Link>
            </div>

            <MovieCarousel movies={trending} mediaType={mediaType} />
          </section>

          <section className="mb-12 md:mb-16">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4 border-b border-zinc-900 pb-4">

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 min-w-0 w-full sm:w-auto">

                <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-950/20 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.08)] shrink-0">
                      <Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                    </div>
                    <h2 className="text-base md:text-2xl font-bold tracking-tight text-white truncate">
                      Upcoming
                    </h2>
                  </div>

                  <Link
                    to="/upcoming"
                    className="sm:hidden group/btn inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-blue-400 bg-blue-500/[0.04] border border-blue-500/20 backdrop-blur-md active:scale-[0.98] shrink-0"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="inline-flex items-center bg-zinc-900/60 p-0.5 rounded-xl border border-zinc-800/80 backdrop-blur-md self-start sm:self-auto shrink-0 mt-0.5 sm:mt-0">
                  <button
                    onClick={() => handleUpcomingTypeChange('movie')}
                    className="relative px-3 py-1 rounded-lg text-[11px] md:text-xs font-semibold transition-colors duration-200 z-10 text-white min-h-[28px] flex items-center"
                  >
                    <span className={upcomingType === 'movie' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}>Movies</span>
                    {upcomingType === 'movie' && (
                      <motion.div layoutId="upcomingActive" className="absolute inset-0 bg-red-600 rounded-lg -z-10 shadow-lg shadow-red-900/20" />
                    )}
                  </button>
                  <button
                    onClick={() => handleUpcomingTypeChange('tv')}
                    className="relative px-3 py-1 rounded-lg text-[11px] md:text-xs font-semibold transition-colors duration-200 z-10 text-white min-h-[28px] flex items-center"
                  >
                    <span className={upcomingType === 'tv' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}>Series</span>
                    {upcomingType === 'tv' && (
                      <motion.div layoutId="upcomingActive" className="absolute inset-0 bg-red-600 rounded-lg -z-10 shadow-lg shadow-red-900/20" />
                    )}
                  </button>
                </div>
              </div>

              <Link
                to="/upcoming"
                className="hidden sm:inline-flex group/btn items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold text-blue-400 bg-blue-500/[0.04] hover:bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] shrink-0 min-h-[32px]"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-1" />
              </Link>
            </div>

            <MovieCarousel movies={upcomingMovies} mediaType={upcomingType} />
          </section>
        </LayoutGroup>

        <section className="mb-16 relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-4 border-b border-zinc-900">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-950/20 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                <Youtube className="w-5 h-5 md:w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Latest Trailers</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mt-1" />
              </h2>
            </div>

            <div className="relative inline-flex items-center rounded-xl bg-zinc-900/80 p-0.5 border border-zinc-800 self-start sm:self-auto">
              {(['popular', 'intheaters', 'tv'] as const).map((catId) => {
                const isActive = trailersCategory === catId;
                const labels = { popular: 'Popular', intheaters: 'In Theatres', tv: 'Series' };
                return (
                  <button
                    key={catId}
                    onClick={() => setTrailersCategory(catId)}
                    className={`relative px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium tracking-wide transition-colors duration-300 z-10 ${isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                  >
                    {labels[catId]}
                    {isActive && (
                      <motion.div
                        layoutId="activeTrailerTab"
                        className="absolute inset-0 bg-red-600 rounded-lg shadow-[0_2px_12px_rgba(220,38,38,0.25)]"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        style={{ zIndex: -1 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative group/scroller">
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#070709] via-[#070709]/40 to-transparent pointer-events-none z-20 opacity-0 group-hover/scroller:opacity-100 transition-opacity duration-500" />

            <div
              ref={sliderRef}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeaveOrUp}
              onMouseUp={handleMouseLeaveOrUp}
              onMouseMove={handleMouseMove}
              className="flex gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory py-4 px-1 cursor-grab scroll-smooth select-none"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {trailers.slice(0, 20).map((movie) => {
                const isTrailerActive = activeTrailerId === movie.id;
                const targetUrl = trailersCategory === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`;
                const year = movie.release_date ? String(new Date(movie.release_date).getFullYear()) : '—';

                return (
                  <div
                    key={movie.id}
                    className="snap-start min-w-[85%] sm:min-w-[48%] md:min-w-[40%] lg:min-w-[28%] xl:min-w-[24%] shrink-0"
                  >
                    <div
                      className="group relative flex flex-col w-full overflow-hidden rounded-2xl bg-zinc-900/30 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
                      style={{ boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.04) inset" }}
                    >
                      <div className="aspect-video relative bg-black/50 w-full overflow-hidden">
                        {isMobileRef.current ? (
                          isTrailerActive ? (
                            <iframe
                              src={`https://www.youtube.com/embed/${movie.trailerKey}?autoplay=1&modestbranding=1&rel=0`}
                              title={`${movie.title} Trailer`}
                              className="w-full h-full object-cover scale-[1.01]"
                              allow="autoplay; fullscreen"
                              allowFullScreen
                              loading="lazy"
                            />
                          ) : (
                            <button
                              onClick={() => setActiveTrailerId(movie.id)}
                              className="w-full h-full flex items-center justify-center bg-cover bg-center relative"
                              aria-label={`Play ${movie.title} trailer`}
                              style={{ backgroundImage: `url(https://img.youtube.com/vi/${movie.trailerKey}/maxresdefault.jpg)` }}
                            >
                              <div className="absolute inset-0 bg-black/40 transition-colors duration-300 group-hover:bg-black/20" />
                              <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] group-hover:scale-110 transition-transform duration-300 z-10">
                                <Play className="w-5 h-5 fill-current ml-0.5 text-black" />
                              </div>
                            </button>
                          )
                        ) : (
                          <div className="w-full h-full relative">
                            <iframe
                              src={`https://www.youtube.com/embed/${movie.trailerKey}?controls=1&modestbranding=1&rel=0`}
                              title={`${movie.title} Trailer`}
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                              allowFullScreen
                              loading="lazy"
                            />
                            <div className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing pointer-events-auto" style={{ bottom: "44px" }} />
                          </div>
                        )}
                      </div>

                      <Link to={targetUrl} className="block relative z-20">
                        <div className="p-4 bg-gradient-to-b from-zinc-900/60 to-zinc-950/90 flex flex-col gap-1">
                          <h3 className="font-semibold text-[14px] md:text-[15px] text-zinc-200 leading-snug tracking-tight group-hover:text-white transition-colors duration-300 line-clamp-1">
                            {movie.title || movie.name || 'Untitled'}
                          </h3>
                          <div className="flex items-center gap-2 text-zinc-500 font-medium text-[12px]">
                            <span className="font-mono tracking-wider">{year}</span>
                            <span className="text-zinc-700 text-[10px]">•</span>
                            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold group-hover:text-red-400 transition-colors duration-300">
                              {trailersCategory === 'tv' ? 'Series' : 'Feature'}
                            </span>
                          </div>
                        </div>
                      </Link>

                      <div className="absolute inset-0 rounded-2xl border border-white/0 pointer-events-none transition-all duration-500 group-hover:border-white/[0.04] z-30" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import Hero from "../components/Hero.tsx";
import { Youtube, Clock, Star, TrendingUp, Bookmark, User, History, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import MovieCarousel from "../components/MovieCarousel.tsx";
import Loading from "../components/Loading.tsx";

const Home = () => {
  const [trending, setTrending] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  const [upcomingType, setUpcomingType] = useState<'movie' | 'tv'>('movie');
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');

const menuItems = [
  {
    icon: TrendingUp,
    label: "Trending",
    path: "/trending",
    accentColor: "#f97316",
  },
  {
    icon: Clock,
    label: "Upcoming",
    path: "/upcoming",
    accentColor: "#3b82f6",
  },
  {
    icon: Star,
    label: "Top Rated",
    path: "/top-rated",
    accentColor: "#f59e0b",
  },
  {
    icon: Bookmark,
    label: "Watchlist",
    path: "/watchlist",
    accentColor: "#06b6d4",
  },
  {
    icon: History,
    label: "History",
    path: "/history",
    accentColor: "#10b981",
  },
];

  const MenuItem = ({ icon: Icon, label, path, accentColor }: any) => {
    return (
      <div className="relative group">
        <Link 
          to={path} 
          className="flex items-center justify-center gap-2 p-2 min-h-[44px] min-w-[44px] md:min-w-0 md:min-h-0 md:p-2.5 md:gap-3 bg-white/10/70 backdrop-blur-xl border border-white/20 md:border-[1px] rounded-xl cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] hover:border-opacity-100 hover:-translate-y-1 text-white font-semibold text-[10px] md:text-sm opacity-90 hover:opacity-100 snap-center"
          style={{
            borderColor: `${accentColor}40`,
            boxShadow: `0 4px 12px -4px ${accentColor}30, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
        >
          <Icon className="w-4 h-4 md:w-4 md:h-4 flex-shrink-0 opacity-100 group-hover:scale-110 transition-all duration-300" style={{ color: accentColor }} />
          <span className="hidden md:inline whitespace-nowrap max-md:hidden">{label}</span>
        </Link>
      </div>
    );
  };



  type TrailerMovie = {
    id: number;
    title: string;
    release_date?: string;
    trailerKey: string;
  };

  const [trailers, setTrailers] = useState<TrailerMovie[]>([]);
  const [trailersCategory, setTrailersCategory] = useState<'popular' | 'intheaters' | 'tv'>('popular');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
  const UPCOMING_URL = `https://api.themoviedb.org/3/movie/upcoming?api_key=${API_KEY}`;
  const UPCOMING_TV_URL = `https://api.themoviedb.org/3/tv/on_the_air?api_key=${API_KEY}`;
  const POPULAR_URL = `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}`;
  const NOW_PLAYING_URL = `https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}`;
  const TV_POPULAR_URL = `https://api.themoviedb.org/3/tv/popular?api_key=${API_KEY}`;

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

  const handleMediaTypeChange = (type: string) => {
    setMediaType(type as 'movie' | 'tv');
  };

  const handleUpcomingTypeChange = (type: 'movie' | 'tv') => {
    setUpcomingType(type);
  };

  const sliderRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const [activeTrailerId, setActiveTrailerId] = useState<number | null>(null);
  const isMobileRef = useRef<boolean>(false);
  useEffect(() => {
    const update = () => { isMobileRef.current = window.innerWidth < 768; };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (loading) {
    return <Loading />;
  }

  return (
    <div>
      <Hero />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-center gap-2 p-2 -m-2 md:m-0 md:p-0 md:gap-4 md:justify-start md:overflow-x-visible md:grid md:grid-cols-3 lg:grid-cols-5 md:gap-4 mb-4 lg:mb-8 md:max-w-6xl md:mx-auto max-w-full no-scrollbar">
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
        {/* ── Trending Now Section ── */}
        <section className="mb-14">
          <div className="flex items-start xs:items-center justify-between mb-6 gap-3">
            {/* Left: accent bar + title + toggle */}
            <div className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-4 min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                  Trending Now
                </h2>
              </div>

              {/* Mobile toggle */}
              <div className="md:hidden ml-[19px] xs:ml-0">
                <div
                  className="inline-flex items-center bg-white/[0.06] border border-white/[0.08] rounded-full p-1"
                  style={{ WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)' }}
                >
                  <button
                    onClick={() => handleMediaTypeChange('movie')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${mediaType === 'movie'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-900/40'
                      : 'text-zinc-400 hover:text-white'}`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => handleMediaTypeChange('tv')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${mediaType === 'tv'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-900/40'
                      : 'text-zinc-400 hover:text-white'}`}
                  >
                    Series
                  </button>
                </div>
              </div>

              {/* Desktop animated toggle */}
              <div className="hidden md:flex items-center">
                <div
                  className="inline-flex items-center bg-white/[0.06] border border-white/[0.08] rounded-full p-1"
                  style={{ WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)' }}
                >
                  <div className="relative flex items-center">
                    <button
                      onClick={() => handleMediaTypeChange('movie')}
                      className={`relative z-10 px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200 ${mediaType === 'movie' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Movies
                    </button>
                    <button
                      onClick={() => handleMediaTypeChange('tv')}
                      className={`relative z-10 px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200 ${mediaType === 'tv' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Series
                    </button>
                    <motion.div
                      className="absolute inset-y-0 bg-red-600 rounded-full shadow-lg shadow-red-900/50"
                      animate={{
                        width: mediaType === 'movie' ? '82px' : '74px',
                        x: mediaType === 'movie' ? 0 : 82,
                      }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: View All */}
            <Link
              to="/trending"
              className="flex items-center gap-0.5 text-xs sm:text-sm font-semibold text-orange-600 hover:text-orange-400 transition-colors duration-200 whitespace-nowrap flex-shrink-0"
            >
              View All
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Link>
          </div>
          <MovieCarousel movies={trending} mediaType={mediaType} />
        </section>

        {/* ── Upcoming Section ── */}
        <section className="mb-14">
          <div className="flex items-start xs:items-center justify-between mb-6 gap-3">
            {/* Left: accent bar + title + toggle */}
            <div className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-4 min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                  <Clock className="w-6 h-6 text-blue-600 shadow-lg shadow-blue-900/40" />
                  Upcoming
                </h2>
              </div>

              {/* Mobile toggle */}
              <div className="md:hidden ml-[19px] xs:ml-0">
                <div
                  className="inline-flex items-center bg-white/[0.06] border border-white/[0.08] rounded-full p-1"
                  style={{ WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)' }}
                >
                  <button
                    onClick={() => handleUpcomingTypeChange('movie')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${upcomingType === 'movie'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-900/40'
                      : 'text-zinc-400 hover:text-white'}`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => handleUpcomingTypeChange('tv')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${upcomingType === 'tv'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-900/40'
                      : 'text-zinc-400 hover:text-white'}`}
                  >
                    Series
                  </button>
                </div>
              </div>

              {/* Desktop animated toggle */}
              <div className="hidden md:flex items-center">
                <div
                  className="inline-flex items-center bg-white/[0.06] border border-white/[0.08] rounded-full p-1"
                  style={{ WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)' }}
                >
                  <div className="relative flex items-center">
                    <button
                      onClick={() => handleUpcomingTypeChange('movie')}
                      className={`relative z-10 px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200 ${upcomingType === 'movie' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Movies
                    </button>
                    <button
                      onClick={() => handleUpcomingTypeChange('tv')}
                      className={`relative z-10 px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200 ${upcomingType === 'tv' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Series
                    </button>
                    <motion.div
                      className="absolute inset-y-0 bg-red-600 rounded-full shadow-lg shadow-red-900/50"
                      animate={{
                        width: upcomingType === 'movie' ? '82px' : '74px',
                        x: upcomingType === 'movie' ? 0 : 82,
                      }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: View All */}
            <Link
              to="/upcoming"
              className="flex items-center gap-0.5 text-xs sm:text-sm font-semibold text-red-600 hover:text-red-400 transition-colors duration-200 whitespace-nowrap flex-shrink-0"
            >
              View All
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Link>
          </div>
          <MovieCarousel movies={upcomingMovies} mediaType={upcomingType} />
        </section>
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 md:gap-4">
              <h2 className="text-lg md:text-2xl font-bold flex items-center gap-1 md:gap-2 text-white">
                <Youtube className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
                <span className="hidden xs:inline">Latest Trailers</span>
                <span className="inline xs:hidden">Trailers</span>
              </h2>

              <div className="hidden md:flex items-center gap-2">
                <div
                  className="relative flex items-center rounded-full bg-white/10 border border-white/20 backdrop-blur-md p-1 shadow"
                  style={{
                    WebkitBackdropFilter: 'blur(12px)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <button
                    onClick={() => setTrailersCategory('popular')}
                    className={`relative z-10 px-3 py-1 rounded-full text-sm font-medium transition-colors ${trailersCategory === 'popular' ? 'text-white' : 'text-gray-300'
                      }`}
                  >
                    Popular
                  </button>
                  <button
                    onClick={() => setTrailersCategory('intheaters')}
                    className={`relative z-10 px-3 py-1 rounded-full text-sm font-medium transition-colors ${trailersCategory === 'intheaters' ? 'text-white' : 'text-gray-300'
                      }`}
                  >
                    In Theatres
                  </button>
                  <button
                    onClick={() => setTrailersCategory('tv')}
                    className={`relative z-10 px-3 py-1 rounded-full text-sm font-medium transition-colors ${trailersCategory === 'tv' ? 'text-white' : 'text-gray-300'
                      }`}
                  >
                    Series
                  </button>
                  <motion.div
                    className="absolute inset-0 bg-red-600 rounded-full"
                    animate={{
                      width: trailersCategory === 'popular' ? '75px' : trailersCategory === 'intheaters' ? '95px' : '65px',
                      x: trailersCategory === 'popular' ? 0 : trailersCategory === 'intheaters' ? 75 : 170,
                    }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  />
                </div>
              </div>

              <div className="w-full md:hidden mt-2">
                <div className="inline-flex items-center justify-center gap-0.5 bg-zinc-900 rounded-full p-0.5 mx-auto max-w-xs">
                  <button
                    onClick={() => setTrailersCategory('popular')}
                    className={`px-2 py-0.5 rounded-full text-[0.7rem] font-medium transition-colors ${trailersCategory === 'popular' ? 'bg-red-600 text-white' : 'text-gray-300'}`}
                    aria-pressed={trailersCategory === 'popular'}
                  >
                    Popular
                  </button>
                  <button
                    onClick={() => setTrailersCategory('intheaters')}
                    className={`px-2 py-0.5 rounded-full text-[0.7rem] font-medium transition-colors ${trailersCategory === 'intheaters' ? 'bg-red-600 text-white' : 'text-gray-300'}`}
                    aria-pressed={trailersCategory === 'intheaters'}
                  >
                    Theatres
                  </button>
                  <button
                    onClick={() => setTrailersCategory('tv')}
                    className={`px-2 py-0.5 rounded-full text-[0.7rem] font-medium transition-colors ${trailersCategory === 'tv' ? 'bg-red-600 text-white' : 'text-gray-300'}`}
                    aria-pressed={trailersCategory === 'tv'}
                  >
                    Series
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            ref={sliderRef}
            onMouseDown={(e) => {
              const slider = sliderRef.current;
              if (!slider) return;
              isDragging.current = true;
              slider.classList.add("cursor-grabbing");
              startX.current = e.pageX - slider.offsetLeft;
              scrollLeft.current = slider.scrollLeft;
            }}
            onMouseLeave={() => {
              const slider = sliderRef.current;
              if (!slider) return;
              isDragging.current = false;
              slider.classList.remove("cursor-grabbing");
            }}
            onMouseUp={() => {
              const slider = sliderRef.current;
              if (!slider) return;
              isDragging.current = false;
              slider.classList.remove("cursor-grabbing");
            }}
            onMouseMove={(e) => {
              const slider = sliderRef.current;
              if (!slider || !isDragging.current) return;
              e.preventDefault();
              const x = e.pageX - slider.offsetLeft;
              const walk = (x - startX.current) * 1;
              slider.scrollLeft = scrollLeft.current - walk;
            }}
            className="flex gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory py-4 cursor-grab"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {trailers.slice(0, 20).map((movie) => (
              <div
                key={movie.id}
                className="snap-center min-w-[85%] md:min-w-[40%] lg:min-w-[24%] p-1"
              >
                <div className="group bg-gradient-to-br from-zinc-900/80 to-zinc-800/80 backdrop-blur-xl border border-zinc-700/40 shadow-2xl rounded-2xl overflow-hidden hover:scale-105 hover:shadow-2xl transition-all duration-300">
                  <div className="aspect-video relative bg-black">
                    {isMobileRef.current ? (
                      activeTrailerId === movie.id ? (
                        <iframe
                          src={`https://www.youtube.com/embed/${movie.trailerKey}?autoplay=1`}
                          title={`${movie.title} Trailer`}
                          className="w-full h-full rounded-t-2xl"
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
                          <span className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-all duration-300 rounded-t-2xl" />
                          <div className="w-16 h-16 rounded-full bg-red-600/80 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300 z-10">
                            <svg className="w-8 h-8 text-white animate-pulse" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        </button>
                      )
                    ) : (
                      <iframe
                        src={`https://www.youtube.com/embed/${movie.trailerKey}`}
                        title={`${movie.title} Trailer`}
                        className="w-full h-full rounded-t-2xl"
                        allowFullScreen
                        loading="lazy"
                      />
                    )}
                  </div>
                  <Link to={trailersCategory === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`} className="block">
                    <div className="p-4">
                      <h3 className="font-bold text-base md:text-lg truncate text-white transition-colors">{movie.title || (movie as any).name || 'Untitled'}</h3>
                      <p className="text-xs text-gray-400">
                        {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
                      </p>
                    </div>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
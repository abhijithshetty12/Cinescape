import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import Hero from "../components/Hero.tsx";
import { Youtube, Clock, Star, TrendingUp, Bookmark, User, History } from "lucide-react";
import { Link } from "react-router-dom";
import MovieCarousel from "../components/MovieCarousel.tsx";
import Loading from "../components/Loading.tsx";

const Home = () => {
  const [trending, setTrending] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  const [upcomingType, setUpcomingType] = useState<'movie' | 'tv'>('movie');
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
          {[
            {
              icon: TrendingUp,
              label: "Trending",
              path: "/trending",
              color: "bg-orange-600",
            },
            {
              icon: Clock,
              label: "Upcoming",
              path: "/upcoming",
              color: "bg-blue-500",
            },
            {
              icon: Star,
              label: "Top Rated",
              path: "/top-rated",
              color: "bg-amber-500",
            },
            {
              icon: Bookmark,
              label: "Watchlist",
              path: "/watchlist",
              color: "bg-cyan-500",
            },
            {
              icon: History,
              label: "History",
              path: "/history",
              color: "bg-green-500",
            },
          ].map((category, index) => (
            <Link
              key={index}
              to={category.path}
              className={`${category.color} p-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-70 transition-opacity`}
            >
              <category.icon className="w-5 h-5" />
              <span className="font-medium text-white">{category.label}</span>
            </Link>
          ))}
        </div>
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col xs:flex-row xs:items-center gap-3 xs:gap-4 w-full">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                <TrendingUp className="w-7 h-7 text-orange-500" />
                Trending Now
              </h2>

              <div className="w-full xs:w-auto md:hidden mt-2">
                <div
                  className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md rounded-full p-1 shadow"
                  style={{
                    WebkitBackdropFilter: 'blur(12px)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <button
                    onClick={() => handleMediaTypeChange('movie')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${mediaType === 'movie'
                      ? 'bg-red-600 text-white shadow'
                      : 'text-gray-300'
                      }`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => handleMediaTypeChange('tv')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${mediaType === 'tv'
                      ? 'bg-red-600 text-white shadow'
                      : 'text-gray-300'
                      }`}
                  >
                    Series
                  </button>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <div
                  className="flex items-center p-1 bg-white/10 border border-white/20 backdrop-blur-md rounded-full w-fit shadow"
                  style={{
                    WebkitBackdropFilter: 'blur(12px)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
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
              </div>
            </div>
            <div className="w-full flex justify-end -mt-6 mb-4">
              <Link
                to="/trending"
                className="inline-flex items-center font-bold uppercase tracking-wide text-yellow-500 hover:text-yellow-400 no-underline whitespace-nowrap text-xs sm:text-base transition-colors duration-200"
              >
                View All
                <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 z-10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
          <MovieCarousel movies={trending} mediaType={mediaType} />
        </section>
        <section className="mb-12">
          <div className="relative w-full">
            <div className="flex flex-col xs:flex-row xs:items-center gap-3 xs:gap-4 w-full">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                <Clock className="w-6 h-6 text-blue-600" />
                Upcoming
              </h2>

              <div className="w-full xs:w-auto md:hidden mt-2">
                <div
                  className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md rounded-full p-1 shadow"
                  style={{
                    WebkitBackdropFilter: 'blur(12px)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <button
                    onClick={() => handleUpcomingTypeChange('movie')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${upcomingType === 'movie'
                      ? 'bg-red-600 text-white shadow'
                      : 'text-gray-300'
                      }`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => handleUpcomingTypeChange('tv')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${upcomingType === 'tv'
                      ? 'bg-red-600 text-white shadow'
                      : 'text-gray-300'
                      }`}
                  >
                    Series
                  </button>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <div
                  className="flex items-center p-1 bg-white/10 border border-white/20 backdrop-blur-md rounded-full w-fit shadow"
                  style={{
                    WebkitBackdropFilter: 'blur(12px)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div className="relative flex items-center rounded-full">
                    <button
                      onClick={() => handleUpcomingTypeChange('movie')}
                      className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${upcomingType === 'movie' ? 'text-white' : 'text-gray-400'
                        }`}
                    >
                      Movies
                    </button>
                    <button
                      onClick={() => handleUpcomingTypeChange('tv')}
                      className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${upcomingType === 'tv' ? 'text-white' : 'text-gray-400'
                        }`}
                    >
                      Series
                    </button>
                    <motion.div
                      className="absolute inset-0 bg-red-600 rounded-full"
                      animate={{
                        width: upcomingType === 'movie' ? '85px' : '80px',
                        x: upcomingType === 'movie' ? 0 : 85,
                      }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute justify-end w-full -mt top-0 mb-20 flex items-center">
              <Link
                to="/upcoming"
                className="inline-flex items-center font-bold uppercase tracking-wide text-yellow-500 hover:text-yellow-400 no-underline whitespace-nowrap text-xs sm:text-base transition-colors duration-200"
              >
                View All
                <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 z-10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
          <MovieCarousel movies={upcomingMovies} mediaType={upcomingType} />
        </section>
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                <Youtube className="w-8 h-8 text-red-600" />
                Latest Trailers
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

              <div className="w-full md:hidden mt-3">
                <div className="inline-flex items-center justify-center gap-1 bg-zinc-900 rounded-full p-1 mx-auto max-w-xs">
                  <button
                    onClick={() => setTrailersCategory('popular')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${trailersCategory === 'popular' ? 'bg-red-600 text-white' : 'text-gray-300'}`}
                    aria-pressed={trailersCategory === 'popular'}
                  >
                    Popular
                  </button>
                  <button
                    onClick={() => setTrailersCategory('intheaters')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${trailersCategory === 'intheaters' ? 'bg-red-600 text-white' : 'text-gray-300'}`}
                    aria-pressed={trailersCategory === 'intheaters'}
                  >
                    In Theatres
                  </button>
                  <button
                    onClick={() => setTrailersCategory('tv')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${trailersCategory === 'tv' ? 'bg-red-600 text-white' : 'text-gray-300'}`}
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
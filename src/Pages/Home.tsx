import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, LayoutGroup } from "framer-motion";
import Hero from "../components/Hero.tsx";
import { Youtube, Clock, Star, TrendingUp, Bookmark, History, Play } from "lucide-react";
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
                    <Icon
                        className="w-4 h-4 md:w-4 md:h-4 flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                        style={{ color: accentColor }}
                    />
                    <span className="hidden md:inline whitespace-nowrap">{label}</span>
                </Link>
            </div>
        );
    };
    if (loading) {
        return <Loading />;
    }
    return (
        <div className="bg-black min-h-screen text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',sans-serif] selection:bg-white/20 antialiased relative overflow-x-hidden">
            <div className="fixed top-[-150px] left-1/2 -translate-x-1/2 w-[350px] sm:w-[700px] h-[350px] sm:h-[500px] bg-gradient-to-br from-pink-500/15 via-red-500/10 to-purple-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
            <div className="fixed top-[50%] -left-[150px] w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none z-0" />
            <Hero />
            <main className="relative z-10 container mx-auto px-3 sm:px-6 py-6 sm:py-12 max-w-6xl">
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
                    <section className="mb-8 sm:mb-16">
                        <div className="flex items-center justify-between mb-3 sm:mb-6 gap-3 pb-2.5 sm:pb-4 border-b border-white/10">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <div className="p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0">
                                    <TrendingUp className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-orange-600" />
                                </div>
                                <h2 className="text-base sm:text-2xl font-bold tracking-tight text-white truncate">
                                    Trending Now
                                </h2>
                            </div>
                            <div className="inline-flex items-center bg-white/10 dark:bg-white/[0.06] backdrop-blur-2xl p-0.5 sm:p-1 rounded-full border border-white/15 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0">
                                <button
                                    onClick={() => handleMediaTypeChange('movie')}
                                    className={`relative px-2.5 py-0.5 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-300 z-10 ${mediaType === 'movie' ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
                                        }`}
                                >
                                    <span>Movies</span>
                                    {mediaType === 'movie' && (
                                        <motion.div
                                            layoutId="trendingActive"
                                            className="absolute inset-0 bg-gradient-to-b from-[#FF3B30] to-[#E02B20] rounded-full -z-10 shadow-[0_4px_15px_rgba(255,59,48,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                </button>
                                <button
                                    onClick={() => handleMediaTypeChange('tv')}
                                    className={`relative px-2.5 py-0.5 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-300 z-10 ${mediaType === 'tv' ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
                                        }`}
                                >
                                    <span>Series</span>
                                    {mediaType === 'tv' && (
                                        <motion.div
                                            layoutId="trendingActive"
                                            className="absolute inset-0 bg-gradient-to-b from-[#FF3B30] to-[#E02B20] rounded-full -z-10 shadow-[0_4px_15px_rgba(255,59,48,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                </button>
                            </div>
                        </div>
                        <MovieCarousel movies={trending} mediaType={mediaType} />
                    </section>
                    <section className="mb-8 sm:mb-16">
                        <div className="flex items-center justify-between mb-3 sm:mb-6 gap-3 pb-2.5 sm:pb-4 border-b border-white/10">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <div className="p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0">
                                    <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-600" />
                                </div>
                                <h2 className="text-base sm:text-2xl font-bold tracking-tight text-white truncate">
                                    Upcoming
                                </h2>
                            </div>
                            <div className="inline-flex items-center bg-white/10 dark:bg-white/[0.06] backdrop-blur-2xl p-0.5 sm:p-1 rounded-full border border-white/15 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0">
                                <button
                                    onClick={() => handleUpcomingTypeChange('movie')}
                                    className={`relative px-2.5 py-0.5 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-300 z-10 ${upcomingType === 'movie' ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
                                        }`}
                                >
                                    <span>Movies</span>
                                    {upcomingType === 'movie' && (
                                        <motion.div
                                            layoutId="upcomingActive"
                                            className="absolute inset-0 bg-gradient-to-b from-[#FF3B30] to-[#E02B20] rounded-full -z-10 shadow-[0_4px_15px_rgba(255,59,48,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                </button>
                                <button
                                    onClick={() => handleUpcomingTypeChange('tv')}
                                    className={`relative px-2.5 py-0.5 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-300 z-10 ${upcomingType === 'tv' ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
                                        }`}
                                >
                                    <span>Series</span>
                                    {upcomingType === 'tv' && (
                                        <motion.div
                                            layoutId="upcomingActive"
                                            className="absolute inset-0 bg-gradient-to-b from-[#FF3B30] to-[#E02B20] rounded-full -z-10 shadow-[0_4px_15px_rgba(255,59,48,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                </button>
                            </div>
                        </div>
                        <MovieCarousel movies={upcomingMovies} mediaType={upcomingType} />
                    </section>
                </LayoutGroup>
                <section className="mb-12 sm:mb-16 relative">
                    <div className="flex items-center justify-between mb-6 sm:mb-8 pb-3 sm:pb-4 border-b border-white/10 gap-3">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <div className="p-2 sm:p-2 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0">
                                <Youtube className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                            </div>
                            <h2 className="text-base sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2 truncate">
                                <span>Latest Trailers</span>
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mt-0.5 shrink-0" />
                            </h2>
                        </div>
                        <div className="inline-flex items-center bg-white/10 dark:bg-white/[0.06] backdrop-blur-2xl p-0.5 sm:p-1 rounded-full border border-white/15 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0">
                            {(['popular', 'intheaters', 'tv'] as const).map((catId) => {
                                const isActive = trailersCategory === catId;
                                const labels = { popular: 'Popular', intheaters: 'In Theatres', tv: 'Series' };
                                return (
                                    <button
                                        key={catId}
                                        onClick={() => setTrailersCategory(catId)}
                                        className={`relative px-2 sm:px-3.5 py-0.5 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all duration-300 z-10 ${isActive ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
                                            }`}
                                    >
                                        {labels[catId]}
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeTrailerTab"
                                                className="absolute inset-0 bg-gradient-to-b from-[#FF3B30] to-[#E02B20] rounded-full -z-10 shadow-[0_4px_15px_rgba(255,59,48,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="relative group/scroller">
                        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-black via-black/40 to-transparent pointer-events-none z-20 opacity-0 group-hover/scroller:opacity-100 transition-opacity duration-500" />
                        <div
                            ref={sliderRef}
                            onMouseDown={handleMouseDown}
                            onMouseLeave={handleMouseLeaveOrUp}
                            onMouseUp={handleMouseLeaveOrUp}
                            onMouseMove={handleMouseMove}
                            className="flex gap-3.5 sm:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory py-2 px-1 cursor-grab scroll-smooth select-none -mx-3 sm:mx-0 px-3 sm:px-0"
                            style={{ WebkitOverflowScrolling: "touch" }}
                        >
                            {trailers.slice(0, 20).map((movie) => {
                                const isTrailerActive = activeTrailerId === movie.id;
                                const targetUrl = trailersCategory === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`;
                                const year = movie.release_date ? String(new Date(movie.release_date).getFullYear()) : '—';
                                return (
                                    <div
                                        key={movie.id}
                                        className="snap-start min-w-[82%] sm:min-w-[45%] md:min-w-[36%] lg:min-w-[28%] shrink-0"
                                    >
                                        <div className="group relative flex flex-col w-full overflow-hidden rounded-2xl sm:rounded-3xl bg-white/10 dark:bg-white/[0.05] backdrop-blur-2xl border border-white/15 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-white/30">
                                            <div className="aspect-video relative bg-black/60 w-full overflow-hidden rounded-t-2xl sm:rounded-t-3xl">
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
                                                            className="w-full h-full flex items-center justify-center bg-cover bg-center relative group/play"
                                                            aria-label={`Play ${movie.title} trailer`}
                                                            style={{ backgroundImage: `url(https://img.youtube.com/vi/${movie.trailerKey}/maxresdefault.jpg)` }}
                                                        >
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-colors duration-300" />
                                                            <div className="w-12 h-12 rounded-full bg-white/25 backdrop-blur-md border border-white/40 text-white flex items-center justify-center shadow-2xl group-hover/play:scale-110 transition-transform duration-300 z-10">
                                                                <Play className="w-5 h-5 fill-white ml-0.5 text-white" />
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
                                                <div className="p-3.5 sm:p-4 bg-transparent flex flex-col gap-1">
                                                    <h3 className="font-semibold text-sm sm:text-base text-white leading-snug tracking-tight group-hover:text-red-400 transition-colors duration-300 line-clamp-1">
                                                        {movie.title || movie.name || 'Untitled'}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-white/50 font-medium text-xs">
                                                        <span className="tracking-tight">{year}</span>
                                                        <span className="text-white/30 text-[10px]">•</span>
                                                        <span className="text-[10px] uppercase tracking-wider text-white/70 font-semibold px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                                                            {trailersCategory === 'tv' ? 'Series' : 'Feature'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>
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
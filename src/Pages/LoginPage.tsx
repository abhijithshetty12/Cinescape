import React, { useState, useEffect, useRef } from 'react';
import fetchRandomMovieImages from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Bookmark,
  TrendingUp,
  Search,
  Film,
  Check,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  X,
  Loader2,
  ChevronRight,
  Tv
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { getPasswordPolicyError, passwordMeetsPolicy, getRegistrationError } from '../utils/passwordPolicy.ts';

const TMDB_KEY = '859afbb4b98e3b467da9c99ac390e950';

interface TmdbImage {
  file_path: string;
  width: number;
  height: number;
  vote_average: number;
}

const LoginPage: React.FC = () => {
  const { user, login, logout, register, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [rail1, setRail1] = useState<string[]>([]);
  const [rail2, setRail2] = useState<string[]>([]);
  const [rail3, setRail3] = useState<string[]>([]);

  const [bgSearchOpen, setBgSearchOpen] = useState(false);
  const [bgSearchQuery, setBgSearchQuery] = useState('');
  const [bgSearchResults, setBgSearchResults] = useState<any[]>([]);
  const [bgImages, setBgImages] = useState<TmdbImage[]>([]);
  const [bgSearchLoading, setBgSearchLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ id: number; type: string; title: string } | null>(null);
  const [bgMediaType, setBgMediaType] = useState<'movie' | 'tv'>('movie');
  const [bgCategory, setBgCategory] = useState<string>('trending');
  const [bgPage, setBgPage] = useState(1);
  const [bgTotalPages, setBgTotalPages] = useState(1);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const loadBackground = async (attempt = 0) => {
      try {
        const image = await fetchRandomMovieImages();
        if (!image || typeof image !== 'string') {
          throw new Error('No background image returned');
        }

        await new Promise<void>((resolve, reject) => {
          const preload = new Image();
          const timeout = window.setTimeout(() => {
            preload.onload = null;
            preload.onerror = null;
            reject(new Error('Background image timed out'));
          }, 12000);
          preload.onload = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          preload.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error('Background image failed to load'));
          };
          preload.src = image;
          if (preload.complete && preload.naturalWidth > 0) {
            window.clearTimeout(timeout);
            resolve();
          }
        });

        if (!cancelled) setBackgroundImage(image);
      } catch {
        if (!cancelled && attempt < 5) {
          retryTimer = setTimeout(() => loadBackground(attempt + 1), Math.min(1500 * (attempt + 1), 6000));
        }
      }
    };

    loadBackground();

    const loadRails = async () => {
      try {
        const [moviesRes, tvRes, animeRes] = await Promise.all([
          axios.get(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}`),
          axios.get(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_KEY}`),
          axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_genres=16&sort_by=popularity.desc`)
        ]);

        if (!cancelled) {
          const getPosters = (results: any[]) => results
            .filter((m: any) => m.poster_path)
            .slice(0, 10)
            .map((m: any) => `https://image.tmdb.org/t/p/w342${m.poster_path}`);

          setRail1(getPosters(moviesRes.data.results));
          setRail2(getPosters(tvRes.data.results));
          setRail3(getPosters(animeRes.data.results));
        }
      } catch {
        if (!cancelled) {
          const fallback = [
            'https://image.tmdb.org/t/p/w342/1X7vow16X7CnCoexXh4H4F2yDJv.jpg',
            'https://image.tmdb.org/t/p/w342/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
            'https://image.tmdb.org/t/p/w342/pFlaoHTZeyNkG83vxsAJiGzfSsa.jpg',
            'https://image.tmdb.org/t/p/w342/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg'
          ];
          setRail1(fallback);
          setRail2([...fallback].reverse());
          setRail3(fallback);
        }
      }
    };
    loadRails();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    setBgPage(1);
  }, [bgSearchQuery, bgMediaType, bgCategory]);

  useEffect(() => {
    if (!bgSearchOpen || selectedMedia) return;

    let cancelled = false;
    const fetchResults = async () => {
      if (bgPage === 1) setBgSearchLoading(true);

      try {
        let endpoint = '';
        if (bgSearchQuery.trim()) {
          endpoint = `https://api.themoviedb.org/3/search/${bgMediaType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(bgSearchQuery)}&include_adult=false&page=${bgPage}`;
        } else {
          if (bgCategory === 'trending') {
            endpoint = `https://api.themoviedb.org/3/trending/${bgMediaType}/week?api_key=${TMDB_KEY}&page=${bgPage}`;
          } else if (bgCategory === 'popular') {
            endpoint = `https://api.themoviedb.org/3/${bgMediaType}/popular?api_key=${TMDB_KEY}&page=${bgPage}`;
          } else if (bgCategory === 'top_rated') {
            endpoint = `https://api.themoviedb.org/3/${bgMediaType}/top_rated?api_key=${TMDB_KEY}&page=${bgPage}`;
          } else if (bgCategory === 'now_playing' && bgMediaType === 'movie') {
            endpoint = `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&page=${bgPage}`;
          } else if (bgCategory === 'upcoming' && bgMediaType === 'movie') {
            endpoint = `https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_KEY}&page=${bgPage}`;
          } else if (bgCategory === 'airing_today' && bgMediaType === 'tv') {
            endpoint = `https://api.themoviedb.org/3/tv/airing_today?api_key=${TMDB_KEY}&page=${bgPage}`;
          } else {
            endpoint = `https://api.themoviedb.org/3/${bgMediaType}/popular?api_key=${TMDB_KEY}&page=${bgPage}`;
          }
        }

        const res = await axios.get(endpoint);
        if (!cancelled) {
          const filtered = res.data.results.filter((r: any) => r.backdrop_path);
          setBgSearchResults(prev => bgPage === 1 ? filtered : [...prev, ...filtered]);
          setBgTotalPages(res.data.total_pages > 500 ? 500 : res.data.total_pages);
        }
      } catch {
        if (!cancelled && bgPage === 1) setBgSearchResults([]);
      } finally {
        if (!cancelled && bgPage === 1) setBgSearchLoading(false);
      }
    };

    const timer = setTimeout(fetchResults, bgSearchQuery.trim() && bgPage === 1 ? 400 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bgSearchQuery, bgSearchOpen, bgMediaType, bgCategory, bgPage, selectedMedia]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && bgPage < bgTotalPages && !bgSearchLoading && !selectedMedia) {
          setBgPage(prev => prev + 1);
        }
      },
      { threshold: 1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [bgPage, bgTotalPages, bgSearchLoading, selectedMedia]);

  const handleSelectMedia = async (media: any) => {
    setSelectedMedia({ id: media.id, type: media.media_type || bgMediaType, title: media.title || media.name });
    setBgSearchLoading(true);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/${media.media_type || bgMediaType}/${media.id}/images?api_key=${TMDB_KEY}&include_image_language=en,null`);
      setBgImages(res.data.backdrops.slice(0, 12));
    } catch {
      setBgImages([]);
    } finally {
      setBgSearchLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);

    try {
      await register(email, password);
      navigate('/home');
    } catch (err: any) {
      setError(getRegistrationError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      await loginWithGoogle();
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Google login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Bookmark, text: 'Track your favorites' },
    { icon: TrendingUp, text: 'Discover trending hits' },
    { icon: Search, text: 'Explore vast catalog' },
    { icon: Film, text: 'Build your watchlists' },
  ];

  const formVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { opacity: 0, y: -15, transition: { duration: 0.2, ease: 'easeIn' } },
  };

  const categories = [
    { id: 'trending', label: 'Trending', media: 'both' },
    { id: 'popular', label: 'Popular', media: 'both' },
    { id: 'top_rated', label: 'Top Rated', media: 'both' },
    { id: 'now_playing', label: 'Now Playing', media: 'movie' },
    { id: 'upcoming', label: 'Upcoming', media: 'movie' },
    { id: 'airing_today', label: 'Airing Today', media: 'tv' },
  ];

  return (
    <>
      <div className="relative h-[100dvh] w-full overflow-hidden bg-[#050505] text-white flex flex-col lg:flex-row font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]">

        {/* Mobile Logo */}
        <div className="absolute top-6 left-6 z-50 lg:hidden">
          <img 
            src="/Cinescape_Logo.svg" 
            alt="Cinescape" 
            className="h-8 w-auto object-contain drop-shadow-lg" 
          />
        </div>

        <div className="absolute top-0 left-0 w-full h-[45dvh] lg:hidden pointer-events-none z-0 overflow-hidden bg-[#050505]">
          <div className="absolute inset-0 flex justify-center gap-1.5 sm:gap-2 px-2 opacity-50">
            <div className="w-1/3 h-full overflow-hidden relative">
              <motion.div
                animate={{ y: ["0%", "-50%"] }}
                transition={{ repeat: Infinity, ease: "linear", duration: 25 }}
                className="flex flex-col gap-1.5 sm:gap-2"
              >
                {[...rail1, ...rail1].map((src, i) => (
                  <div key={i} className="w-full aspect-[2/3] rounded-lg overflow-hidden shrink-0 border border-white/10">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </motion.div>
            </div>

            <div className="w-1/3 h-full overflow-hidden relative">
              <motion.div
                animate={{ y: ["-50%", "0%"] }}
                transition={{ repeat: Infinity, ease: "linear", duration: 28 }}
                className="flex flex-col gap-1.5 sm:gap-2"
              >
                {[...rail2, ...rail2].map((src, i) => (
                  <div key={i} className="w-full aspect-[2/3] rounded-lg overflow-hidden shrink-0 border border-white/10">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </motion.div>
            </div>

            <div className="w-1/3 h-full overflow-hidden relative">
              <motion.div
                animate={{ y: ["0%", "-50%"] }}
                transition={{ repeat: Infinity, ease: "linear", duration: 22 }}
                className="flex flex-col gap-1.5 sm:gap-2"
              >
                {[...rail3, ...rail3].map((src, i) => (
                  <div key={i} className="w-full aspect-[2/3] rounded-lg overflow-hidden shrink-0 border border-white/10">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </motion.div>
            </div>
          </div>

          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#050505]/60 to-[#050505]" />
        </div>

        <div className="hidden lg:block absolute inset-0 z-0">
          <motion.div
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: 1.08, opacity: backgroundImage ? 1 : 0 }}
            transition={{ scale: { duration: 20, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }, opacity: { duration: 0.8, ease: 'easeOut' } }}
            className="absolute inset-0"
            style={{
              backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
        </div>

        <button
          onClick={() => setBgSearchOpen(true)}
          className="hidden lg:flex absolute top-4 right-6 z-50 items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-semibold text-zinc-300 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Change Backdrop
        </button>

        <div className="relative z-10 w-full h-full flex flex-col lg:flex-row overflow-hidden">
          <div className="hidden lg:flex lg:w-[55%] flex-col justify-center px-16 xl:px-24 py-12 h-full">
            <div className="max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-8"
              >
                <img
                  src="/Logo.png"
                  alt="Cinescape"
                  className="h-16 object-contain drop-shadow-2xl"
                />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-5xl xl:text-6xl font-extrabold leading-tight mb-4"
              >
                <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                  Your Cinema
                </span>
                <br />
                <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
                  Universe Awaits
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-lg text-gray-400 mb-10 max-w-md"
              >
                Discover, track, and curate your personal movie journey with Cinescape.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="space-y-4"
              >
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.text}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                    className="flex items-center gap-4 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-red-500/20 group-hover:border-red-500/30 transition-all duration-300">
                      <feature.icon className="w-5 h-5 text-gray-300 group-hover:text-red-400 transition-colors" />
                    </div>
                    <span className="text-gray-300 text-sm font-medium">{feature.text}</span>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-end sm:justify-center h-full px-3 pb-6 sm:p-6 lg:p-8 xl:p-12 overflow-hidden lg:pt-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="w-full max-w-sm sm:max-w-md mx-auto lg:mx-0 lg:ml-auto lg:mt-12 xl:mt-16"
            >
              <div className="relative flex max-h-full w-full flex-col overflow-hidden lg:backdrop-blur-3xl lg:bg-zinc-950/65 rounded-[28px] p-4 sm:p-8 lg:shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-36 bg-gradient-to-b from-red-600/30 via-orange-500/10 to-transparent blur-2xl pointer-events-none lg:block hidden" />

                <div className="flex flex-col flex-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isRegistering ? 'register-header' : 'login-header'}
                      variants={formVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-center mb-6 sm:mb-8 shrink-0"
                    >
                      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1.5 sm:mb-2">
                        {isRegistering ? 'Create Account' : 'Welcome back'}
                      </h2>
                      <p className="text-zinc-400 text-[11px] sm:text-sm">
                        {isRegistering
                          ? 'Begin your cinematic journey.'
                          : 'Continue your cinematic odyssey.'}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="mb-4 sm:mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-3 sm:p-4 flex items-start gap-2.5 shrink-0"
                      >
                        <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-red-300 text-[11px] sm:text-sm leading-relaxed">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={isRegistering ? handleRegister : handleLogin} className="shrink-0">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isRegistering ? 'register-fields' : 'login-fields'}
                        variants={formVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="space-y-3 sm:space-y-4"
                      >
                        <div className="relative flex items-center bg-[#18181b]/80 lg:bg-zinc-900/50 border border-white/[0.08] lg:border-white/10 rounded-xl sm:rounded-2xl px-3.5 sm:px-4 py-3 sm:py-2.5 focus-within:border-red-500/50 focus-within:ring-1 focus-within:ring-red-500/50 transition-all duration-300">
                          <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-500 flex-shrink-0 mr-3" />
                          <div className="relative w-full flex flex-col justify-center">
                            <label className="text-[9px] sm:text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                              Email Address
                            </label>
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="name@example.com"
                              className="bg-transparent text-white text-xs sm:text-sm focus:outline-none placeholder-zinc-600 w-full pt-0.5"
                              required
                            />
                          </div>
                        </div>

                        <div className="relative flex items-center bg-[#18181b]/80 lg:bg-zinc-900/50 border border-white/[0.08] lg:border-white/10 rounded-xl sm:rounded-2xl px-3.5 sm:px-4 py-3 sm:py-2.5 focus-within:border-red-500/50 focus-within:ring-1 focus-within:ring-red-500/50 transition-all duration-300">
                          <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-500 flex-shrink-0 mr-3" />
                          <div className="relative w-full flex flex-col justify-center pr-8">
                            <label className="text-[9px] sm:text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                              Password
                            </label>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              autoComplete={isRegistering ? "new-password" : "current-password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="bg-transparent text-white text-xs sm:text-sm focus:outline-none placeholder-zinc-600 w-full pt-0.5"
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 sm:right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                          </button>
                        </div>

                        {isRegistering && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 px-1" aria-live="polite">
                              {passwordMeetsPolicy(password) ? <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" /> : <Circle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-500" />}
                              <span className={`text-[10px] sm:text-xs ${passwordMeetsPolicy(password) ? 'text-emerald-400' : 'text-zinc-400'}`}>At least 12 characters</span>
                            </div>
                            <div className="relative flex items-center bg-[#18181b]/80 lg:bg-zinc-900/50 border border-white/[0.08] lg:border-white/10 rounded-xl sm:rounded-2xl px-3.5 sm:px-4 py-3 sm:py-2.5 focus-within:border-red-500/50 transition-colors">
                              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-500 shrink-0 mr-3" />
                              <div className="w-full flex flex-col pr-8">
                                <label htmlFor="register-confirm-password" className="text-[9px] sm:text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Confirm Password</label>
                                <input id="register-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Confirm your password" className="bg-transparent text-white text-xs sm:text-sm focus:outline-none placeholder-zinc-600 w-full pt-0.5" required />
                              </div>
                              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3.5 sm:right-4 text-zinc-500 hover:text-zinc-300" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}>
                                {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                              </button>
                            </div>
                          </div>
                        )}

                        {!isRegistering && (
                          <div className="flex items-center justify-between pt-0.5 sm:pt-1 px-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none group">
                              <div
                                onClick={() => setRememberMe(!rememberMe)}
                                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[4px] sm:rounded-md border transition-all duration-200 flex items-center justify-center shadow-sm ${rememberMe
                                  ? 'bg-gradient-to-br from-red-500 to-red-600 border-red-500'
                                  : 'bg-[#18181b] lg:bg-zinc-900/80 border-zinc-700/80 group-hover:border-zinc-500'
                                  }`}
                              >
                                {rememberMe && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white stroke-[3]" />}
                              </div>
                              <span className="text-[11px] sm:text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors font-medium">
                                Remember me
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setError('Password reset coming soon!')}
                              className="text-[11px] sm:text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                            >
                              Forgot password?
                            </button>
                          </div>
                        )}

                        <div className="pt-1.5 sm:pt-2">
                          <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full flex items-center justify-center py-4 sm:py-3.5 px-6 rounded-xl sm:rounded-2xl font-bold text-[13px] sm:text-sm tracking-wider uppercase transition-all duration-300 shadow-lg border border-red-400/30
                            bg-gradient-to-r from-red-500 via-red-600 to-orange-600 hover:brightness-110 active:scale-[0.98] shadow-red-600/30
                            ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            {isLoading ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <span className="drop-shadow-sm">
                                {isRegistering ? 'SIGN UP' : 'LOGIN'}
                              </span>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </form>

                  <div className="relative my-5 sm:my-6 flex items-center justify-center shrink-0">
                    <div className="w-full flex items-center gap-3">
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 lg:via-white/15 to-white/10 lg:to-white/15" />
                      <span className="text-[9px] sm:text-[10px] font-semibold text-zinc-500 lg:text-zinc-400 tracking-widest uppercase whitespace-nowrap px-1">
                        OR CONTINUE WITH
                      </span>
                      <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-white/10 lg:via-white/15 to-white/10 lg:to-white/15" />
                    </div>
                  </div>

                  <div className="shrink-0">
                    <button
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className={`w-full flex items-center justify-center gap-3 py-3.5 sm:py-3 px-6 rounded-xl sm:rounded-2xl font-medium text-[13px] sm:text-sm transition-all duration-300 bg-[#18181b]/80 lg:bg-zinc-900/60 border border-white/[0.08] lg:border-white/10 hover:bg-[#27272a] lg:hover:bg-zinc-800/80 hover:border-white/20 text-zinc-200
                      ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      aria-label="Login with Google"
                    >
                      <svg className="w-4 h-4 sm:w-4 sm:h-4" viewBox="0 0 24 24">
                        <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#34A853" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span>Google</span>
                    </button>
                  </div>

                  <div className="mt-6 sm:mt-6 text-center shrink-0">
                    <span className="text-zinc-500 text-xs sm:text-sm">
                      {isRegistering ? 'Already have an account?' : "Don't have an account?"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(!isRegistering);
                        setError('');
                      }}
                      className="ml-2 text-red-400 hover:text-red-300 font-semibold text-xs sm:text-sm transition-colors"
                    >
                      {isRegistering ? 'Login' : 'Sign up'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {bgSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-end justify-center bg-black/70 px-0 pb-0 pt-12 backdrop-blur-xl sm:items-center sm:px-5 sm:pb-5"
            onMouseDown={(event) => { if (event.target === event.currentTarget) setBgSearchOpen(false); }}
          >
            <motion.div
              initial={{ y: 36, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 36, opacity: 0 }}
              className="flex max-h-[calc(100dvh-48px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#141417] shadow-2xl sm:max-h-[85vh] sm:rounded-[28px]"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-white">Set the scene</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">Make your login page feel like your favorite film</p>
                </div>
                <button
                  onClick={() => {
                    setBgSearchOpen(false);
                    setSelectedMedia(null);
                    setBgSearchQuery('');
                    setBgImages([]);
                  }}
                  aria-label="Close background selector"
                  className="rounded-full bg-white/10 p-2 text-zinc-300 hover:bg-white/20 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6">
                {selectedMedia ? (
                  <button
                    onClick={() => {
                      setSelectedMedia(null);
                      setBgImages([]);
                    }}
                    className="mb-4 flex items-center gap-2 self-start text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Back to titles <span className="text-zinc-500">/ {selectedMedia.title}</span>
                  </button>
                ) : (
                  <div className="mb-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          value={bgSearchQuery}
                          onChange={(event) => setBgSearchQuery(event.target.value)}
                          placeholder={`Search ${bgMediaType === 'movie' ? 'movies' : 'series'}...`}
                          className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-red-500/50 transition-colors"
                        />
                      </div>
                      <div className="flex rounded-full border border-white/10 bg-black/40 p-1 shrink-0 w-full sm:w-auto">
                        <button
                          onClick={() => { setBgMediaType('movie'); setBgSearchQuery(''); setBgCategory('trending'); }}
                          className={`flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${bgMediaType === 'movie' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                        >
                          <Film className="h-3.5 w-3.5" />
                          Movies
                        </button>
                        <button
                          onClick={() => { setBgMediaType('tv'); setBgSearchQuery(''); setBgCategory('trending'); }}
                          className={`flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${bgMediaType === 'tv' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                        >
                          <Tv className="h-3.5 w-3.5" />
                          Series
                        </button>
                      </div>
                    </div>

                    {!bgSearchQuery && (
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden">
                        {categories.filter(c => c.media === 'both' || c.media === bgMediaType).map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setBgCategory(cat.id)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${bgCategory === cat.id ? 'bg-white text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {bgSearchLoading && bgPage === 1 && (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin text-red-500" /> Loading...
                  </div>
                )}

                {!bgSearchLoading && selectedMedia ? (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {bgImages.map((img) => (
                      <button
                        key={img.file_path}
                        onClick={() => {
                          setBackgroundImage(`https://image.tmdb.org/t/p/original${img.file_path}`);
                          setBgSearchOpen(false);
                          setSelectedMedia(null);
                          setBgSearchQuery('');
                          setBgImages([]);
                        }}
                        className="group relative overflow-hidden rounded-xl border border-white/10 transition hover:border-red-500/50"
                      >
                        <img
                          src={`https://image.tmdb.org/t/p/w500${img.file_path}`}
                          alt=""
                          className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </button>
                    ))}
                    {bgImages.length === 0 && (
                      <p className="col-span-full py-8 text-center text-sm text-zinc-500">
                        No backdrops available for this title.
                      </p>
                    )}
                  </div>
                ) : !bgSearchLoading || bgPage > 1 ? (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {bgSearchResults.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectMedia(item)}
                          className="group relative overflow-hidden rounded-xl border border-white/10 text-left transition hover:border-red-500/40"
                        >
                          <img
                            src={`https://image.tmdb.org/t/p/w300${item.backdrop_path}`}
                            alt={item.title || item.name}
                            className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent px-2.5 pb-2 pt-8">
                            <p className="truncate text-xs font-semibold text-white">{item.title || item.name}</p>
                          </div>
                        </button>
                      ))}
                      {bgSearchResults.length === 0 && bgSearchQuery && (
                        <p className="col-span-full py-8 text-center text-sm text-zinc-500">No results found.</p>
                      )}
                    </div>
                    {bgPage < bgTotalPages && !bgSearchQuery && (
                      <div ref={observerTarget} className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LoginPage;
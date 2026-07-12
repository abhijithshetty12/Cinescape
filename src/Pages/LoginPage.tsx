import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LoginPage: React.FC = () => {
  const { user, login, logout, register, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchBackgroundImage = async () => {
      const image = await fetchRandomMovieImages();
      setBackgroundImage(image);
    };
    fetchBackgroundImage();
  }, []);

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
    setIsLoading(true);

    try {
      await register(email, password);
      navigate('/home');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use. Please log in.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
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

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white flex">
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: 1.08 }}
        transition={{ duration: 20, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 z-10" />

      <div className="relative z-20 w-full min-h-screen flex flex-col lg:flex-row">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="hidden lg:flex lg:w-[55%] flex-col justify-center px-16 xl:px-24 py-12"
        >
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
        </motion.div>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="w-full max-w-sm sm:max-w-md"
          >
            <div className="relative backdrop-blur-3xl bg-zinc-950/65 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden">

              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-36 bg-gradient-to-b from-red-600/30 via-orange-500/10 to-transparent blur-2xl pointer-events-none" />

              <div className="lg:hidden flex justify-center mb-6">
                <img
                  src="/Logo.png"
                  alt="Cinescape"
                  className="h-10 sm:h-12 object-contain drop-shadow-lg"
                />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={isRegistering ? 'register-header' : 'login-header'}
                  variants={formVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="text-center mb-8"
                >
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
                    {isRegistering ? 'Create Account' : 'Welcome back'}
                  </h2>
                  <p className="text-zinc-400 text-xs sm:text-sm">
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
                    className="mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-xs sm:text-sm leading-relaxed">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={isRegistering ? handleRegister : handleLogin}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isRegistering ? 'register-fields' : 'login-fields'}
                    variants={formVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="space-y-4"
                  >
                    <div className="relative flex items-center bg-zinc-900/50 border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-red-500/50 focus-within:ring-1 focus-within:ring-red-500/50 transition-all duration-300">
                      <Mail className="w-5 h-5 text-zinc-500 flex-shrink-0 mr-3" />
                      <div className="relative w-full flex flex-col justify-center">
                        <label className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600 w-full pt-0.5"
                          required
                        />
                      </div>
                    </div>

                    <div className="relative flex items-center bg-zinc-900/50 border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-red-500/50 focus-within:ring-1 focus-within:ring-red-500/50 transition-all duration-300">
                      <Lock className="w-5 h-5 text-zinc-500 flex-shrink-0 mr-3" />
                      <div className="relative w-full flex flex-col justify-center pr-8">
                        <label className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                          Password
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600 w-full pt-0.5"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>

                    {!isRegistering && (
                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                          <div
                            onClick={() => setRememberMe(!rememberMe)}
                            className={`w-4 h-4 rounded-md border transition-all duration-200 flex items-center justify-center shadow-sm ${rememberMe
                                ? 'bg-gradient-to-br from-red-500 to-red-600 border-red-500'
                                : 'bg-zinc-900/80 border-zinc-700/80 group-hover:border-zinc-500'
                              }`}
                          >
                            {rememberMe && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          </div>
                          <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors font-medium">
                            Remember me
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setError('Password reset coming soon!')}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full flex items-center justify-center py-3.5 px-6 rounded-2xl font-bold text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 shadow-lg border border-red-400/30
                        bg-gradient-to-r from-red-500 via-red-600 to-orange-600 hover:brightness-110 active:scale-[0.98] shadow-red-600/30
                        ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <span className="drop-shadow-sm">
                            {isRegistering ? 'SIGN UP' : 'SIGN IN'}
                          </span>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </form>

              <div className="relative my-6 flex items-center justify-center">
                <div className="w-full flex items-center gap-3">
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/15 to-white/15" />
                  <span className="text-[10px] font-semibold text-zinc-400 tracking-widest uppercase whitespace-nowrap px-1">
                    OR CONTINUE WITH
                  </span>
                  <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-white/15 to-white/15" />
                </div>
              </div>

              <div>
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center gap-3 py-3 px-6 rounded-2xl font-medium text-xs sm:text-sm transition-all duration-300 bg-zinc-900/60 border border-white/10 hover:bg-zinc-800/80 hover:border-white/20 text-zinc-200
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Login with Google"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#4285F4"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Google</span>
                </button>
              </div>

              <div className="mt-6 text-center">
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
                  {isRegistering ? 'Sign in' : 'Sign up'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
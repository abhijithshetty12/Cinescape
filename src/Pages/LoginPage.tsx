import React, { useState, useEffect } from 'react';
import fetchRandomMovieImages from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
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

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err: any) {
      setError(err.message || 'Logout failed. Please try again.');
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

      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 z-10" />

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

        <div className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8 xl:p-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="w-full max-w-sm sm:max-w-md"
          >
            <div className="relative backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 lg:p-10 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

              <div className="lg:hidden flex justify-center mb-4 sm:mb-6">
                <img
                  src="/Logo.png"
                  alt="Cinescape"
                  className="h-10 sm:h-12 object-contain drop-shadow-lg"
                />
              </div>

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-center mb-6 sm:mb-8"
              >
                <h2 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
                  {isRegistering ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-gray-400 text-xs sm:text-sm">
                  {isRegistering
                    ? 'Sign up to start your cinematic journey'
                    : "Let's get you back into the action"}
                </p>
              </motion.div>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm leading-relaxed">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <form
                onSubmit={isRegistering ? handleRegister : handleLogin}
                className="space-y-4 sm:space-y-5"
              >
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="relative"
                >
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none z-10" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=" "
                    className="peer w-full pl-12 pr-4 py-3 sm:py-4 rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 focus:bg-white/[0.08] transition-all duration-300"
                    required
                  />
                  <label
                    htmlFor="email"
                    className="absolute left-12 top-3 sm:top-4 text-gray-500 text-sm transition-all duration-300 
                    peer-placeholder-shown:top-3 sm:peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-red-400
                    peer-not-placeholder-shown:top-1 peer-not-placeholder-shown:text-[10px] peer-not-placeholder-shown:text-red-400"
                  >
                    Email Address
                  </label>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="relative"
                >
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none z-10" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=" "
                    className="peer w-full pl-12 pr-12 py-3 sm:py-4 rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 focus:bg-white/[0.08] transition-all duration-300"
                    required
                  />
                  <label
                    htmlFor="password"
                    className="absolute left-12 top-3 sm:top-4 text-gray-500 text-sm transition-all duration-300 
                    peer-placeholder-shown:top-3 sm:peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-red-400
                    peer-not-placeholder-shown:top-1 peer-not-placeholder-shown:text-[10px] peer-not-placeholder-shown:text-red-400"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors z-10"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </motion.div>

                {!isRegistering && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.45 }}
                    className="flex items-center justify-between"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-4 h-4 rounded-md border border-zinc-700 bg-zinc-950 peer-checked:bg-red-500 peer-checked:border-red-500 transition-all duration-150 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white hidden peer-checked:block stroke-[3]" />
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors font-medium tracking-wide">
                        Remember me
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setError('Password reset coming soon!')}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors font-medium"
                    >
                      Forgot password?
                    </button>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center gap-2 py-3 sm:py-4 px-6 rounded-xl font-bold text-sm sm:text-base transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg
                    ${isLoading
                        ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                        : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-500/25 hover:shadow-red-500/40'
                      }`}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <LogIn className="w-5 h-5" />
                    )}
                    <span>
                      {isLoading
                        ? isRegistering
                          ? 'Creating Account...'
                          : 'Signing In...'
                        : isRegistering
                          ? 'Create Account'
                          : 'Sign In'}
                    </span>
                  </button>
                </motion.div>
              </form>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                className="relative my-4 sm:my-6"
              >
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-transparent text-gray-500 uppercase tracking-wider">
                    Or continue with
                  </span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center gap-3 py-3 sm:py-4 px-6 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] border
                  ${isLoading
                      ? 'bg-gray-800/50 border-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-white/[0.05] border-white/10 hover:bg-white/10 text-white hover:border-white/20'
                    }`}
                  aria-label="Login with Google"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                  <span>Continue with Google</span>
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.65 }}
                className="mt-6 sm:mt-8 text-center"
              >
                <span className="text-gray-500 text-sm">
                  {isRegistering ? 'Already have an account?' : "Don't have an account?"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                  }}
                  className="ml-2 text-red-400 hover:text-red-300 font-semibold text-sm transition-colors"
                >
                  {isRegistering ? 'Sign In' : 'Sign Up'}
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;


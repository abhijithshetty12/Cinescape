import React, { useState, useEffect } from 'react';
import fetchRandomMovieImages from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const LoginPage: React.FC = () => {
  const { user, login, logout, register, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

  const backgroundImageUrl = backgroundImage ? `url(${backgroundImage})` : undefined;
  const hasError = error.length > 0;

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

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-8 relative overflow-hidden"
      style={{
        backgroundImage: backgroundImageUrl,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md sm:max-w-lg md:max-w-xl"
      >
        <div className="max-w-xl w-full bg-gray-900 bg-opacity-80 p-10 rounded-lg shadow-xl space-y-2">
          <div className="text-center space-y-2">
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-4xl font-bold text-white"
            >
              Welcome Back!
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg text-gray-300"
            >
              Let's Get You In
            </motion.p>
          </div>

          {hasError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/20 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="space-y-2"
            >
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-12 pr-4 py-3 sm:py-4 rounded-xl bg-black/50 border border-gray-600/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="space-y-2"
            >
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-12 pr-12 py-3 sm:py-4 rounded-xl bg-black/50 border border-gray-600/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2"
            >
              <button
                type="submit"
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-3 sm:py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${isLoading
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-500/25'
                  }`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                <span>{isLoading ? 'Signing In...' : 'Login'}</span>
              </button>

              <button
                type="button"
                onClick={handleRegister}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-3 sm:py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${isLoading
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white shadow-blue-500/25'
                  }`}
              >
                <UserPlus className="w-5 h-5" />
                <span>Register</span>
              </button>
            </motion.div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600/50" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-900/80 text-gray-400">Or continue with</span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="space-y-3"
          >
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-3 py-3 sm:py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${isLoading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-white hover:bg-gray-100 text-gray-900 shadow-white/10 border border-gray-300'
                }`}
              aria-label="Login with Google"
            >
              <i className="fab fa-google text-xl text-red-500" />
              <span>Continue with Google</span>
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
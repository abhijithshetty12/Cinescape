import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SignUpModal: React.FC = () => {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password);
      navigate('/home');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Signup failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs sm:text-sm leading-relaxed">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

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

        <div className="relative flex items-center bg-zinc-900/50 border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-red-500/50 focus-within:ring-1 focus-within:ring-red-500/50 transition-all duration-300">
          <Lock className="w-5 h-5 text-zinc-500 flex-shrink-0 mr-3" />
          <div className="relative w-full flex flex-col justify-center pr-8">
            <label className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
              Confirm Password
            </label>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-transparent text-white text-sm focus:outline-none placeholder-zinc-600 w-full pt-0.5"
              required
            />
          </div>
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex items-center justify-center py-3.5 px-6 rounded-2xl font-bold text-xs sm:text-sm tracking-wider uppercase text-white transition-all duration-300 shadow-lg border border-red-400/30
            bg-gradient-to-r from-red-500 via-red-600 to-orange-600 hover:brightness-110 active:scale-[0.98] shadow-red-600/30
            ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="drop-shadow-sm">SIGN UP</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SignUpModal;
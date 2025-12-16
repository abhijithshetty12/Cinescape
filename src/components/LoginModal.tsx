import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn } from 'lucide-react';

const LoginModal: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      setError('');
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-2xl shadow-2xl p-8 border border-gray-700/60 backdrop-blur-lg"
    >
      <div className="flex flex-col items-center mb-8">
        <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-full p-4 shadow-lg mb-4">
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">Sign In</h2>
        <p className="text-gray-400 text-sm text-center">Welcome back! Please enter your credentials to continue.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800/60 border border-red-400/30 text-white rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 shadow"
            placeholder="Enter your email"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800/60 border border-red-400/30 text-white rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 shadow"
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-500 text-sm text-center"
          >
            {error}
          </motion.p>
        )}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg ${
            loading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Signing In...
            </span>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
      <div className="mt-6 text-center">
        <span className="text-gray-400 text-sm">Don't have an account?</span>
        <button
          type="button"
          onClick={() => navigate('/register')}
          className="ml-2 text-red-400 hover:text-orange-400 font-semibold transition-colors"
        >
          Register
        </button>
      </div>
    </motion.div>
  );
};

export default LoginModal;
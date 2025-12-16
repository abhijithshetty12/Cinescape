import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';

const SignUpModal: React.FC = () => {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await register(email, password);
      setError('');
      alert('Signup successful!');
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-red-600"
          placeholder="Enter your email"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-red-600"
          placeholder="Enter your password"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-4 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-red-600"
          placeholder="Confirm your password"
          required
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        className="w-full bg-red-600 hover:bg-red-500 text-black font-bold py-2 rounded-md"
      >
        Sign Up
      </button>
    </form>
  );
};

export default SignUpModal;

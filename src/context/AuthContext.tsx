import React, { createContext, useState, useEffect, ReactNode } from 'react';
import {
  auth,
  googleProvider,
  facebookProvider
} from '../firebase.ts';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  signInWithPopup
} from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Invalid email or password.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw new Error('Failed to logout.');
    }
  };

  const register = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Registration failed:', error);
      throw new Error('Failed to register. Email might already be in use.');
    }
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google login failed:', error);
      throw new Error('Failed to sign in with Google.');
    }
  };

  const loginWithFacebook = async () => {
    try {
      const result = await signInWithPopup(auth, facebookProvider);
      const user = result.user;
      console.log('Facebook login successful:', user);
    } catch (error: any) {
      console.error('Facebook login error:', error);
      if (error.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with the same email but different sign-in credentials.');
      } else {
        throw new Error('Failed to sign in with Facebook.');
      }
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider
      value={{ user, login, logout, register, loginWithGoogle, loginWithFacebook }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
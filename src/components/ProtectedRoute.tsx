import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

const ProtectedRoute = () => {
  const { user } = useAuth();
  // AuthContext doesn't expose `loading`, but it does render a loader while initializing.
  // This local state ensures we don't flash an unauthorized redirect before AuthProvider finishes.
  const [didInit, setDidInit] = useState(false);

  useEffect(() => {
    setDidInit(true);
  }, []);

  if (!didInit) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;



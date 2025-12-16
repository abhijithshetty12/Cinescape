import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

const ConditionalRoute = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/home" />;
  } else {
    return <Navigate to="/login" />;
  }
};

export default ConditionalRoute;

import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

const ProtectedRoute = () => {
  const { user } = useAuth();
  const [didInit, setDidInit] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    setDidInit(true);
  }, []);

  useEffect(() => {
    if (didInit && !user) {
      const t = window.setTimeout(() => setShouldRedirect(true), 450);
      return () => window.clearTimeout(t);
    }
  }, [didInit, user]);

  if (!didInit) return <div>Loading...</div>;

  if (!user) {
    if (shouldRedirect) {
      return <Navigate to="/login" replace />;
    }

    return (
      <div className="min-h-screen w-full flex items-start justify-center pt-8 bg-black">
        <div
          className="w-full max-w-md px-4"
          style={{
            animation: 'glassPopTop 520ms cubic-bezier(.2,.9,.2,1) both',
          }}
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
            <div className="absolute -top-24 -left-24 h-40 w-40 rounded-full bg-red-500/20 blur-2xl" />
            <div className="absolute -bottom-24 -right-24 h-40 w-40 rounded-full bg-cyan-500/15 blur-2xl" />

            <div className="relative p-6">
              <div className="text-white font-bold text-lg mb-1">Login required</div>
              <div className="text-zinc-400 text-sm">Redirecting to login…</div>

              <div className="mt-5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-red-500/60"
                  style={{ animation: 'glassShimmer 900ms ease-in-out infinite' }}
                />
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes glassPopTop {
            0% {
              opacity: 0;
              transform: translateY(-24px) scale(0.98);
              filter: blur(4px);
            }
            60% {
              opacity: 1;
              transform: translateY(6px) scale(1.015);
              filter: blur(0px);
            }
            100% {
              opacity: 1;
              transform: translateY(0px) scale(1);
            }
          }
          @keyframes glassShimmer {
            0% { transform: translateX(-100%); width: 30%; opacity: .6; }
            50% { transform: translateX(0%); width: 60%; opacity: 1; }
            100% { transform: translateX(100%); width: 30%; opacity: .6; }
          }
        `}</style>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;




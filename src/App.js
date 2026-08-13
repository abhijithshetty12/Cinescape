import "./App.css";
import Navbar from "./components/Navbar.tsx";
import ConditionalRoute from './components/ConditionalRoute.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import License from "./components/License.tsx";
import CommandMenu from "./components/CommandMenu.tsx";

import Home from "./Pages/Home.tsx";

import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

const Explore = lazy(() => import("./Pages/Explore.tsx"));
const MovieDetails = lazy(() => import("./Pages/MovieDetails.tsx"));
const Toprated = lazy(() => import("./Pages/Toprated.jsx"));
const Talentsdetails = lazy(() => import("./Pages/Talentsdetails.tsx"));
const LoginPage = lazy(() => import("./Pages/LoginPage.tsx"));
const ProfilePage = lazy(() => import("./Pages/ProfilePage.tsx"));
const TalentsProfilePage = lazy(() => import("./Pages/TalentsProfilePage.tsx"));
const Tvdetails = lazy(() => import("./Pages/Tvdetails.tsx"));
const FavTalents = lazy(() => import("./Pages/FavTalents.tsx"));
const Trending = lazy(() => import("./Pages/Trending.tsx"));
const Watchlist = lazy(() => import("./Pages/Watchlist.tsx"));
const Upcoming = lazy(() => import("./Pages/Upcoming.tsx"));
const SearchResults = lazy(() => import("./Pages/SearchResults.tsx"));
const HistoryPage = lazy(() => import("./Pages/History.tsx"));
const DirectorsCut = lazy(() => import("./Pages/DirectorsCut.tsx"));
const TalentsConnections = lazy(() => import("./Pages/TalentsConnections.tsx"));

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

const AppRoutes = ({ isCmdMenuOpen, setIsCmdMenuOpen, isDark, toggleDark }) => {
  const location = useLocation();

  return (
    <>
      {location.pathname !== "/login" && <Navbar />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ConditionalRoute />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<Home />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/talents" element={<TalentsProfilePage />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/movie/:id" element={<MovieDetails />} />
            <Route path="/talent/:id" element={<Talentsdetails />} />
            <Route path="/talent/:id/connections" element={<TalentsConnections />} />
            <Route path="tv/:id" element={<Tvdetails />} />
            <Route path="/top-rated" element={<Toprated />} />
            <Route path="/fav-talents" element={<FavTalents />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/upcoming" element={<Upcoming />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/directors-cut" element={<DirectorsCut />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
};

function App() {
  const [isCmdMenuOpen, setIsCmdMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = isDark ? 'dark' : 'light';
    root.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleDark = useCallback(() => {
    setIsDark((v) => !v);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key?.toLowerCase();

      if (mod && key === 'k') {
        e.preventDefault();
        setIsCmdMenuOpen(true);
      }

      if (e.key === 'Escape') {
        setIsCmdMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black text-white relative">
        <AppRoutes
          isCmdMenuOpen={isCmdMenuOpen}
          setIsCmdMenuOpen={setIsCmdMenuOpen}
          isDark={isDark}
          toggleDark={toggleDark}
        />
        <CommandMenu
          isOpen={isCmdMenuOpen}
          onClose={() => setIsCmdMenuOpen(false)}
        />
        <License />
      </div>
    </BrowserRouter>
  );
}

export default App;
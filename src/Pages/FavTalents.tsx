import React, { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from 'framer-motion';

import {
  Heart,
  Star,
  Users,
  Search,
  SortAsc,
  SortDesc,
  LayoutGrid,
  List,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { db } from '../firebase.ts';
import { collection, onSnapshot } from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext.tsx';

type SortOrder = 'name' | 'recent';
type ViewMode = 'grid' | 'list';

interface Talent {
  id: string;
  name: string;
  profilePath: string;
}

const FavoriteTalentPage: React.FC = () => {
  useEffect(() => {
    const id = 'cinescape-glass-keyframes';
    if (typeof document === 'undefined') return;
    if (document.getElementById(id)) return;

    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = `
@keyframes glassSweep {
  0% { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
  20% { opacity: 1; }
  60% { opacity: 0.95; }
  100% { transform: translateX(220%) skewX(-18deg); opacity: 0; }
}`;
    document.head.appendChild(style);

  }, []);

  const { user } = useContext(AuthContext)!;
  const [favoriteTalents, setFavoriteTalents] = useState<Talent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    if (user?.uid) {
      const favouriteTalentsRef = collection(db, `users/${user.uid}/favouriteTalents`);
      const unsubscribe = onSnapshot(favouriteTalentsRef, (snapshot) => {
        const talentMap = new Map<string, Talent>();
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const id = data.talentId || data.id;
          if (id && data.name && !talentMap.has(id)) {
            talentMap.set(id, {
              id,
              name: data.name,
              profilePath: data.profile_path
                ? `https://image.tmdb.org/t/p/w780${data.profile_path}`
                : '',
            });
          }
        });
        setFavoriteTalents(Array.from(talentMap.values()));
      });

      return () => unsubscribe();
    }
  }, [user?.uid]);

  const filteredTalents = favoriteTalents
    .filter((talent) =>
      talent.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOrder === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  const talentCount = filteredTalents.length;
  const totalCount = favoriteTalents.length;

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'recent' ? 'name' : 'recent'));
  };

  if (favoriteTalents.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center max-w-lg"
        >
          <div className="relative mb-10">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-red-500/20 rounded-full blur-3xl animate-pulse" />
            </div>
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-28 h-28 mx-auto bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-full flex items-center justify-center border border-zinc-700/50 shadow-2xl"
            >
              <Heart className="w-14 h-14 text-zinc-500" />
            </motion.div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            No Favorite Talents
          </h1>
          <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
            Discover and follow your favorite talents to keep track of their latest movies and shows.
          </p>
          <Link
            to="/explore"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-xl shadow-red-500/20 hover:shadow-red-500/40"
          >
            <Users className="w-5 h-5" />
            Discover Talents
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900/80 to-black/80 border border-zinc-800/50 p-6 md:p-10 backdrop-blur-xl">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-red-600/5 rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-xl shadow-red-500/20">
                <Heart className="text-white w-8 h-8 md:w-10 md:h-10 fill-current" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                  Favorite Talents
                </h1>
                <p className="text-zinc-400 text-sm md:text-base mt-1">
                  {totalCount} {totalCount === 1 ? 'talent' : 'talents'} in your collection
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-zinc-800/60 backdrop-blur-sm px-5 py-3 rounded-full border border-zinc-700/50 w-fit">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-zinc-300 text-sm font-medium">
                {totalCount} talented {totalCount === 1 ? 'star' : 'stars'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 mb-8"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4 z-10" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search talents..."
            className="w-full pl-11 pr-4 py-3 bg-zinc-800/40 backdrop-blur-md border border-white/10 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 focus:bg-zinc-800/60 transition-all duration-300 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleSort}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/60 rounded-2xl text-zinc-300 hover:text-white hover:bg-zinc-800/60 hover:border-zinc-700/50 transition-all duration-300"
          >
            {sortOrder === 'name' ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {sortOrder === 'name' ? 'A-Z' : 'Recent'}
            </span>
          </button>

          {/* View Toggle */}
          <div className="flex items-center bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/60 rounded-2xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all duration-300 ${viewMode === 'grid'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all duration-300 ${viewMode === 'list'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {searchTerm && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-zinc-400 text-sm mb-6"
        >
          Found {talentCount} {talentCount === 1 ? 'talent' : 'talents'} matching "{searchTerm}"
        </motion.p>
      )}

      <AnimatePresence mode="wait">
        {viewMode === 'grid' && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6"
          >
            <AnimatePresence>
              {filteredTalents.map((talent, index) => {
                const talentImageUrl = talent.profilePath;
                const talentName = talent.name ?? 'Unknown Talent';
                const initials = talentName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <motion.div
                    key={talent.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.05,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    <Link
                      to={`/talent/${talent.id}`}
                      className="group block relative bg-gradient-to-br from-zinc-900/60 to-black/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10"
                    >
                      <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-2 py-1">
                        <span className="text-xs font-bold text-zinc-300">
                          #{index + 1}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 z-20 bg-gradient-to-br from-red-500 to-red-600 p-2 rounded-full shadow-lg shadow-red-500/30">
                        <Heart className="w-3 h-3 md:w-4 md:h-4 text-white fill-current" />
                      </div>

                      <div className="relative aspect-[3/4] overflow-hidden">
                        {talent.profilePath ? (
                          <img
                            src={talentImageUrl}
                            alt={`${talentName} profile`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center">
                            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center mb-3">
                              <span className="text-2xl font-bold text-zinc-500">
                                {initials}
                              </span>
                            </div>
                            <span className="text-xs text-zinc-500 text-center px-4">
                              No Image Available
                            </span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-white/10 via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                          <div
                            className="absolute top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent -skew-x-12 blur-[1px]
                               -translate-x-[150%] 
                               group-hover:translate-x-[250%] 
                               transition-transform duration-1000 ease-out"
                          />
                        </div>

                        <div className="absolute inset-0 bg-gradient-to-t from-white/10 via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                          <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            whileHover={{ y: 0, opacity: 1 }}
                            className="flex items-center gap-2 text-white"
                          >
                            <span className="text-sm font-semibold">View Profile</span>
                            <ArrowRight className="w-4 h-4" />
                          </motion.div>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-red-500/15 blur-2xl" />
                        </div>
                      </div>

                      <div className="p-3 md:p-4">
                        <h2 className="font-bold text-sm md:text-base text-white truncate transition-colors duration-300 group-hover:text-white">
                          {talentName}
                        </h2>
                      </div>

                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {viewMode === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-3"
          >
            <AnimatePresence>
              {filteredTalents.map((talent, index) => {
                const talentImageUrl = talent.profilePath;
                const talentName = talent.name ?? 'Unknown Talent';
                const initials = talentName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <motion.div
                    key={talent.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.04,
                    }}
                  >
                    <Link
                      to={`/talent/${talent.id}`}
                      className="group flex items-center gap-4 bg-gradient-to-r from-zinc-900/60 to-black/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/5 hover:border-red-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/5 p-3"
                    >
                      <span className="text-zinc-600 font-bold text-sm w-6 text-center">
                        {index + 1}
                      </span>

                      <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-zinc-800">
                        {talent.profilePath ? (
                          <img
                            src={talentImageUrl}
                            alt={`${talentName} profile`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.08]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-sm font-bold text-zinc-600">
                              {initials}
                            </span>
                          </div>
                        )}

                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        >
                          <div className="absolute -left-6 top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent blur-[1px]" style={{ animation: 'glassSweep 900ms ease-out forwards' }} />
                        </div>

                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-base md:text-lg text-white truncate group-hover:text-red-400 transition-colors duration-300">
                          {talentName}
                        </h2>
                        <p className="text-zinc-500 text-sm">Talent</p>
                      </div>

                      <div className="p-2 rounded-xl bg-zinc-800/50 group-hover:bg-white/10 transition-colors duration-300">
                        <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-white/90 transition-colors duration-300" />
                      </div>

                      <div className="hidden sm:flex p-2">
                        <Heart className="w-5 h-5 text-red-500 fill-current" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {filteredTalents.length === 0 && searchTerm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <Search className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-zinc-400 mb-2">
            No talents found
          </h3>
          <p className="text-zinc-500">
            Try adjusting your search terms
          </p>
        </motion.div>
      )}

      {filteredTalents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-zinc-900/40 backdrop-blur-sm px-6 py-3 rounded-full border border-zinc-800/50">
            <Star className="w-5 h-5 text-yellow-400 fill-current" />
            <span className="text-zinc-300 text-sm md:text-base">
              You've favorited{' '}
              <span className="text-white font-semibold">{totalCount}</span>{' '}
              {totalCount === 1 ? 'talent' : 'talents'}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default FavoriteTalentPage;
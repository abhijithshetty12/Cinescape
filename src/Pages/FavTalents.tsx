import React, { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Star,
  Users,
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  ChevronRight,
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
  addedAt?: number;
}

const FavoriteTalentPage: React.FC = () => {
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
              addedAt: data.addedAt?.toMillis ? data.addedAt.toMillis() : (data.createdAt || 0),
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
      } else {
        return (b.addedAt || 0) - (a.addedAt || 0);
      }
    });

  const totalCount = favoriteTalents.length;

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'recent' ? 'name' : 'recent'));
  };

  if (favoriteTalents.length === 0) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-6 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',sans-serif]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-sm w-full p-8 rounded-[38px] bg-white/[0.03] dark:bg-black/[0.25] backdrop-blur-3xl border border-white/20 dark:border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] relative overflow-hidden"
        >
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-b from-white/20 to-white/5 dark:from-white/10 dark:to-white/[0.02] backdrop-blur-2xl border border-white/30 dark:border-white/15 shadow-[0_8px_32px_0_rgba(255,45,85,0.2)] flex items-center justify-center">
              <Heart className="w-10 h-10 text-[#FF2D55] fill-[#FF2D55]/20" />
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">
            No Favorites Yet
          </h1>
          <p className="text-white/60 text-[15px] leading-relaxed mb-8 font-normal">
            Explore and add your favorite stars to keep up with their latest work.
          </p>
          <Link
            to="/explore"
            className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-b from-[#FF3B30] to-[#E02B20] text-white py-3.5 px-6 rounded-2xl font-medium text-[15px] shadow-[0_8px_25px_rgba(255,59,48,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] active:scale-[0.98] transition-all duration-200"
          >
            <Users className="w-4 h-4" />
            Discover Talents
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',sans-serif]">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6 sm:mb-8"
      >
        <div className="relative rounded-[32px] sm:rounded-[40px] bg-gradient-to-b from-white/[0.08] to-white/[0.02] dark:from-white/[0.05] dark:to-white/[0.01] backdrop-blur-3xl border border-white/20 dark:border-white/10 p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.3)] overflow-hidden">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#FF2D55]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#FF3B30] to-[#FF2D55] p-0.5 shadow-[0_8px_20px_rgba(255,45,85,0.35)] flex items-center justify-center shrink-0">
                <div className="w-full h-full rounded-[14px] bg-black/10 backdrop-blur-sm flex items-center justify-center">
                  <Heart className="text-white w-7 h-7 fill-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Favorite Talents
                </h1>
                <p className="text-white/60 text-xs sm:text-sm mt-0.5 font-normal">
                  {totalCount} {totalCount === 1 ? 'person' : 'people'} saved
                </p>
              </div>
            </div>

            <div className="hidden sm:inline-flex items-center gap-2 self-start sm:self-auto bg-white/10 dark:bg-white/[0.06] backdrop-blur-2xl px-4 py-2 rounded-full border border-white/15 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-white/90 text-xs font-medium tracking-wide">
                {totalCount} Star{totalCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="space-y-3 mb-6 sm:mb-8">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4 z-10 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search favorites..."
            className="w-full pl-10 pr-4 py-3 bg-white/10 dark:bg-white/[0.05] backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.1)]"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={toggleSort}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 dark:bg-white/[0.05] backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl text-white/90 hover:text-white hover:bg-white/15 transition-all text-xs font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] active:scale-95"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort: {sortOrder === 'name' ? 'Name (A-Z)' : 'Recently Added'}</span>
          </button>

          <div className="flex items-center bg-white/10 dark:bg-white/[0.05] backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid'
                  ? 'bg-white/20 dark:bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-white/40 hover:text-white/70'
                }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'list'
                  ? 'bg-white/20 dark:bg-white/15 text-white shadow-sm border border-white/20'
                  : 'text-white/40 hover:text-white/70'
                }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'grid' && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4"
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
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.03,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <Link
                      to={`/talent/${talent.id}`}
                      className="group block relative rounded-3xl overflow-hidden bg-white/10 dark:bg-white/[0.04] backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.25)] hover:border-white/40 active:scale-[0.98] transition-all duration-200"
                    >
                      <div className="absolute top-3 right-3 z-20 bg-gradient-to-br from-red-500 to-red-600 p-2 rounded-full shadow-lg shadow-red-500/30">
                        <Heart className="w-3 h-3 md:w-4 md:h-4 text-white fill-current" />
                      </div>

                      <div className="relative aspect-[4/5] overflow-hidden bg-white/5">
                        {talent.profilePath ? (
                          <img
                            src={talentImageUrl}
                            alt={`${talentName} profile`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
                              <span className="text-base font-medium text-white/70">
                                {initials}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      </div>

                      <div className="absolute bottom-0 inset-x-0 p-3">
                        <h2 className="font-semibold text-xs sm:text-sm text-white truncate tracking-tight">
                          {talentName}
                        </h2>
                      </div>
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
            transition={{ duration: 0.2 }}
            className="space-y-2 sm:space-y-3"
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{
                      duration: 0.25,
                      delay: index * 0.02,
                    }}
                  >
                    <Link
                      to={`/talent/${talent.id}`}
                      className="group flex items-center gap-3.5 p-2.5 rounded-2xl bg-white/10 dark:bg-white/[0.04] backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_25px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:border-white/40 active:scale-[0.99] transition-all duration-200"
                    >
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/10 border border-white/10">
                        {talent.profilePath ? (
                          <img
                            src={talentImageUrl}
                            alt={`${talentName} profile`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xs font-semibold text-white/60">
                              {initials}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-sm text-white truncate tracking-tight">
                          {talentName}
                        </h2>
                        <p className="text-white/50 text-xs mt-0.5">Artist</p>
                      </div>

                      <div className="flex items-center gap-2 pr-1">
                        <div className="bg-gradient-to-br from-red-500 to-red-600 p-1.5 rounded-full shadow-md shadow-red-500/30">
                          <Heart className="w-3.5 h-3.5 text-white fill-current" />
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors" />
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 p-6 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 mt-4"
        >
          <Search className="w-8 h-8 text-white/30 mx-auto mb-3" />
          <h3 className="text-base font-medium text-white mb-1">
            No Results
          </h3>
          <p className="text-white/50 text-xs">
            No talents matched "{searchTerm}"
          </p>
        </motion.div>
      )}

      {filteredTalents.length > 0 && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10">
            <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span className="text-white/60 text-xs">
              Showing <span className="text-white font-medium">{filteredTalents.length}</span> of {totalCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoriteTalentPage;
import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Star, Heart, HeartOff, ImageOff, ChartNoAxesCombined, Clapperboard, Tv, Layers, Sparkles, CalendarDays, Calendar, ChevronDown, Check, Network } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Toast from "../components/Toast.tsx";
import Loading from "../components/Loading.tsx";
import { AuthContext } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import GlassSweep from "../components/GlassSweep.tsx";

const Talentsdetails = () => {
  const { id } = useParams();
  const auth = useContext(AuthContext);
  const user = auth?.user;

  const [talent, setTalent] = useState<any>(null);
  const [works, setWorks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'popularity'>('latest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteDocId, setFavoriteDocId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({ message: '', type: 'success', isVisible: false });

  const noImageSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 150"><rect width="100%" height="100%" fill="%2327272a"/><g transform="translate(38, 50) scale(1)" stroke="%2371717a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M10.41 4.41A2 2 0 0 1 11 4h9a2 2 0 0 1 2 2v9a2 2 0 0 1-.42 1.15"/><path d="M16 16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 .42-1.15"/><path d="m2 18 5.58-5.58a1 1 0 0 1 1.41 0l3.41 3.41"/><path d="m16 11.5 1-1a1 1 0 0 1 .18-.15"/></g><text x="50%" y="95" fill="%2371717a" font-size="6" font-family="sans-serif" text-anchor="middle" font-weight="500">No Image Available</text></svg>`;
  const tmdbAPIKey = "859afbb4b98e3b467da9c99ac390e950";

  const sortOptions = [
    { id: 'latest', label: 'Latest Release', icon: CalendarDays },
    { id: 'oldest', label: 'Oldest Release', icon: Calendar },
    { id: 'popularity', label: 'Most Popular', icon: Sparkles }
  ] as const;

  useEffect(() => {
    const fetchTalentData = async () => {
      try {
        const talentRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}?api_key=${tmdbAPIKey}&language=en-US`
        );
        setTalent(talentRes.data);

        const creditsRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}/combined_credits?api_key=${tmdbAPIKey}&language=en-US`
        );

        const castContributions = (creditsRes.data.cast || []).map((item: any) => ({
          ...item,
          displayRole: item.character ? `as ${item.character}` : "Cast",
          uniqueKey: `cast-${item.id}-${item.character || ''}`
        }));

        const crewContributions = (creditsRes.data.crew || []).map((item: any) => ({
          ...item,
          displayRole: item.job || item.department || "Crew",
          uniqueKey: `crew-${item.id}-${item.job || ''}`
        }));

        const combinedWorksMap = new Map();
        [...castContributions, ...crewContributions].forEach((item) => {
          if (combinedWorksMap.has(item.id)) {
            const existing = combinedWorksMap.get(item.id);
            if (!existing.displayRole.includes(item.displayRole)) {
              existing.displayRole += `, ${item.displayRole}`;
            }
          } else {
            combinedWorksMap.set(item.id, { ...item });
          }
        });

        const sortedWorks = Array.from(combinedWorksMap.values());
        setWorks(sortedWorks);

        const socialRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}/external_ids?api_key=${tmdbAPIKey}`
        );
        setTalent((prevTalent: any) => ({
          ...prevTalent,
          ...socialRes.data,
        }));

        if (user?.uid && talentRes.data.id) {
          const favRef = collection(db, `users/${user.uid}/favouriteTalents`);
          const favQuery = query(favRef, where("talentId", "==", talentRes.data.id));
          const favSnap = await getDocs(favQuery);
          if (!favSnap.empty) {
            setIsFavorite(true);
            setFavoriteDocId(favSnap.docs[0].id);
          } else {
            setIsFavorite(false);
            setFavoriteDocId(null);
          }
        }
      } catch (err: any) {
        console.error("Error fetching talent data:", err);
      } finally {
        if (loading) setLoading(false);
      }
    };

    fetchTalentData();
  }, [id, user?.uid]);

  const handleFavoriteToggle = async () => {
    if (!talent || !user) return;

    try {
      const favoritesRef = collection(db, `users/${user.uid}/favouriteTalents`);
      if (isFavorite && favoriteDocId) {
        const { doc } = await import('firebase/firestore');
        const docRef = doc(db, `users/${user.uid}/favouriteTalents/${favoriteDocId}`);
        await deleteDoc(docRef);
        setIsFavorite(false);
        setFavoriteDocId(null);
        setToast({ message: `${talent.name} removed from favorites.`, type: 'info', isVisible: true });
      } else {
        const talentData = {
          talentId: talent.id,
          name: talent.name,
          profile_path: talent.profile_path,
        };
        const docRef = await addDoc(favoritesRef, talentData);
        setIsFavorite(true);
        setFavoriteDocId(docRef.id);

        const count = 200;
        const defaults = {
          origin: { y: 0.7 },
          colors: ['#EF4444', '#EC4899', '#F43F5E', '#FB7185', '#D946EF']
        };

        const fire = (particleRatio: number, opts: any) => {
          confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio)
          });
        };

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });

        setToast({ message: `${talent.name} added to favorites.`, type: 'success', isVisible: true });
      }
    } catch (error) {
      console.error("Error toggling favorite talent:", error);
      setToast({ message: "Failed to update favorites.", type: 'error', isVisible: true });
    }
  };

  if (loading) {
    return <Loading />;
  }

  const trendingWork = [...works]
    .filter((w) => w.backdrop_path || w.poster_path)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];

  const backgroundImageUrl = trendingWork
    ? `url(https://image.tmdb.org/t/p/original${trendingWork.backdrop_path || trendingWork.poster_path})`
    : '';
  const talentImageUrl = `https://image.tmdb.org/t/p/w500${talent?.profile_path ?? ''}`;
  const talentName = talent?.name ?? 'Unknown Filmography';
  const talentPopularity = talent?.popularity ?? 0;
  const formattedPopularity = talentPopularity.toFixed(1);

  const filteredWorks = works
    .filter((work) => {
      if (activeTab === 'all') return true;
      const mediaType = work.media_type === "tv" ? "tv" : "movie";
      return mediaType === activeTab;
    })
    .sort((a, b) => {
      if (sortBy === 'latest') {
        const dateA = new Date(a.release_date || a.first_air_date || 0).getTime();
        const dateB = new Date(b.release_date || b.first_air_date || 0).getTime();
        return dateB - dateA;
      }
      if (sortBy === 'oldest') {
        const dateA = new Date(a.release_date || a.first_air_date || '9999-12-31').getTime();
        const dateB = new Date(b.release_date || b.first_air_date || '9999-12-31').getTime();
        return dateA - dateB;
      }
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    });

  const ActiveSortIcon = sortOptions.find(opt => opt.id === sortBy)?.icon || CalendarDays;

  const gridContainerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.02
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24
      }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: -10,
      transition: { duration: 0.15 }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl">
      <div className="relative min-h-[460px] sm:h-[450px] md:h-[500px] mb-8 md:mb-12 rounded-3xl overflow-hidden border border-white/[0.08] shadow-2xl bg-zinc-950">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 filter blur-[2px] sm:blur-0 transition-all duration-75"
          style={{ backgroundImage: backgroundImageUrl }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/20 sm:from-zinc-950 sm:via-zinc-950/70 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/50 via-transparent to-zinc-950/50 hidden sm:block" />
        </div>

        <div className="relative h-full flex flex-col sm:flex-row items-center sm:items-end justify-end sm:justify-start p-6 sm:p-8 md:p-10 gap-6 z-10">
          <div className="flex-shrink-0 w-full sm:w-auto flex justify-center sm:block">
            <div className="w-36 h-48 sm:w-40 sm:h-56 md:w-48 md:h-68 rounded-2xl overflow-hidden shadow-2xl border border-white/10 backdrop-blur-md bg-zinc-900/40 transform -translate-y-2 sm:translate-y-0">
              {talent?.profile_path ? (
                <img
                  src={talentImageUrl}
                  alt={`${talentName} profile`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex flex-col items-center justify-center text-zinc-500">
                  <ImageOff className="w-10 h-10 mb-2 opacity-40" />
                  <span className="text-xs font-medium px-4 text-center">No Image</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left text-white w-full">
            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black tracking-tight mb-3 leading-tight drop-shadow-sm">
              {talentName}
            </h1>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-6">
              <div className="flex items-center gap-2 bg-white/[0.06] backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/[0.08] shadow-inner">
                <ChartNoAxesCombined className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="font-bold text-sm tracking-wide">{formattedPopularity}</span>
                <span className="text-zinc-400 text-xs font-medium hidden xs:inline">Popularity</span>
              </div>
            </div>

            <div className="w-full sm:w-auto">
              <motion.button
                onClick={handleFavoriteToggle}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 shadow-xl border ${isFavorite
                  ? "bg-gradient-to-r from-rose-600 to-pink-600 border-rose-500 shadow-rose-950/30"
                  : "bg-white text-zinc-950 border-white shadow-black/10 hover:bg-zinc-100"
                  }`}
                aria-label={isFavorite ? `Remove ${talentName} from favorites` : `Add ${talentName} to favorites`}
              >
                <AnimatePresence mode="wait">
                  {isFavorite ? (
                    <motion.div
                      key="heart-on"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <HeartOff className="w-4 h-4 flex-shrink-0" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="heart-off"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Heart className="w-4 h-4 flex-shrink-0 fill-current" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className="tracking-wide">
                  {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8 mb-12">
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-zinc-900/20 backdrop-blur-md rounded-3xl p-6 border border-zinc-800/60 shadow-xl">
            <h2 className="text-lg font-bold mb-5 text-white tracking-tight">Personal Info</h2>
            <dl className="space-y-4">
              {[
                { label: 'Born', value: talent?.birthday ?? 'N/A' },
                { label: 'Place of Birth', value: talent?.place_of_birth ?? 'N/A' },
                { label: 'Known For', value: talent?.known_for_department ?? 'N/A' },
                { label: 'Total Credits', value: `${works.length} titles` }
              ].map(({ label, value }) => (
                <div key={label} className="border-b border-zinc-800/40 pb-3 last:border-b-0 last:pb-0">
                  <dt className="text-zinc-500 text-xs font-semibold tracking-wider uppercase mb-1">{label}</dt>
                  <dd className="text-zinc-200 text-sm font-medium leading-relaxed">{value}</dd>
                </div>
              ))}

              {((talent?.instagram_id || talent?.twitter_id || talent?.youtube_id) && (
                <div className="pt-4 border-t border-zinc-800/40">
                  <dt className="text-zinc-500 text-xs font-semibold tracking-wider uppercase mb-4">Social Connect</dt>
                  <div className="flex flex-wrap gap-3">
                    {talent?.instagram_id && (
                      <a
                        href={`https://instagram.com/${talent.instagram_id}`}
                        rel="noopener noreferrer"
                        aria-label={`${talentName} on Instagram`}
                        className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-all duration-200 hover:scale-105 group active:scale-95"
                      >
                        <img src="/insta-icon.png" alt="Instagram" className="w-9 h-9 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                    {talent?.twitter_id && (
                      <a
                        href={`https://twitter.com/${talent.twitter_id}`}
                        rel="noopener noreferrer"
                        aria-label={`${talentName} on Twitter`}
                        className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-all duration-200 hover:scale-105 group active:scale-95"
                      >
                        <img src="/twitter-icon.png" alt="Twitter" className="w-9 h-9 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                    {talent?.youtube_id && (
                      <a
                        href={`https://youtube.com/${talent.youtube_id}`}
                        rel="noopener noreferrer"
                        aria-label={`${talentName} on YouTube`}
                        className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-all duration-200 hover:scale-105 group active:scale-95"
                      >
                        <img src="/yt-icon.png" alt="YouTube" className="w-9 h-9 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="lg:col-span-3 order-1 lg:order-2">
          <div className="bg-zinc-900/10 backdrop-blur-sm rounded-3xl p-6 sm:p-8 border border-zinc-800/40 shadow-xl h-full flex flex-col justify-start">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white tracking-tight">Biography</h2>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal">
              {talent?.biography ?? "Biography not available for this individual."}
            </p>
          </div>
        </div>
      </div>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 flex-1">
            <h2 className="text-2xl md:text-3xl font-bold text-white whitespace-nowrap">Filmography</h2>
            <div className="h-px bg-gradient-to-r from-zinc-800 to-transparent flex-1 hidden sm:block" />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative flex items-center p-1 bg-gradient-to-b from-white/[0.07] to-white/[0.01] border border-t-white/[0.15] border-x-white/[0.08] border-b-white/[0.03] rounded-2xl w-full sm:w-fit backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.15)] overflow-hidden">
              <button
                onClick={() => setActiveTab('all')}
                className={`relative flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 md:px-5 py-2 md:py-2 font-bold text-[11px] md:text-xs tracking-wide transition-all duration-500 ease-[0.25,1,0.5,1] rounded-xl overflow-hidden group ${activeTab === 'all'
                  ? 'text-white shadow-[0_4px_20px_rgba(220,38,38,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
              >
                {activeTab === 'all' && (
                  <div className="absolute inset-0 bg-gradient-to-b from-red-500 via-red-600 to-red-700 before:absolute before:inset-0 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_50%,rgba(0,0,0,0.15)_100%)]" />
                )}
                {activeTab === 'all' && (
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                )}
                <Layers className={`w-3.5 h-3.5 relative z-10 transition-transform duration-300 ${activeTab === 'all' ? 'scale-105' : 'group-hover:scale-105'}`} />
                <span className="relative z-10">All</span>
              </button>

              <button
                onClick={() => setActiveTab('movie')}
                className={`relative flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 md:px-5 py-2 md:py-2 font-bold text-[11px] md:text-xs tracking-wide transition-all duration-500 ease-[0.25,1,0.5,1] rounded-xl overflow-hidden group ${activeTab === 'movie'
                  ? 'text-white shadow-[0_4px_20px_rgba(220,38,38,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
              >
                {activeTab === 'movie' && (
                  <div className="absolute inset-0 bg-gradient-to-b from-red-500 via-red-600 to-red-700 before:absolute before:inset-0 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_50%,rgba(0,0,0,0.15)_100%)]" />
                )}
                {activeTab === 'movie' && (
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                )}
                <Clapperboard className={`w-3.5 h-3.5 relative z-10 transition-transform duration-300 ${activeTab === 'movie' ? 'scale-105' : 'group-hover:scale-105'}`} />
                <span className="relative z-10">Movies</span>
              </button>

              <button
                onClick={() => setActiveTab('tv')}
                className={`relative flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 md:px-5 py-2 md:py-2 font-bold text-[11px] md:text-xs tracking-wide transition-all duration-500 ease-[0.25,1,0.5,1] rounded-xl overflow-hidden group ${activeTab === 'tv'
                  ? 'text-white shadow-[0_4px_20px_rgba(220,38,38,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
              >
                {activeTab === 'tv' && (
                  <div className="absolute inset-0 bg-gradient-to-b from-red-500 via-red-600 to-red-700 before:absolute before:inset-0 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_50%,rgba(0,0,0,0.15)_100%)]" />
                )}
                {activeTab === 'tv' && (
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                )}
                <Tv className={`w-3.5 h-3.5 relative z-10 transition-transform duration-300 ${activeTab === 'tv' ? 'scale-105' : 'group-hover:scale-105'}`} />
                <span className="relative z-10">Series</span>
              </button>

              <Link
                to={`/talent/${talent?.id}/connections`}
                className="relative flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 md:px-5 py-2 md:py-2 font-bold text-[11px] md:text-xs tracking-wide transition-all duration-500 ease-[0.25,1,0.5,1] rounded-xl overflow-hidden group text-white border border-transparent hover:border-blue-400/40 hover:bg-blue-500/10"
              >
                <Network className="w-3.5 h-3.5 relative z-10 transition-transform duration-300 group-hover:scale-110 text-blue-400" />
                <span className="relative z-10">Connections</span>
              </Link>

            </div>

            <div className="relative">
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="w-full sm:w-auto flex items-center justify-between gap-2.5 px-4 py-2.5 bg-gradient-to-b from-white/[0.07] to-white/[0.01] border border-t-white/[0.15] border-x-white/[0.08] border-b-white/[0.03] rounded-2xl backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.15)] text-white font-semibold text-xs transition-all duration-300 hover:border-white/20 active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <ActiveSortIcon className="w-4 h-4 text-red-500" />
                  <span>{sortOptions.find(o => o.id === sortBy)?.label}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${isSortOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isSortOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsSortOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 top-full mt-2 w-full sm:w-48 p-1.5 bg-zinc-900/90 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl z-50 overflow-hidden"
                    >
                      {sortOptions.map((option) => {
                        const Icon = option.icon;
                        const isSelected = sortBy === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => {
                              setSortBy(option.id);
                              setIsSortOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${isSelected
                                ? 'bg-gradient-to-r from-red-600/20 to-red-600/10 text-white font-semibold border border-red-500/20'
                                : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                              }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-red-500' : 'text-zinc-400'}`} />
                              <span>{option.label}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-red-500" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <motion.div
          key={`${activeTab}-${sortBy}`}
          variants={gridContainerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredWorks.map((work) => {
              const workTitle = work.title || work.name || "Untitled Project";
              const mediaType = work.media_type === "tv" ? "tv" : "movie";
              const releaseDate = work.release_date || work.first_air_date;

              const hasYear = releaseDate && releaseDate.trim() !== "";
              const workYear = hasYear ? releaseDate.split("-")[0] : "TBD";

              return (
                <motion.div
                  key={work.uniqueKey || work.id}
                  variants={cardVariants}
                  layout
                >
                  <Link to={`/${mediaType}/${work.id}`} className="block h-full group">
                    <div className="h-full relative overflow-hidden rounded-2xl">
                      <div className="absolute top-2 right-2 md:top-3 md:right-3 z-30 pointer-events-none">
                        <div
                          className={`flex items-center justify-center h-5 md:h-6 px-2 rounded-lg backdrop-blur-md border shadow-md transition-colors duration-300 ${hasYear
                            ? "bg-black/30 border-white/[0.08] group-hover:bg-black/40 group-hover:border-white/[0.15]"
                            : "bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20 group-hover:border-amber-500/30"
                            }`}
                        >
                          <span
                            className={`text-[9px] md:text-[10px] font-semibold tracking-wider transition-colors duration-300 ${hasYear
                              ? "text-zinc-300 group-hover:text-white"
                              : "text-amber-400 font-bold group-hover:text-amber-300"
                              }`}
                          >
                            {workYear}
                          </span>
                        </div>
                      </div>

                      <GlassSweep
                        posterUrl={work.poster_path ? `https://image.tmdb.org/t/p/w780${work.poster_path}` : noImageSvg}
                        title={workTitle}
                        subtitle={
                          <span className="block text-zinc-400 text-xs font-normal truncate mt-0.5 capitalize">
                            {work.displayRole}
                          </span>
                        }
                      />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {filteredWorks.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-zinc-500"
          >
            <Clapperboard className="w-12 h-12 stroke-[1.5] mb-3 opacity-40" />
            <p className="text-sm font-medium">No results found in this category.</p>
          </motion.div>
        )}

        <div className="flex flex-col items-center mt-12">
          <div className="w-full h-px bg-gradient-to-r from-zinc-800 via-zinc-700/40 to-transparent mb-3" />
          <span className="text-zinc-500 text-xs uppercase tracking-widest font-medium">End of filmography</span>
        </div>
      </section>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
};

export default Talentsdetails;
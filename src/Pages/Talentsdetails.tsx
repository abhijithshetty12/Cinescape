import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { Heart, HeartOff, ImageOff, ChartNoAxesCombined, Clapperboard, Tv, Layers, Flame, CalendarDays, Calendar, ChevronDown, Check, Network, Images, Download, X, ChevronLeft, ChevronRight, User, Film, Crown, Star } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Toast from "../components/Toast.tsx";
import Loading from "../components/Loading.tsx";
import { AuthContext } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import confetti from 'canvas-confetti';
import GlassSweep from "../components/GlassSweep.tsx";

interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

const getDominantColor = (imageUrl: string): Promise<ColorRGB> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve({ r: 220, g: 38, b: 38 });
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      try {
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < imageData.length; i += 16) {
          if (imageData[i + 3] > 128) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }
        if (count === 0) return resolve({ r: 220, g: 38, b: 38 });
        resolve({
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count)
        });
      } catch {
        resolve({ r: 220, g: 38, b: 38 });
      }
    };
    img.onerror = () => resolve({ r: 220, g: 38, b: 38 });
  });
};

const Talentsdetails = () => {
  const { id } = useParams();
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const [talent, setTalent] = useState<any>(null);
  const [works, setWorks] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'popularity'>('latest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteDocId, setFavoriteDocId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({ message: '', type: 'success', isVisible: false });
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [dominantColor, setDominantColor] = useState<ColorRGB>({ r: 220, g: 38, b: 38 });
  const [activeNavSection, setActiveNavSection] = useState<'overview' | 'bio' | 'known-for' | 'gallery' | 'filmography'>('overview');
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const bioRef = useRef<HTMLDivElement>(null);
  const knownForRef = useRef<HTMLDivElement>(null);
  const gallerySectionRef = useRef<HTMLDivElement>(null);
  const filmographyRef = useRef<HTMLDivElement>(null);

  const noImageSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 150"><rect width="100%" height="100%" fill="%2327272a"/><g transform="translate(38, 50) scale(1)" stroke="%2371717a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M10.41 4.41A2 2 0 0 1 11 4h9a2 2 0 0 1 2 2v9a2 2 0 0 1-.42 1.15"/><path d="M16 16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 .42-1.15"/><path d="m2 18 5.58-5.58a1 1 0 0 1 1.41 0l3.41 3.41"/><path d="m16 11.5 1-1a1 1 0 0 1 .18-.15"/></g><text x="50%" y="95" fill="%2371717a" font-size="6" font-family="sans-serif" text-anchor="middle" font-weight="500">No Image Available</text></svg>`;
  const tmdbAPIKey = "859afbb4b98e3b467da9c99ac390e950";

  const sortOptions = [
    { id: 'latest', label: 'Latest Release', icon: CalendarDays },
    { id: 'oldest', label: 'Oldest Release', icon: Calendar },
    { id: 'popularity', label: 'Most Popular', icon: Flame }
  ] as const;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;
      const sections = [
        { id: 'overview', ref: heroRef },
        { id: 'bio', ref: bioRef },
        { id: 'known-for', ref: knownForRef },
        { id: 'gallery', ref: gallerySectionRef },
        { id: 'filmography', ref: filmographyRef }
      ];

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.ref.current && section.ref.current.offsetTop <= scrollPosition) {
          setActiveNavSection(section.id as any);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchTalentData = async () => {
      try {
        const talentRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}?api_key=${tmdbAPIKey}&language=en-US`
        );
        setTalent(talentRes.data);

        if (talentRes.data?.profile_path) {
          getDominantColor(`https://image.tmdb.org/t/p/w185${talentRes.data.profile_path}`)
            .then(color => setDominantColor(color));
        }

        const creditsRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}/combined_credits?api_key=${tmdbAPIKey}&language=en-US`
        );

        const imagesRes = await axios.get(
          `https://api.themoviedb.org/3/person/${id}/images?api_key=${tmdbAPIKey}`
        );
        setImages(imagesRes.data.profiles || []);

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

  const handleNextImage = useCallback(() => {
    if (selectedImageIndex === null || images.length === 0) return;
    setSelectedImageIndex((prev) => (prev !== null ? (prev + 1) % images.length : 0));
  }, [selectedImageIndex, images.length]);

  const handlePrevImage = useCallback(() => {
    if (selectedImageIndex === null || images.length === 0) return;
    setSelectedImageIndex((prev) => (prev !== null ? (prev - 1 + images.length) % images.length : 0));
  }, [selectedImageIndex, images.length]);

  const handleCloseLightbox = useCallback(() => {
    setSelectedImageIndex(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageIndex === null) return;
      if (e.key === "ArrowRight") {
        handleNextImage();
      } else if (e.key === "ArrowLeft") {
        handlePrevImage();
      } else if (e.key === "Escape") {
        handleCloseLightbox();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImageIndex, handleNextImage, handlePrevImage, handleCloseLightbox]);

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

  const handleDownloadImage = async (filePath: string, index: number) => {
    try {
      const imageUrl = `https://image.tmdb.org/t/p/original${filePath}`;
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${talent?.name || 'talent'}-photo-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      window.open(`https://image.tmdb.org/t/p/original${filePath}`, '_blank');
    }
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      const offset = 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = ref.current.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const knownForWorks = useMemo(() => {
    return [...works]
      .filter((w) => w.poster_path || w.backdrop_path)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 6);
  }, [works]);

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

  const isBioLong = talent?.biography && talent.biography.length > 300;

  return (
    <div className="relative min-h-screen font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',sans-serif]">
      <style>{`
        .filmography-card-static:hover,
        .filmography-card-static:hover > a,
        .filmography-card-static:hover > a > div,
        .filmography-card-static:hover > a > div > div,
        .filmography-card-static:hover > a > div > div > :last-child {
          transform: none !important;
          translate: none !important;
          scale: 1 !important;
          rotate: none !important;
        }
      `}</style>
      <div
        className="fixed inset-0 pointer-events-none transition-all duration-1000 z-0 opacity-25"
        style={{
          background: `radial-gradient(1200px circle at 50% -10%, rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.35), transparent 70%)`
        }}
      />

      <div className="relative z-10 container mx-auto px-4 py-6 md:py-12 max-w-7xl">
        <div ref={heroRef} className="relative mb-6 md:mb-10 rounded-[32px] sm:rounded-[40px] overflow-hidden p-0.5 bg-gradient-to-b from-white/30 via-white/10 to-transparent shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)]">
          <div className="relative min-h-none sm:min-h-[380px] md:h-[420px] rounded-[30px] sm:rounded-[38px] overflow-hidden bg-black/60 backdrop-blur-3xl">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 filter blur-xl opacity-50 transition-all duration-700"
              style={{ backgroundImage: backgroundImageUrl }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div
              className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen"
              style={{
                background: `radial-gradient(800px circle at 20% 40%, rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.5), transparent 60%)`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none" />

            <div className="relative h-full flex flex-col sm:flex-row items-center sm:items-end justify-between p-5 sm:p-7 md:p-8 gap-5 z-10 pt-8 sm:pt-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-6 w-full sm:w-auto">
                <div className="relative flex-shrink-0 group">
                  <div className="relative w-32 h-44 sm:w-36 sm:h-52 md:w-44 md:h-60 rounded-[28px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.5)] p-1 bg-gradient-to-b from-white/40 via-white/10 to-transparent backdrop-blur-2xl">
                    <div className="w-full h-full rounded-[24px] overflow-hidden relative bg-zinc-900">
                      {talent?.profile_path ? (
                        <img
                          src={talentImageUrl}
                          alt={`${talentName} profile`}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-500">
                          <ImageOff className="w-10 h-10 mb-2 opacity-40" />
                          <span className="text-xs font-medium px-4 text-center">No Image</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left text-white w-full">
                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-2 sm:mb-3 leading-[1.05] drop-shadow-md">
                    {talentName}
                  </h1>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-4 sm:mb-5">
                    <div className="flex items-center gap-2 bg-gradient-to-b from-white/25 to-white/10 backdrop-blur-2xl px-3.5 py-1.5 rounded-full border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
                      <ChartNoAxesCombined className="w-4 h-4 text-amber-300 shrink-0" />
                      <span className="font-semibold text-xs tracking-wide text-white">{formattedPopularity}</span>
                      <span className="text-white/60 text-xs font-medium hidden xs:inline">Popularity</span>
                    </div>

                    {images.length > 0 && (
                      <button
                        onClick={() => setIsGalleryOpen(true)}
                        className="flex items-center gap-2 bg-gradient-to-b from-white/25 to-white/10 hover:from-white/35 hover:to-white/15 backdrop-blur-2xl px-3.5 py-1.5 rounded-full border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-all active:scale-95 text-white"
                      >
                        <Images className="w-4 h-4 text-sky-300 shrink-0" />
                        <span className="font-semibold text-xs tracking-wide">{images.length} Photos</span>
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <motion.button
                      onClick={handleFavoriteToggle}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      className={`w-full sm:w-auto flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-6 py-3 rounded-2xl font-semibold text-xs tracking-wide transition-all duration-300 shadow-2xl border ${isFavorite
                        ? "bg-gradient-to-b from-rose-500 to-rose-700 text-white border-rose-400/40 shadow-rose-950/50"
                        : "bg-gradient-to-b from-white/95 to-white/80 text-black border-white shadow-black/20 hover:from-white hover:to-white/90"
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
                      <span>
                        {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                      </span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-4 z-40 mb-8 w-full max-w-fit mx-auto sm:mx-0 px-2 sm:px-0">
          <nav className="flex items-center gap-1 sm:gap-2 p-1.5 bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl overflow-x-auto no-scrollbar max-w-[calc(100vw-2rem)] sm:max-w-none touch-pan-x -webkit-overflow-scrolling-touch">
            <button
              onClick={() => scrollToSection(heroRef)}
              className={`px-3 sm:px-3.5 py-2 min-h-[44px] rounded-full text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 active:scale-95 ${activeNavSection === 'overview'
                ? 'bg-white text-black shadow-lg scale-105'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>Overview</span>
            </button>
            {knownForWorks.length > 0 && (
              <button
                onClick={() => scrollToSection(knownForRef)}
                className={`px-3 sm:px-3.5 py-2 min-h-[44px] rounded-full text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 active:scale-95 ${activeNavSection === 'known-for'
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span>Known For</span>
              </button>
            )}
            {images.length > 0 && (
              <button
                onClick={() => scrollToSection(gallerySectionRef)}
                className={`px-3 sm:px-3.5 py-2 min-h-[44px] rounded-full text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 active:scale-95 ${activeNavSection === 'gallery'
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Images className="w-3.5 h-3.5 shrink-0" />
                <span>Gallery</span>
              </button>
            )}
            <button
              onClick={() => scrollToSection(filmographyRef)}
              className={`px-3 sm:px-3.5 py-2 min-h-[44px] rounded-full text-xs font-semibold tracking-wide transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 active:scale-95 ${activeNavSection === 'filmography'
                ? 'bg-white text-black shadow-lg scale-105'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Film className="w-3.5 h-3.5 shrink-0" />
              <span>Filmography</span>
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8 mb-12">
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="bg-zinc-900/40 backdrop-blur-md rounded-3xl p-6 border border-zinc-800/60 shadow-xl">
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
                          className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-all duration-200 hover:scale-105 group active:scale-95 min-h-[44px] min-w-[44px]"
                        >
                          <img src="/insta-icon.png" alt="Instagram" className="w-9 h-9 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                      {talent?.twitter_id && (
                        <a
                          href={`https://twitter.com/${talent.twitter_id}`}
                          rel="noopener noreferrer"
                          aria-label={`${talentName} on Twitter`}
                          className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-all duration-200 hover:scale-105 group active:scale-95 min-h-[44px] min-w-[44px]"
                        >
                          <img src="/twitter-icon.png" alt="Twitter" className="w-9 h-9 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                      {talent?.youtube_id && (
                        <a
                          href={`https://youtube.com/${talent.youtube_id}`}
                          rel="noopener noreferrer"
                          aria-label={`${talentName} on YouTube`}
                          className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-all duration-200 hover:scale-105 group active:scale-95 min-h-[44px] min-w-[44px]"
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

          <div ref={bioRef} className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-zinc-900/30 backdrop-blur-sm rounded-3xl p-6 sm:p-8 border border-zinc-800/40 shadow-xl h-full flex flex-col justify-start">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white tracking-tight">Biography</h2>
              <div className="relative">
                <p className={`text-zinc-300 text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal transition-all duration-500 ${!isBioExpanded ? 'line-clamp-4 max-h-28 overflow-hidden' : ''}`}>
                  {talent?.biography ?? "Biography not available for this individual."}
                </p>
                {!isBioExpanded && isBioLong && (
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-900/90 via-zinc-900/40 to-transparent pointer-events-none" />
                )}
              </div>
              {isBioLong && (
                <button
                  onClick={() => setIsBioExpanded(!isBioExpanded)}
                  className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors w-fit focus:outline-none min-h-[44px] min-w-[44px] py-2"
                >
                  <span>{isBioExpanded ? "Read Less" : "Read More"}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isBioExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>

        {knownForWorks.length > 0 && (
          <div ref={knownForRef} className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Crown className="w-5 h-5 text-amber-500 shrink-0" />
              <h2 className="text-2xl font-bold text-white tracking-tight">Known For</h2>
            </div>
            <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory scroll-smooth no-scrollbar touch-pan-x -webkit-overflow-scrolling-touch pb-4 px-4 sm:px-0 -mx-4 sm:mx-0">
              {knownForWorks.map((work) => {
                const mediaType = work.media_type === "tv" ? "tv" : "movie";
                const rating = work.vote_average ? work.vote_average.toFixed(1) : null;
                const releaseDate = work.release_date || work.first_air_date;
                const workYear = releaseDate && releaseDate.trim() !== "" ? releaseDate.split("-")[0] : "TBD";

                return (
                  <Link key={work.id} to={`/${mediaType}/${work.id}`} className="group block shrink-0 w-[140px] sm:w-[160px] md:w-[180px] snap-start">
                    <div className="relative aspect-[2/3] rounded-3xl overflow-hidden bg-gradient-to-b from-white/20 via-white/5 to-transparent p-[1px] shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
                      <div className="relative w-full h-full rounded-[23px] overflow-hidden bg-zinc-950">
                        <img
                          src={work.poster_path ? `https://image.tmdb.org/t/p/w342${work.poster_path}` : noImageSvg}
                          alt={work.title || work.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/25 via-transparent to-transparent pointer-events-none z-10" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
                        {rating && (
                          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 shadow-md">
                            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 fill-amber-400" />
                            <span className="text-[10px] sm:text-[11px] font-semibold text-white leading-none tracking-tight">{rating}</span>
                          </div>
                        )}
                        <div className="absolute top-2.5 right-2.5 z-20 flex items-center justify-center px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 shadow-md">
                          <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-200 leading-none tracking-tight">{workYear}</span>
                        </div>

                        <div className="absolute bottom-0 inset-x-0 p-3 z-20 flex flex-col justify-end">
                          <span className="text-xs font-bold text-white line-clamp-1 tracking-tight">{work.title || work.name}</span>
                          <span className="text-[10px] text-zinc-300 line-clamp-1 font-medium">{work.displayRole}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {images.length > 0 && (
          <div ref={gallerySectionRef} className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Images className="w-5 h-5 text-sky-400 shrink-0" />
                <h2 className="text-2xl font-bold text-white tracking-tight">Gallery Preview</h2>
              </div>
              <button
                onClick={() => setIsGalleryOpen(true)}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-end"
              >
                View All ({images.length})
              </button>
            </div>
            <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-6 gap-4 overflow-x-auto no-scrollbar touch-pan-x -webkit-overflow-scrolling-touch -mx-4 px-4 sm:mx-0 sm:px-0">
              {images.slice(0, 6).map((img, idx) => (
                <div
                  key={img.file_path || idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className="group relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 cursor-pointer shadow-lg active:scale-95 transition-all shrink-0 w-[140px] sm:w-auto"
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w342${img.file_path}`}
                    alt={`${talentName} preview ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Images className="w-6 h-6 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <section ref={filmographyRef}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3 flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-white whitespace-nowrap">Filmography</h2>
              <div className="h-px bg-gradient-to-r from-zinc-800 to-transparent flex-1 hidden sm:block" />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex items-center p-1 bg-gradient-to-b from-white/[0.07] to-white/[0.01] border border-t-white/[0.15] border-x-white/[0.08] border-b-white/[0.03] rounded-xl w-auto sm:w-auto backdrop-blur-2xl shadow-[0_4px_20px_0_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] overflow-hidden">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`relative flex-1 sm:flex-initial flex items-center justify-center gap-1.5 min-h-[36px] px-2.5 md:px-4 py-1 font-semibold text-[11px] md:text-xs tracking-wide transition-all duration-500 ease-[0.25,1,0.5,1] rounded-lg overflow-hidden group ${activeTab === 'all'
                    ? 'text-white shadow-[0_2px_12px_rgba(220,38,38,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                >
                  {activeTab === 'all' && (
                    <div className="absolute inset-0 bg-gradient-to-b from-red-500 via-red-600 to-red-700 before:absolute before:inset-0 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_50%,rgba(0,0,0,0.15)_100%)]" />
                  )}
                  {activeTab === 'all' && (
                    <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                  )}
                  <Layers className={`w-3 h-3 relative z-10 transition-transform duration-300 ${activeTab === 'all' ? 'scale-105' : 'group-hover:scale-105'}`} />
                  <span className="relative z-10">All</span>
                </button>

                <button
                  onClick={() => setActiveTab('movie')}
                  className={`relative flex-1 sm:flex-initial flex items-center justify-center gap-1.5 min-h-[36px] px-2.5 md:px-4 py-1 font-semibold text-[11px] md:text-xs tracking-wide transition-all duration-500 ease-[0.25,1,0.5,1] rounded-lg overflow-hidden group ${activeTab === 'movie'
                    ? 'text-white shadow-[0_2px_12px_rgba(220,38,38,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                >
                  {activeTab === 'movie' && (
                    <div className="absolute inset-0 bg-gradient-to-b from-red-500 via-red-600 to-red-700 before:absolute before:inset-0 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_50%,rgba(0,0,0,0.15)_100%)]" />
                  )}
                  {activeTab === 'movie' && (
                    <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                  )}
                  <Clapperboard className={`w-3 h-3 relative z-10 transition-transform duration-300 ${activeTab === 'movie' ? 'scale-105' : 'group-hover:scale-105'}`} />
                  <span className="relative z-10">Movies</span>
                </button>

                <button
                  onClick={() => setActiveTab('tv')}
                  className={`relative flex-1 sm:flex-initial flex items-center justify-center gap-1.5 min-h-[36px] px-2.5 md:px-4 py-1 font-semibold text-[11px] md:text-xs tracking-wide transition-all duration-500 ease-[0.25,1,0.5,1] rounded-lg overflow-hidden group ${activeTab === 'tv'
                    ? 'text-white shadow-[0_2px_12px_rgba(220,38,38,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                >
                  {activeTab === 'tv' && (
                    <div className="absolute inset-0 bg-gradient-to-b from-red-500 via-red-600 to-red-700 before:absolute before:inset-0 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_50%,rgba(0,0,0,0.15)_100%)]" />
                  )}
                  {activeTab === 'tv' && (
                    <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                  )}
                  <Tv className={`w-3 h-3 relative z-10 transition-transform duration-300 ${activeTab === 'tv' ? 'scale-105' : 'group-hover:scale-105'}`} />
                  <span className="relative z-10">Series</span>
                </button>

                <Link
                  to={`/talent/${talent?.id}/connections`}
                  className="relative flex-1 sm:flex-initial flex items-center justify-center gap-1.5 min-h-[36px] px-2.5 md:px-4 py-1 font-semibold text-[11px] md:text-xs tracking-wide transition-all duration-500 ease-[0.25,1,0.5,1] rounded-lg overflow-hidden group text-white border border-transparent hover:border-blue-400/40 hover:bg-blue-500/10"
                >
                  <Network className="w-3 h-3 relative z-10 transition-transform duration-300 group-hover:scale-110 text-blue-400" />
                  <span className="relative z-10">Connections</span>
                </Link>
              </div>
              <div className="relative">
                <button
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="w-full sm:w-auto flex items-center justify-between gap-2 min-h-[38px] px-3 py-1.5 bg-gradient-to-b from-white/[0.07] to-white/[0.01] border border-t-white/[0.15] border-x-white/[0.08] border-b-white/[0.03] rounded-xl backdrop-blur-2xl shadow-[0_4px_20px_0_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] text-white font-medium text-xs transition-all duration-300 hover:border-white/20 active:scale-98"
                >
                  <div className="flex items-center gap-1.5">
                    <ActiveSortIcon className="w-3.5 h-3.5 text-red-500" />
                    <span>{sortOptions.find(o => o.id === sortBy)?.label}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-300 ${isSortOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isSortOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.95 }}
                      className="absolute right-0 mt-1.5 w-44 z-50 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1 backdrop-blur-xl"
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
                            className={`w-full flex items-center justify-between min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${isSelected ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-rose-500" />
                              <span>{option.label}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-rose-400" />}
                          </button>
                        );
                      })}
                    </motion.div>
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
                const rating = work.vote_average ? work.vote_average.toFixed(1) : null;

                return (
                  <motion.div
                    key={work.uniqueKey || work.id}
                    variants={cardVariants}
                    layout
                    className="filmography-card-static"
                  >
                    <Link to={`/${mediaType}/${work.id}`} className="block h-full group">
                      <div className="h-full relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-b from-white/25 via-white/10 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-colors duration-300 group-hover:from-white/40 group-hover:via-white/20 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                        <div className="relative w-full h-full rounded-[15px] overflow-hidden bg-zinc-950">
                          {rating && (
                            <div className="absolute top-2 left-2 md:top-3 md:left-3 z-30 pointer-events-none">
                              <div className="flex items-center gap-1 h-5 md:h-6 px-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 shadow-md">
                                <Star className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-400 fill-amber-400" />
                                <span className="text-[9px] md:text-[10px] font-semibold text-white leading-none tracking-tight">
                                  {rating}
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 md:top-3 md:right-3 z-30 pointer-events-none">
                            <div
                              className={`flex items-center justify-center h-5 md:h-6 px-2 rounded-full backdrop-blur-md border shadow-md transition-colors duration-300 ${hasYear
                                  ? "bg-black/50 border-white/15 group-hover:bg-black/60 group-hover:border-white/25"
                                  : "bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20 group-hover:border-amber-500/30"
                                }`}
                            >
                              <span
                                className={`text-[9px] md:text-[10px] font-semibold leading-none tracking-tight transition-colors duration-300 ${hasYear
                                    ? "text-zinc-200 group-hover:text-white"
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
      </div>

      <AnimatePresence>
        {isGalleryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-xl"
          >
            <motion.div
              initial={isMobileViewport ? { y: "100%" } : { scale: 0.9, opacity: 0 }}
              animate={isMobileViewport ? { y: 0 } : { scale: 1, opacity: 1 }}
              exit={isMobileViewport ? { y: "100%" } : { scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`relative w-full ${isMobileViewport
                ? "h-[85vh] rounded-t-[32px] border-t border-white/20"
                : "max-w-5xl max-h-[85vh] rounded-3xl border border-white/10"
                } bg-zinc-950/95 overflow-hidden flex flex-col shadow-2xl`}
            >
              {isMobileViewport && (
                <div className="w-full py-3 flex items-center justify-center cursor-grab active:cursor-grabbing">
                  <div className="w-12 h-1.5 rounded-full bg-zinc-700/80" />
                </div>
              )}

              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Images className="w-5 h-5 text-sky-400 shrink-0" />
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">
                    {talentName} - Gallery
                  </h3>
                  <span className="text-xs text-zinc-400 font-medium shrink-0">({images.length})</span>
                </div>
                <button
                  onClick={() => setIsGalleryOpen(false)}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4 auto-rows-max">
                {images.map((img, idx) => (
                  <div
                    key={img.file_path || idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className="group relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 aspect-[2/3] cursor-pointer active:scale-95 transition-transform"
                  >
                    <img
                      src={`https://image.tmdb.org/t/p/w500${img.file_path}`}
                      alt={`${talentName} ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                      <span className="text-[10px] font-mono text-zinc-300">{img.width}x{img.height}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadImage(img.file_path, idx);
                        }}
                        className="p-2 rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Download Image"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedImageIndex !== null && images[selectedImageIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseLightbox}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-6"
          >
            <motion.div
              drag={isMobileViewport ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={(_: any, info: PanInfo) => {
                if (info.offset.y > 100 || info.offset.y < -100) {
                  handleCloseLightbox();
                }
              }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="relative w-full h-full sm:max-w-5xl sm:max-h-[90vh] flex flex-col items-center justify-center"
            >
              <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-mono text-white">
                {selectedImageIndex + 1} / {images.length}
              </div>

              <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => handleDownloadImage(images[selectedImageIndex].file_path, selectedImageIndex)}
                  className="p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                  title="Download Image"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={handleCloseLightbox}
                  className="p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                  title="Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <motion.div
                key={selectedImageIndex}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_: any, info: PanInfo) => {
                  if (info.offset.x < -50) handleNextImage();
                  if (info.offset.x > 50) handlePrevImage();
                }}
                className="w-full h-full flex items-center justify-center p-2 sm:p-4"
              >
                <img
                  src={`https://image.tmdb.org/t/p/original${images[selectedImageIndex].file_path}`}
                  alt="Enlarged view"
                  className="max-w-full max-h-[75vh] sm:max-h-[85vh] object-contain rounded-2xl shadow-2xl select-none"
                />
              </motion.div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all flex items-center justify-center min-h-[44px] min-w-[44px] active:scale-95 z-20"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all flex items-center justify-center min-h-[44px] min-w-[44px] active:scale-95 z-20"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
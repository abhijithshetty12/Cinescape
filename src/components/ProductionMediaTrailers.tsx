import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Play, Image as ImageIcon, Download, X, ImageOff, ShieldCheck } from 'lucide-react';

export interface TrailerItem {
  key: string;
  name: string;
  type?: string;
  official?: boolean;
  site?: string;
  id?: string | number;
}

export interface TmdbImageItem {
  file_path: string;
  vote_count?: number;
  vote_average?: number;
  aspect_ratio?: number;
  width?: number;
  height?: number;
}

export type ProductionMediaType = 'movie' | 'tv';

export interface ProductionMediaTrailersProps {
  trailers: TrailerItem[];
  backdrops: TmdbImageItem[];
  posters: TmdbImageItem[];
  title?: string;
  mediaType?: ProductionMediaType;
}

const TMDB_BASE = 'https://image.tmdb.org/t/p';
const W780 = `${TMDB_BASE}/w780`;
const ORIGINAL = `${TMDB_BASE}/original`;

const TABS = [
  { id: 'popular', label: 'Popular', icon: TrendingUp },
  { id: 'videos', label: 'Videos', icon: Play },
  { id: 'backdrops', label: 'Backdrops', icon: ImageIcon },
  { id: 'posters', label: 'Posters', icon: ImageIcon },
];

const ProductionMediaTrailers = ({
  trailers = [],
  backdrops = [],
  posters = [],
  title = 'Title',
  mediaType = 'movie',
}: ProductionMediaTrailersProps) => {
  const [activeTab, setActiveTab] = useState('popular');
  const [featuredVideo, setFeaturedVideo] = useState<TrailerItem | null>(trailers[0] || null);
  const [viewingImage, setViewingImage] = useState<{ src: string; name: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const mediaAlt = mediaType === 'tv' ? 'Series still' : 'Movie still';
  const hasAny = trailers.length > 0 || backdrops.length > 0 || posters.length > 0;

  const downloadImage = useCallback(async (file_path: string, filename: string) => {
    const url = `${ORIGINAL}/${file_path}`;
    setDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  }, []);

  const handleDownload = (file_path: string) =>
    downloadImage(file_path, `${title.replace(/\s+/g, '_')}_${file_path.split('/').pop()}`);

  const topVideo = trailers[0];
  const topBackdrop = backdrops[0];
  const topPoster = posters[0];

  return (
    <div className="w-full my-8 sm:my-12 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="relative w-full bg-black text-white p-4 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-[0_0_120px_rgba(0,0,0,1)] overflow-hidden font-sans">
        <div className="absolute top-0 left-1/3 w-72 sm:w-96 h-72 sm:h-96 bg-blue-600/10 rounded-full filter blur-[100px] sm:blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 w-72 sm:w-96 h-72 sm:h-96 bg-indigo-600/10 rounded-full filter blur-[100px] sm:blur-[140px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-400 px-1 text-center md:text-left">
            Production Media & Trailers
          </h3>
          <div className="grid grid-cols-4 md:flex items-center gap-1 sm:gap-6 border-b border-white/10 pb-1 sm:pb-0.5 w-full md:w-auto bg-zinc-950/40 md:bg-transparent p-1 md:p-0 rounded-2xl md:rounded-none">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative py-2.5 sm:pb-3 text-xs font-semibold uppercase tracking-wider transition-colors duration-300 flex items-center justify-center md:justify-start gap-2 whitespace-nowrap rounded-xl md:rounded-none ${
                    isActive ? 'text-white bg-white/5 md:bg-transparent' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <span className="hidden sm:inline">{tab.label}</span>

                  {isActive && (
                    <motion.div
                      layoutId="activeUnderline"
                      className="absolute bottom-0 left-2 right-2 md:left-0 md:right-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {!hasAny ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 bg-zinc-950/40 rounded-3xl border border-white/[0.05] backdrop-blur-3xl">
            <ImageOff className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-600 mb-3 stroke-[1.25]" />
            <p className="text-xs sm:text-sm text-zinc-400 font-medium">No production media assets available</p>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col gap-10">
            {activeTab === 'popular' && (
              <div className="flex lg:grid lg:grid-cols-12 gap-5 sm:gap-6 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 snap-x snap-mandatory scrollbar-none items-stretch">
                {topVideo && (
                  <div className="w-[85vw] sm:w-[360px] lg:w-auto lg:col-span-12 xl:col-span-6 flex flex-col gap-3 shrink-0 snap-center">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Play className="w-3.5 h-3.5 text-blue-500 fill-blue-500" /> Top Video
                      </h4>
                      {topVideo.official && (
                        <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <ShieldCheck className="w-3 h-3" /> Official
                        </span>
                      )}
                    </div>
                    <div className="relative aspect-video w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 bg-black shadow-lg">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${topVideo.key}?autoplay=0`}
                        title={topVideo.name}
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <p className="text-xs font-semibold text-white truncate px-1">{topVideo.name}</p>
                  </div>
                )}
                {topBackdrop && (
                  <div className="w-[85vw] sm:w-[360px] lg:w-auto lg:col-span-7 xl:col-span-4 flex flex-col gap-3 shrink-0 snap-center">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> Featured Backdrop
                      </h4>
                    </div>
                    <div
                      onClick={() => setViewingImage({ src: `${ORIGINAL}/${topBackdrop.file_path}`, name: topBackdrop.file_path })}
                      className="group relative aspect-video w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-zinc-950/80 backdrop-blur-2xl cursor-pointer shadow-lg hover:border-white/25 transition-all duration-500"
                    >
                      <img
                        src={`${W780}/${topBackdrop.file_path}`}
                        alt={mediaAlt}
                        className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 p-3 sm:p-4 flex items-end justify-between">
                        <span className="text-[10px] sm:text-xs font-medium text-zinc-300 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full bg-black/40 border border-white/10">
                          HD Backdrop
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(topBackdrop.file_path);
                          }}
                          disabled={downloading}
                          className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-blue-600 text-white backdrop-blur-xl border border-white/20 transition-all active:scale-90"
                        >
                          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {topPoster && (
                  <div className="w-[55vw] sm:w-[220px] lg:w-auto lg:col-span-5 xl:col-span-2 flex flex-col gap-3 shrink-0 snap-center">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2 truncate">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Key Poster
                      </h4>
                    </div>
                    <div
                      onClick={() => setViewingImage({ src: `${ORIGINAL}/${topPoster.file_path}`, name: topPoster.file_path })}
                      className="group relative aspect-[2/3] w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-zinc-950/80 backdrop-blur-2xl cursor-pointer shadow-xl hover:border-white/25 transition-all duration-500"
                    >
                      <img
                        src={`${W780}/${topPoster.file_path}`}
                        alt={mediaAlt}
                        className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 p-2.5 sm:p-3 flex items-end justify-between">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(topPoster.file_path);
                          }}
                          disabled={downloading}
                          className="w-full py-1.5 sm:py-2 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-[10px] sm:text-xs font-semibold backdrop-blur-xl border border-blue-400/30 transition-all flex items-center justify-center gap-1 sm:gap-1.5 active:scale-95"
                        >
                          <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Original
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'videos' && trailers.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Play className="w-4 h-4 text-blue-500 fill-blue-500" /> Trailers & Clips
                  </h3>
                  <span className="text-xs font-medium text-zinc-500">{trailers.length} Videos</span>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  {featuredVideo && (
                    <div className="w-full lg:w-2/3 flex flex-col gap-3 shrink-0">
                      <div className="relative aspect-video w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 bg-black shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                        <iframe
                          className="w-full h-full"
                          src={`https://www.youtube.com/embed/${featuredVideo.key}?autoplay=0`}
                          title={featuredVideo.name}
                          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 px-2">
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{featuredVideo.name}</h4>
                          <span className="text-[10px] sm:text-xs text-zinc-400">YouTube Official Stream</span>
                        </div>
                        {featuredVideo.official && (
                          <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 backdrop-blur-xl shrink-0">
                            <ShieldCheck className="w-3 h-3" /> Official
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="w-full lg:w-1/3 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto max-h-[380px] pb-2 lg:pb-0 scrollbar-none sm:scrollbar-thin sm:scrollbar-thumb-zinc-800">
                    {trailers.map((trailer) => {
                      const isSelected = featuredVideo?.key === trailer.key;
                      return (
                        <div
                          key={trailer.key}
                          onClick={() => setFeaturedVideo(trailer)}
                          className={`group cursor-pointer p-2.5 sm:p-3 rounded-2xl border transition-all duration-300 flex items-center gap-3 backdrop-blur-2xl shrink-0 w-64 sm:w-72 lg:w-full ${
                            isSelected
                              ? 'bg-blue-600/15 border-blue-500/40 shadow-[0_0_25px_rgba(37,99,235,0.25)]'
                              : 'bg-zinc-950/60 border-white/[0.06] hover:border-white/20 hover:bg-zinc-900/40'
                          }`}
                        >
                          <div className="relative aspect-video w-20 sm:w-24 rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shrink-0">
                            <img
                              src={`https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg`}
                              alt={trailer.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <p className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">{trailer.name}</p>
                            <span className="text-[10px] text-zinc-500 mt-1">Select Video</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
            {activeTab === 'backdrops' && backdrops.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-500" /> Production Backdrops
                  </h3>
                  <span className="text-xs font-medium text-zinc-500">{backdrops.length} Stills</span>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-none sm:scrollbar-thin sm:scrollbar-thumb-zinc-800 snap-x snap-mandatory">
                  {backdrops.map((item) => (
                    <div
                      key={item.file_path}
                      onClick={() => setViewingImage({ src: `${ORIGINAL}/${item.file_path}`, name: item.file_path })}
                      className="group relative aspect-video w-72 sm:w-96 rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-zinc-950/80 backdrop-blur-2xl cursor-pointer shrink-0 shadow-lg hover:border-white/25 transition-all duration-500 snap-center"
                    >
                      <img
                        src={`${W780}/${item.file_path}`}
                        alt={mediaAlt}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 p-3 sm:p-4 flex items-end justify-between">
                        <span className="text-[10px] sm:text-xs font-medium text-zinc-300 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full bg-black/40 border border-white/10">
                          HD Backdrop
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item.file_path);
                          }}
                          disabled={downloading}
                          className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-blue-600 text-white backdrop-blur-xl border border-white/20 transition-all active:scale-90"
                        >
                          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {activeTab === 'posters' && posters.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" /> Key Art & Posters
                  </h3>
                  <span className="text-xs font-medium text-zinc-500">{posters.length} Posters</span>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-none sm:scrollbar-thin sm:scrollbar-thumb-zinc-800 snap-x snap-mandatory">
                  {posters.map((item) => (
                    <div
                      key={item.file_path}
                      onClick={() => setViewingImage({ src: `${ORIGINAL}/${item.file_path}`, name: item.file_path })}
                      className="group relative aspect-[2/3] w-40 sm:w-52 rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-zinc-950/80 backdrop-blur-2xl cursor-pointer shrink-0 shadow-xl hover:border-white/25 transition-all duration-500 snap-center"
                    >
                      <img
                        src={`${W780}/${item.file_path}`}
                        alt={mediaAlt}
                        className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 p-2.5 sm:p-3 flex items-end justify-between">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item.file_path);
                          }}
                          disabled={downloading}
                          className="w-full py-1.5 sm:py-2 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-[10px] sm:text-xs font-semibold backdrop-blur-xl border border-blue-400/30 transition-all flex items-center justify-center gap-1 sm:gap-1.5 active:scale-95"
                        >
                          <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Get Original
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        <AnimatePresence>
          {viewingImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-3 sm:p-8"
              onClick={() => setViewingImage(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative max-w-5xl w-full bg-black/80 border border-white/15 rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-[0_0_120px_rgba(0,0,0,1)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative flex items-center justify-center bg-black max-h-[70vh] sm:max-h-[75vh] overflow-hidden">
                  <img
                    src={viewingImage.src}
                    alt="Vault Media High Resolution"
                    className="w-full h-auto max-h-[70vh] sm:max-h-[75vh] object-contain"
                  />
                </div>

                <div className="p-3.5 sm:p-5 bg-zinc-950/90 border-t border-white/10 backdrop-blur-2xl flex items-center justify-between gap-3 sm:gap-4">
                  <span className="text-[10px] sm:text-xs font-medium text-zinc-400 truncate max-w-[150px] sm:max-w-none">
                    {viewingImage.name}
                  </span>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownload(viewingImage.name)}
                      disabled={downloading}
                      className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl sm:rounded-2xl text-white font-semibold text-[10px] sm:text-xs border border-blue-400/30 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewingImage(null)}
                      className="p-2 sm:p-2.5 bg-white/10 hover:bg-white/20 rounded-xl sm:rounded-2xl text-white border border-white/10 transition-all active:scale-95"
                    >
                      <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProductionMediaTrailers;
import React from 'react';
import { motion } from 'framer-motion';
import { Star, Sparkles, CheckCircle, Edit2, Trash2 } from 'lucide-react';

interface MediaRatingProps {
  userRating: number | null;
  hasSavedRating: boolean;
  editingRating: boolean;
  onRate: (rating: number) => void;
  onSubmit: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDeleteRating: () => void;
  mediaType: 'movie' | 'tv';
}

const MediaRating = ({
  userRating,
  hasSavedRating,
  editingRating,
  onRate,
  onSubmit,
  onEdit,
  onCancelEdit,
  onDeleteRating,
  mediaType,
}: MediaRatingProps) => {
  const maskPrefix = mediaType === 'tv' ? 'star-gradient-tv' : 'star-gradient';

  const getRatingDescription = (rating: number) => {
    if (rating <= 1) return 'Weak sauce :(';
    if (rating <= 2) return 'Terrible';
    if (rating <= 3) return 'Bad';
    if (rating <= 4) return 'Poor';
    if (rating <= 5) return 'Meh';
    if (rating <= 6) return 'Fair';
    if (rating <= 7) return 'Good';
    if (rating <= 8) return 'Great';
    if (rating <= 9) return 'Superb';
    if (rating <= 9.5) return 'Perfect';
    return 'Masterpiece!';
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-full mx-auto overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/90 via-zinc-950/95 to-black p-5 sm:p-7 md:p-9 shadow-2xl backdrop-blur-2xl"
    >
      <div
        className={`absolute -top-24 -left-24 w-72 h-72 rounded-full bg-gradient-to-br ${userRating! >= 8 ? 'from-emerald-500/15 via-amber-500/10' : userRating! >= 6 ? 'from-sky-500/15 via-blue-500/10' : userRating! >= 4 ? 'from-amber-500/15 via-orange-500/10' : 'from-rose-500/15 via-red-500/10'} to-transparent blur-3xl pointer-events-none transition-all duration-700`}
      />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between gap-4 pb-6 mb-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-b from-amber-400/20 to-amber-500/5 border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400/30 stroke-[1.75]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Your Rating</h2>
            <p className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">User Assessment</p>
          </div>
        </div>

        {hasSavedRating && !editingRating && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Saved
          </span>
        )}
      </div>

      <div className="relative z-10">
        {hasSavedRating && !editingRating ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center justify-between gap-6 py-4 px-2 sm:px-4"
          >
            <div className="relative flex-shrink-0 flex items-center justify-center w-40 h-40 sm:w-44 sm:h-44">
              <div
                className={`absolute inset-0 rounded-full blur-2xl opacity-20 transition-all duration-700 ${userRating! >= 8 ? 'bg-emerald-500' : userRating! >= 6 ? 'bg-sky-500' : userRating! >= 4 ? 'bg-amber-500' : 'bg-rose-500'}`}
              />

              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" className="stroke-zinc-800/80" strokeWidth="6" fill="transparent" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray="263.89"
                  initial={{ strokeDashoffset: 263.89 }}
                  animate={{
                    strokeDashoffset: 263.89 - (263.89 * (userRating ?? 0)) / 10,
                  }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className={`transition-colors duration-500 ${userRating! >= 8 ? 'text-emerald-400' : userRating! >= 6 ? 'text-sky-400' : userRating! >= 4 ? 'text-amber-400' : 'text-rose-400'}`}
                />
              </svg>

              <div className="absolute inset-3 rounded-full bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-white/10 flex flex-col items-center justify-center p-2 shadow-inner backdrop-blur-xl">
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400 tracking-tighter"
                >
                  {userRating}
                </motion.span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                  / 10 Stars
                </span>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center sm:items-start text-center sm:text-left space-y-4 w-full">
              <div className="space-y-1.5 w-full">
                <p className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
                  Your Submitted Rating
                </p>

                {userRating !== null && (
                  <div>
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-black uppercase tracking-wider backdrop-blur-md shadow-md transition-all duration-300 ${userRating! >= 8 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10' : userRating! >= 6 ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-sky-500/10' : userRating! >= 4 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-amber-500/10' : 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-rose-500/10'}`}
                    >
                      {userRating! >= 8.5 && <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />}
                      <span>{getRatingDescription(userRating!)}</span>
                      {userRating! >= 8.5 && <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />}
                    </motion.div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-2.5 w-full max-w-md pt-1">
                <motion.button
                  onClick={onSubmit}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-2.5 sm:py-3 px-3 sm:px-5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-zinc-950 font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
                >
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" />
                  <span className="truncate">Re-Submit</span>
                </motion.button>

                <motion.button
                  onClick={onEdit}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-2.5 sm:py-3 px-3 sm:px-5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 shadow-md backdrop-blur-xl"
                >
                  <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400/20 shrink-0" />
                  <span className="truncate">Edit Rating</span>
                </motion.button>

                <motion.button
                  onClick={onDeleteRating}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="py-2.5 sm:py-3 px-3 sm:px-5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 shadow-md backdrop-blur-xl"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate hidden sm:inline">Delete</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl flex justify-center">
              <div className="grid grid-cols-5 sm:flex sm:flex-nowrap items-center justify-center gap-1.5 sm:gap-1.5 max-w-fit">
                {[...Array(10)].map((_, index) => {
                  const starValue = index + 1;
                  const current = userRating ?? 0;
                  const isFull = current >= starValue;
                  const isHalf = current === starValue - 0.5;
                  const maskId = `${maskPrefix}-${index}`;

                  return (
                    <div key={index} className="relative flex items-center justify-center">
                      <svg className="w-0 h-0 absolute" aria-hidden="true" focusable="false">
                        <defs>
                          <linearGradient id={maskId} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="50%" stopColor="#f59e0b" />
                            <stop offset="50%" stopColor="#27272a" />
                          </linearGradient>
                        </defs>
                      </svg>

                      <button
                        type="button"
                        onClick={() => onRate(starValue - 0.5)}
                        className="absolute left-0 top-0 w-1/2 h-full z-20 cursor-pointer outline-none"
                        aria-label={`Rate ${starValue - 0.5} stars`}
                      />
                      <button
                        type="button"
                        onClick={() => onRate(starValue)}
                        className="absolute right-0 top-0 w-1/2 h-full z-20 cursor-pointer outline-none"
                        aria-label={`Rate ${starValue} stars`}
                      />

                      <motion.div
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        className="relative p-1 cursor-pointer touch-none"
                      >
                        <Star
                          className={`w-7 h-7 sm:w-7 sm:h-7 transition-all duration-200 ${isFull ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)] stroke-[1.5]' : isHalf ? 'stroke-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)] stroke-[1.5]' : 'text-zinc-700 fill-zinc-900/50 stroke-[1.5]'}`}
                          style={isHalf ? { fill: `url(#${maskId})` } : undefined}
                        />
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col items-center space-y-2 min-h-[64px] justify-center">
              {userRating !== null ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center space-y-2"
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">{userRating}</span>
                    <span className="text-zinc-500 font-bold text-xs uppercase tracking-wider">/ 10 Stars</span>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider backdrop-blur-md transition-all duration-300 ${userRating >= 8 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : userRating >= 6 ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' : userRating >= 4 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}
                  >
                    {userRating >= 8.5 && <Sparkles className="w-3 h-3 animate-pulse text-amber-400" />}
                    <span>{getRatingDescription(userRating)}</span>
                    {userRating >= 8.5 && <Sparkles className="w-3 h-3 animate-pulse text-amber-400" />}
                  </div>
                </motion.div>
              ) : (
                <span className="text-xs font-semibold text-zinc-500 tracking-wide uppercase">
                  Select your rating from 1 to 10 stars
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-3 pt-2 w-full max-w-xs sm:max-w-md mx-auto">
              <motion.button
                onClick={onSubmit}
                disabled={userRating === null}
                whileHover={{ scale: userRating !== null ? 1.02 : 1 }}
                whileTap={{ scale: userRating !== null ? 0.98 : 1 }}
                className={`flex-1 min-w-0 py-2.5 sm:py-3 px-3 sm:px-6 rounded-xl font-extrabold text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg ${userRating !== null ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-zinc-950 shadow-amber-500/20 hover:shadow-amber-500/30 cursor-pointer' : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-60'}`}
              >
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" />
                <span className="truncate">Submit</span>
              </motion.button>

              {hasSavedRating && (
                <motion.button
                  onClick={onCancelEdit}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="py-2.5 sm:py-3 px-3 sm:px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center shrink-0"
                >
                  <span>Cancel</span>
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.section>
  );
};

export default MediaRating;

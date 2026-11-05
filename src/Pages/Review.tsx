import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Film, MessageSquareText, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import ReviewList from '../components/ReviewList.tsx';

const Review: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.uid;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!userId) {
    return (
      <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-14 text-white selection:bg-emerald-500/30 sm:px-6 sm:py-20 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-cyan-500/10 blur-[100px]" />
        
        <section className="relative z-10 w-full max-w-lg overflow-hidden rounded-[40px] border border-white/[0.12] bg-white/[0.03] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_40px_100px_-20px_rgba(0,0,0,0.8)] backdrop-blur-3xl sm:p-12 transform-gpu">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.05] text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <MessageSquareText className="h-7 w-7" />
          </div>
          <p className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
            <Sparkles className="h-3.5 w-3.5" />
            Your cinema journal
          </p>
          <h1 className="text-4xl font-black tracking-[-0.03em] sm:text-5xl">Your reviews, collected.</h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-zinc-400 sm:text-base">
            Sign in to revisit your ratings, edit your thoughts, and share the stories that stayed with you.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 px-8 text-sm font-bold text-emerald-950 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Film className="h-4 w-4" />
            Sign in to view reviews
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative isolate min-h-screen overflow-x-hidden bg-[#050505] px-3 pb-20 pt-6 text-white selection:bg-emerald-500/30 sm:px-6 sm:pb-24 sm:pt-10 lg:px-8 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif] transform-gpu">
      <div className="pointer-events-none absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-[400px] w-[400px] translate-x-1/3 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-[500px] w-[500px] translate-y-1/3 rounded-full bg-violet-500/10 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="relative mb-8 overflow-hidden rounded-[36px] border border-white/[0.12] bg-white/[0.03] px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_40px_100px_-20px_rgba(0,0,0,0.8)] backdrop-blur-3xl sm:mb-12 sm:rounded-[48px] sm:px-10 sm:py-12 transform-gpu">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-emerald-500/[0.08] blur-[80px]" />
          
          <div className="relative flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <MessageSquareText className="h-3.5 w-3.5 text-emerald-300" />
                Your cinema journal
              </div>
              <h1 className="text-5xl font-black leading-none tracking-[-0.04em] sm:text-7xl">
                Review<span className="bg-gradient-to-br from-emerald-200 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(52,211,153,0.3)]">s.</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                Every take, every rating, every return to a story — all in one place.
              </p>
            </div>
            
            <div className="flex items-center gap-4 rounded-[24px] border border-white/[0.08] bg-white/[0.02] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_40px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <span className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-emerald-400/20 bg-gradient-to-b from-emerald-400/10 to-emerald-500/5 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
                <Film className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-white tracking-tight">Your personal timeline</p>
                <p className="mt-0.5 text-[11px] font-medium text-zinc-500">Movies and series you’ve reviewed</p>
              </div>
            </div>
          </div>
        </header>
        
        <section aria-label="Your reviews" className="relative z-10 transform-gpu">
          <ReviewList userId={userId} />
        </section>
      </div>
    </main>
  );
};

export default Review;
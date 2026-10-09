import React, { useState, useEffect, useRef } from 'react';
import { Search, Menu, X, Compass, Users, Heart, Award, Clapperboard, Tv, User, Loader2, AlertCircle, SearchX, ListPlus, LogOut, Settings, ChevronRight, Film, Eye, Bookmark, } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  profile_path?: string;
  release_date?: string;
  first_air_date?: string;
  media_type: string;
}

const Navbar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<'movie' | 'tv' | 'person'>('movie');
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!user?.uid) { setPhotoUrl(null); setProfileName(''); return; }
    return onSnapshot(doc(db, 'users', user.uid), snap => {
      const data = snap.exists() ? snap.data() : null;
      setPhotoUrl(data?.photoDataUrl || data?.photoURL || user.photoURL || null);
      setProfileName(data?.displayName || data?.name || data?.username || user.displayName || user.email?.split('@')[0] || 'Cinescape user');
    }, () => setPhotoUrl(null));
  }, [user?.uid]);

  useEffect(() => {
    document.body.style.overflow = isTrayOpen || (searchOpen && window.innerWidth < 768) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isTrayOpen, searchOpen]);

  useEffect(() => {
    setIsTrayOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (searchOpen) requestAnimationFrame(() => searchRef.current?.focus());
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsTrayOpen(false); setSearchOpen(false); setProfileOpen(false); }
    };
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;
      let current = '';
      document.querySelectorAll<HTMLElement>('section[id], div[id]').forEach(section => {
        if (scrollPosition >= section.offsetTop && scrollPosition < section.offsetTop + section.offsetHeight) current = section.id;
      });
      setActiveSection(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  useEffect(() => {
    if (!searchOpen || !searchQuery.trim()) { setSearchResults([]); setLoading(false); setError(''); return; }
    const current = ++requestRef.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const key = '859afbb4b98e3b467da9c99ac390e950';
        const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(searchQuery.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        if (current === requestRef.current) setSearchResults((data.results || []).filter((item: SearchResult) => ['movie','tv','person'].includes(item.media_type)));
      } catch (e) {
        if (!controller.signal.aborted && current === requestRef.current) setError('Search is unavailable. Please try again.');
      } finally {
        if (current === requestRef.current) setLoading(false);
      }
    }, 280);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchQuery, searchOpen]);

  const closePanels = () => { setIsTrayOpen(false); setSearchOpen(false); setProfileOpen(false); };
  const openSearch = () => { setIsTrayOpen(false); setProfileOpen(false); setSearchOpen(true); };
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery('');
    closePanels();
  };
  const handleResultClick = (id: number, mediaType: string) => {
    navigate(mediaType === 'person' ? `/talent/${id}` : mediaType === 'tv' ? `/tv/${id}` : `/movie/${id}`);
    setSearchQuery('');
    closePanels();
  };
  const handleSignOut = async () => {
    try { await signOut(getAuth()); closePanels(); navigate('/home'); }
    catch (e) { setError('Unable to sign out. Please try again.'); }
  };

  const navItems = [
    { label: 'Explore', path: '/explore', sectionId: 'explore', icon: Compass },
    { label: 'Top Rated', path: '/top-rated', sectionId: 'top-rated', icon: Award },
    { label: 'My List', path: '/mylist', sectionId: 'mylist', icon: ListPlus },
    { label: 'Talents', path: '/talents', sectionId: 'talents', icon: Users },
    { label: 'Favorites', path: '/favourites', sectionId: 'favourites', icon: Heart }
  ];
  const movies = searchResults.filter(result => result.media_type === 'movie');
  const tvShows = searchResults.filter(result => result.media_type === 'tv');
  const talents = searchResults.filter(result => result.media_type === 'person');

  const searchGroups = [
    { id: 'movie' as const, label: 'Films', icon: Clapperboard, items: movies, tone: 'text-rose-300', active: 'border-rose-400/30 bg-gradient-to-r from-rose-500/25 via-rose-400/10 to-black/15 text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_6px_18px_rgba(244,63,94,0.08)]', dot: 'bg-rose-400' },
    { id: 'tv' as const, label: 'Shows', icon: Tv, items: tvShows, tone: 'text-sky-300', active: 'border-sky-400/30 bg-gradient-to-r from-sky-500/25 via-sky-400/10 to-black/15 text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_6px_18px_rgba(14,165,233,0.08)]', dot: 'bg-sky-400' },
    { id: 'person' as const, label: 'Talents', icon: Users, items: talents, tone: 'text-emerald-300', active: 'border-emerald-400/30 bg-gradient-to-r from-emerald-500/25 via-emerald-400/10 to-black/15 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_6px_18px_rgba(16,185,129,0.08)]', dot: 'bg-emerald-400' }
  ];
  const activeGroup = searchGroups.find(group => group.id === searchTab) || searchGroups[0];
  const SearchDropdownContent = () => (
    <div className="mt-2 overflow-hidden rounded-2xl border border-white/[0.13] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_35px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="grid grid-cols-3 gap-1.5 border-b border-white/10 px-1.5 py-2 sm:gap-2 sm:px-2">
        {searchGroups.map(group => <button key={group.id} type="button" onClick={() => setSearchTab(group.id)} className={`flex min-w-0 items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[10px] font-semibold transition-all duration-200 sm:gap-1.5 sm:px-3 sm:text-xs ${searchTab === group.id ? group.active : 'border-transparent bg-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-white'}`}><group.icon className={`h-3.5 w-3.5 ${searchTab === group.id ? group.tone : ''}`} />{group.label}<span className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums sm:text-[10px] ${searchTab === group.id ? "border border-white/10 bg-black/25 text-zinc-200" : "text-zinc-500"}`}>{group.items.length}</span></button>)}
      </div>
      <div className="max-h-[min(55dvh,490px)] overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin] [scrollbar-color:#555_transparent]">
        {loading ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin text-red-400" />Searching...</div> : error ? <div className="flex items-center gap-2 px-3 py-8 text-sm text-rose-300"><AlertCircle className="h-4 w-4" />{error}</div> : activeGroup.items.length === 0 ? <div className="flex flex-col items-center gap-2 py-10 text-sm text-zinc-500"><SearchX className="h-6 w-6" />No {activeGroup.label.toLowerCase()} found</div> : activeGroup.items.map(result => {
          const imagePath = result.media_type === 'person' ? result.profile_path : result.poster_path;
          const year = (result.release_date || result.first_air_date || '').slice(0, 4);
          return <button type="button" key={`${result.media_type}-${result.id}`} onClick={() => handleResultClick(result.id, result.media_type)} className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/60">
            <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md border border-white/10 bg-zinc-900">{imagePath ? <img src={`https://image.tmdb.org/t/p/w92${imagePath}`} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-600"><Film className="h-4 w-4" /></div>}</div>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-200 transition group-hover:text-white">{result.title || result.name}</span>
            <span className={`flex shrink-0 items-center gap-1.5 ${activeGroup.tone} opacity-65`}><ListPlus className="h-3.5 w-3.5" /><Eye className="h-3.5 w-3.5" /><Heart className="h-3.5 w-3.5" /></span>
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">{year || '—'}</span>
          </button>;
        })}
      </div>
    </div>
  );

  const quickLinks = [
    { label: 'My List', detail: 'Saved for later', icon: ListPlus, path: '/mylist' },
    { label: 'Watched', detail: 'Your viewing history', icon: Eye, path: '/history' },
    { label: 'Watchlist', detail: 'Your watchlist', icon: Bookmark, path: '/watchlist' },
    { label: 'Favorites', detail: 'Loved it', icon: Heart, path: '/favourites' }
  ];

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-[80] w-full border-0 bg-black/35 backdrop-blur-xl backdrop-saturate-150 text-white pointer-events-none">
        <div className="pointer-events-auto relative mx-auto flex h-[62px] max-w-[1500px] items-center gap-2 px-3 sm:px-6 lg:h-[76px]">
          <Link to="/home" onClick={closePanels} aria-label="Cinescape home" className="flex shrink-0 items-center gap-2 rounded-xl py-1.5">
            <img src="/Logo.png" alt="" className="h-8 w-8 object-contain drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
            <img src="/Cinescape.png" alt="Cinescape" className="hidden h-5 w-auto sm:block" />
          </Link>
          <div className="absolute left-[62px] top-0 flex h-[53px] items-center rounded-b-[23px] border border-t-0 border-white/[0.12] bg-black/90 px-2 shadow-[0_10px_28px_rgba(0,0,0,0.35),inset_0_-1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl sm:left-[78px] lg:hidden">
            <button type="button" onClick={() => searchOpen ? setSearchOpen(false) : openSearch()} aria-label="Search" className="flex h-8 w-9 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/10 hover:text-white"><Search className="h-[18px] w-[18px]" /></button>
          </div>
          <div className="hidden lg:flex absolute left-1/2 top-0 z-10 -translate-x-1/2 items-center gap-1 rounded-b-[34px] border border-t-0 border-white/[0.08] bg-black px-4 pb-3 pt-3 shadow-[0_16px_35px_rgba(0,0,0,0.35)] before:pointer-events-none before:absolute before:-left-8 before:top-0 before:h-8 before:w-8 before:bg-[radial-gradient(circle_at_0_100%,transparent_32px,#000_33px)] after:pointer-events-none after:absolute after:-right-8 after:top-0 after:h-8 after:w-8 after:bg-[radial-gradient(circle_at_100%_100%,transparent_32px,#000_33px)]">
            <button type="button" onClick={() => searchOpen ? setSearchOpen(false) : openSearch()} aria-label="Search" className="relative flex items-center justify-center rounded-xl p-3 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"><Search className="h-[17px] w-[17px]" /></button>
            {navItems.map(item => {
              const active = location.pathname === item.path || activeSection === item.sectionId;
              return <Link key={item.path} to={item.path} title={item.label} aria-label={item.label} className={`relative rounded-xl p-3 transition-colors ${active ? 'bg-white/10 text-red-400' : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`}><item.icon className="h-[17px] w-[17px]" />{active && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-red-500" />}</Link>;
            })}
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => { setIsTrayOpen(v => !v); setSearchOpen(false); setProfileOpen(false); }} aria-label={isTrayOpen ? 'Close menu' : 'Open menu'} aria-expanded={isTrayOpen} className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-200 transition hover:bg-black/60 lg:hidden">{isTrayOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            <div ref={profileRef} className="relative">
              <button type="button" onClick={() => { setProfileOpen(v => !v); setIsTrayOpen(false); setSearchOpen(false); }} aria-label="Account menu" aria-expanded={profileOpen} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/70 transition hover:border-white/40">
                <img src={photoUrl || '/user-icon.jpg'} alt="Account" className="h-full w-full object-cover" />
              </button>
              {profileOpen && <div className="absolute right-0 top-full mt-3 w-[min(300px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-white/10 bg-[#090909] p-2 shadow-[0_20px_65px_rgba(0,0,0,0.8)]">
                <div className="border-b border-white/10 px-3 py-3"><p className="truncate text-sm font-semibold text-white">{profileName || user?.displayName || 'Cinescape account'}</p><p className="mt-1 truncate text-xs text-zinc-500">{user?.email || 'Your account'}</p></div>
                <Link to="/profile" onClick={closePanels} className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"><User className="h-4 w-4" />Profile</Link>
                <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500"><Settings className="h-4 w-4" />Settings <span className="ml-auto text-[10px]">Coming soon</span></div>
                <button type="button" onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-300 hover:bg-red-500/10 hover:text-red-400"><LogOut className="h-4 w-4" />Sign out</button>
                {error && <p className="px-3 py-2 text-xs text-red-400">{error}</p>}
              </div>}
            </div>
          </div>
        </div>
      </nav>
      <div aria-hidden="true" className="h-[62px] w-full shrink-0 lg:h-[76px]" />
      <div className={`fixed inset-0 z-[75] transition-all duration-300 lg:hidden ${isTrayOpen ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'}`}>
        <button aria-label="Close navigation" onClick={() => setIsTrayOpen(false)} className="absolute inset-0 bg-black/70" />
        <div className={`absolute inset-x-2 top-[62px] max-h-[calc(100dvh-72px)] overflow-hidden rounded-b-[28px] border border-t-0 border-white/[0.14] bg-[#08090b]/85 px-4 pb-4 pt-3 shadow-[0_24px_65px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-[32px] backdrop-saturate-150 transition-transform duration-300 ${isTrayOpen ? 'translate-y-0' : '-translate-y-5'}`}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-0 h-40 w-40 rounded-full bg-red-500/[0.055] blur-[65px]" />
          <div className="relative space-y-1">
            {navItems.map(item => { const active = location.pathname === item.path; return <Link key={item.path} to={item.path} onClick={closePanels} className={`flex items-center gap-4 rounded-xl px-3 py-2.5 text-[14px] transition ${active ? 'border border-red-400/20 bg-gradient-to-r from-red-500/15 to-white/[0.035] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'border border-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-white'}`}><item.icon className={`h-[19px] w-[19px] ${active ? 'text-red-500' : ''}`} /><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500" />}</Link>; })}
          </div>
          <div className="my-2 h-px bg-white/10" />
          <Link to="/profile" onClick={closePanels} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-zinc-300 hover:bg-white/5 hover:text-white"><img src={photoUrl || user?.photoURL || "/user-icon.jpg"} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white/15 object-cover" /><span className="min-w-0 flex-1 truncate font-medium">{profileName || user?.displayName || user?.email?.split("@")[0] || "Profile"}</span><ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" /></Link>
          <div className="mt-2 flex items-center justify-center gap-2 text-[11px] tracking-[0.2em] text-zinc-600"><img src="/Logo.png" alt="" className="h-4 w-4 object-contain" /> CINESCAPE</div>
        </div>
      </div>
      <div className={`fixed inset-0 z-[90] transition-all duration-300 ${searchOpen ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'}`}>
        <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-[9px]" />
        <div className={`absolute left-1/2 top-[70px] w-[calc(100%-28px)] max-w-[460px] -translate-x-1/2 transition-all duration-300 md:top-[90px] ${searchOpen ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-3 scale-[0.98] opacity-0'}`}>
          <div className="relative isolate overflow-hidden rounded-[22px] border border-white/[0.18] bg-[#0a0a0d]/65 p-3 shadow-[0_30px_100px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-[36px] backdrop-saturate-[1.6] sm:p-4">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 h-48 w-48 rounded-full bg-red-500/[0.09] blur-[65px]" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-20 h-48 w-48 rounded-full bg-blue-500/[0.06] blur-[70px]" />
            <form onSubmit={handleSearch} className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Search className="ml-2 h-5 w-5 shrink-0 text-zinc-500" />
              <input ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search titles or jump to..." aria-label="Search movies, series and talents" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[15px] text-white outline-none placeholder:text-zinc-500" />
              {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="rounded-full p-2 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>}
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search" className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
            </form>
            <div className="relative max-h-[min(75dvh,650px)] overflow-y-auto overscroll-contain pt-2">
              {!searchQuery.trim() ? <div className="space-y-0.5">{quickLinks.map(link => <Link key={link.label} to={link.path} onClick={closePanels} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"><link.icon className="h-[17px] w-[17px]" /><span>{link.label}</span><span className="ml-auto text-xs text-zinc-600">{link.detail}</span></Link>)}</div> : <div className="relative min-h-[80px] pb-2"><SearchDropdownContent /></div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
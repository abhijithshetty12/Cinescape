import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpDown,
  Bookmark,
  Check,
  ChevronRight,
  ExternalLink,
  Clapperboard,
  Film,
  Grid3X3,
  Heart,
  ImageOff,
  List,
  ListChecks,
  MoreHorizontal,
  Search,
  Tv,
  User,
  X,
} from 'lucide-react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.ts';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext.tsx';

type SortOrder = 'recent' | 'name' | 'rating';
type ViewMode = 'grid' | 'list';
type FavouriteTab = 'movies' | 'tv' | 'talents';
type FavouriteKind = 'movie' | 'tv' | 'talent';

interface FavouriteBase {
  key: string;
  docId: string;
  id: string;
  name: string;
  kind: FavouriteKind;
  imagePath: string;
  addedAt: number;
}

interface FavouriteMedia extends FavouriteBase {
  kind: 'movie' | 'tv';
  year: string;
  releaseDate: string;
  rating: number;
  genres: string[];
}

interface FavouriteTalent extends FavouriteBase {
  kind: 'talent';
  department: string;
}

type FavouriteItem = FavouriteMedia | FavouriteTalent;

interface MyListFolder {
  id: string;
  name: string;
}

const storedMediaKey = (data: any, fallbackId?: string) => {
  const fallbackMatch = typeof fallbackId === 'string' ? fallbackId.match(/^(movie|tv)[-_](\d+)$/i) : null;
  const rawId = data?.movieId ?? data?.mediaId ?? data?.id ?? fallbackMatch?.[2] ?? fallbackId;
  const numericId = Number(rawId);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  const rawType = data?.mediaType ?? data?.type ?? fallbackMatch?.[1];
  const mediaType = rawType === 'tv' ? 'tv' : 'movie';
  return `${mediaType}-${numericId}`;
};

const mediaKey = (item: FavouriteMedia) => `${item.kind}-${Number(item.id)}`;

const MiniStatusCluster = ({ watched, inMyList, inWatchlist }: { watched: boolean; inMyList: boolean; inWatchlist: boolean }) => (
  <div className="flex items-center justify-end -space-x-1.5 sm:-space-x-1">
    <span className="relative z-[4] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-black/90 bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_2px_7px_rgba(239,68,68,0.32),inset_0_1px_1px_rgba(255,255,255,0.32)] sm:h-5 sm:min-w-5 sm:border-2" title="Favourite"><Heart className="h-2 w-2 fill-current stroke-[2.6] sm:h-2.5 sm:w-2.5" /></span>
    {inMyList && <span className="relative z-[3] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-black/90 bg-gradient-to-b from-fuchsia-500 to-purple-700 text-white shadow-[0_2px_7px_rgba(168,85,247,0.28)] sm:h-5 sm:min-w-5 sm:border-2" title="In My List"><ListChecks className="h-2 w-2 stroke-[2.8] sm:h-2.5 sm:w-2.5" /></span>}
    {inWatchlist && <span className="relative z-[2] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-black/90 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_2px_7px_rgba(59,130,246,0.28)] sm:h-5 sm:min-w-5 sm:border-2" title="In Watchlist"><Bookmark className="h-2 w-2 fill-current stroke-[2.6] sm:h-2.5 sm:w-2.5" /></span>}
    {watched && <span className="relative z-[1] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-black/90 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_2px_7px_rgba(16,185,129,0.28)] sm:h-5 sm:min-w-5 sm:border-2" title="Watched"><Check className="h-2 w-2 stroke-[3.5] sm:h-2.5 sm:w-2.5" /></span>}
  </div>
);

const TAB_CONFIG: {
  key: FavouriteTab;
  label: string;
  icon: React.ElementType;
  activeIconClass: string;
}[] = [
  { key: 'movies', label: 'Movies', icon: Clapperboard, activeIconClass: 'text-red-400' },
  { key: 'tv', label: 'Series', icon: Tv, activeIconClass: 'text-cyan-400' },
  { key: 'talents', label: 'Talent', icon: User, activeIconClass: 'text-violet-400' },
];

const toMillis = (value: any) => {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  if (value instanceof Date) return value.getTime();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
const imageUrl = (path?: string | null, size = 'w780') => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : `/${path}`}`;
};

const getMediaId = (data: any, fallback: string) => {
  const raw = data.movieId ?? data.mediaId ?? data.id ?? fallback.replace(/^(movie|tv)-/, '');
  return String(raw ?? fallback);
};

const getMediaKind = (data: any, fallback: string): 'movie' | 'tv' => {
  const raw = data.mediaType ?? data.type ?? (fallback.startsWith('tv-') ? 'tv' : 'movie');
  return raw === 'tv' ? 'tv' : 'movie';
};

const getReleaseDate = (data: any, kind: 'movie' | 'tv') => String(
  kind === 'tv'
    ? data.first_air_date ?? data.firstAirDate ?? data.releaseDate ?? data.release_date ?? data.releaseYear ?? data.year ?? ''
    : data.release_date ?? data.releaseDate ?? data.releaseYear ?? data.year ?? ''
);

const yearFromDate = (value: unknown) => {
  const match = String(value ?? '').match(/\b(18|19|20)\d{2}\b/);
  return match?.[0] ?? '';
};

const getTalentDepartment = (data: any) => String(
  data.known_for_department ??
  data.knownForDepartment ??
  data.department ??
  data.knownFor ??
  data.known_for ??
  data.primaryDepartment ??
  ''
).trim();

const getRoute = (item: FavouriteItem) => {
  if (item.kind === 'talent') return `/talent/${item.id}`;
  if (item.kind === 'tv') return `/tv/${item.id}`;
  return `/movie/${item.id}`;
};

const FavouriteImage = ({ item, talent = false }: { item: FavouriteItem; talent?: boolean }) => {
  const [failed, setFailed] = useState(false);
  const src = imageUrl(item.imagePath, talent ? 'w780' : 'w500');

  if (!src || failed) {
    const initials = item.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,.07),transparent_45%),#111113]">
        {talent ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-base font-black text-zinc-500 shadow-inner">
            {initials || <User className="h-6 w-6" />}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-700">
            <ImageOff className="h-7 w-7" />
            <span className="text-[9px] font-bold uppercase tracking-[.14em]">No image</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={item.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
    />
  );
};

const MediaTypeBadge = ({ kind }: { kind: FavouriteKind }) => {
  if (kind === 'talent') {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] border border-white/[0.11] bg-black/55 text-violet-300 shadow-lg backdrop-blur-xl" aria-label="Talent">
        <User className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] border border-white/[0.11] bg-black/55 shadow-lg backdrop-blur-xl" aria-label={kind === 'tv' ? 'Series' : 'Movie'}>
      {kind === 'tv' ? <Tv className="h-3.5 w-3.5 text-cyan-300" /> : <Clapperboard className="h-3.5 w-3.5 text-red-400" />}
    </span>
  );
};

const Favourites: React.FC = () => {
  const { user } = useContext(AuthContext)!;
  const [mediaItems, setMediaItems] = useState<FavouriteMedia[]>([]);
  const [talentItems, setTalentItems] = useState<FavouriteTalent[]>([]);
  const [activeTab, setActiveTab] = useState<FavouriteTab>('movies');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [watchHistory, setWatchHistory] = useState<Set<string>>(new Set());
  const [historyDocIds, setHistoryDocIds] = useState<Map<string, string>>(new Map());
  const [watchlistKeys, setWatchlistKeys] = useState<Set<string>>(new Set());
  const [watchlistDocIds, setWatchlistDocIds] = useState<Map<string, string>>(new Map());
  const [myListKeys, setMyListKeys] = useState<Set<string>>(new Set());
  const [myListFolders, setMyListFolders] = useState<MyListFolder[]>([]);
  const [actionItem, setActionItem] = useState<FavouriteItem | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderPickerItem, setFolderPickerItem] = useState<FavouriteMedia | null>(null);
  const [folderMemberships, setFolderMemberships] = useState<Map<string, Set<string>>>(new Map());
  const [historyDates, setHistoryDates] = useState<Map<string, string>>(new Map());
  const [historyItem, setHistoryItem] = useState<FavouriteMedia | null>(null);
  const [historyDate, setHistoryDate] = useState('');
  const [metadataLoaded, setMetadataLoaded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.uid) {
      setMediaItems([]);
      setTalentItems([]);
      return;
    }

    const mediaUnsubscribe = onSnapshot(
      collection(db, `users/${user.uid}/favouriteMedia`),
      (snapshot) => {
        const map = new Map<string, FavouriteMedia>();
        snapshot.docs.forEach((entry) => {
          const data = entry.data();
          const kind = getMediaKind(data, entry.id);
          const id = getMediaId(data, entry.id);
          const key = `${kind}-${id}`;
          if (map.has(key)) return;

          map.set(key, {
            key,
            docId: entry.id,
            id,
            kind,
            name: String(data.title ?? data.name ?? 'Untitled'),
            imagePath: String(data.posterPath ?? data.poster_path ?? data.poster ?? ''),
            addedAt: toMillis(data.addedAt ?? data.createdAt ?? data.timestamp),
            releaseDate: getReleaseDate(data, kind),
            year: yearFromDate(getReleaseDate(data, kind)),
            rating: Number(data.vote_average ?? data.voteAverage ?? data.rating ?? 0) || 0,
            genres: Array.isArray(data.genres)
              ? data.genres.filter((genre: unknown): genre is string => typeof genre === 'string').slice(0, 2)
              : [],
          });
        });
        setMediaItems(Array.from(map.values()));
      },
      () => setMediaItems([]),
    );

    const talentUnsubscribe = onSnapshot(
      collection(db, `users/${user.uid}/favouriteTalents`),
      (snapshot) => {
        const map = new Map<string, FavouriteTalent>();
        snapshot.docs.forEach((entry) => {
          const data = entry.data();
          const id = String(data.talentId ?? data.id ?? entry.id.replace(/^talent-/, ''));
          if (!id || map.has(id)) return;

          map.set(id, {
            key: `talent-${id}`,
            docId: entry.id,
            id,
            kind: 'talent',
            name: String(data.name ?? 'Unknown Talent'),
            imagePath: String(data.profilePath ?? data.profile_path ?? ''),
            addedAt: toMillis(data.addedAt ?? data.createdAt ?? data.timestamp),
            department: getTalentDepartment(data),
          });
        });
        setTalentItems(Array.from(map.values()));
      },
      () => setTalentItems([]),
    );

    return () => {
      mediaUnsubscribe();
      talentUnsubscribe();
    };
  }, [user?.uid]);


  useEffect(() => {
    if (!user?.uid) return;
    const historyUnsub = onSnapshot(collection(db, `users/${user.uid}/history`), snapshot => {
      const keys = new Set<string>(); const ids = new Map<string,string>();
      const dates = new Map<string,string>();
      snapshot.docs.forEach(d => { const data=d.data(); const k=storedMediaKey(data,d.id); if(k){keys.add(k);ids.set(k,d.id);dates.set(k,String(data.watchedDate ?? data.watchDate ?? data.date ?? ''));} });
      setWatchHistory(keys); setHistoryDocIds(ids); setHistoryDates(dates);
    });
    const watchUnsub = onSnapshot(collection(db, `users/${user.uid}/watchlist`), snapshot => {
      const keys = new Set<string>(); const ids = new Map<string,string>();
      snapshot.docs.forEach(d => { const k=storedMediaKey(d.data(),d.id); if(k){keys.add(k);ids.set(k,d.id);} });
      setWatchlistKeys(keys); setWatchlistDocIds(ids);
    });
    const legacy = new Map<string,Set<string>>(); const nested = new Map<string,Set<string>>(); const unsubs = new Map<string,()=>void>();
    const emit=()=>{const keys=new Set<string>();const memberships=new Map<string,Set<string>>();legacy.forEach((v,id)=>{v.forEach(k=>keys.add(k));memberships.set(id,new Set(v));});nested.forEach((v,id)=>{v.forEach(k=>keys.add(k));const set=memberships.get(id)||new Set<string>();v.forEach(k=>set.add(k));memberships.set(id,set);});setMyListKeys(keys);setFolderMemberships(memberships);};
    const listsUnsub=onSnapshot(collection(db, `users/${user.uid}/customWatchlists`), snapshot => {
      const live=new Set<string>(); const folders:MyListFolder[]=[];
      snapshot.docs.forEach(f=>{
        live.add(f.id); const data=f.data(); folders.push({id:f.id,name:data.name||data.title||data.listName||'Untitled List'});
        const l=new Set<string>(); if(Array.isArray(data.items)) data.items.forEach((x:any)=>{const k=storedMediaKey(x);if(k)l.add(k)}); legacy.set(f.id,l);
        if(!unsubs.has(f.id)){const u=onSnapshot(collection(db,`users/${user.uid}/customWatchlists/${f.id}/items`), ss=>{const n=new Set<string>();ss.docs.forEach(d=>{const k=storedMediaKey(d.data(),d.id);if(k)n.add(k)});nested.set(f.id,n);emit();});unsubs.set(f.id,u);}
      });
      [...unsubs.entries()].forEach(([id,u])=>{if(!live.has(id)){u();unsubs.delete(id);nested.delete(id);legacy.delete(id);}});
      setMyListFolders(folders); emit();
    });
    return()=>{historyUnsub();watchUnsub();listsUnsub();unsubs.forEach(u=>u());};
  }, [user?.uid]);


  useEffect(() => {
    const targets: FavouriteItem[] = [...mediaItems, ...talentItems].filter(item => {
      if (metadataLoaded.has(item.key)) return false;
      if (item.kind === 'talent') return !item.department;
      return !item.year || !item.releaseDate;
    });
    if (!targets.length || !API_KEY) return;
    let cancelled = false;
    Promise.all(targets.slice(0, 20).map(async item => {
      try {
        const endpoint = item.kind === 'talent' ? `person/${item.id}` : `${item.kind}/${item.id}`;
        const { data } = await axios.get(`https://api.themoviedb.org/3/${endpoint}`, { params: { api_key: API_KEY, language: 'en-US' } });
        return { item, data };
      } catch {
        return { item, data: null };
      }
    })).then(results => {
      if (cancelled) return;
      setMediaItems(current => current.map(item => {
        const found=results.find(r=>r.item.key===item.key)?.data;
        if(!found)return item;
        const date=item.kind==='tv' ? found.first_air_date : found.release_date;
        return {...item,releaseDate:item.releaseDate||date||'',year:item.year||yearFromDate(date)};
      }));
      setTalentItems(current => current.map(item => {
        const found=results.find(r=>r.item.key===item.key)?.data;
        return found ? {...item,department:item.department||getTalentDepartment(found)||'Talent'} : item;
      }));
      setMetadataLoaded(current=>{const next=new Set(current);results.forEach(r=>next.add(r.item.key));return next;});
    });
    return () => { cancelled = true; };
  }, [mediaItems, talentItems, metadataLoaded]);

  const allItems = useMemo<FavouriteItem[]>(() => [...mediaItems, ...talentItems], [mediaItems, talentItems]);

  const counts = useMemo(() => ({
    movies: mediaItems.filter((item) => item.kind === 'movie').length,
    tv: mediaItems.filter((item) => item.kind === 'tv').length,
    talents: talentItems.length,
  }), [allItems.length, mediaItems, talentItems.length]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let items = allItems.filter((item) => {
      if (activeTab === 'movies' && item.kind !== 'movie') return false;
      if (activeTab === 'tv' && item.kind !== 'tv') return false;
      if (activeTab === 'talents' && item.kind !== 'talent') return false;
      if (!normalizedSearch) return true;

      const haystack = item.kind === 'talent'
        ? `${item.name} ${item.department}`
        : `${item.name} ${item.year} ${item.genres.join(' ')}`;
      return haystack.toLowerCase().includes(normalizedSearch);
    });

    items = [...items].sort((a, b) => {
      if (sortOrder === 'name') return a.name.localeCompare(b.name);
      if (sortOrder === 'rating') {
        const left = a.kind === 'talent' ? -1 : a.rating;
        const right = b.kind === 'talent' ? -1 : b.rating;
        return right - left || a.name.localeCompare(b.name);
      }
      return b.addedAt - a.addedAt || a.name.localeCompare(b.name);
    });

    return items;
  }, [activeTab, allItems, searchTerm, sortOrder]);

  const cycleSort = () => {
    setSortOrder((current) => current === 'recent' ? 'name' : current === 'name' ? 'rating' : 'recent');
  };

  const removeFavourite = async (item: FavouriteItem) => {
    if (!user?.uid || removingKey) return;
    setRemovingKey(item.key);
    try {
      const collectionName = item.kind === 'talent' ? 'favouriteTalents' : 'favouriteMedia';
      await deleteDoc(doc(db, `users/${user.uid}/${collectionName}/${item.docId}`));
    } finally {
      setRemovingKey(null);
    }
  };


  const saveHistoryDate = async (item: FavouriteMedia, isoDate: string) => {
    if (!user?.uid || !isoDate) return;
    const key=mediaKey(item);
    const existingId=historyDocIds.get(key);
    const docId=existingId || key;
    await setDoc(doc(db,`users/${user.uid}/history/${docId}`),{
      movieId:Number(item.id),
      mediaId:Number(item.id),
      mediaType:item.kind,
      title:item.name,
      posterPath:item.imagePath,
      watchedDate:isoDate,
      timestamp:serverTimestamp()
    },{merge:true});
    setHistoryItem(null);
  };

  const openHistoryManager = (item: FavouriteMedia) => {
    const key=mediaKey(item);
    const existing=historyDates.get(key);
    const date=existing ? new Date(existing) : new Date();
    const local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
    setHistoryDate(local);
    setHistoryItem(item);
  };

  const setWatchedNow = async (item: FavouriteMedia) => {
    await saveHistoryDate(item,new Date().toISOString());
  };

  const setWatchedOnRelease = async (item: FavouriteMedia) => {
    const raw=item.releaseDate || (item.year ? `${item.year}-01-01` : '');
    if(!raw)return;
    const date=new Date(raw);
    if(Number.isNaN(date.getTime()))return;
    date.setHours(20,0,0,0);
    await saveHistoryDate(item,date.toISOString());
  };

  const removeHistory = async (item: FavouriteMedia) => {
    if(!user?.uid)return;
    const key=mediaKey(item);
    await deleteDoc(doc(db,`users/${user.uid}/history/${historyDocIds.get(key)||key}`));
    setHistoryItem(null);
  };

  const toggleWatchlist = async (item: FavouriteMedia) => {
    if (!user?.uid) return;
    const key=mediaKey(item);
    if(watchlistKeys.has(key)){await deleteDoc(doc(db,`users/${user.uid}/watchlist/${watchlistDocIds.get(key)||key}`));return;}
    await setDoc(doc(db,`users/${user.uid}/watchlist/${key}`),{movieId:Number(item.id),mediaId:Number(item.id),mediaType:item.kind,title:item.name,posterPath:item.imagePath,releaseDate:item.kind==='movie'?item.year:'',first_air_date:item.kind==='tv'?item.year:'',genres:item.genres,addedAt:serverTimestamp()},{merge:true});
  };

  const setFolderMembership = async (item: FavouriteMedia, folderId:string, enabled:boolean) => {
    if(!user?.uid)return;
    const key=mediaKey(item);
    const itemRef=doc(db,`users/${user.uid}/customWatchlists/${folderId}/items/${key}`);
    if(enabled){
      await setDoc(itemRef,{id:Number(item.id),movieId:Number(item.id),mediaId:Number(item.id),type:item.kind,mediaType:item.kind,title:item.name,poster:item.imagePath,posterPath:item.imagePath,releaseYear:item.year,voteAverage:item.rating,genres:item.genres,addedAt:serverTimestamp()},{merge:true});
    }else{
      const folderRef=doc(db,`users/${user.uid}/customWatchlists/${folderId}`);
      const folders=await getDocs(collection(db,`users/${user.uid}/customWatchlists`));
      const target=folders.docs.find(d=>d.id===folderId);
      const tasks:Promise<unknown>[]=[deleteDoc(itemRef)];
      if(target){
        const data=target.data();
        if(Array.isArray(data.items)){
          const next=data.items.filter((x:any)=>storedMediaKey(x)!==key);
          if(next.length!==data.items.length)tasks.push(updateDoc(folderRef,{items:next}));
        }
        const nestedItems=await getDocs(collection(db,`users/${user.uid}/customWatchlists/${folderId}/items`));
        nestedItems.docs.forEach(d=>{if(storedMediaKey(d.data(),d.id)===key && d.id!==key)tasks.push(deleteDoc(d.ref));});
      }
      await Promise.all(tasks);
    }
  };

  const openListManager = (item: FavouriteMedia) => {
    setFolderPickerItem(item);
    setShowFolderPicker(true);
  };


  const sortLabel = sortOrder === 'recent' ? 'Recently Added' : sortOrder === 'name' ? 'Name (A–Z)' : 'Rating';
  const totalCount = allItems.length;

  const renderGridCard = (item: FavouriteItem, index: number) => {
    const isTalent = item.kind === 'talent';
    return (
      <motion.article
        key={item.key}
        layout
        initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.28, delay: Math.min(index * 0.02, 0.16) }}
        className="group relative min-w-0"
      >
        <div className="h-full overflow-hidden rounded-[24px] border border-white/[0.075] bg-[linear-gradient(145deg,rgba(18,18,20,.92),rgba(7,7,8,.98))] p-2.5 shadow-[0_16px_42px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:shadow-[0_22px_55px_rgba(0,0,0,.44)]">
          <div className={`relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-zinc-900 ${isTalent ? 'aspect-[4/5]' : 'aspect-[2/3]'}`}>
            <FavouriteImage item={item} talent={isTalent} />
            <Link to={getRoute(item)} className="absolute inset-0 z-10" aria-label={`Open ${item.name}`} />
            <div className="pointer-events-none absolute inset-0 z-[11] bg-gradient-to-b from-black/18 via-transparent to-black/55" />

            <div className="pointer-events-none absolute left-2 top-2 z-20">
              <MediaTypeBadge kind={item.kind} />
            </div>

            <div className="absolute top-3 right-3 z-20 bg-gradient-to-br from-red-500 to-red-600 p-2 rounded-full shadow-lg shadow-red-500/30">
              <Heart className="w-3 h-3 md:w-4 md:h-4 text-white fill-current" />
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void removeFavourite(item);
              }}
              disabled={removingKey === item.key}
              className="absolute top-3 right-3 z-30 h-7 w-7 rounded-full md:h-8 md:w-8 disabled:cursor-wait"
              title="Remove from Favourites"
              aria-label={`Remove ${item.name} from Favourites`}
            />

            {!isTalent && <div className="pointer-events-none absolute bottom-2 right-2 z-20"><MiniStatusCluster watched={watchHistory.has(mediaKey(item))} inMyList={myListKeys.has(mediaKey(item))} inWatchlist={watchlistKeys.has(mediaKey(item))} /></div>}
            <div className="absolute inset-x-2 bottom-2 z-40 hidden translate-y-3 items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-black/65 p-1.5 opacity-0 shadow-xl backdrop-blur-xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 lg:flex">
              {isTalent ? <>
                <button type="button" onClick={(e)=>{e.preventDefault();e.stopPropagation();void removeFavourite(item)}} className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-500/15" title="Remove Favourite"><Heart className="h-3.5 w-3.5 fill-current" /></button>
                <Link to={getRoute(item)} onClick={e=>e.stopPropagation()} className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10" title="Open Profile"><ExternalLink className="h-3.5 w-3.5" /></Link>

              </> : <>
                <button type="button" onClick={(e)=>{e.preventDefault();e.stopPropagation();openHistoryManager(item)}} className={`flex h-8 w-8 items-center justify-center rounded-xl ${watchHistory.has(mediaKey(item))?'text-emerald-400':'text-white/80 hover:bg-white/10'}`} title="Watched"><Check className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={(e)=>{e.preventDefault();e.stopPropagation();openListManager(item)}} className={`flex h-8 w-8 items-center justify-center rounded-xl ${myListKeys.has(mediaKey(item))?'text-violet-400':'text-white/80 hover:bg-white/10'}`} title="Manage List"><ListChecks className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={(e)=>{e.preventDefault();e.stopPropagation();void toggleWatchlist(item)}} className={`flex h-8 w-8 items-center justify-center rounded-xl ${watchlistKeys.has(mediaKey(item))?'text-blue-400':'text-white/80 hover:bg-white/10'}`} title="Toggle Watchlist"><Bookmark className={`h-3.5 w-3.5 ${watchlistKeys.has(mediaKey(item))?'fill-current':''}`} /></button>
                <button type="button" onClick={(e)=>{e.preventDefault();e.stopPropagation();void removeFavourite(item)}} className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-500/15" title="Remove Favourite"><Heart className="h-3.5 w-3.5 fill-current" /></button>
                <button type="button" onClick={(e)=>{e.preventDefault();e.stopPropagation();setActionItem(item)}} className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10" title="More"><MoreHorizontal className="h-3.5 w-3.5" /></button>
              </>}
            </div>

            <button type="button" onClick={(event)=>{event.preventDefault();event.stopPropagation();setActionItem(item)}} className="absolute bottom-2 left-2 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/80 shadow-lg backdrop-blur-xl lg:hidden" aria-label={`Actions for ${item.name}`}><MoreHorizontal className="h-4 w-4" /></button>
          </div>

          <div className="px-1 pb-1 pt-3.5">
            <Link to={getRoute(item)}>
              <h2 className="truncate text-[12px] font-black tracking-[-.01em] text-zinc-100 transition-colors group-hover:text-white sm:text-sm">
                {item.name}
              </h2>
            </Link>

            {item.kind === 'talent' ? (
              <p className="mt-1 truncate text-[9px] font-semibold text-zinc-600 sm:text-[10px]">
                {item.department || 'Talent'}
              </p>
            ) : (
              <div className="mt-1.5 flex min-h-4 items-center gap-1.5 overflow-hidden text-[9px] font-semibold text-zinc-600 sm:text-[10px]">
                <span>{item.year || 'TBA'}</span>
                {item.genres.length > 0 && <span className="text-zinc-800">•</span>}
                {item.genres.map((genre) => <span key={genre} className="truncate">{genre}</span>)}
              </div>
            )}
          </div>
        </div>
      </motion.article>
    );
  };

  const renderListCard = (item: FavouriteItem, index: number) => (
    <motion.article
      key={item.key}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.015, 0.12) }}
      className="group flex min-h-[96px] items-center gap-3 rounded-[22px] border border-white/[0.075] bg-white/[0.025] p-2.5 shadow-[0_14px_35px_rgba(0,0,0,.2)] backdrop-blur-2xl transition hover:border-white/[0.14] hover:bg-white/[0.04] sm:min-h-[110px] sm:gap-4 sm:p-3"
    >
      <Link to={getRoute(item)} className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <div className={`relative shrink-0 overflow-hidden rounded-[15px] border border-white/[0.08] bg-zinc-900 ${item.kind === 'talent' ? 'h-[76px] w-[62px] sm:h-[88px] sm:w-[70px]' : 'h-[84px] w-14 sm:h-[96px] sm:w-16'}`}>
          <FavouriteImage item={item} talent={item.kind === 'talent'} />
        </div>

        <div className="min-w-0 flex-1 py-1">
          <div className="flex items-center gap-2">
            <MediaTypeBadge kind={item.kind} />

          </div>
          <h2 className="mt-2 truncate text-sm font-black tracking-tight text-zinc-100 sm:text-base">{item.name}</h2>
          {item.kind === 'talent' ? (
            <p className="mt-1 text-[10px] font-semibold text-zinc-600">{item.department || 'Talent'}</p>
          ) : (
            <p className="mt-1 truncate text-[10px] font-semibold text-zinc-600">
              {[item.year || 'TBA', ...item.genres].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1.5 pr-0.5">
        {item.kind !== 'talent' && <MiniStatusCluster watched={watchHistory.has(mediaKey(item))} inMyList={myListKeys.has(mediaKey(item))} inWatchlist={watchlistKeys.has(mediaKey(item))} />}
        <div className="relative bg-gradient-to-br from-red-500 to-red-600 p-2 rounded-full shadow-lg shadow-red-500/30">
          <Heart className="w-3 h-3 md:w-4 md:h-4 text-white fill-current" />
          <button type="button" onClick={() => void removeFavourite(item)} disabled={removingKey === item.key} className="absolute inset-0 rounded-full disabled:cursor-wait" aria-label={`Remove ${item.name} from Favourites`} title="Remove from Favourites" />
        </div>
        <button type="button" onClick={() => setActionItem(item)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white active:scale-95" aria-label={`Actions for ${item.name}`}><MoreHorizontal className="h-4 w-4" /></button>
      </div>
    </motion.article>
  );

  if (!user) {
    return (
      <div className="flex min-h-[82vh] items-center justify-center px-5 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',sans-serif]">
        <div className="w-full max-w-sm rounded-[30px] border border-white/[0.08] bg-white/[0.025] p-7 text-center backdrop-blur-3xl">
          <Heart className="mx-auto h-8 w-8 text-rose-400" />
          <h1 className="mt-4 text-xl font-black text-white">Your Favourites</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">Sign in to see your favourite movies, series and talent in one place.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050506] pb-20 text-zinc-100 selection:bg-rose-500/35 selection:text-white" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-190px] h-[430px] w-[90vw] max-w-5xl -translate-x-1/2 rounded-full bg-rose-500/[0.055] blur-[130px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-3 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 sm:px-5 sm:pt-9 lg:px-7">
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-[28px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(19,19,21,.94),rgba(7,7,8,.98))] p-4 shadow-[0_24px_75px_rgba(0,0,0,.38),inset_0_1px_0_rgba(255,255,255,.055)] backdrop-blur-3xl sm:rounded-[34px] sm:p-6"
        >
          <div className="pointer-events-none absolute right-[-80px] top-[-100px] h-56 w-56 rounded-full bg-rose-500/[0.08] blur-[80px]" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] border border-rose-300/20 bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_8px_24px_rgba(244,63,94,.28),inset_0_1px_1px_rgba(255,255,255,.3)] sm:h-14 sm:w-14">
                <Heart className="h-5 w-5 fill-current sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[.22em] text-rose-300/60">Your library</p>
                <h1 className="mt-0.5 text-xl font-black tracking-[-.025em] text-white sm:text-3xl">Favourites</h1>
                <p className="mt-1 text-[10px] font-semibold text-zinc-600 sm:text-xs">Movies, series and talent you love — together.</p>
              </div>
            </div>

            <div className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/25 px-3 py-2 text-[10px] font-bold text-zinc-400 sm:flex">
              <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
              {totalCount} saved
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-1 rounded-[16px] border border-white/[0.07] bg-black/30 p-1 backdrop-blur-2xl sm:max-w-2xl sm:gap-1.5">
            {TAB_CONFIG.map((tab) => {
              const active = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="relative flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-[12px] px-1.5 text-[10px] font-black transition sm:min-h-11 sm:gap-1.5 sm:px-3 sm:text-[11px]"
                >
                  {active && <motion.span layoutId="favourites-tab-pill" className="absolute inset-0 rounded-[12px] border border-white/[0.11] bg-gradient-to-b from-white/[0.095] to-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_4px_16px_rgba(0,0,0,.18)]" transition={{ type: 'spring', stiffness: 340, damping: 28 }} />}
                  <Icon className={`relative z-10 hidden h-3.5 w-3.5 sm:block ${active ? tab.activeIconClass : 'text-zinc-600'}`} />
                  <span className={`relative z-10 truncate ${active ? 'text-white' : 'text-zinc-500'}`}>{tab.label}</span>
                  <span className={`relative z-10 shrink-0 rounded-md px-1.5 py-0.5 text-[8px] ${active ? 'bg-white/[0.08] text-zinc-300' : 'bg-black/25 text-zinc-700'}`}>{counts[tab.key]}</span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {totalCount === 0 ? (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex min-h-[360px] flex-col items-center justify-center rounded-[30px] border border-dashed border-white/[0.075] bg-white/[0.015] px-5 text-center backdrop-blur-2xl sm:mt-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-rose-400/15 bg-rose-500/[0.065] text-rose-400 shadow-[0_12px_32px_rgba(244,63,94,.12)]">
              <Heart className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-lg font-black text-white">No Favourites Yet</h2>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-600">Favourite movies, TV series or talent and they’ll automatically appear here.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link to="/explore" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-rose-500 to-red-600 px-4 text-xs font-black text-white shadow-[0_8px_24px_rgba(244,63,94,.2)]"><Film className="h-4 w-4" />Explore titles</Link>
              <Link to="/talents" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-xs font-black text-zinc-300 backdrop-blur-2xl"><User className="h-4 w-4 text-violet-400" />Explore talent</Link>
            </div>
          </motion.section>
        ) : (
          <>
            <section className="mt-5 space-y-2.5 sm:mt-7 sm:space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search favourites..."
                  className="min-h-12 w-full rounded-[17px] border border-white/[0.075] bg-white/[0.03] pl-10 pr-11 text-[12px] font-semibold text-white outline-none backdrop-blur-2xl transition placeholder:text-zinc-700 focus:border-rose-400/25 focus:bg-white/[0.045] focus:ring-2 focus:ring-rose-500/[0.06] sm:text-sm"
                />
                {searchTerm && (
                  <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-white/[0.05] hover:text-white" aria-label="Clear favourites search"><X className="h-4 w-4" /></button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2.5">
                <button type="button" onClick={cycleSort} className="flex min-h-11 min-w-0 items-center gap-2 rounded-[15px] border border-white/[0.075] bg-white/[0.03] px-3.5 text-[10px] font-black text-zinc-400 backdrop-blur-2xl transition hover:bg-white/[0.05] hover:text-white active:scale-[.98] sm:text-[11px]">
                  <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                  <span className="truncate">{sortLabel}</span>
                </button>

                <div className="flex shrink-0 rounded-[15px] border border-white/[0.075] bg-white/[0.03] p-1 backdrop-blur-2xl">
                  <button type="button" onClick={() => setViewMode('grid')} className={`flex h-9 w-9 items-center justify-center rounded-[11px] transition ${viewMode === 'grid' ? 'bg-white/[0.085] text-amber-300 shadow-inner' : 'text-zinc-600 hover:text-zinc-300'}`} aria-label="Grid view"><Grid3X3 className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setViewMode('list')} className={`flex h-9 w-9 items-center justify-center rounded-[11px] transition ${viewMode === 'list' ? 'bg-white/[0.085] text-cyan-300 shadow-inner' : 'text-zinc-600 hover:text-zinc-300'}`} aria-label="List view"><List className="h-4 w-4" /></button>
                </div>
              </div>
            </section>

            <div className="mb-3 mt-6 flex items-end justify-between gap-3 px-1 sm:mb-4 sm:mt-8">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.22em] text-zinc-700">Saved favourites</p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">{activeTab === 'movies' ? 'Movies' : activeTab === 'tv' ? 'TV Series' : 'Talent'} <span className="ml-1 text-zinc-700">{filteredItems.length}</span></h2>
              </div>
              <p className="text-right text-[10px] font-semibold text-zinc-600">{totalCount} total</p>
            </div>

            <AnimatePresence mode="wait">
              {filteredItems.length > 0 ? (
                viewMode === 'grid' ? (
                  <motion.div key={`grid-${activeTab}-${sortOrder}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5">
                    <AnimatePresence>{filteredItems.map(renderGridCard)}</AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.div key={`list-${activeTab}-${sortOrder}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2.5 sm:space-y-3">
                    <AnimatePresence>{filteredItems.map(renderListCard)}</AnimatePresence>
                  </motion.div>
                )
              ) : (
                <motion.div key="empty-filtered" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex min-h-[260px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/[0.075] bg-white/[0.015] px-5 text-center">
                  <Search className="h-7 w-7 text-zinc-700" />
                  <h3 className="mt-4 text-sm font-black text-zinc-300">No favourites found</h3>
                  <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-zinc-600">Try another category or clear your search.</p>
                  {searchTerm && (
                    <button type="button" onClick={() => setSearchTerm('')} className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-[10px] font-black text-zinc-300 hover:bg-white/[0.065]">
                      <X className="h-3.5 w-3.5" />Clear search
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>

      {actionItem && (
        <div className="fixed inset-0 z-[10020] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={()=>setActionItem(null)} aria-label="Close actions" />
          <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} className="relative z-10 w-full max-w-lg rounded-t-[30px] border border-white/10 bg-zinc-950 p-4 shadow-2xl sm:rounded-[30px]">
            <div className="mb-4 flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-base font-black text-white">{actionItem.name}</h3><p className="mt-1 text-[10px] text-zinc-500">{actionItem.kind==='talent'?(actionItem.department||'Talent'):(actionItem.kind==='tv'?'Series':'Movie')}</p></div><button onClick={()=>setActionItem(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-400"><X className="h-4 w-4"/></button></div>
            {actionItem.kind==='talent' ? <div className="grid grid-cols-2 gap-2">
              <button onClick={()=>void removeFavourite(actionItem)} className="flex flex-col items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 py-3 text-[10px] font-bold text-rose-300"><Heart className="h-4 w-4 fill-current"/>Unfavourite</button>
              <Link to={getRoute(actionItem)} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-[10px] font-bold text-zinc-300"><ExternalLink className="h-4 w-4"/>Profile</Link>

            </div> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button onClick={()=>openHistoryManager(actionItem)} className={`flex flex-col items-center gap-2 rounded-2xl border py-3 text-[10px] font-bold ${watchHistory.has(mediaKey(actionItem))?'border-emerald-500/20 bg-emerald-500/10 text-emerald-300':'border-white/10 bg-white/[0.04] text-zinc-300'}`}><Check className="h-4 w-4"/>{watchHistory.has(mediaKey(actionItem))?'Rewatch':'Watched'}</button>
              <button onClick={()=>openListManager(actionItem)} className={`flex flex-col items-center gap-2 rounded-2xl border py-3 text-[10px] font-bold ${myListKeys.has(mediaKey(actionItem))?'border-violet-500/20 bg-violet-500/10 text-violet-300':'border-white/10 bg-white/[0.04] text-zinc-300'}`}><ListChecks className="h-4 w-4"/>Manage List</button>
              <button onClick={()=>void toggleWatchlist(actionItem)} className={`flex flex-col items-center gap-2 rounded-2xl border py-3 text-[10px] font-bold ${watchlistKeys.has(mediaKey(actionItem))?'border-blue-500/20 bg-blue-500/10 text-blue-300':'border-white/10 bg-white/[0.04] text-zinc-300'}`}><Bookmark className="h-4 w-4"/>Watchlist</button>
              <button onClick={()=>void removeFavourite(actionItem)} className="flex flex-col items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 py-3 text-[10px] font-bold text-rose-300"><Heart className="h-4 w-4 fill-current"/>Unfavourite</button>
            </div>}
          </motion.div>
        </div>
      )}

      {showFolderPicker && folderPickerItem && (
        <div className="fixed inset-0 z-[10030] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={()=>{setShowFolderPicker(false);setFolderPickerItem(null)}} aria-label="Close list manager"/>
          <motion.div initial={{y:50,opacity:0}} animate={{y:0,opacity:1}} className="relative z-10 w-full max-w-md rounded-t-[30px] border border-white/10 bg-zinc-950 p-4 shadow-2xl sm:rounded-[30px]">
            <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-black text-white">Manage List</h3><p className="text-[10px] text-zinc-500">Choose which lists contain {folderPickerItem.name}.</p></div><button onClick={()=>{setShowFolderPicker(false);setFolderPickerItem(null)}} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400"><X className="h-4 w-4"/></button></div>
            {myListFolders.length ? <div className="space-y-1.5">{myListFolders.map(folder=>{const active=folderMemberships.get(folder.id)?.has(mediaKey(folderPickerItem))||false;return <button key={folder.id} onClick={()=>void setFolderMembership(folderPickerItem,folder.id,!active)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-xs font-semibold ${active?'border-violet-500/25 bg-violet-500/10 text-violet-200':'border-white/[0.06] bg-white/[0.03] text-zinc-200'}`}><span className="truncate">{folder.name}</span><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${active?'border-violet-400/30 bg-violet-500 text-white':'border-white/10 bg-white/[0.03] text-transparent'}`}><Check className="h-3 w-3"/></span></button>})}</div> : <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center text-xs text-zinc-500">Create a My List folder first.</div>}
          </motion.div>
        </div>
      )}

      {historyItem && (
        <div className="fixed inset-0 z-[10040] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={()=>setHistoryItem(null)} aria-label="Close watched manager"/>
          <motion.div initial={{y:50,opacity:0}} animate={{y:0,opacity:1}} className="relative z-10 w-full max-w-md rounded-t-[30px] border border-white/10 bg-zinc-950 p-4 shadow-2xl sm:rounded-[30px]">
            <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-black text-white">{watchHistory.has(mediaKey(historyItem))?'Rewatch':'Mark as Watched'}</h3><p className="mt-1 text-[10px] text-zinc-500">{historyItem.name}{historyDates.get(mediaKey(historyItem)) ? ` · Last watched ${new Date(historyDates.get(mediaKey(historyItem))!).toLocaleDateString()}` : ''}</p></div><button onClick={()=>setHistoryItem(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400"><X className="h-4 w-4"/></button></div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={()=>void setWatchedNow(historyItem)} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-xs font-bold text-emerald-300">Just now</button>
              <button disabled={!historyItem.releaseDate && !historyItem.year} onClick={()=>void setWatchedOnRelease(historyItem)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs font-bold text-zinc-300 disabled:opacity-35">Release date</button>
            </div>
            <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
              <label className="text-[9px] font-black uppercase tracking-[.16em] text-zinc-500">Change date & time</label>
              <input type="datetime-local" value={historyDate} onChange={e=>setHistoryDate(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white outline-none focus:border-emerald-500/30"/>
              <button disabled={!historyDate} onClick={()=>void saveHistoryDate(historyItem,new Date(historyDate).toISOString())} className="mt-2 min-h-10 w-full rounded-xl bg-emerald-500 text-xs font-black text-black disabled:opacity-40">{watchHistory.has(mediaKey(historyItem))?'Save / Rewatch':'Mark Watched'}</button>
            </div>
            {watchHistory.has(mediaKey(historyItem)) && <button onClick={()=>void removeHistory(historyItem)} className="mt-3 min-h-10 w-full rounded-xl border border-rose-500/20 bg-rose-500/[0.08] text-xs font-bold text-rose-300">Remove from History</button>}
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Favourites;
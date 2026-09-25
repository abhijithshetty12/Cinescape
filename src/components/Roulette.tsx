import React,{useState,useEffect,useMemo,useCallback,useRef}from'react';
import{motion,AnimatePresence,animate,useMotionValue,useSpring}from'framer-motion';
import{
  Star,X,Play,RotateCcw,Film,SkipForward,ArrowUpRightFromSquare,
  SlidersHorizontal,EyeOff,Clapperboard,Tv,ChevronRight,
  ChevronDown,ChevronUp,Check,RefreshCw,Heart,Zap,Smile,Moon,Brain,Coffee,
  ShieldCheck,Shuffle,History,Languages,CalendarDays,Trash2,Dices,ListFilter,
  Trophy,Flame,Users,Info
}from'lucide-react';
import confetti from'canvas-confetti';
import{useNavigate}from'react-router-dom';

const API_KEY='859afbb4b98e3b467da9c99ac390e950';
const HISTORY_KEY='cinescape_roulette_history_v2';
const HISTORY_LIMIT=20;
const RECENT_EXCLUSION_COUNT=8;
const MAX_SKIPS=2;

const CARD_WIDTH_MOBILE=125;
const CARD_HEIGHT_MOBILE=181;
const CARD_WIDTH_DESKTOP=190;
const CARD_HEIGHT_DESKTOP=275;
const GAP_MOBILE=10;
const GAP_DESKTOP=16;

interface Trailer{
  key:string;
  name?:string;
  site?:string;
  type?:string;
  official?:boolean;
}

interface Keyword{
  id?:number;
  name?:string;
}

interface Movie{
  id:string;
  movieId:string|number;
  mediaType:string;
  posterPath:string;
  title?:string;
  name?:string;
  vote_average?:number;
  releaseDate?:string;
  first_air_date?:string;
  genres:string[];
  trailerKey?:string;
  trailers?:Trailer[];
  runtime?:number;
  episode_run_time?:number[];
  isWatched?:boolean;
  watched?:boolean;
  original_language?:string;
  language?:string;
  popularity?:number;
  overview?:string;
  keywords?:Array<string|Keyword>;
}

export type RouletteSource='watchlist'|'my-list';

export interface RouletteProps{
  isOpen:boolean;
  onClose:()=>void;
  items:Movie[];
  watchedIds?:Array<string|number>;
  source?:RouletteSource;
}

type MediaFilter='all'|'movie'|'tv';
type TimePreset=0|30|60|90|120;
type MoodKey='any'|'mind-bending'|'comfort'|'dark'|'funny'|'action-heavy'|'emotional'|'easy-watch';
type Strength='safe'|'balanced'|'wild';
type EraFilter='all'|'2020s'|'2010s'|'2000s'|'90s'|'classic';
type PickMode='single'|'trio';
type HistoryOutcome='picked'|'watched'|'skipped'|'rerolled';

interface SpinHistoryEntry{
  id:string;
  mediaKey:string;
  movieId:string|number;
  title:string;
  mediaType:'movie'|'tv';
  posterPath:string;
  timestamp:number;
  outcome:HistoryOutcome;
  rating?:number;
  runtime?:number;
}

const LANGUAGE_LABELS:Record<string,string>={
  en:'English',hi:'Hindi',kn:'Kannada',te:'Telugu',ta:'Tamil',ml:'Malayalam',
  ko:'Korean',ja:'Japanese',zh:'Chinese',es:'Spanish',fr:'French',de:'German',
  it:'Italian',pt:'Portuguese',ru:'Russian',ar:'Arabic',tr:'Turkish',th:'Thai',
};

const LANGUAGE_OPTIONS=[
  {code:'all',label:'Any language'},
  {code:'en',label:'English'},
  {code:'hi',label:'Hindi'},
  {code:'kn',label:'Kannada'},
  {code:'te',label:'Telugu'},
  {code:'ta',label:'Tamil'},
  {code:'ml',label:'Malayalam'},
  {code:'ko',label:'Korean'},
  {code:'ja',label:'Japanese'},
];

const MOODS:{key:MoodKey;label:string;hint:string;genres:string[];keywords:string[];icon:React.ElementType}[]=[
  {key:'mind-bending',label:'Mind-bending',hint:'Twists, puzzles, strange worlds',genres:['Mystery','Science Fiction','Thriller'],keywords:['time travel','psychological','mind game','surreal','dream','parallel universe','plot twist','memory','simulation','alternate reality'],icon:Brain},
  {key:'comfort',label:'Comfort',hint:'Warm, familiar, feel-good',genres:['Comedy','Family','Romance','Animation'],keywords:['feel-good','friendship','family','holiday','slice of life','heartwarming','coming of age'],icon:Coffee},
  {key:'dark',label:'Dark',hint:'Heavy, sinister, intense',genres:['Horror','Crime','Thriller','Mystery','Drama'],keywords:['serial killer','revenge','dystopia','psychological','murder','neo-noir','noir','grim','corruption'],icon:Moon},
  {key:'funny',label:'Funny',hint:'Comedy first',genres:['Comedy'],keywords:['satire','parody','buddy comedy','romantic comedy','stand-up','absurd comedy'],icon:Smile},
  {key:'action-heavy',label:'Action-heavy',hint:'Fast, loud, kinetic',genres:['Action','Adventure','War'],keywords:['martial arts','superhero','chase','combat','heist','assassin','explosion','mercenary'],icon:Zap},
  {key:'emotional',label:'Emotional',hint:'Big feelings, strong drama',genres:['Drama','Romance','Family'],keywords:['grief','loss','love','family','friendship','terminal illness','coming of age','tearjerker'],icon:Heart},
  {key:'easy-watch',label:'Easy watch',hint:'Low effort, easy to enjoy',genres:['Comedy','Romance','Family','Animation','Adventure'],keywords:['feel-good','lighthearted','friendship','holiday','slice of life','romantic comedy'],icon:Coffee},
];

const TIME_OPTIONS:{value:TimePreset;label:string;short:string}[]=[
  {value:0,label:'Any',short:'Any'},
  {value:30,label:'30 min',short:'30m'},
  {value:60,label:'1 hour',short:'1h'},
  {value:90,label:'90 min',short:'90m'},
  {value:120,label:'2 hours',short:'2h'},
];

const STRENGTH_OPTIONS:{value:Strength;label:string;hint:string;icon:React.ElementType}[]=[
  {value:'safe',label:'Safe Pick',hint:'Favors higher ratings',icon:ShieldCheck},
  {value:'balanced',label:'Balanced',hint:'Quality + randomness',icon:Shuffle},
  {value:'wild',label:'Wild Card',hint:'Favors hidden gems',icon:Flame},
];

const ERA_OPTIONS:{value:EraFilter;label:string}[]=[
  {value:'all',label:'Any era'},
  {value:'2020s',label:'2020s'},
  {value:'2010s',label:'2010s'},
  {value:'2000s',label:'2000s'},
  {value:'90s',label:'90s'},
  {value:'classic',label:'Classic'},
];

const uniqueMediaKey=(item:Movie)=>`${((item.mediaType||'movie').toLowerCase()==='tv'||(item.mediaType||'').toLowerCase()==='series')?'tv':'movie'}:${item.movieId??item.id}`;

const formatRuntime=(minutes?:number|null)=>{
  if(!minutes||minutes<=0)return'';
  const h=Math.floor(minutes/60);
  const m=minutes%60;
  if(h&&m)return`${h}h ${m}m`;
  if(h)return`${h}h`;
  return`${m}m`;
};

const getYear=(item:Movie)=>{
  const raw=item.releaseDate||item.first_air_date;
  if(!raw)return null;
  const year=Number(String(raw).slice(0,4));
  return Number.isFinite(year)&&year>1800?year:null;
};

const matchesEra=(item:Movie,era:EraFilter)=>{
  if(era==='all')return true;
  const year=getYear(item);
  if(!year)return false;
  if(era==='2020s')return year>=2020&&year<=2029;
  if(era==='2010s')return year>=2010&&year<=2019;
  if(era==='2000s')return year>=2000&&year<=2009;
  if(era==='90s')return year>=1990&&year<=1999;
  return year<1990;
};

const getKeywordNames=(item:Movie)=>
  (item.keywords||[]).map(keyword=>typeof keyword==='string'?keyword:keyword.name||'').filter(Boolean).map(value=>value.toLowerCase());

const Roulette:React.FC<RouletteProps>=({isOpen,onClose,items,watchedIds=[],source='watchlist'})=>{
  const navigate=useNavigate();

  const rouletteContext=useMemo(()=>source==='my-list'?{
    label:'My List',
    title:'My List Roulette',
    subtitle:'Spin this collection',
    setupBadge:'My List Roulette',
    setupDescription:'Choose only what matters from this list. Everything else stays random.',
  }:{
    label:'Watchlist',
    title:'Watchlist Roulette',
    subtitle:'Spin your saved watchlist',
    setupBadge:'Watchlist Roulette',
    setupDescription:'Choose only what matters from your watchlist. Everything else stays random.',
  },[source]);

  const[isSpinning,setIsSpinning]=useState(false);
  const[winner,setWinner]=useState<Movie|null>(null);
  const[showResult,setShowResult]=useState(false);
  const[activeItems,setActiveItems]=useState<Movie[]>(items);
  const[displayReel,setDisplayReel]=useState<Movie[]>([]);
  const[skipCount,setSkipCount]=useState(0);
  const[dominantColor,setDominantColor]=useState('rgba(245,158,11,0.15)');
  const[showTrailerModal,setShowTrailerModal]=useState(false);
  const[trailerKey,setTrailerKey]=useState<string|null>(null);
  const[trailerLoading,setTrailerLoading]=useState(false);

  const[showSetup,setShowSetup]=useState(true);
  const[showMoreFilters,setShowMoreFilters]=useState(false);
  const[showHistory,setShowHistory]=useState(false);
  const[mediaFilter,setMediaFilter]=useState<MediaFilter>('all');
  const[timePreset,setTimePreset]=useState<TimePreset>(0);
  const[selectedMood,setSelectedMood]=useState<MoodKey>('any');
  const[strength,setStrength]=useState<Strength>('balanced');
  const[pickMode,setPickMode]=useState<PickMode>('single');
  const[highRatedOnly,setHighRatedOnly]=useState(false);
  const[unwatchedOnly,setUnwatchedOnly]=useState(false);
  const[selectedGenre,setSelectedGenre]=useState('all');
  const[selectedLanguage,setSelectedLanguage]=useState('all');
  const[selectedEra,setSelectedEra]=useState<EraFilter>('all');
  const[avoidRecent,setAvoidRecent]=useState(true);
  const[tonightMode,setTonightMode]=useState(false);

  const[isPreparing,setIsPreparing]=useState(false);
  const[prepareProgress,setPrepareProgress]=useState({done:0,total:0});
  const[smartError,setSmartError]=useState<string|null>(null);

  const[finalists,setFinalists]=useState<Movie[]>([]);
  const[showFinalists,setShowFinalists]=useState(false);
  const[rouletteHistory,setRouletteHistory]=useState<SpinHistoryEntry[]>([]);
  const[currentHistoryId,setCurrentHistoryId]=useState<string|null>(null);

  const modalCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const reelViewportRef=useRef<HTMLDivElement|null>(null);
  const audioCtxRef=useRef<AudioContext|null>(null);
  const metadataCacheRef=useRef<Map<string,Movie>>(new Map());
  const animationRef=useRef<{stop:()=>void}|null>(null);
  const xOffset=useMotionValue(0);
  const indicatorScale=useSpring(1,{stiffness:420,damping:20});

  const normalizeMediaType=useCallback((item:Movie):'movie'|'tv'=>{
    const type=(item.mediaType||'').toLowerCase();
    return type==='tv'||type==='series'?'tv':'movie';
  },[]);

  const watchedIdSet=useMemo(()=>new Set(watchedIds.map(value=>String(value))),[watchedIds]);
  const hasWatchStatus=useMemo(()=>watchedIds.length>0||items.some(item=>typeof item.isWatched==='boolean'||typeof item.watched==='boolean'),[items,watchedIds.length]);

  const isItemWatched=useCallback((item:Movie)=>{
    if(typeof item.isWatched==='boolean')return item.isWatched;
    if(typeof item.watched==='boolean')return item.watched;
    return watchedIdSet.has(String(item.movieId??item.id))||watchedIdSet.has(String(item.id));
  },[watchedIdSet]);

  const getKnownRuntime=useCallback((item:Movie)=>{
    if(typeof item.runtime==='number'&&item.runtime>0)return item.runtime;
    const episodeRuntime=item.episode_run_time?.find(value=>typeof value==='number'&&value>0);
    return episodeRuntime??null;
  },[]);

  const languageCodeFor=useCallback((item:Movie)=>item.original_language||item.language||'',[]);

  const getPosterSrc=useCallback((item:Movie|null,size='w500')=>{
    if(!item?.posterPath)return'';
    if(item.posterPath.startsWith('http'))return item.posterPath;
    return`https://image.tmdb.org/t/p/${size}${item.posterPath}`;
  },[]);

  const allGenres=useMemo(()=>Array.from(new Set<string>(items.flatMap(item=>Array.isArray(item.genres)?item.genres:[]).filter((genre):genre is string=>Boolean(genre)))).sort((a,b)=>a.localeCompare(b)),[items]);

  useEffect(()=>{
    if(typeof window==='undefined')return;
    try{
      const stored=window.localStorage.getItem(HISTORY_KEY);
      if(stored){
        const parsed=JSON.parse(stored);
        if(Array.isArray(parsed))setRouletteHistory(parsed.slice(0,HISTORY_LIMIT));
      }
    }catch{}
  },[]);

  const persistHistory=useCallback((next:SpinHistoryEntry[])=>{
    const trimmed=next.slice(0,HISTORY_LIMIT);
    setRouletteHistory(trimmed);
    if(typeof window!=='undefined'){
      try{window.localStorage.setItem(HISTORY_KEY,JSON.stringify(trimmed));}catch{}
    }
  },[]);

  const addHistoryEntry=useCallback((item:Movie,outcome:HistoryOutcome='picked')=>{
    const id=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const entry:SpinHistoryEntry={
      id,
      mediaKey:uniqueMediaKey(item),
      movieId:item.movieId??item.id,
      title:item.title||item.name||'Untitled',
      mediaType:normalizeMediaType(item),
      posterPath:item.posterPath||'',
      timestamp:Date.now(),
      outcome,
      rating:item.vote_average,
      runtime:getKnownRuntime(item)??undefined,
    };
    persistHistory([entry,...rouletteHistory.filter(historyItem=>historyItem.id!==id)]);
    setCurrentHistoryId(id);
    return id;
  },[normalizeMediaType,getKnownRuntime,persistHistory,rouletteHistory]);

  const updateCurrentHistoryOutcome=useCallback((outcome:HistoryOutcome)=>{
    if(!currentHistoryId)return;
    persistHistory(rouletteHistory.map(entry=>entry.id===currentHistoryId?{...entry,outcome}:entry));
  },[currentHistoryId,persistHistory,rouletteHistory]);

  const clearHistory=useCallback(()=>{
    persistHistory([]);
    setCurrentHistoryId(null);
  },[persistHistory]);

  const recentMediaKeys=useMemo(()=>{
    const unique:string[]=[];
    for(const entry of rouletteHistory){
      if(!unique.includes(entry.mediaKey))unique.push(entry.mediaKey);
      if(unique.length>=RECENT_EXCLUSION_COUNT)break;
    }
    return new Set(unique);
  },[rouletteHistory]);

  const moodDefinition=useMemo(()=>MOODS.find(mood=>mood.key===selectedMood)??null,[selectedMood]);

  const moodMatches=useCallback((item:Movie,moodKey:MoodKey=selectedMood)=>{
    if(moodKey==='any')return true;
    const mood=MOODS.find(entry=>entry.key===moodKey);
    if(!mood)return true;
    const itemGenres=(item.genres||[]).map(genre=>genre.toLowerCase());
    const genreMatch=mood.genres.some(genre=>itemGenres.includes(genre.toLowerCase()));
    const keywordNames=getKeywordNames(item);
    const keywordMatch=mood.keywords.some(keyword=>keywordNames.some(itemKeyword=>itemKeyword.includes(keyword)||keyword.includes(itemKeyword)));
    return genreMatch||keywordMatch;
  },[selectedMood]);

  const baseFilteredItems=useMemo(()=>items.filter(item=>{
    const type=normalizeMediaType(item);
    if(mediaFilter!=='all'&&type!==mediaFilter)return false;
    if(highRatedOnly&&(item.vote_average??0)<8)return false;
    if(tonightMode&&(item.vote_average??0)<6.5)return false;
    if(unwatchedOnly&&hasWatchStatus&&isItemWatched(item))return false;
    if(selectedGenre!=='all'&&!(item.genres||[]).includes(selectedGenre))return false;
    if(!matchesEra(item,selectedEra))return false;
    return true;
  }),[items,normalizeMediaType,mediaFilter,highRatedOnly,tonightMode,unwatchedOnly,hasWatchStatus,isItemWatched,selectedGenre,selectedEra]);

  const previewEligibleItems=useMemo(()=>{
    let pool=baseFilteredItems.filter(item=>{
      if(timePreset>0){
        const runtime=getKnownRuntime(item);
        if(runtime!==null&&runtime>timePreset)return false;
      }
      if(selectedLanguage!=='all'){
        const language=languageCodeFor(item);
        if(language&&language!==selectedLanguage)return false;
      }
      if(selectedMood!=='any'){
        const hasKnownKeywords=(item.keywords?.length??0)>0;
        const hasGenreMatch=moodDefinition?.genres.some(genre=>(item.genres||[]).some(itemGenre=>itemGenre.toLowerCase()===genre.toLowerCase()));
        if(hasKnownKeywords&&!moodMatches(item)&&!hasGenreMatch)return false;
      }
      return true;
    });

    if(avoidRecent&&recentMediaKeys.size){
      const fresh=pool.filter(item=>!recentMediaKeys.has(uniqueMediaKey(item)));
      const required=pickMode==='trio'?3:1;
      if(fresh.length>=required)pool=fresh;
    }
    return pool;
  },[baseFilteredItems,timePreset,getKnownRuntime,selectedLanguage,languageCodeFor,selectedMood,moodDefinition,moodMatches,avoidRecent,recentMediaKeys,pickMode]);

  const approximateMetadataCount=useMemo(()=>previewEligibleItems.filter(item=>{
    if(timePreset>0&&getKnownRuntime(item)===null)return true;
    if(selectedLanguage!=='all'&&!languageCodeFor(item))return true;
    if(strength==='wild'&&typeof item.popularity!=='number')return true;
    if(selectedMood!=='any'&&!moodMatches(item)&&(item.keywords?.length??0)===0)return true;
    return false;
  }).length,[previewEligibleItems,timePreset,getKnownRuntime,selectedLanguage,languageCodeFor,strength,selectedMood,moodMatches]);

  const filterCriteriaCount=useMemo(()=>[
    mediaFilter!=='all',timePreset>0,selectedMood!=='any',highRatedOnly,tonightMode,
    unwatchedOnly&&hasWatchStatus,selectedGenre!=='all',selectedLanguage!=='all',selectedEra!=='all',
  ].filter(Boolean).length,[mediaFilter,timePreset,selectedMood,highRatedOnly,tonightMode,unwatchedOnly,hasWatchStatus,selectedGenre,selectedLanguage,selectedEra]);

  const oddsPreview=useMemo(()=>previewEligibleItems.slice(0,5),[previewEligibleItems]);

  const resetSmartFilters=useCallback(()=>{
    setMediaFilter('all');
    setTimePreset(0);
    setSelectedMood('any');
    setStrength('balanced');
    setPickMode('single');
    setHighRatedOnly(false);
    setUnwatchedOnly(false);
    setSelectedGenre('all');
    setSelectedLanguage('all');
    setSelectedEra('all');
    setAvoidRecent(true);
    setTonightMode(false);
    setSmartError(null);
  },[]);

  const activateTonightMode=useCallback(()=>{
    setTonightMode(true);
    setTimePreset(120);
    setStrength('balanced');
    setHighRatedOnly(false);
    setUnwatchedOnly(hasWatchStatus);
    setSelectedMood('any');
    setSelectedGenre('all');
    setSelectedLanguage('all');
    setSelectedEra('all');
    setSmartError(null);
  },[hasWatchStatus]);

  const initAudioContext=useCallback(()=>{
    if(!audioCtxRef.current){
      const AudioCtx=window.AudioContext||(window as unknown as{webkitAudioContext:typeof AudioContext}).webkitAudioContext;
      if(AudioCtx)audioCtxRef.current=new AudioCtx();
    }
    if(audioCtxRef.current?.state==='suspended')audioCtxRef.current.resume();
  },[]);

  const playTickSound=useCallback(()=>{
    if(!audioCtxRef.current)return;
    try{
      const ctx=audioCtxRef.current;
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type='triangle';
      osc.frequency.setValueAtTime(140,ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40,ctx.currentTime+0.03);
      gain.gain.setValueAtTime(0.13,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime+0.03);
    }catch{}
  },[]);

  const playChimeSound=useCallback(()=>{
    if(!audioCtxRef.current)return;
    try{
      const ctx=audioCtxRef.current;
      [523.25,659.25,783.99,1046.5].forEach((freq,index)=>{
        const osc=ctx.createOscillator();
        const gain=ctx.createGain();
        const start=ctx.currentTime+index*0.08;
        osc.type='sine';
        osc.frequency.setValueAtTime(freq,start);
        gain.gain.setValueAtTime(0,start);
        gain.gain.linearRampToValueAtTime(0.12,start+0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001,start+0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start+0.4);
      });
    }catch{}
  },[]);

  const extractDominantColor=useCallback((imageUrl:string)=>{
    if(!imageUrl)return;
    const img=new Image();
    img.crossOrigin='Anonymous';
    img.src=imageUrl;
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d');
      if(!ctx)return;
      canvas.width=30;
      canvas.height=30;
      ctx.drawImage(img,0,0,30,30);
      try{
        const data=ctx.getImageData(0,0,30,30).data;
        let r=0,g=0,b=0,count=0;
        for(let i=0;i<data.length;i+=16){r+=data[i];g+=data[i+1];b+=data[i+2];count++;}
        setDominantColor(`rgba(${Math.floor(r/count)},${Math.floor(g/count)},${Math.floor(b/count)},0.45)`);
      }catch{setDominantColor('rgba(245,158,11,0.25)');}
    };
    img.onerror=()=>setDominantColor('rgba(245,158,11,0.25)');
  },[]);

  const fetchMetadata=useCallback(async(item:Movie)=>{
    const key=uniqueMediaKey(item);
    const cached=metadataCacheRef.current.get(key);
    if(cached)return{...item,...cached,genres:cached.genres?.length?cached.genres:item.genres};

    const type=normalizeMediaType(item);
    const mediaId=item.movieId||item.id;
    try{
      const response=await fetch(`https://api.themoviedb.org/3/${type}/${mediaId}?api_key=${API_KEY}&language=en-US&append_to_response=keywords`);
      if(!response.ok)throw new Error(`TMDB request failed: ${response.status}`);
      const data=await response.json();
      const runtime=type==='movie'
        ?(typeof data.runtime==='number'&&data.runtime>0?data.runtime:undefined)
        :(Array.isArray(data.episode_run_time)?data.episode_run_time.find((value:number)=>value>0):undefined)||
          (typeof data.last_episode_to_air?.runtime==='number'&&data.last_episode_to_air.runtime>0?data.last_episode_to_air.runtime:undefined);
      const rawKeywords=type==='movie'?data.keywords?.keywords:data.keywords?.results;
      const enriched:Movie={
        ...item,
        runtime:item.runtime??runtime,
        original_language:item.original_language||item.language||data.original_language,
        popularity:typeof item.popularity==='number'?item.popularity:data.popularity,
        overview:item.overview||data.overview,
        genres:item.genres?.length?item.genres:(data.genres||[]).map((genre:{name:string})=>genre.name),
        keywords:item.keywords?.length?item.keywords:(Array.isArray(rawKeywords)?rawKeywords.map((keyword:{id:number;name:string})=>({id:keyword.id,name:keyword.name})):[]),
      };
      metadataCacheRef.current.set(key,enriched);
      return enriched;
    }catch{
      metadataCacheRef.current.set(key,item);
      return item;
    }
  },[normalizeMediaType]);

  const itemNeedsMetadata=useCallback((item:Movie)=>{
    if(timePreset>0&&getKnownRuntime(item)===null)return true;
    if(selectedLanguage!=='all'&&!languageCodeFor(item))return true;
    if(strength==='wild'&&typeof item.popularity!=='number')return true;
    if(selectedMood!=='any'&&!moodMatches(item)&&(item.keywords?.length??0)===0)return true;
    return false;
  },[timePreset,getKnownRuntime,selectedLanguage,languageCodeFor,strength,selectedMood,moodMatches]);

  const enrichPool=useCallback(async(pool:Movie[])=>{
    const needs=pool.filter(itemNeedsMetadata);
    setPrepareProgress({done:0,total:needs.length});
    if(!needs.length)return pool;

    const enrichedMap=new Map<string,Movie>();
    const batchSize=6;
    let done=0;
    for(let i=0;i<needs.length;i+=batchSize){
      const batch=needs.slice(i,i+batchSize);
      const enrichedBatch=await Promise.all(batch.map(fetchMetadata));
      enrichedBatch.forEach(item=>enrichedMap.set(uniqueMediaKey(item),item));
      done+=batch.length;
      setPrepareProgress({done,total:needs.length});
    }
    return pool.map(item=>enrichedMap.get(uniqueMediaKey(item))??item);
  },[itemNeedsMetadata,fetchMetadata]);

  const applyExactFilters=useCallback((pool:Movie[])=>{
    let filtered=pool.filter(item=>{
      if(mediaFilter!=='all'&&normalizeMediaType(item)!==mediaFilter)return false;
      if(highRatedOnly&&(item.vote_average??0)<8)return false;
      if(tonightMode&&(item.vote_average??0)<6.5)return false;
      if(unwatchedOnly&&hasWatchStatus&&isItemWatched(item))return false;
      if(selectedGenre!=='all'&&!(item.genres||[]).includes(selectedGenre))return false;
      if(!matchesEra(item,selectedEra))return false;
      if(timePreset>0){
        const runtime=getKnownRuntime(item);
        if(runtime===null||runtime>timePreset)return false;
      }
      if(selectedLanguage!=='all'&&languageCodeFor(item)!==selectedLanguage)return false;
      if(selectedMood!=='any'&&!moodMatches(item))return false;
      return true;
    });

    if(avoidRecent&&recentMediaKeys.size){
      const fresh=filtered.filter(item=>!recentMediaKeys.has(uniqueMediaKey(item)));
      const required=pickMode==='trio'?3:1;
      if(fresh.length>=required)filtered=fresh;
    }
    return filtered;
  },[mediaFilter,normalizeMediaType,highRatedOnly,tonightMode,unwatchedOnly,hasWatchStatus,isItemWatched,selectedGenre,selectedEra,timePreset,getKnownRuntime,selectedLanguage,languageCodeFor,selectedMood,moodMatches,avoidRecent,recentMediaKeys,pickMode]);

  const weightForItem=useCallback((item:Movie)=>{
    const rating=Math.max(0,item.vote_average??0);
    const popularity=Math.max(0,item.popularity??50);
    let weight=1;
    if(strength==='safe')weight=Math.max(0.15,Math.pow(Math.max(0.5,rating-4),2));
    else if(strength==='balanced')weight=0.8+Math.max(0,rating-5)*0.14;
    else weight=Math.max(0.08,1/(1+popularity/35))*3.5+0.12;
    if(avoidRecent&&recentMediaKeys.has(uniqueMediaKey(item)))weight*=0.12;
    return Math.max(0.01,weight);
  },[strength,avoidRecent,recentMediaKeys]);

  const weightedPick=useCallback((pool:Movie[])=>{
    if(!pool.length)return null;
    const weighted=pool.map(item=>({item,weight:weightForItem(item)}));
    const total=weighted.reduce((sum,entry)=>sum+entry.weight,0);
    let target=Math.random()*total;
    for(const entry of weighted){
      target-=entry.weight;
      if(target<=0)return entry.item;
    }
    return weighted[weighted.length-1].item;
  },[weightForItem]);

  const pickMany=useCallback((pool:Movie[],count:number,first?:Movie|null)=>{
    const result:Movie[]=[];
    const available=[...pool];
    if(first){
      result.push(first);
      const index=available.findIndex(item=>uniqueMediaKey(item)===uniqueMediaKey(first));
      if(index>=0)available.splice(index,1);
    }
    while(result.length<count&&available.length){
      const chosen=weightedPick(available);
      if(!chosen)break;
      result.push(chosen);
      const index=available.findIndex(item=>uniqueMediaKey(item)===uniqueMediaKey(chosen));
      if(index>=0)available.splice(index,1);
    }
    return result;
  },[weightedPick]);

  const buildReelItems=useCallback((pool:Movie[],forcedWinner:Movie)=>{
    if(!pool.length)return{items:[] as Movie[],targetIndex:0};
    const shuffle=(array:Movie[])=>{
      const copy=[...array];
      for(let i=copy.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [copy[i],copy[j]]=[copy[j],copy[i]];
      }
      return copy;
    };
    const repeated:Movie[]=[];
    const repetitions=Math.max(18,Math.ceil(170/pool.length));
    for(let i=0;i<repetitions;i++)repeated.push(...shuffle(pool));
    const startIdx=Math.floor(repeated.length*0.72);
    const endIdx=Math.floor(repeated.length*0.86);
    const possible:number[]=[];
    for(let i=startIdx;i<=endIdx;i++)if(uniqueMediaKey(repeated[i])===uniqueMediaKey(forcedWinner))possible.push(i);
    const targetIndex=possible.length?possible[Math.floor(Math.random()*possible.length)]:Math.floor((startIdx+endIdx)/2);
    repeated[targetIndex]=forcedWinner;
    return{items:repeated,targetIndex};
  },[]);

  const triggerConfetti=useCallback(()=>{
    const canvasElement=modalCanvasRef.current;
    if(!canvasElement)return;
    try{
      const localizedConfetti=confetti.create(canvasElement,{resize:true,useWorker:true});
      localizedConfetti({particleCount:65,spread:60,gravity:1,scalar:0.95,origin:{x:0.5,y:0.4},colors:['#f59e0b','#fbbf24','#ffffff','#d97706','#fef3c7']});
    }catch{}
  },[]);

  const revealSingleWinner=useCallback((selectedWinner:Movie)=>{
    setWinner(selectedWinner);
    setShowResult(true);
    setShowFinalists(false);
    setTrailerKey(null);
    addHistoryEntry(selectedWinner,'picked');
    playChimeSound();
    const poster=getPosterSrc(selectedWinner,'w200');
    if(poster)extractDominantColor(poster);
  },[addHistoryEntry,playChimeSound,getPosterSrc,extractDominantColor]);

  const startSpin=useCallback((poolOverride?:Movie[])=>{
    const spinPool=poolOverride?.length?poolOverride:activeItems;
    if(!spinPool.length||isSpinning)return;
    const forcedWinner=weightedPick(spinPool);
    if(!forcedWinner)return;
    const reel=buildReelItems(spinPool,forcedWinner);

    initAudioContext();
    animationRef.current?.stop();
    setDisplayReel(reel.items);
    setIsSpinning(true);
    setWinner(null);
    setShowResult(false);
    setShowFinalists(false);
    setFinalists([]);
    setShowTrailerModal(false);
    setTrailerKey(null);
    setCurrentHistoryId(null);
    xOffset.set(0);

    requestAnimationFrame(()=>{
      const viewportWidth=reelViewportRef.current?.clientWidth??(typeof window!=='undefined'?window.innerWidth:375);
      const isMobile=viewportWidth<640;
      const cardWidth=isMobile?CARD_WIDTH_MOBILE:CARD_WIDTH_DESKTOP;
      const gap=isMobile?GAP_MOBILE:GAP_DESKTOP;
      const totalWidth=cardWidth+gap;
      const centerOffset=viewportWidth/2-cardWidth/2;
      const targetX=-(reel.targetIndex*totalWidth)+centerOffset;
      let lastTickIndex=-1;

      animationRef.current=animate(0,targetX,{
        duration:5.4,
        ease:[0.12,0.9,0.2,1],
        onUpdate:latest=>{
          xOffset.set(latest);
          const currentTickIndex=Math.round(Math.abs(latest-centerOffset)/totalWidth);
          if(currentTickIndex!==lastTickIndex){
            lastTickIndex=currentTickIndex;
            indicatorScale.set(1.22);
            window.setTimeout(()=>indicatorScale.set(1),40);
            if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(8);
            playTickSound();
          }
        },
        onComplete:()=>{
          xOffset.set(targetX);
          const landed=reel.items[reel.targetIndex];
          setIsSpinning(false);
          if(pickMode==='trio'){
            const finalThree=pickMany(spinPool,3,landed);
            setFinalists(finalThree);
            setShowFinalists(true);
            playChimeSound();
          }else{
            revealSingleWinner(landed);
          }
        }
      });
    });
  },[activeItems,isSpinning,weightedPick,buildReelItems,initAudioContext,xOffset,indicatorScale,playTickSound,pickMode,pickMany,playChimeSound,revealSingleWinner]);

  const handleSmartSpin=useCallback(async()=>{
    setSmartError(null);
    setIsPreparing(true);
    setPrepareProgress({done:0,total:0});
    try{
      let pool=[...baseFilteredItems];
      pool=await enrichPool(pool);
      pool=applyExactFilters(pool);
      const required=pickMode==='trio'?3:1;
      if(pool.length<required){
        setSmartError(pickMode==='trio'
          ?`Choose Between 3 needs at least 3 matching titles. Only ${pool.length} match right now.`
          :'No titles match those settings after runtime, mood, language, and recent-spin checks. Try loosening one constraint.');
        return;
      }
      setActiveItems(pool);
      setDisplayReel([]);
      setSkipCount(0);
      setWinner(null);
      setShowResult(false);
      setShowSetup(false);
      window.setTimeout(()=>startSpin(pool),60);
    }finally{
      setIsPreparing(false);
    }
  },[baseFilteredItems,enrichPool,applyExactFilters,pickMode,startSpin]);

  const handleSkip=useCallback(()=>{
    if(!winner||skipCount>=MAX_SKIPS||activeItems.length<=1)return;
    updateCurrentHistoryOutcome('skipped');
    const updated=activeItems.filter(item=>uniqueMediaKey(item)!==uniqueMediaKey(winner));
    setActiveItems(updated);
    setSkipCount(previous=>previous+1);
    setShowResult(false);
    setWinner(null);
    setTrailerKey(null);
    window.setTimeout(()=>startSpin(updated),120);
  },[winner,skipCount,activeItems,updateCurrentHistoryOutcome,startSpin]);

  const handleSpinAgain=useCallback(()=>{
    if(winner)updateCurrentHistoryOutcome('rerolled');
    setShowResult(false);
    setWinner(null);
    window.setTimeout(()=>startSpin(activeItems),80);
  },[winner,updateCurrentHistoryOutcome,startSpin,activeItems]);

  const chooseFinalist=useCallback((item:Movie)=>{
    setShowFinalists(false);
    setFinalists([]);
    revealSingleWinner(item);
  },[revealSingleWinner]);

  const getActiveKey=useCallback((movie:Movie|null)=>{
    if(!movie)return null;
    return movie.trailerKey||movie.trailers?.find(trailer=>trailer.site==='YouTube'&&(trailer.type==='Trailer'||trailer.type==='Teaser'))?.key||movie.trailers?.find(trailer=>trailer.site==='YouTube')?.key||null;
  },[]);

  const fetchTrailer=useCallback(async(movie:Movie|null)=>{
    if(!movie)return null;
    const existingKey=getActiveKey(movie);
    if(existingKey){setTrailerKey(existingKey);return existingKey;}
    setTrailerLoading(true);
    setTrailerKey(null);
    try{
      const type=normalizeMediaType(movie);
      const id=movie.movieId||movie.id;
      const response=await fetch(`https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${API_KEY}&language=en-US`);
      if(!response.ok)throw new Error(`TMDB request failed: ${response.status}`);
      const data=await response.json();
      const videos:Trailer[]=Array.isArray(data.results)?data.results:[];
      const youtubeVideos=videos.filter(video=>video.site==='YouTube'&&video.key);
      const selected=youtubeVideos.find(video=>video.type==='Trailer'&&video.official===true)||youtubeVideos.find(video=>video.type==='Trailer')||youtubeVideos.find(video=>video.type==='Teaser')||youtubeVideos[0];
      if(selected?.key){setTrailerKey(selected.key);return selected.key;}
    }catch(error){console.error('Trailer fetch failed:',error);}finally{setTrailerLoading(false);}
    return null;
  },[getActiveKey,normalizeMediaType]);

  const getTrailerUrl=useCallback((key:string)=>`https://www.youtube.com/embed/${key}?autoplay=1&modestbranding=1&rel=0&playsinline=1`,[]);

  const openTrailer=useCallback(async()=>{
    if(!winner)return;
    setShowTrailerModal(true);
    await fetchTrailer(winner);
  },[winner,fetchTrailer]);

  const openExternalYoutube=useCallback((movie:Movie|null)=>{
    if(!movie)return;
    const key=trailerKey||getActiveKey(movie);
    if(key)window.open(`https://www.youtube.com/watch?v=${key}`,'_blank','noopener,noreferrer');
    else window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title||movie.name||''} official trailer`)}`,'_blank','noopener,noreferrer');
  },[trailerKey,getActiveKey]);

  const whyThis=useMemo(()=>{
    if(!winner)return{matched:0,total:0,chips:[] as string[]};
    const tests:{active:boolean;matched:boolean}[]=[
      {active:mediaFilter!=='all',matched:mediaFilter==='all'||normalizeMediaType(winner)===mediaFilter},
      {active:timePreset>0,matched:timePreset===0||((getKnownRuntime(winner)??9999)<=timePreset)},
      {active:selectedMood!=='any',matched:selectedMood==='any'||moodMatches(winner)},
      {active:highRatedOnly,matched:!highRatedOnly||(winner.vote_average??0)>=8},
      {active:tonightMode,matched:!tonightMode||((winner.vote_average??0)>=6.5&&(getKnownRuntime(winner)??9999)<=120)},
      {active:unwatchedOnly&&hasWatchStatus,matched:!unwatchedOnly||!isItemWatched(winner)},
      {active:selectedGenre!=='all',matched:selectedGenre==='all'||winner.genres?.includes(selectedGenre)},
      {active:selectedLanguage!=='all',matched:selectedLanguage==='all'||languageCodeFor(winner)===selectedLanguage},
      {active:selectedEra!=='all',matched:matchesEra(winner,selectedEra)},
    ];
    const activeTests=tests.filter(test=>test.active);
    const runtime=getKnownRuntime(winner);
    const chips:string[]=[];
    if(selectedGenre!=='all')chips.push(selectedGenre.toUpperCase());
    else if(winner.genres?.[0])chips.push(winner.genres[0].toUpperCase());
    if(runtime)chips.push(formatRuntime(runtime).toUpperCase());
    if(typeof winner.vote_average==='number')chips.push(`${winner.vote_average.toFixed(1)} ★`);
    if(hasWatchStatus)chips.push(isItemWatched(winner)?'WATCHED':'UNWATCHED');
    const language=languageCodeFor(winner);
    if(language&&LANGUAGE_LABELS[language])chips.push(LANGUAGE_LABELS[language].toUpperCase());
    return{matched:activeTests.filter(test=>test.matched).length,total:activeTests.length,chips:chips.slice(0,5)};
  },[winner,mediaFilter,normalizeMediaType,timePreset,getKnownRuntime,selectedMood,moodMatches,highRatedOnly,tonightMode,unwatchedOnly,hasWatchStatus,isItemWatched,selectedGenre,selectedLanguage,languageCodeFor,selectedEra]);

  const dynamicCta=useMemo(()=>{
    const count=previewEligibleItems.length;
    if(tonightMode)return pickMode==='trio'?`Tonight's 3 · ${count} Picks`:`Tonight's Pick · ${count}`;
    if(pickMode==='trio')return`Deal Me 3 · ${count} Picks`;
    if(filterCriteriaCount===0&&strength==='balanced')return'✨ Pure Chaos';
    if(mediaFilter==='movie'&&timePreset===120&&filterCriteriaCount<=2)return'🎲 Pick My Movie';
    return`✨ Surprise Me · ${count} Picks`;
  },[previewEligibleItems.length,tonightMode,pickMode,filterCriteriaCount,strength,mediaFilter,timePreset]);

  const preparationLabel=prepareProgress.total>0?`Checking ${prepareProgress.done}/${prepareProgress.total}…`:'Building your odds…';

  useEffect(()=>{
    if(showResult&&winner){
      const timer=window.setTimeout(()=>triggerConfetti(),120);
      return()=>window.clearTimeout(timer);
    }
  },[showResult,winner,triggerConfetti]);

  useEffect(()=>{
    if(!isOpen)return;
    animationRef.current?.stop();
    setShowSetup(true);
    setShowMoreFilters(false);
    setShowHistory(false);
    setActiveItems(items);
    setDisplayReel([]);
    setSkipCount(0);
    setWinner(null);
    setShowResult(false);
    setShowFinalists(false);
    setFinalists([]);
    setShowTrailerModal(false);
    setTrailerKey(null);
    setSmartError(null);
    setCurrentHistoryId(null);
    xOffset.set(0);
  },[isOpen,items,xOffset]);

  useEffect(()=>()=>animationRef.current?.stop(),[]);

  useEffect(()=>{
    if(!showTrailerModal){setTrailerKey(null);setTrailerLoading(false);}
  },[showTrailerModal]);

  if(!isOpen)return null;

  const historyOutcomeStyle=(outcome:HistoryOutcome)=>{
    if(outcome==='watched')return'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
    if(outcome==='skipped')return'border-red-400/20 bg-red-400/10 text-red-300';
    if(outcome==='rerolled')return'border-cyan-400/20 bg-cyan-400/10 text-cyan-300';
    return'border-amber-400/20 bg-amber-400/10 text-amber-300';
  };

  return(
    <div
      className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-black text-white antialiased"
      style={{fontFamily:"-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif"}}
    >
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-colors duration-1000"
        style={{background:showResult?`radial-gradient(ellipse at center,${dominantColor},transparent 72%),#000`:'radial-gradient(ellipse at top,rgba(245,158,11,0.13),transparent 64%),#000'}}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black"/>
      </div>

      <header className="relative z-30 flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-extrabold uppercase tracking-tight sm:text-4xl"><span>{rouletteContext.label}</span> <span className="bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">Roulette</span></h2>
          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-white/35 sm:text-[10px]">{rouletteContext.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={()=>setShowHistory(true)} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-300 shadow-lg shadow-black/35 transition hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white active:scale-90" aria-label="Recent spins">
            <History className="h-4 w-4"/>
            {rouletteHistory.length>0&&<span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[8px] font-black text-black">{Math.min(rouletteHistory.length,9)}</span>}
          </button>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-300 shadow-lg shadow-black/35 transition hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white active:scale-90" aria-label="Close roulette"><X className="h-4 w-4"/></button>
        </div>
      </header>

      {showSetup&&!isSpinning?(
        <main className="relative z-20 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(18px,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pt-4">
          <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} className="mx-auto w-full max-w-4xl rounded-[26px] border border-white/[0.1] bg-white/[0.05] p-3.5 shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-3xl sm:rounded-[34px] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-amber-300"><Dices className="h-3 w-3"/>{rouletteContext.setupBadge}</div>
                <h3 className="text-lg font-black tracking-tight sm:text-2xl">Set the vibe. Keep the surprise.</h3>
                <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-zinc-500 sm:text-xs">{rouletteContext.setupDescription}</p>
              </div>
              {filterCriteriaCount>0&&<button type="button" onClick={resetSmartFilters} className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 px-2.5 py-2 text-[9px] font-bold text-zinc-300 shadow-md shadow-black/30 transition hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white"><RefreshCw className="h-3 w-3"/>Reset</button>}
            </div>

            <button type="button" onClick={activateTonightMode} className={`mt-4 flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${tonightMode?'border border-indigo-400/40 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-xl shadow-indigo-500/25 hover:from-indigo-700 hover:via-violet-700 hover:to-fuchsia-700':'border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-200 shadow-lg shadow-black/35 hover:border-indigo-500/30 hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800'}`}>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-inner ${tonightMode?'bg-white/15 text-white':'bg-gradient-to-br from-zinc-800 to-zinc-700 text-indigo-400'}`}><Moon className="h-5 w-5"/></span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-xs font-black sm:text-sm">Tonight Mode{tonightMode&&<span className="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[8px] uppercase tracking-wider text-white">Active</span>}</span><span className={`mt-0.5 block text-[9px] leading-relaxed sm:text-[10px] ${tonightMode?'text-white/75':'text-zinc-500'}`}>Unwatched when available · ≤ 2h · 6.5+ rating · balanced odds</span></span>
              <ChevronRight className={`h-4 w-4 shrink-0 ${tonightMode?'text-white/80':'text-zinc-500'}`}/>
            </button>

            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">1 · What?</p><span className="text-[8px] text-zinc-700">Media</span></div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  {value:'all' as MediaFilter,label:'Anything',icon:Shuffle},
                  {value:'movie' as MediaFilter,label:'Movies',icon:Clapperboard},
                  {value:'tv' as MediaFilter,label:'TV',icon:Tv},
                ]).map(option=>{
                  const Icon=option.icon;
                  const selected=mediaFilter===option.value;
                  return <button key={option.value} type="button" onClick={()=>{setMediaFilter(option.value);setTonightMode(false);setSmartError(null);}} className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-[10px] font-black transition active:scale-[0.98] sm:min-h-[70px] sm:text-xs ${selected?(option.value==='movie'?'border-blue-400/40 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700':option.value==='tv'?'border-cyan-400/40 bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-700 hover:to-blue-700':'border-amber-400/40 bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600'):'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400 shadow-md shadow-black/30 hover:border-white/20 hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white'}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5"/>{option.label}</button>;
                })}
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">2 · I have…</p><span className="text-[8px] text-zinc-700">Maximum runtime</span></div>
              <div className="grid grid-cols-5 gap-1.5 rounded-2xl border border-white/[0.07] bg-black/25 p-1.5">
                {TIME_OPTIONS.map(option=>{
                  const selected=timePreset===option.value;
                  return <button key={option.value} type="button" onClick={()=>{setTimePreset(option.value);setTonightMode(false);setSmartError(null);}} className={`min-h-[42px] rounded-xl px-1 text-[9px] font-black transition active:scale-[0.97] sm:text-[11px] ${selected?'border border-cyan-400/40 bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-lg shadow-cyan-500/25':'border border-transparent bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400 shadow-sm shadow-black/25 hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white'}`}>{option.label}</button>;
                })}
              </div>
              <p className="mt-1.5 text-[8px] text-zinc-700">For TV, runtime uses typical/recent episode duration.</p>
            </section>

            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">3 · Mood</p><span className="text-[8px] text-zinc-700">Genres + TMDB keywords</span></div>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button type="button" onClick={()=>{setSelectedMood('any');setSmartError(null);}} className={`shrink-0 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.98] ${selectedMood==='any'?'border-amber-400/40 bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/25':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400 shadow-md shadow-black/25 hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white'}`}><span className="flex items-center gap-2 text-[10px] font-black"><Dices className="h-4 w-4"/>Any mood</span><span className="mt-0.5 block text-[8px] opacity-60">Keep it random</span></button>
                {MOODS.map(mood=>{
                  const Icon=mood.icon;
                  const selected=selectedMood===mood.key;
                  return <button key={mood.key} type="button" onClick={()=>{setSelectedMood(mood.key);setTonightMode(false);setSmartError(null);}} className={`w-[132px] shrink-0 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98] sm:w-[150px] ${selected?'border-amber-400/40 bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400 shadow-md shadow-black/25 hover:border-amber-500/20 hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white'}`}><span className="flex items-center gap-2 text-[10px] font-black"><Icon className="h-4 w-4"/>{mood.label}</span><span className="mt-1 block text-[8px] leading-tight opacity-60">{mood.hint}</span></button>;
                })}
              </div>
            </section>

            <section className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Roulette strength</p><span className="text-[8px] text-zinc-700">Odds weighting</span></div>
                <div className="grid grid-cols-3 gap-1.5">
                  {STRENGTH_OPTIONS.map(option=>{
                    const Icon=option.icon;
                    const selected=strength===option.value;
                    return <button key={option.value} type="button" onClick={()=>{setStrength(option.value);setSmartError(null);}} className={`rounded-2xl border p-2.5 text-left transition active:scale-[0.98] ${selected?(option.value==='safe'?'border-emerald-400/40 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25':option.value==='wild'?'border-orange-400/40 bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/25':'border-blue-400/40 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'):'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400 shadow-md shadow-black/25 hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white'}`}><Icon className={`mb-1.5 h-4 w-4 ${selected?'text-white':'text-zinc-500'}`}/><span className="block text-[9px] font-black sm:text-[10px]">{option.label}</span><span className={`mt-0.5 hidden text-[7px] leading-tight sm:block ${selected?'text-white/75':'text-zinc-600'}`}>{option.hint}</span></button>;
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Finale</p><span className="text-[8px] text-zinc-700">One pick or shortlist</span></div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={()=>setPickMode('single')} className={`min-h-[66px] rounded-2xl border p-3 text-left transition active:scale-[0.98] ${pickMode==='single'?'border-amber-400/40 bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/25':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400 shadow-md shadow-black/25 hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white'}`}><Trophy className={`mb-1.5 h-4 w-4 ${pickMode==='single'?'text-black':'text-zinc-500'}`}/><span className="block text-[10px] font-black">One Winner</span><span className={`mt-0.5 block text-[8px] ${pickMode==='single'?'text-black/65':'text-zinc-600'}`}>Roulette decides</span></button>
                  <button type="button" onClick={()=>setPickMode('trio')} className={`min-h-[66px] rounded-2xl border p-3 text-left transition active:scale-[0.98] ${pickMode==='trio'?'border-fuchsia-400/40 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-500/25':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400 shadow-md shadow-black/25 hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white'}`}><Users className={`mb-1.5 h-4 w-4 ${pickMode==='trio'?'text-white':'text-zinc-500'}`}/><span className="block text-[10px] font-black">Choose Between 3</span><span className={`mt-0.5 block text-[8px] ${pickMode==='trio'?'text-white/70':'text-zinc-600'}`}>You make the final call</span></button>
                </div>
              </div>
            </section>

            <section className="mt-5">
              <button type="button" onClick={()=>setShowMoreFilters(value=>!value)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 px-4 py-3 text-left text-zinc-200 shadow-lg shadow-black/30 transition hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white">
                <span className="flex items-center gap-2"><ListFilter className="h-4 w-4 text-zinc-500"/><span><span className="block text-[10px] font-black">More filters</span><span className="mt-0.5 block text-[8px] text-zinc-600">Rating, unwatched, genre, language, era, recent spins</span></span></span>
                {showMoreFilters?<ChevronUp className="h-4 w-4 text-zinc-600"/>:<ChevronDown className="h-4 w-4 text-zinc-600"/>}
              </button>

              <AnimatePresence initial={false}>
                {showMoreFilters&&<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                  <div className="mt-2 space-y-3 rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={()=>{setHighRatedOnly(value=>!value);setTonightMode(false);setSmartError(null);}} className={`flex min-h-[58px] items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${highRatedOnly?'border-amber-400/40 bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/25':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-300 shadow-md shadow-black/25 hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${highRatedOnly?'bg-black/15 text-black':'bg-gradient-to-br from-zinc-800 to-zinc-700 text-zinc-500'}`}><Star className={`h-3.5 w-3.5 ${highRatedOnly?'fill-black text-black':''}`}/></span><span className="min-w-0"><span className="block text-[9px] font-black">8+ TMDB</span><span className={`text-[7px] ${highRatedOnly?'text-black/65':'text-zinc-600'}`}>Highly rated only</span></span>{highRatedOnly&&<Check className="ml-auto h-3.5 w-3.5 text-black"/>}</button>
                      <button type="button" disabled={!hasWatchStatus} onClick={()=>{if(hasWatchStatus){setUnwatchedOnly(value=>!value);setTonightMode(false);setSmartError(null);}}} className={`flex min-h-[58px] items-center gap-2.5 rounded-xl border p-2.5 text-left transition disabled:opacity-35 ${unwatchedOnly?'border-emerald-400/40 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-300 shadow-md shadow-black/25 hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${unwatchedOnly?'bg-white/15 text-white':'bg-gradient-to-br from-zinc-800 to-zinc-700 text-zinc-500'}`}><EyeOff className="h-3.5 w-3.5"/></span><span className="min-w-0"><span className="block text-[9px] font-black">Unwatched</span><span className={`text-[7px] ${unwatchedOnly?'text-white/70':'text-zinc-600'}`}>{hasWatchStatus?'Fresh picks only':'Status unavailable'}</span></span>{unwatchedOnly&&<Check className="ml-auto h-3.5 w-3.5 text-white"/>}</button>
                    </div>

                    {allGenres.length>0&&<div><p className="mb-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-zinc-700">Genre</p><div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><button type="button" onClick={()=>setSelectedGenre('all')} className={`shrink-0 rounded-full border px-3 py-2 text-[9px] font-bold ${selectedGenre==='all'?'border-zinc-500/50 bg-gradient-to-r from-zinc-200 to-white text-black shadow-md shadow-white/10':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400'}`}>Any</button>{allGenres.map(genre=><button key={genre} type="button" onClick={()=>{setSelectedGenre(genre);setTonightMode(false);setSmartError(null);}} className={`shrink-0 rounded-full border px-3 py-2 text-[9px] font-bold ${selectedGenre===genre?'border-amber-400/40 bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md shadow-amber-500/20':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400'}`}>{genre}</button>)}</div></div>}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-zinc-700"><Languages className="h-3 w-3"/>Language</p><div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{LANGUAGE_OPTIONS.map(option=><button key={option.code} type="button" onClick={()=>{setSelectedLanguage(option.code);setTonightMode(false);setSmartError(null);}} className={`shrink-0 rounded-full border px-3 py-2 text-[9px] font-bold ${selectedLanguage===option.code?'border-cyan-400/40 bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400'}`}>{option.label}</button>)}</div></div>
                      <div><p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-zinc-700"><CalendarDays className="h-3 w-3"/>Era</p><div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{ERA_OPTIONS.map(option=><button key={option.value} type="button" onClick={()=>{setSelectedEra(option.value);setTonightMode(false);setSmartError(null);}} className={`shrink-0 rounded-full border px-3 py-2 text-[9px] font-bold ${selectedEra===option.value?'border-violet-400/40 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/20':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-400'}`}>{option.label}</button>)}</div></div>
                    </div>

                    <button type="button" onClick={()=>setAvoidRecent(value=>!value)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${avoidRecent?'border-fuchsia-400/40 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-500/25':'border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-300 shadow-md shadow-black/25'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${avoidRecent?'bg-white/15 text-white':'bg-gradient-to-br from-zinc-800 to-zinc-700 text-zinc-500'}`}><History className="h-3.5 w-3.5"/></span><span className="flex-1"><span className="block text-[9px] font-black">Avoid Recent Spins</span><span className={`block text-[7px] ${avoidRecent?'text-white/70':'text-zinc-600'}`}>Temporarily excludes up to {RECENT_EXCLUSION_COUNT} recent winners when enough alternatives exist</span></span><span className={`h-5 w-9 rounded-full p-0.5 transition ${avoidRecent?'bg-fuchsia-400':'bg-zinc-800'}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${avoidRecent?'translate-x-4':'translate-x-0'}`}/></span></button>
                  </div>
                </motion.div>}
              </AnimatePresence>
            </section>

            <section className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-black/30">
              <div className="flex items-center gap-3 p-3.5">
                <div className="flex -space-x-2.5 shrink-0">
                  {oddsPreview.length?oddsPreview.map((item,index)=><div key={`${uniqueMediaKey(item)}-${index}`} className="h-12 w-8 overflow-hidden rounded-lg border-2 border-zinc-950 bg-zinc-900 shadow-lg" style={{zIndex:oddsPreview.length-index}}>{getPosterSrc(item,'w185')?<img src={getPosterSrc(item,'w185')} alt="" className="h-full w-full object-cover"/>:<div className="h-full w-full bg-zinc-900"/>}</div>):<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-700"><Film className="h-4 w-4"/></div>}
                </div>
                <div className="min-w-0 flex-1"><p className="text-xs font-black">{previewEligibleItems.length} possible pick{previewEligibleItems.length===1?'':'s'}</p><p className="mt-0.5 text-[8px] leading-relaxed text-zinc-600">{approximateMetadataCount>0?`${approximateMetadataCount} title${approximateMetadataCount===1?'':'s'} will be verified with TMDB before spinning.`:avoidRecent&&rouletteHistory.length?'Recent winners are being kept out of the immediate odds.':'These are the titles currently in play.'}</p></div>
              </div>

              <div className="border-t border-white/[0.06] p-2.5">
                <button type="button" onClick={handleSmartSpin} disabled={isPreparing||previewEligibleItems.length<(pickMode==='trio'?3:1)} className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 px-5 py-3 text-xs font-black text-black shadow-[0_10px_30px_rgba(245,158,11,0.22)] transition hover:brightness-110 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-35 sm:text-sm">
                  {isPreparing?<><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black"/>{preparationLabel}</>:<><Dices className="h-4 w-4"/>{dynamicCta}<ChevronRight className="h-4 w-4"/></>}
                </button>
              </div>
            </section>

            {smartError&&<p className="mt-3 rounded-2xl border border-red-500/15 bg-red-500/[0.07] px-4 py-3 text-[9px] font-semibold leading-relaxed text-red-300">{smartError}</p>}
          </motion.div>
        </main>
      ):(
        <main className="relative z-20 flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-center gap-2 px-4 pt-2">
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[9px] font-bold text-zinc-500 backdrop-blur-xl">{activeItems.length} eligible</span>
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[9px] font-bold text-zinc-500 backdrop-blur-xl">{strength==='safe'?'Safe Pick':strength==='wild'?'Wild Card':'Balanced'}</span>
            <button type="button" disabled={isSpinning} onClick={()=>{setShowSetup(true);setShowResult(false);setShowFinalists(false);setWinner(null);}} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 px-3 py-1.5 text-[9px] font-bold text-zinc-300 shadow-md shadow-black/30 transition hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white disabled:opacity-30"><SlidersHorizontal className="h-3 w-3"/>Edit</button>
          </div>

          <div ref={reelViewportRef} className="relative my-auto flex h-[238px] w-full items-center justify-center overflow-hidden sm:h-[340px]">
            <motion.div style={{scale:indicatorScale}} className="absolute top-1.5 z-50 rotate-180 text-amber-400 drop-shadow-[0_4px_12px_rgba(245,158,11,0.5)]"><svg className="h-5 w-5 fill-current sm:h-6 sm:w-6" viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg></motion.div>
            <motion.div style={{scale:indicatorScale}} className="absolute bottom-1.5 z-50 text-amber-400 drop-shadow-[0_-4px_12px_rgba(245,158,11,0.5)]"><svg className="h-5 w-5 fill-current sm:h-6 sm:w-6" viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg></motion.div>
            <div className="pointer-events-none absolute z-40 h-[187px] w-[131px] rounded-[28px] border-2 border-amber-400/70 bg-gradient-to-b from-amber-400/10 via-transparent to-amber-400/10 shadow-[0_0_38px_rgba(245,158,11,0.28),inset_0_1px_1px_rgba(255,255,255,0.4)] sm:h-[281px] sm:w-[196px]"/>
            <div className="absolute left-0 flex h-full w-full items-center justify-start overflow-visible">
              <motion.div className="flex transform-gpu will-change-transform gap-[10px] sm:gap-[16px]" style={{x:xOffset}}>
                {displayReel.map((item,index)=><div key={`${uniqueMediaKey(item)}-${index}`} className="relative h-[181px] w-[125px] shrink-0 overflow-hidden rounded-[24px] border border-white/20 bg-white/[0.05] shadow-[0_12px_30px_rgba(0,0,0,0.5)] transition sm:h-[275px] sm:w-[190px]" style={{opacity:isSpinning?0.62:1}}>{getPosterSrc(item)?<img src={getPosterSrc(item)} alt="" className="h-full w-full select-none object-cover" draggable={false}/>:<div className="flex h-full w-full items-center justify-center p-3 text-center text-[10px] font-semibold text-white/50">{item.title||item.name}</div>}<div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/5"/></div>)}
              </motion.div>
            </div>
          </div>
          <div className="shrink-0 pb-[max(18px,env(safe-area-inset-bottom))] text-center text-[8px] uppercase tracking-[0.18em] text-zinc-700">The center ring is the result</div>
        </main>
      )}

      <AnimatePresence>
        {showFinalists&&finalists.length>0&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[115] flex items-end justify-center bg-black/82 p-0 backdrop-blur-2xl sm:items-center sm:p-5">
          <motion.div initial={{y:36,opacity:0,scale:0.98}} animate={{y:0,opacity:1,scale:1}} exit={{y:36,opacity:0}} className="w-full max-w-2xl rounded-t-[30px] border border-white/12 bg-zinc-950 p-4 pb-[max(18px,env(safe-area-inset-bottom))] shadow-[0_30px_100px_rgba(0,0,0,0.7)] sm:rounded-[30px] sm:p-6">
            <div className="text-center"><div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-violet-300"><Users className="h-3 w-3"/>Final 3</div><h3 className="text-xl font-black sm:text-2xl">Roulette narrowed it down.</h3><p className="mt-1 text-[10px] text-zinc-500">Now you make the final choice.</p></div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">{finalists.map((item,index)=><button key={uniqueMediaKey(item)} type="button" onClick={()=>chooseFinalist(item)} className="group overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-800 to-zinc-950 p-1.5 text-left shadow-lg shadow-black/35 transition hover:-translate-y-1 hover:border-amber-400/50 hover:from-zinc-700 hover:to-zinc-900 active:scale-[0.98] sm:p-2"><div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900">{getPosterSrc(item)?<img src={getPosterSrc(item)} alt={item.title||item.name} className="h-full w-full object-cover"/>:<div className="h-full w-full"/>}<span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[8px] font-black text-white backdrop-blur">{index+1}</span></div><p className="mt-2 line-clamp-2 break-words py-px text-[9px] font-extrabold leading-[1.25] text-white sm:text-xs">{item.title||item.name}</p><div className="mt-1 flex items-center gap-1 text-[8px] text-zinc-500"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400"/>{item.vote_average?.toFixed(1)||'N/A'}</div></button>)}</div>
            <button type="button" onClick={()=>{setShowFinalists(false);setFinalists([]);window.setTimeout(()=>startSpin(activeItems),80);}} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 py-3 text-[10px] font-bold text-zinc-200 shadow-lg shadow-black/30 transition hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white"><RotateCcw className="h-3.5 w-3.5"/>Reroll all three</button>
          </motion.div>
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showResult&&winner&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[110] flex items-end justify-center overflow-y-auto bg-black/82 p-0 backdrop-blur-2xl sm:items-center sm:p-4">
          <canvas ref={modalCanvasRef} className="pointer-events-none absolute inset-0 z-[130] h-full w-full"/>
          <motion.div initial={{scale:0.98,y:30,opacity:0}} animate={{scale:1,y:0,opacity:1}} exit={{scale:0.98,y:30,opacity:0}} transition={{type:'spring',damping:26,stiffness:220}} className="relative z-[120] flex max-h-[96dvh] w-full max-w-[430px] flex-col overflow-x-hidden overflow-y-auto rounded-t-[30px] border border-white/20 bg-gradient-to-b from-white/[0.14] via-zinc-950/96 to-zinc-950 p-4 pb-[max(18px,env(safe-area-inset-bottom))] text-center shadow-[0_25px_70px_rgba(0,0,0,0.7)] sm:my-auto sm:max-h-[92dvh] sm:rounded-[34px] sm:p-6">
            <button onClick={onClose} className="absolute right-3 top-3 z-[140] flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 text-zinc-300 shadow-lg shadow-black/35 transition hover:from-zinc-800 hover:to-zinc-600 hover:text-white" aria-label="Close"><X className="h-4 w-4"/></button>

            <div className="mx-auto mt-1 h-[155px] w-[108px] shrink-0 overflow-hidden rounded-[18px] border border-white/25 bg-black shadow-[0_12px_30px_rgba(0,0,0,0.7)] sm:h-[215px] sm:w-[150px]">{getPosterSrc(winner)?<img src={getPosterSrc(winner)} alt={winner.title||winner.name} className="h-full w-full object-cover"/>:<div className="h-full w-full"/>}</div>
            <div className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-300"><Trophy className="h-3 w-3"/>Winner Picked</div>
            <h3
              className="mx-auto mt-2 w-full max-w-[360px] break-words px-3 py-0.5 text-[19px] font-extrabold leading-[1.22] tracking-[-0.015em] text-white sm:px-5 sm:text-2xl sm:leading-[1.18]"
              style={{overflowWrap:'anywhere'}}
            >
              {winner.title||winner.name}
            </h3>

            <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-zinc-500"><span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400"/><span className="font-bold text-white">{winner.vote_average?.toFixed(1)||'N/A'}</span></span>{getYear(winner)&&<span>• {getYear(winner)}</span>}{getKnownRuntime(winner)&&<span>• {formatRuntime(getKnownRuntime(winner))}</span>}</div>

            <div className="mt-3 rounded-2xl border border-white/[0.07] bg-black/30 p-3 text-left">
              <div className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-amber-300"/><p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">Why this?</p></div>
              <p className="mt-1.5 text-[10px] font-bold text-white">{whyThis.total>0?`Matched ${whyThis.matched}/${whyThis.total} of your filters`:`Pure chaos — selected from ${activeItems.length} eligible titles`}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{whyThis.chips.map(chip=><span key={chip} className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[8px] font-bold text-zinc-400">{chip}</span>)}</div>
              <p className="mt-2 text-[8px] text-zinc-600">{strength==='safe'?'Safe Pick weighted the odds toward stronger TMDB ratings.':strength==='wild'?'Wild Card weighted the odds toward lower-popularity hidden gems.':'Balanced kept the odds broad with a light quality bias.'}</p>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button onClick={()=>{navigate(`/${normalizeMediaType(winner)}/${winner.movieId}`);onClose();}} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 px-5 py-3 text-xs font-black text-black shadow-[0_8px_22px_rgba(245,158,11,0.28)] active:scale-[0.98]"><Play className="h-4 w-4 fill-black"/>Watch Selection</button>
              <div className="grid grid-cols-2 gap-2"><button onClick={openTrailer} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-red-400/40 bg-gradient-to-r from-red-500 to-rose-600 px-3 text-[10px] font-bold text-white shadow-lg shadow-red-500/25 transition hover:from-red-600 hover:to-rose-700 active:scale-[0.98]"><Film className="h-3.5 w-3.5"/>Trailer</button><button onClick={handleSkip} disabled={skipCount>=MAX_SKIPS||activeItems.length<=1} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 px-3 text-[10px] font-bold text-zinc-200 shadow-lg shadow-black/30 transition hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 active:scale-[0.98] disabled:opacity-30"><SkipForward className="h-3.5 w-3.5"/>Skip ({MAX_SKIPS-skipCount})</button></div>
              <button onClick={handleSpinAgain} className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-[10px] font-bold text-zinc-200 shadow-lg shadow-black/30 transition hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white"><RotateCcw className="h-3.5 w-3.5"/>Spin Again</button>
              <button onClick={()=>{setShowResult(false);setWinner(null);setShowSetup(true);}} className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-[10px] font-bold text-zinc-300 shadow-md shadow-black/25 transition hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800 hover:text-white"><SlidersHorizontal className="h-3.5 w-3.5"/>Change Setup</button>
            </div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[170] flex items-end justify-center bg-black/75 backdrop-blur-xl sm:items-center sm:p-5">
          <button type="button" onClick={()=>setShowHistory(false)} className="absolute inset-0" aria-label="Close recent spins"/>
          <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}} className="relative z-10 flex max-h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-zinc-950 shadow-2xl sm:rounded-[30px]">
            <div className="flex items-center justify-between border-b border-white/[0.07] p-4"><div><div className="flex items-center gap-2"><History className="h-4 w-4 text-amber-300"/><h3 className="text-sm font-black">Recent Spins</h3></div><p className="mt-1 text-[8px] text-zinc-600">Used by Avoid Recent Spins and kept on this device.</p></div><div className="flex items-center gap-2">{rouletteHistory.length>0&&<button type="button" onClick={clearHistory} className="flex h-9 w-9 items-center justify-center rounded-full border border-red-400/40 bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25 transition hover:from-red-600 hover:to-rose-700"><Trash2 className="h-3.5 w-3.5"/></button>}<button type="button" onClick={()=>setShowHistory(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-700 text-zinc-300 shadow-md shadow-black/30 transition hover:text-white"><X className="h-4 w-4"/></button></div></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[max(14px,env(safe-area-inset-bottom))]">{rouletteHistory.length===0?<div className="flex min-h-[220px] flex-col items-center justify-center text-center"><Dices className="h-7 w-7 text-zinc-700"/><p className="mt-3 text-xs font-black text-zinc-400">No spins yet</p><p className="mt-1 text-[9px] text-zinc-700">Your roulette trail will appear here.</p></div>:<div className="space-y-2">{rouletteHistory.map(entry=>{const currentItem=items.find(item=>uniqueMediaKey(item)===entry.mediaKey);const displayOutcome:HistoryOutcome=currentItem&&isItemWatched(currentItem)?'watched':entry.outcome;return <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-2.5"><div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-900">{entry.posterPath?<img src={entry.posterPath.startsWith('http')?entry.posterPath:`https://image.tmdb.org/t/p/w185${entry.posterPath}`} alt="" className="h-full w-full object-cover"/>:<div className="h-full w-full"/>}</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-black">{entry.title}</p><p className="mt-0.5 text-[8px] text-zinc-600">{entry.mediaType==='tv'?'TV':'Movie'} · {new Date(entry.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'})}{entry.rating?` · ${entry.rating.toFixed(1)} ★`:''}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-wide ${historyOutcomeStyle(displayOutcome)}`}>{displayOutcome}</span></div>;})}</div>}</div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showTrailerModal&&winner&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[190] flex items-center justify-center bg-black/92 p-3 backdrop-blur-3xl sm:p-5">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-[24px] border border-white/15 bg-black shadow-2xl sm:rounded-[28px]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-4 py-3"><span className="truncate text-xs font-bold sm:text-sm">{winner.title||winner.name} — Trailer</span><div className="flex items-center gap-2"><button onClick={()=>openExternalYoutube(winner)} className="flex items-center gap-1.5 rounded-full border border-red-400/40 bg-gradient-to-r from-red-500 to-rose-600 px-3 py-1.5 text-[9px] font-bold text-white shadow-lg shadow-red-500/25 transition hover:from-red-600 hover:to-rose-700 sm:text-xs">YouTube<ArrowUpRightFromSquare className="h-3 w-3"/></button><button onClick={()=>setShowTrailerModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-700 text-zinc-300 shadow-md shadow-black/30"><X className="h-4 w-4"/></button></div></div>
            <div className="relative aspect-video w-full bg-black">{trailerLoading?<div className="flex h-full flex-col items-center justify-center text-zinc-500"><div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-red-500"/><p className="text-xs">Fetching trailer…</p></div>:trailerKey?<iframe className="h-full w-full border-0" src={getTrailerUrl(trailerKey)} title={`${winner.title||winner.name} Trailer`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>:<div className="flex h-full flex-col items-center justify-center text-zinc-500"><Film className="mb-2 h-9 w-9 opacity-50"/><p className="text-xs font-medium">Trailer not available directly.</p><button onClick={()=>openExternalYoutube(winner)} className="mt-3 text-[10px] font-semibold text-red-400 underline underline-offset-2">Search on YouTube</button></div>}</div>
          </div>
        </motion.div>}
      </AnimatePresence>
    </div>
  );
};

export default Roulette;
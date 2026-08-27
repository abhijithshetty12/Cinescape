import React,{useState,useEffect,useMemo,useCallback,useRef}from'react';
import{motion,AnimatePresence,animate,useMotionValue,useSpring}from'framer-motion';
import{Star,X,Play,RotateCcw,Sparkles,Film,SkipForward,ArrowUpRightFromSquare}from'lucide-react';
import confetti from'canvas-confetti';
import{useNavigate}from'react-router-dom';

const API_KEY='859afbb4b98e3b467da9c99ac390e950';

interface Trailer{
  key:string;
  name?:string;
  site?:string;
  type?:string;
  official?:boolean;
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
}

interface WatchlistRouletteProps{
  isOpen:boolean;
  onClose:()=>void;
  items:Movie[];
}

const CARD_WIDTH_MOBILE=125;
const CARD_HEIGHT_MOBILE=181;
const CARD_WIDTH_DESKTOP=190;
const CARD_HEIGHT_DESKTOP=275;
const GAP_MOBILE=10;
const GAP_DESKTOP=16;
const MAX_SKIPS=2;

const WatchlistRoulette:React.FC<WatchlistRouletteProps>=({isOpen,onClose,items})=>{
  const[isSpinning,setIsSpinning]=useState(false);
  const[winner,setWinner]=useState<Movie|null>(null);
  const[showResult,setShowResult]=useState(false);
  const[activeItems,setActiveItems]=useState<Movie[]>(items);
  const[skipCount,setSkipCount]=useState(0);
  const[dominantColor,setDominantColor]=useState('rgba(245,158,11,0.15)');
  const[showTrailerModal,setShowTrailerModal]=useState(false);
  const[trailerKey,setTrailerKey]=useState<string|null>(null);
  const[trailerLoading,setTrailerLoading]=useState(false);

  const navigate=useNavigate();
  const modalCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const audioCtxRef=useRef<AudioContext|null>(null);
  const xOffset=useMotionValue(0);
  const indicatorScale=useSpring(1,{stiffness:420,damping:20});

  useEffect(()=>{
    setActiveItems(items);
    setSkipCount(0);
  },[items]);

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
      gain.gain.setValueAtTime(0.15,ctx.currentTime);
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
      const notes=[523.25,659.25,783.99,1046.5];
      notes.forEach((freq,idx)=>{
        const osc=ctx.createOscillator();
        const gain=ctx.createGain();
        const start=ctx.currentTime+idx*0.08;
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
        for(let i=0;i<data.length;i+=16){
          r+=data[i];
          g+=data[i+1];
          b+=data[i+2];
          count++;
        }
        setDominantColor(`rgba(${Math.floor(r/count)},${Math.floor(g/count)},${Math.floor(b/count)},0.45)`);
      }catch{
        setDominantColor('rgba(245,158,11,0.25)');
      }
    };
    img.onerror=()=>setDominantColor('rgba(245,158,11,0.25)');
  },[]);

  const getPosterSrc=useCallback((m:Movie|null)=>{
    if(!m?.posterPath)return'';
    if(m.posterPath.startsWith('http'))return m.posterPath;
    return`https://image.tmdb.org/t/p/w500${m.posterPath}`;
  },[]);

  const reelItems=useMemo(()=>{
    if(!activeItems.length)return[];
    const shuffle=(array:Movie[])=>[...array].sort(()=>Math.random()-0.5);
    const repeated:Movie[]=[];
    const repetitions=Math.max(15,Math.ceil(150/activeItems.length));
    for(let i=0;i<repetitions;i++)repeated.push(...shuffle(activeItems));
    return repeated;
  },[activeItems]);

  const triggerConfetti=useCallback(()=>{
    const canvasElement=modalCanvasRef.current;
    if(!canvasElement)return;
    try{
      const localizedConfetti=confetti.create(canvasElement,{resize:true,useWorker:true});
      localizedConfetti({
        particleCount:65,
        spread:60,
        gravity:1,
        scalar:0.95,
        origin:{x:0.5,y:0.4},
        colors:['#f59e0b','#fbbf24','#ffffff','#d97706','#fef3c7']
      });
    }catch{}
  },[]);

  const startSpin=useCallback(()=>{
    if(!activeItems.length)return;
    initAudioContext();

    const vw=typeof window!=='undefined'?window.innerWidth:375;
    const isMobile=vw<640;
    const cardWidth=isMobile?CARD_WIDTH_MOBILE:CARD_WIDTH_DESKTOP;
    const gap=isMobile?GAP_MOBILE:GAP_DESKTOP;
    const totalWidth=cardWidth+gap;
    const centerOffset=vw/2-cardWidth/2;

    setIsSpinning(true);
    setWinner(null);
    setShowResult(false);
    setShowTrailerModal(false);
    setTrailerKey(null);
    xOffset.set(0);

    const winnerItem=activeItems[Math.floor(Math.random()*activeItems.length)];
    const startIdx=Math.floor(reelItems.length*0.7);
    const endIdx=Math.floor(reelItems.length*0.85);
    const possibleIndices:number[]=[];

    for(let i=startIdx;i<=endIdx;i++){
      if(reelItems[i]?.id===winnerItem.id)possibleIndices.push(i);
    }

    const targetIndex=possibleIndices.length
      ?possibleIndices[Math.floor(Math.random()*possibleIndices.length)]
      :Math.floor((startIdx+endIdx)/2);

    const targetX=-(targetIndex*totalWidth)+centerOffset;
    let lastTickIndex=-1;

    const controls=animate(0,targetX,{
      duration:5.4,
      ease:[0.12,0.9,0.2,1],
      onUpdate:latest=>{
        xOffset.set(latest);
        const absolutePassedProgress=Math.abs(latest-centerOffset);
        const currentTickIndex=Math.round(absolutePassedProgress/totalWidth);

        if(currentTickIndex!==lastTickIndex){
          lastTickIndex=currentTickIndex;
          indicatorScale.set(1.25);
          setTimeout(()=>indicatorScale.set(1),40);
          if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(10);
          playTickSound();
        }
      },
      onComplete:()=>{
        const selectedWinner=reelItems[targetIndex];
        setIsSpinning(false);
        setWinner(selectedWinner);
        setShowResult(true);
        setTrailerKey(null);
        playChimeSound();

        if(selectedWinner?.posterPath){
          extractDominantColor(`https://image.tmdb.org/t/p/w200${selectedWinner.posterPath}`);
        }
      }
    });

    return()=>controls.stop();
  },[activeItems,reelItems,xOffset,indicatorScale,initAudioContext,playTickSound,playChimeSound,extractDominantColor]);

  const handleSkip=useCallback(()=>{
    if(!winner||skipCount>=MAX_SKIPS||activeItems.length<=1)return;
    const updated=activeItems.filter(item=>item.id!==winner.id);
    setActiveItems(updated);
    setSkipCount(prev=>prev+1);
    setShowResult(false);
    setWinner(null);
    setTrailerKey(null);
    setTimeout(()=>startSpin(),150);
  },[winner,skipCount,activeItems,startSpin]);

  const getActiveKey=useCallback((movie:Movie|null)=>{
    if(!movie)return null;
    return movie.trailerKey||movie.trailers?.find(t=>t.site==='YouTube'&&(t.type==='Trailer'||t.type==='Teaser'))?.key||movie.trailers?.find(t=>t.site==='YouTube')?.key||null;
  },[]);

  const fetchTrailer=useCallback(async(movie:Movie|null)=>{
    if(!movie)return null;

    const existingKey=getActiveKey(movie);
    if(existingKey){
      setTrailerKey(existingKey);
      return existingKey;
    }

    setTrailerLoading(true);
    setTrailerKey(null);

    try{
      const type=movie.mediaType?.toLowerCase()==='tv'||movie.mediaType?.toLowerCase()==='series'?'tv':'movie';
      const id=movie.movieId||movie.id;
      const url=`https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${API_KEY}&language=en-US`;

      const response=await fetch(url);
      if(!response.ok)throw new Error(`TMDB request failed: ${response.status}`);

      const data=await response.json();
      const videos:Trailer[]=Array.isArray(data.results)?data.results:[];

      const youtubeVideos=videos.filter(video=>video.site==='YouTube'&&video.key);

      const selected=
        youtubeVideos.find(video=>video.type==='Trailer'&&video.official===true)||
        youtubeVideos.find(video=>video.type==='Trailer')||
        youtubeVideos.find(video=>video.type==='Teaser')||
        youtubeVideos[0];

      if(selected?.key){
        setTrailerKey(selected.key);
        return selected.key;
      }
    }catch(error){
      console.error('Trailer fetch failed:',error);
    }finally{
      setTrailerLoading(false);
    }

    return null;
  },[getActiveKey]);

  const getTrailerUrl=useCallback((key:string)=>{
    return`https://www.youtube.com/embed/${key}?autoplay=1&modestbranding=1&rel=0&playsinline=1`;
  },[]);

  const openTrailer=useCallback(async()=>{
    if(!winner)return;
    setShowTrailerModal(true);
    await fetchTrailer(winner);
  },[winner,fetchTrailer]);

  const openExternalYoutube=useCallback((movie:Movie|null)=>{
    if(!movie)return;

    const key=trailerKey||getActiveKey(movie);

    if(key){
      window.open(`https://www.youtube.com/watch?v=${key}`,'_blank','noopener,noreferrer');
    }else{
      const query=encodeURIComponent(`${movie.title||movie.name||''} official trailer`);
      window.open(`https://www.youtube.com/results?search_query=${query}`,'_blank','noopener,noreferrer');
    }
  },[trailerKey,getActiveKey]);

  useEffect(()=>{
    if(showResult&&winner){
      const timer=setTimeout(()=>triggerConfetti(),120);
      return()=>clearTimeout(timer);
    }
  },[showResult,winner,triggerConfetti]);

  useEffect(()=>{
    if(isOpen&&activeItems.length>0)startSpin();
  },[isOpen]);

  useEffect(()=>{
    if(!showTrailerModal){
      setTrailerKey(null);
      setTrailerLoading(false);
    }
  },[showTrailerModal]);

  if(!isOpen)return null;

  return(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] flex flex-col items-center justify-between py-6 overflow-hidden bg-black touch-none select-none w-screen h-screen min-h-screen font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif] antialiased">

      <div
        className="absolute inset-0 pointer-events-none z-0 transition-colors duration-1000"
        style={{
          background:showResult
            ?`radial-gradient(ellipse at center,${dominantColor},transparent 75%),#000000`
            :'radial-gradient(ellipse at top,rgba(245,158,11,0.12),transparent 70%),#000000'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/40 to-black"/>
      </div>

      <motion.div
        initial={{y:-15,opacity:0}}
        animate={{y:0,opacity:1}}
        className="relative text-center w-full px-6 z-10 shrink-0 mt-4 sm:mt-6"
      >
        <h2 className="text-2xl sm:text-5xl font-extrabold text-white tracking-tight uppercase">
          Watchlist <span className="bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_4px_15px_rgba(245,158,11,0.3)]">Roulette</span>
        </h2>
        <p className="text-white/50 mt-1 font-semibold tracking-widest uppercase text-[9px] sm:text-xs">Deciding your next cinematic choice</p>
      </motion.div>

      <div className="relative w-full flex items-center justify-center overflow-hidden my-auto z-10 h-[240px] sm:h-[340px]">

        <motion.div style={{scale:indicatorScale}} className="absolute top-1.5 z-50 text-amber-400 transform rotate-180 drop-shadow-[0_4px_12px_rgba(245,158,11,0.5)]">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg>
        </motion.div>

        <motion.div style={{scale:indicatorScale}} className="absolute bottom-1.5 z-50 text-amber-400 drop-shadow-[0_-4px_12px_rgba(245,158,11,0.5)]">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg>
        </motion.div>

        <div className="absolute rounded-[28px] z-40 border-2 border-amber-400/60 pointer-events-none bg-gradient-to-b from-amber-400/10 via-transparent to-amber-400/10 shadow-[0_0_35px_rgba(245,158,11,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all duration-300 w-[131px] h-[187px] sm:w-[196px] sm:h-[281px]"/>

        <div className="absolute left-0 w-full overflow-visible flex items-center justify-start h-full">
          <motion.div className="flex will-change-transform transform-gpu gap-[10px] sm:gap-[16px]" style={{x:xOffset}}>
            {reelItems.map((item,idx)=>(
              <div
                key={`${item.id}-${idx}`}
                className="relative shrink-0 overflow-hidden bg-gradient-to-b from-white/[0.14] via-white/[0.04] to-transparent border border-white/20 shadow-[0_12px_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-3xl transition-all duration-500 rounded-[24px] w-[125px] h-[181px] sm:w-[190px] sm:h-[275px]"
                style={{opacity:isSpinning?0.5:1,scale:isSpinning?0.95:1}}
              >
                {getPosterSrc(item)?(
                  <img
                    src={getPosterSrc(item)}
                    alt=""
                    className="w-full h-full object-cover select-none pointer-events-none"
                    loading="lazy"
                    onError={e=>{e.currentTarget.style.display='none';}}
                  />
                ):(
                  <div className="w-full h-full flex items-center justify-center p-3 text-center text-[10px] sm:text-xs font-semibold text-white/50 bg-black/60">
                    {item.title||item.name}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none"/>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="h-6 w-full shrink-0 z-0 pointer-events-none"/>

      <AnimatePresence>
        {showResult&&winner&&(
          <motion.div
            initial={{opacity:0}}
            animate={{opacity:1}}
            exit={{opacity:0}}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto"
          >
            <canvas ref={modalCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[130]"/>

            <motion.div
              initial={{scale:0.96,y:15,opacity:0}}
              animate={{scale:1,y:0,opacity:1}}
              exit={{scale:0.96,y:15,opacity:0}}
              transition={{type:'spring',damping:26,stiffness:220}}
              className="w-full max-w-[340px] sm:max-w-[380px] bg-gradient-to-b from-white/[0.16] via-white/[0.06] to-transparent border border-white/25 rounded-[38px] p-5 sm:p-6 text-center shadow-[0_25px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-3xl relative overflow-hidden z-[120] my-auto flex flex-col justify-center items-center"
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white border border-white/20 backdrop-blur-xl transition-all z-[140] active:scale-90"
                aria-label="Close Reveal Layout"
              >
                <X className="w-4 h-4 stroke-[2.5]"/>
              </button>

              <div className="relative mx-auto mb-3.5 w-[125px] h-[181px] sm:w-[160px] sm:h-[230px] rounded-[22px] overflow-hidden border border-white/30 shadow-[0_12px_30px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.4)] bg-black shrink-0">
                {getPosterSrc(winner)?(
                  <img
                    src={getPosterSrc(winner)}
                    alt={winner.title||winner.name}
                    className="w-full h-full object-cover"
                  />
                ):(
                  <div className="w-full h-full bg-black/80"/>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10"/>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 backdrop-blur-md text-amber-300 text-[10px] font-bold tracking-wide uppercase mb-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                <Sparkles className="w-3 h-3 fill-amber-300 stroke-none"/>
                Winner Picked
              </div>

              <h3 className="text-lg sm:text-2xl font-bold text-white mb-2 tracking-tight line-clamp-2 px-1 leading-tight shrink-0">
                {winner.title||winner.name}
              </h3>

              <div className="flex items-center justify-center gap-3 mb-4 text-xs">
                <div className="flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-full border border-white/15 backdrop-blur-md">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 stroke-none"/>
                  <span className="text-white font-bold">{winner.vote_average?.toFixed(1)||'0.0'}</span>
                </div>
                <div className="w-px h-3 bg-white/20"/>
                <span className="text-white/60 font-medium tracking-wide">
                  {winner.releaseDate||winner.first_air_date
                    ?new Date(winner.releaseDate||winner.first_air_date||'').getFullYear()
                    :'N/A'}
                </span>
              </div>

              <div className="flex flex-col gap-2 w-full shrink-0">
                <button
                  onClick={()=>{
                    navigate(`/${winner.mediaType}/${winner.movieId}`);
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500 text-black font-extrabold text-xs sm:text-sm rounded-full transition-all shadow-[0_8px_20px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(0,0,0,0.2)] active:scale-[0.96]"
                >
                  <Play className="w-4 h-4 fill-black stroke-none"/>
                  Watch Selection
                </button>

                <div className="grid grid-cols-2 gap-2 w-full">
                  <button
                    onClick={openTrailer}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-full shadow-[0_4px_14px_rgba(220,38,38,0.4)] transition-all active:scale-[0.96]"
                    aria-label="Watch Trailer"
                  >
                    <Film className="w-3.5 h-3.5 stroke-[2.2]"/>
                    Watch Trailer
                  </button>

                  <button
                    onClick={handleSkip}
                    disabled={skipCount>=MAX_SKIPS||activeItems.length<=1}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 border text-xs font-bold rounded-full backdrop-blur-xl transition-all active:scale-[0.96] ${
                      skipCount>=MAX_SKIPS||activeItems.length<=1
                        ?'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                        :'bg-white/10 hover:bg-white/15 border-white/20 text-white'
                    }`}
                  >
                    <SkipForward className="w-3.5 h-3.5 stroke-[2.2]"/>
                    Skip ({MAX_SKIPS-skipCount})
                  </button>
                </div>

                <button
                  onClick={startSpin}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-5 bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white font-semibold text-xs rounded-full backdrop-blur-xl transition-all active:scale-[0.96]"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[2.2]"/>
                  Spin Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTrailerModal&&winner&&(
          <motion.div
            initial={{opacity:0}}
            animate={{opacity:1}}
            exit={{opacity:0}}
            className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl"
          >
            <div className="relative w-full max-w-3xl bg-black/80 border border-white/20 rounded-[28px] overflow-hidden shadow-2xl flex flex-col">

              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/60 backdrop-blur-md">
                <span className="text-white font-bold text-sm tracking-wide truncate pr-4">
                  {winner.title||winner.name} — Trailer
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={()=>openExternalYoutube(winner)}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold rounded-full transition-all border border-red-400/30 shadow-md active:scale-95"
                    title="Open on YouTube"
                  >
                    <span>YouTube</span>
                    <ArrowUpRightFromSquare className="w-3.5 h-3.5"/>
                  </button>

                  <button
                    onClick={()=>setShowTrailerModal(false)}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all active:scale-90"
                    aria-label="Close Trailer"
                  >
                    <X className="w-4 h-4"/>
                  </button>
                </div>
              </div>

              <div className="relative w-full aspect-video bg-black">
                {trailerLoading?(
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/60">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-red-500 rounded-full animate-spin mb-3"/>
                    <p className="text-sm font-medium">Fetching trailer...</p>
                  </div>
                ):trailerKey?(
                  <iframe
                    className="w-full h-full border-0"
                    src={getTrailerUrl(trailerKey)}
                    title={`${winner.title||winner.name} Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ):(
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/50">
                    <Film className="w-10 h-10 mb-2 opacity-50"/>
                    <p className="text-sm font-medium">Trailer not available directly.</p>
                    <button
                      onClick={()=>openExternalYoutube(winner)}
                      className="mt-3 text-red-400 hover:text-red-300 text-xs font-semibold underline underline-offset-2"
                    >
                      Search on YouTube instead
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WatchlistRoulette;
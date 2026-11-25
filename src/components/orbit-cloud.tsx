"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { TextSizeButton, usePreferences } from "@/components/preferences";
import { EyeOff, X, Orbit } from "lucide-react";
import { limitConceptsByLayer } from "@/lib/bubble-limit";
import { countSupporters } from "@/lib/supporters";
import { detailForConcept, type ThemeRef } from "@/lib/concept-detail";
import { bubbleTypography } from "@/lib/bubble-type";
import { fitSpeechCluster } from "@/lib/bubble-pack";
import { type PlacedWord } from "@/lib/wordcloud";
import type { Concept } from "@/lib/types";
import type { CloudQuote } from "@/components/word-cloud";
import { INK_THEME_COLORS as colors } from "@/lib/colors";

const keyOf = (word: Concept) => `${word.text}:${word.themeId ?? ""}`;

export function OrbitCloud({ readOnly = false, focusRequest, onFocusHandled, concepts, themeIds, quotes = [], themes = [], pickedKey = null, onPick, onHide, busy = false, animationHistory, animationScope = "" }: {
  readOnly?: boolean;
  focusRequest?: {key:string;sequence:number}|null; onFocusHandled?:()=>void;
  concepts: Concept[]; themeIds: string[]; quotes?: CloudQuote[]; themes?: ThemeRef[];
  pickedKey?: string | null; onPick?: (key: string | null) => void;
  onHide?: (id: string) => void; busy?: boolean;
  animationHistory?: Set<string>; animationScope?: string;
}) {
  const {t} = usePreferences();
  const frame = useRef<HTMLDivElement>(null);
  const [localHistory] = useState(() => new Set<string>());
  const history = animationHistory ?? localHistory;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [layout, setLayout] = useState<{ words: PlacedWord[]; height: number; width: number; pages: number }>({ words: [], height: 0, width: 0, pages: 1 });
  const [depth, setDepth] = useState(0);
  const [bubbleLimits, setBubbleLimits] = useState<ReadonlyMap<string | null, number>>(() => new Map());
  const [depthHint, setDepthHint] = useState<number | null>(null);
  const railDrag = useRef<{y:number; moved:boolean} | null>(null);
  const railSuppress = useRef(false);
  const flight = useRef<number>(0);
  const [reduced, setReduced] = useState(false);
  const drag = useRef<{x:number; scroll:number; moved:boolean} | null>(null);
  const suppressClick = useRef(false);
  const [localPick, setLocalPick] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer=useRef<ReturnType<typeof setTimeout> | null>(null);
  const signature = JSON.stringify(concepts.map(word=>{
    const matches=detailForConcept(word,quotes,themes);
    return {...word,weight:word.supporterCount ?? (matches.direct?countSupporters(matches.quotes):0)};
  }));
  const allConcepts = useMemo(() => JSON.parse(signature) as Concept[], [signature]);
  const dimensionSignature = JSON.stringify([...new Set([...themeIds,...allConcepts.map(word=>word.themeId)])].filter(id=>allConcepts.some(word=>word.themeId===id)));
  const dimensions = useMemo(()=>JSON.parse(dimensionSignature) as (string|null)[],[dimensionSignature]);
  const currentDimension = dimensions[Math.min(dimensions.length - 1, Math.max(0, depthHint ?? Math.round(depth)))] ?? null;
  const layerTotal = allConcepts.filter(word => word.themeId === currentDimension).length;
  const visibleCount = Math.min(layerTotal, bubbleLimits.get(currentDimension) ?? layerTotal);
  const stableConcepts = useMemo(() => limitConceptsByLayer(allConcepts, bubbleLimits), [allConcepts, bubbleLimits]);
  const active = onPick ? pickedKey : localPick;
  const choose = (key: string | null) => {
    if(closeTimer.current)clearTimeout(closeTimer.current);
    const commit=()=>{setClosing(false);if(onPick)onPick(key);else setLocalPick(key);};
    if(key===null&&active&&!reduced){setClosing(true);closeTimer.current=setTimeout(commit,180);}
    else commit();
  };
  useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
  // One idle bubble at a time; all interaction restarts the quiet interval.
  useEffect(() => {
    const map = frame.current;
    const cloud = map?.parentElement;
    if (!map || !cloud || reduced || active) return;
    let timer: ReturnType<typeof setTimeout>;
    let motion: Animation | null = null;
    const schedule = () => { timer = setTimeout(wobble, 8000 + Math.random() * 4000); };
    const wobble = () => {
      if (!document.hidden && !cloud.querySelector('.orbit-speech:hover, :focus-visible') && !drag.current && !railDrag.current) {
        const layer = Math.round(map.scrollTop / Math.max(1, map.clientHeight));
        const candidates = Array.from(map.querySelectorAll<HTMLButtonElement>(`[data-layer-index="${layer}"] .orbit-speech:not(.orbit-unseen):not(.orbit-node-enter)`))
          .filter(node => node.style.visibility !== "hidden");
        const node = candidates[Math.floor(Math.random() * candidates.length)];
        if (node) motion = node.animate([
          {translate:"0px 0px",rotate:"0deg"},
          {translate:"-2px 0px",rotate:"-1deg",offset:.25},
          {translate:"2px 0px",rotate:"1deg",offset:.55},
          {translate:"-1px 0px",rotate:"-.4deg",offset:.8},
          {translate:"0px 0px",rotate:"0deg"},
        ], {duration:600,easing:"ease-in-out"});
      }
      schedule();
    };
    const interruptIdle = () => {clearTimeout(timer);motion?.cancel();motion=null;schedule();};
    const events = ["pointerdown","pointermove","pointerover","focusin","keydown","wheel"] as const;
    events.forEach(event=>cloud.addEventListener(event,interruptIdle,{passive:true}));
    map.addEventListener("scroll",interruptIdle,{passive:true});
    document.addEventListener("visibilitychange",interruptIdle);
    schedule();
    return ()=>{
      clearTimeout(timer);motion?.cancel();
      events.forEach(event=>cloud.removeEventListener(event,interruptIdle));
      map.removeEventListener("scroll",interruptIdle);
      document.removeEventListener("visibilitychange",interruptIdle);
    };
  }, [reduced, active, animationScope]);
  const selected = concepts.find(word => keyOf(word) === active);
  const detail = selected ? detailForConcept(selected, quotes, themes) : null;
  const colorOf = (id: string | null) => {
    const i=Math.max(0,dimensions.indexOf(id));
    return i<colors.length?colors[i]:`hsl(${(25+(i-colors.length)*137.508)%360} 75% 66%)`;
  };

  // The dock is fixed to the viewport, so CSS viewport-height guesses cannot
  // account for wrapped headings, larger text, or an expanded controls tray.
  useLayoutEffect(() => {
    const canvas = frame.current?.closest<HTMLElement>(".cloud-canvas");
    const shell = canvas?.closest<HTMLElement>(".orbit-shell");
    const dock = shell?.querySelector<HTMLElement>(".orbit-dock");
    if (!canvas || !shell || !dock) return;
    const previousHeight = canvas.style.height;
    const previousMinHeight = canvas.style.minHeight;
    let scheduled = 0;
    const measure = () => {
      scheduled = 0;
      const top = canvas.getBoundingClientRect().top;
      const dockTop = dock.getBoundingClientRect().top;
      const height = Math.max(0, Math.floor(dockTop - top - 28));
      canvas.style.minHeight = "0px";
      canvas.style.height = `${height}px`;
    };
    const schedule = () => {
      if (!scheduled) scheduled = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(dock);
    resize.observe(shell);
    shell.querySelectorAll(".desk-header,.desk-question").forEach(node => resize.observe(node));
    const attributes = new MutationObserver(schedule);
    attributes.observe(shell, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", schedule);
    measure();
    return () => {
      cancelAnimationFrame(scheduled);
      resize.disconnect();
      attributes.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      canvas.style.height = previousHeight;
      canvas.style.minHeight = previousMinHeight;
    };
  }, []);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const bounds = element.getBoundingClientRect();
      const w=Math.floor(bounds.width),h=Math.floor(bounds.height);
      setSize(previous=>previous.w===w && previous.h===h ? previous : {w,h});
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size.w < 40 || size.h < 40) return;
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      const mobile = size.w < 600;
      const maxWeight = Math.max(1, ...stableConcepts.map(word => word.weight));
      const minWeight = Math.min(maxWeight, ...stableConcepts.map(word => word.weight));
      const words: PlacedWord[] = [];
      // Every dimension shares one composition; changing focus never repacks it.
      const ordered=[...stableConcepts].sort((a,b)=>b.weight-a.weight||keyOf(a).localeCompare(keyOf(b)));
      const diameters=ordered.map(word=>{
        const ratio=maxWeight===minWeight?.5:(word.weight-minWeight)/(maxWeight-minWeight);
        const maximum=Math.min(mobile?154:225,size.h*.45,size.w*.43);
        const minimum=Math.min(maximum,mobile?78:88);
        return Math.round(minimum+(maximum-minimum)*Math.sqrt(ratio));
      });
      const cloudWidth=Math.min(size.w*.9, Math.max(340,Math.sqrt(diameters.reduce((sum,d)=>sum+d*d,0))*1.12)),cloudHeight=size.h*.82;
      // Different depths may overlap: size against the busiest single plane, not all planes combined.
      const planeIndices=dimensions.map(id=>ordered.flatMap((word,i)=>word.themeId===id?[i]:[]));
      const commonFit=Math.min(1,...planeIndices.map((indices,layer)=>{
        if(!indices.length)return 1;
        const fit=fitSpeechCluster(indices.map(i=>diameters[i]),cloudWidth,cloudHeight,5,layer,mobile);
        return fit[0].d/diameters[indices[0]];
      }));
      const circles=diameters.map(d=>({x:0,y:0,d:d*commonFit,page:0}));
      // Every plane has its own compact centre, including singleton themes.
      for(const [layer,id] of dimensions.entries()){
        const indices=ordered.flatMap((word,i)=>word.themeId===id?[i]:[]);
        if(!indices.length)continue;
        const local=fitSpeechCluster(indices.map(i=>circles[i].d),cloudWidth,cloudHeight,5,layer,mobile);
        const minX=Math.min(...local.map(c=>c.x)),maxX=Math.max(...local.map(c=>c.x+c.d));
        const minY=Math.min(...local.map(c=>c.y)),maxY=Math.max(...local.map(c=>c.y+c.d*.76));
        const phase=layer*2.3999632297;
        const centerX=cloudWidth/2+Math.cos(phase)*Math.min(30,size.w*.045);
        const centerY=cloudHeight/2+Math.sin(phase)*Math.min(24,size.h*.055);
        local.forEach((c,j)=>{
          circles[indices[j]]={...c,
            x:c.x+centerX-(minX+maxX)/2,
            y:c.y+centerY-(minY+maxY)/2};
        });
      }
      const left=Math.min(...circles.map(c=>c.x),cloudWidth),right=Math.max(0,...circles.map(c=>c.x+c.d));
      const top=Math.min(...circles.map(c=>c.y),cloudHeight),bottom=Math.max(0,...circles.map(c=>c.y+c.d*.76));
      const magnify=Math.min(mobile?1.35:1.65,size.w*.90/Math.max(1,right-left),size.h*.94/Math.max(1,bottom-top));
      circles.forEach(c=>{c.x=(c.x-left)*magnify;c.y=(c.y-top)*magnify;c.d*=magnify;});
      const offsetX=(size.w-(right-left)*magnify)/2,offsetY=(size.h-(bottom-top)*magnify)/2;
      ordered.forEach((word,i)=>{
        const {x,y,d}=circles[i];
        const layer=dimensions.indexOf(word.themeId);
        const fontSize=16;
        // Packing reserves the full speech-box footprint, including its tail.
        words.push({...word,x:x+offsetX+layer*size.w,y:y+offsetY,w:d,h:d*.76,fontSize});
      });
      const pages=Math.max(1,dimensions.length);
      setLayout({ words, height:size.h, width:pages * size.w, pages });
    };
    void document.fonts.ready.then(draw);
    return () => { cancelled = true; };
  }, [size, stableConcepts, dimensions]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReduced(query.matches); };
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const travel = (target:number,key:string|null=null) => {
    choose(null);cancelAnimationFrame(flight.current);
    const element=frame.current;if(!element)return;
    const from=element.scrollTop,to=Math.max(0,Math.min(layout.pages-1,target))*size.h;
    if(reduced || Math.abs(to-from)<2){element.scrollTop=to;choose(key);return;}
    const start=performance.now();
    const tick=(now:number)=>{const t=Math.min(1,(now-start)/650);element.scrollTop=from+(to-from)*(1-Math.pow(1-t,3));if(t<1)flight.current=requestAnimationFrame(tick);else choose(key);};
    flight.current=requestAnimationFrame(tick);
  };
  const handledFocus=useRef<object|null>(null);
  useEffect(()=>{
    if(!focusRequest || handledFocus.current===focusRequest || size.w<1 || size.h<1)return;
    const word=layout.words.find(item=>keyOf(item)===focusRequest.key);
    if(!word){
      const target = allConcepts.find(item=>keyOf(item)===focusRequest.key);
      if(target && bubbleLimits.has(target.themeId)){
        const restore=requestAnimationFrame(()=>setBubbleLimits(previous => {
          const next = new Map(previous); next.delete(target.themeId); return next;
        }));
        return ()=>cancelAnimationFrame(restore);
      }
      return;
    }
    const id=requestAnimationFrame(()=>{handledFocus.current=focusRequest;travel(Math.floor(word.x/size.w),focusRequest.key);onFocusHandled?.();});
    return ()=>cancelAnimationFrame(id);
    // A request is consumed once after layout is ready; polling must not replay navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[focusRequest,layout.words,size.w,size.h]);
  const navigate=(direction:number)=>travel(Math.round(depth)+direction);
  const interrupt=()=>{cancelAnimationFrame(flight.current);};
  useEffect(()=>()=>cancelAnimationFrame(flight.current),[]);
  const changeLimit = (delta: number) => {
    const next = Math.max(1, Math.min(layerTotal, visibleCount + delta));
    choose(null);
    setBubbleLimits(previous => {
      const updated = new Map(previous);
      if(next === layerTotal) updated.delete(currentDimension);
      else updated.set(currentDimension, next);
      return updated;
    });
  };
  return <div className="orbit-cloud orbit-ranked-cloud">
    <svg className="orbit-ambient" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g className="orbit-ambient-lines" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M790 -70C800 50 900 125 1060 135M-70 440C70 420 180 490 225 650"/>
        <path d="M913 54h27q12 0 12 12v7q0 12-12 12h-12l-10 8 2-8h-7q-12 0-12-12v-7q0-12 12-12ZM49 507h23q10 0 10 10v5q0 10-10 10H61l-9 7 2-7h-5q-10 0-10-10v-5q0-10 10-10Z"/>
      </g>
      <g className="orbit-ambient-dots" fill="currentColor"><circle cx="874" cy="35" r="2"/><circle cx="843" cy="115" r="1.8"/><circle cx="154" cy="516" r="2"/></g>
      <g className="orbit-ambient-gold"><circle cx="895" cy="91" r="1.8"/><circle cx="103" cy="475" r="1.8"/></g>
    </svg>
    <div className="orbit-depth-slider">
      <TextSizeButton/>
      <div className="orbit-slider-track"
        onMouseLeave={()=>setDepthHint(null)}
        onBlur={event=>{if(event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node))setDepthHint(null);}}
        onPointerDown={event=>{if(event.button!==0)return;railSuppress.current=false;railDrag.current={y:event.clientY,moved:false};}}
        onPointerMove={event=>{
          const start=railDrag.current;if(!start)return;
          if(Math.abs(event.clientY-start.y)>5)start.moved=true;
          if(!start.moved)return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const bounds=event.currentTarget.getBoundingClientRect();
          const value=Math.max(0,Math.min(1,(event.clientY-bounds.top-16)/(bounds.height-32)))*Math.max(0,dimensions.length-1);
          interrupt();choose(null);setDepthHint(Math.round(value));
          if(frame.current)frame.current.scrollTop=value*size.h;
        }}
        onPointerUp={()=>{railSuppress.current=!!railDrag.current?.moved;railDrag.current=null;}}
        onPointerCancel={()=>{railDrag.current=null;railSuppress.current=true;}}
        onClickCapture={event=>{if(railSuppress.current){event.preventDefault();event.stopPropagation();railSuppress.current=false;}}}>
        <div className="orbit-depth-ruler" aria-hidden="true">{dimensions.map((id,i)=><span key={id??"ungrouped"} style={{top:`${dimensions.length<2?50:i/(dimensions.length-1)*100}%`}}/>)}</div>
        <div className="orbit-dimension-stops">{dimensions.map((id,i)=>{
          const count=stableConcepts.filter(word=>word.themeId===id).length;
          const label=themes.find(theme=>theme.id===id)?.label??"Ungrouped";
          return <button type="button" key={id??"ungrouped"} className="orbit-depth-stop"
            aria-label={`${t(`Layer ${i+1} of ${dimensions.length}`, `第 ${i+1}／${dimensions.length} 層`)} · ${label}: ${count} ${t(count===1?"bubble":"bubbles","個氣泡")}`}
            aria-pressed={Math.round(depth)===i}
            onMouseEnter={()=>setDepthHint(i)}
            onFocus={()=>setDepthHint(i)}
            onClick={()=>{setDepthHint(i);travel(i);}}
            style={{top:`${dimensions.length<2?50:i/(dimensions.length-1)*100}%`,"--stop-color":colorOf(id)} as CSSProperties}>
            <i aria-hidden="true"/>
            {Math.round(depth)===i && <span className="orbit-layer-wave" aria-hidden="true"/>}
            <span className="orbit-layer-hint" aria-hidden="true">{t(`Layer ${i+1} / ${dimensions.length}`, `第 ${i+1}／${dimensions.length} 層`)}</span>
          </button>;
        })}</div>
        {depthHint !== null && <div className="orbit-depth-count orbit-count-controls is-visible" role="group"
          aria-label={t("Bubble count for this layer", "這一層的氣泡數量")}
          style={{top:dimensions.length<2?"50%":`calc(16px + (100% - 32px) * ${depthHint / (dimensions.length - 1)})`}}
          onPointerDown={event=>{event.stopPropagation();railSuppress.current=false;}}
          onPointerMove={event=>event.stopPropagation()}
          onClick={event=>event.stopPropagation()}>
          <button type="button" aria-label={t("Show more bubbles", "增加氣泡數量")} disabled={visibleCount>=layerTotal} onClick={()=>changeLimit(1)}>▲</button>
          <span role="status" aria-live="polite" aria-label={t(`${visibleCount} of ${layerTotal} bubbles shown`, `顯示 ${visibleCount} / ${layerTotal} 個氣泡`)}>{visibleCount}</span>
          <button type="button" aria-label={t("Show fewer bubbles", "減少氣泡數量")} disabled={visibleCount<=1} onClick={()=>changeLimit(-1)}>▼</button>
        </div>}
        <input className="orbit-depth-keyboard" type="range" aria-label={t("Depth","深度")} aria-orientation="vertical"
          aria-valuetext={`${Math.min(dimensions.length,Math.round(depth)+1)} of ${dimensions.length}`}
          min={0} max={Math.max(0,dimensions.length-1)} step={1} value={Math.round(depth)} disabled={dimensions.length<2}
          onChange={event=>{const value=Number(event.target.value);setDepthHint(value);travel(value);}}/>
      </div>
    </div>
    <div className="orbit-map orbit-depth-map" ref={frame} aria-label="Bubble depth space. Scroll down to explore deeper." tabIndex={0}
      onScroll={event=>setDepth(event.currentTarget.scrollTop/Math.max(1,size.h))} onWheel={()=>{interrupt();choose(null);}}
      onKeyDown={event=>{if(["ArrowDown","ArrowUp","PageDown","PageUp","Home"].includes(event.key)){event.preventDefault();if(event.key==="Home")travel(0);else navigate(event.key==="ArrowDown"||event.key==="PageDown"?1:-1);}}}
      onPointerDown={event=>{interrupt();suppressClick.current=false;if(event.pointerType==="mouse")drag.current={x:event.clientY,scroll:event.currentTarget.scrollTop,moved:false};}}
      onPointerMove={event=>{const start=drag.current;if(!start)return;const delta=event.clientY-start.x;if(Math.abs(delta)>6){start.moved=true;suppressClick.current=true;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.scrollTop=start.scroll-delta;}}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
      onClickCapture={event=>{if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;}}}>
      <div className="orbit-depth-track" style={{height:Math.max(1,layout.pages)*size.h||"100%"}}>
        <div className="orbit-depth-scene" style={{height:size.h||"100%"}}>
          <div className="orbit-depth-glow" aria-hidden="true"/>
          {Array.from({length:layout.pages},(_,layer)=>{
            const signedDistance=layer-depth;
            const distance=Math.abs(signedDistance);
            const focus=Math.exp(-distance*.85);
            const opacity=signedDistance<0 ? .10+.90*Math.exp(-distance*1.05) : .18+.82*focus;
            // Camera advances through planes: passed layers grow forward and fade.
            const planeWords=layout.words.filter(word=>Math.floor(word.x/Math.max(1,size.w))===layer);
            const left=Math.min(...planeWords.map(word=>word.x-layer*size.w),size.w/2);
            const right=Math.max(...planeWords.map(word=>word.x-layer*size.w+word.w),size.w/2);
            const top=Math.min(...planeWords.map(word=>word.y),size.h/2);
            const bottom=Math.max(...planeWords.map(word=>word.y+word.h),size.h/2);
            // Reserve room for the whole plane, including its forward depth zoom.
            const inset=18;
            const scale=Math.min(
              Math.max(.58,Math.min(1.48,1.08*Math.exp(-signedDistance*.16))),
              Math.max(1,size.w-inset*2)/Math.max(1,right-left),
              Math.max(1,size.h-inset*2)/Math.max(1,bottom-top),
            );
            const parallax=Math.tanh(signedDistance*.5);
            const fitShift=(desired:number,start:number,end:number,extent:number)=>Math.max(
              inset-(extent/2+(start-extent/2)*scale),
              Math.min(desired,extent-inset-(extent/2+(end-extent/2)*scale)),
            );
            const shiftX=fitShift(parallax*6,left,right,size.w);
            const shiftY=fitShift(-parallax*16,top,bottom,size.h);
            return <div key={layer} data-layer-index={layer} data-dimension={dimensions[layer]??"ungrouped"} className="orbit-depth-layer orbit-focus-layer" style={{
              opacity,zIndex:layout.words.some(word=>word.themeId===dimensions[layer]&&keyOf(word)===active)?150:Math.round(100-distance*10),
              transform:reduced?"none":`translate(${shiftX}px,${shiftY}px) scale(${scale})`,
              filter:`brightness(${.94+.12*focus}) saturate(${.85+.25*focus})`,
              "--depth-label-opacity":.035+.965*Math.exp(-distance*distance*1.6),
            } as CSSProperties}>
              {layout.words.filter(word=>Math.floor(word.x/Math.max(1,size.w))===layer).map((word,index)=><OrbitNode key={`${animationScope}:${keyOf(word)}`} rise={layout.height-word.y+word.h}
                word={{...word,x:word.x-layer*size.w}} color={colorOf(word.themeId)} selected={false} hidden={active===keyOf(word)}
                onSelect={()=>readOnly ? travel(layer) : active===keyOf(word)?choose(null):travel(layer,keyOf(word))}
                history={history} scope={`${animationScope}`} index={index} reduced={reduced}/>)}
            </div>;
          })}
          {!concepts.length&&<div className="orbit-empty"><Orbit size={40} strokeWidth={1}/><p>{t("A space for every voice.","讓每個想法都被看見")}</p><span>{t("Words appear here as responses arrive.","收到回應後，概念便會在這裡出現。")}</span></div>}
        </div>
      </div>
    </div>
    {selected && detail && <OrbitReadingView key={keyOf(selected)} concept={selected} quotes={detail.quotes}
      supporters={selected.supporterCount ?? (detail.direct?countSupporters(detail.quotes):0)}
      color={colorOf(selected.themeId)} closing={closing} reduced={reduced} busy={busy} onClose={()=>choose(null)} onHide={onHide}
      source={()=>Array.from(frame.current?.querySelectorAll<HTMLButtonElement>("[data-orbit-key]")??[]).find(node=>node.dataset.orbitKey===keyOf(selected))??null}/>}
  </div>;
}


function OrbitNode({ word, color, selected, onSelect, history, scope, index, rise, hidden=false, reading=false }: {
  word: PlacedWord; color: string; selected: boolean; onSelect: () => void;
  history: Set<string>; scope: string; index: number; rise: number; reduced: boolean; hidden?:boolean; reading?:boolean;
}) {
  const {fontScale} = usePreferences();
  const identity = `${scope}:${keyOf(word)}`;
  const surfaceId=useId();
  const node = useRef<HTMLButtonElement>(null);
  const [typography,setTypography]=useState({text:word.text,fontSize:16});
  useLayoutEffect(()=>{
    const element=node.current;
    const context=document.createElement("canvas").getContext("2d");
    if(!element||!context)return;
    const family=getComputedStyle(element).fontFamily;
    const update=()=>{
      const measure=(text:string,size:number)=>{
        context.font=`500 ${size}px ${family}`;
        return context.measureText(text).width;
      };
      const base=bubbleTypography(word.text,word.w,measure,word.h);
      setTypography(fontScale===1 ? base : bubbleTypography(word.text,word.w,measure,word.h,base.fontSize*fontScale));
    };
    update();
    document.fonts.addEventListener("loadingdone",update);
    return ()=>document.fonts.removeEventListener("loadingdone",update);
  },[word.text,word.w,word.h,fontScale]);
  const [revealed, setRevealed] = useState(() => history.has(identity));
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    const element=node.current;
    if (!element || reading || history.has(identity)) return;
    const observer=new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        history.add(identity); setRevealed(true); setEntering(true); observer.disconnect();
      }
    }, {root:element.closest(".orbit-map"),threshold:.25});
    observer.observe(element);
    return () => observer.disconnect();
  }, [history, identity, reading]);
  return <button ref={node} type="button" className={`orbit-node orbit-circle orbit-speech${!revealed && !reading ? " orbit-unseen" : ""}${entering ? " orbit-node-enter" : ""}`} data-orbit-key={reading?undefined:keyOf(word)} aria-label={word.text} title={`${word.text} · ${word.weight} students`} aria-pressed={selected} onClick={onSelect}
    onAnimationEnd={() => setEntering(false)}
    style={{visibility:hidden?"hidden":undefined,left:word.x, top:word.y, width:word.w, height:word.h, fontSize:typography.fontSize,
      "--node-color":color, "--enter-delay":`${400 + (index % 6) * 240}ms`, "--rise-distance":`${rise}px`, "--sway":`${index%2 ? -22 : 22}px`} as CSSProperties}>
      <svg className="orbit-speech-surface" style={{transform:index%2?"scaleX(-1)":undefined}} viewBox="0 0 200 136" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${surfaceId}-fill`} x1="0" y1="0" x2=".75" y2="1">
            <stop stopColor={color} stopOpacity=".82"/><stop offset=".52" stopColor={color} stopOpacity=".30"/><stop offset="1" stopColor={color} stopOpacity=".48"/>
          </linearGradient>
          <linearGradient id={`${surfaceId}-rim`} x1="0" y1="0" x2=".6" y2="1">
            <stop stopColor="#fff" stopOpacity=".95"/><stop offset=".5" stopColor={color}/><stop offset="1" stopColor="#fff" stopOpacity=".65"/>
          </linearGradient>
        </defs>
        <path d="M38 4H162Q196 4 196 38V82Q196 116 162 116H55C43 128 30 132 22 128C29 123 31 118 28 113Q4 107 4 82V38Q4 4 38 4Z" fill="#0c1628" fillOpacity=".92"/>
        <path d="M38 4H162Q196 4 196 38V82Q196 116 162 116H55C43 128 30 132 22 128C29 123 31 118 28 113Q4 107 4 82V38Q4 4 38 4Z"
          fill={`url(#${surfaceId}-fill)`} stroke={`url(#${surfaceId}-rim)`} strokeWidth="1.3" vectorEffect="non-scaling-stroke"/>
      </svg><span>{typography.text}</span></button>;
}



function OrbitReadingView({concept,quotes,supporters,color,closing,reduced,busy,onClose,onHide,source}:{
  concept:Concept;quotes:CloudQuote[];supporters:number;color:string;closing:boolean;reduced:boolean;busy:boolean;
  onClose:()=>void;onHide?: (id:string)=>void;source:()=>HTMLButtonElement|null;
}){
  const {t} = usePreferences();
  const dialog=useRef<HTMLDialogElement>(null);
  const bubble=useRef<HTMLDivElement>(null);
  const closeButton=useRef<HTMLButtonElement>(null);
  const sourceNode=useRef<HTMLButtonElement|null>(null);
  const [box,setBox]=useState({w:320,h:180});
  const [mirror,setMirror]=useState(false);
  const [history]=useState(()=>new Set<string>());
  const titleId=useId();
  useLayoutEffect(()=>{
    const element=dialog.current,hero=bubble.current;if(!element||!hero)return;
    sourceNode.current=source();
    setMirror(sourceNode.current?.querySelector<SVGElement>('svg')?.style.transform==='scaleX(-1)');
    element.showModal();
    closeButton.current?.focus();
    const previous=document.body.style.overflow;document.body.style.overflow="hidden";
    const resize=new ResizeObserver(()=>setBox({w:hero.clientWidth,h:hero.clientHeight}));
    resize.observe(hero);
    return ()=>{resize.disconnect();element.close();document.body.style.overflow=previous;requestAnimationFrame(()=>sourceNode.current?.focus({preventScroll:true}));};
    // Capture the selected source once; live response updates must not replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  return <dialog ref={dialog} className={`orbit-reader${closing?' is-closing':''}`} aria-labelledby={titleId}
    onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="orbit-reader-hero" ref={bubble}>
      <OrbitNode word={{...concept,x:0,y:0,w:box.w,h:box.h,fontSize:20}} color={color} selected={true} onSelect={onClose}
        history={history} scope="reader" index={mirror?1:0} rise={0} reduced={reduced} reading/>
    </div>
    <section className="orbit-reader-panel">
      <header><div className="orbit-reader-heading"><h2 id={titleId}>{t("Student responses","學生回應")}</h2><span>{supporters} {t("students","位學生")} · {quotes.length} {t("responses","則回應")}</span></div><button ref={closeButton} className="orbit-reader-close" aria-label={t("Close responses","關閉回應")} onClick={onClose}><X size={22}/><span className="orbit-action-tooltip" aria-hidden="true">{t("Close","關閉")}</span></button></header>
      <div className="orbit-reader-scroll" tabIndex={0} role="region" aria-label={t("All related responses","所有相關學生回應")}>
        {quotes.length ? <ol className="orbit-reader-grid">{quotes.map((quote,index)=><li key={quote.id}>
          <span className="orbit-reader-number" aria-label={`${t("Response","回應")} ${index+1}`}>{String(index+1).padStart(2,'0')}</span><p>{quote.text}</p><div className="orbit-reader-card-head">
            {onHide&&<button aria-label={`${t("Hide response","隱藏回應")} ${index+1}`} disabled={busy||closing} onClick={()=>onHide(quote.id)}><EyeOff size={17}/><span className="orbit-action-tooltip" aria-hidden="true">{t("Hide","隱藏")}</span></button>}
          </div>
        </li>)}</ol>:<p className="orbit-reader-empty">{t("No responses to display yet.","暫時沒有可顯示的回應。")}</p>}
      </div>
    </section>
  </dialog>;
}

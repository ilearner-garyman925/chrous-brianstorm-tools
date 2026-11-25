/** Word-aware, balanced lines measured in the same font as the rendered bubble. */
export function bubbleTypography(text: string, diameter: number, measure: (text: string, size: number) => number, boxHeight?:number, fixedFontSize?:number) {
  const width=diameter*(boxHeight !== undefined ? .78 : .70), height=boxHeight !== undefined ? boxHeight*.66 : diameter*.66;
  const minimum=fixedFontSize ?? 14, maximum=fixedFontSize ?? Math.min(22,Math.max(minimum,Math.round(diameter*.105)));
  const raw=Array.from(new Intl.Segmenter("zh",{granularity:"word"}).segment(text),part=>part.segment);
  const wrap=(font:number)=>{
    const tokens:string[]=[];
    for(const token of raw){
      if(/^[，。！？、；：,.!?;:…）】」』]+$/u.test(token)&&tokens.length)tokens[tokens.length-1]+=token;
      else if(font===minimum&&measure(token,font)>width){
        // Tiny bubbles abbreviate an oversized word rather than fragmenting it across lines.
        let short=token;
        while(short&&measure(short+"…",font)>width)short=Array.from(short).slice(0,-1).join("");
        tokens.push(short+"…");
      }
      else tokens.push(token);
    }
    const greedy:string[]=[];
    let line="";
    for(const token of tokens){
      if(line.trim()&&measure((line+token).trim(),font)>width){greedy.push(line.trim());line=token.trimStart();}
      else line+=token;
    }
    if(line.trim())greedy.push(line.trim());
    // Balance at word boundaries, without splitting Chinese phrases or English words.
    const target=measure(text,font)/Math.max(1,greedy.length);
    const memo=new Map<string,{cost:number;lines:string[]}>();
    const solve=(start:number,count:number):{cost:number;lines:string[]}=>{
      if(start===tokens.length)return {cost:count===0?0:Infinity,lines:[]};
      if(count===0)return {cost:Infinity,lines:[]};
      const key=`${start}:${count}`;
      const cached=memo.get(key);if(cached)return cached;
      let best={cost:Infinity,lines:[] as string[]},candidate="";
      for(let end=start;end<tokens.length;end++){
        candidate+=tokens[end];
        const clean=candidate.trim(),length=measure(clean,font);
        if(length>width)break;
        if(!clean)continue;
        const rest=solve(end+1,count-1),cost=(length-target)**2+rest.cost;
        if(cost<best.cost)best={cost,lines:[clean,...rest.lines]};
      }
      memo.set(key,best);return best;
    };
    return solve(0,greedy.length).lines.length?solve(0,greedy.length).lines:greedy;
  };
  for(let font=maximum;font>=minimum;font--){
    const lines=wrap(font);
    if(lines.length*font*1.4<=height&&lines.every(line=>measure(line,font)<=width))return {text:lines.join("\n"),fontSize:font};
  }
  const lines=wrap(minimum),capacity=Math.max(1,Math.floor(height/(minimum*1.4)));
  const visible=lines.slice(0,capacity);
  if(lines.length>capacity){
    let last=visible[visible.length-1]||"";
    const original=last;
    while(last&&measure(last+"…",minimum)>width)last=Array.from(last).slice(0,-1).join("");
    // Avoid showing half of an English word at the truncation point.
    if(last!==original)last=last.replace(/\s+[a-z]+$/iu,"").trimEnd();
    visible[visible.length-1]=last+"…";
  }
  return {text:visible.join("\n"),fontSize:minimum};
}

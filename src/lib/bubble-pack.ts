/** First-fit circle packing: earlier canvases are backfilled before adding another. */
export function packBubbles(diameters: number[], width: number, height: number, gap = 12) {
  const pages: {x:number;y:number;d:number}[][] = [[]];
  let seed = 937;
  const random = () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  const inset = 10;
  const circles = diameters.map(d => {
    for(let page=0;;page++) {
      if(!pages[page]) pages.push([]);
      const placed=pages[page];
      const maxX=Math.max(inset,width-d-inset), maxY=Math.max(inset,height-d-inset);
      const fits=(x:number,y:number) => placed.every(o => Math.hypot(x+d/2-o.x-o.d/2,y+d/2-o.y-o.d/2) >= (d+o.d)/2+gap);
      let point: {x:number;y:number}|undefined;
      // Random candidates keep the result organic. A fine scan finds narrow remaining pockets.
      for(let attempt=0;attempt<1000;attempt++) {
        const x=inset+random()*(maxX-inset),y=inset+random()*(maxY-inset);
        if(fits(x,y)){point={x,y};break;}
      }
      if(!point) {
        const step=4;
        scan: for(let y=inset;y<=maxY;y+=step) for(let x=inset;x<=maxX;x+=step) {
          if(fits(x,y)){point={x,y};break scan;}
        }
      }
      if(point) {
        placed.push({...point,d});
        return {x:point.x+page*width,y:point.y,d,page};
      }
    }
  });
  return {circles,pages:pages.length};
}

/** Keep higher-count centers above lower-count centers in each depth plane. */
export function packRankedBubbles(diameters:number[], counts:number[], width:number,height:number,gap=12,rankGap=0){
  const circles:{x:number;y:number;d:number;page:number}[]=[];
  let page=0, floor=0, previous=Infinity;
  for(let i=0;i<diameters.length;i++){
    const d=diameters[i],r=d/2;
    if(i>0&&counts[i]<previous) floor=Math.max(floor,...circles.filter(c=>c.page===page).map(c=>c.y+c.d/2))+rankGap;
    let point:{x:number;y:number}|undefined;
    while(!point){
      const peers=circles.filter(c=>c.page===page);
      search: for(let cy=Math.max(10+r,floor);cy<=height-10-r;cy+=4){
        // Alternate the search direction and offset to avoid aligned columns.
        const offset=(i*37)%29;
        for(let k=0;k<Math.ceil((width-d-20)/4)+1;k++){
          const raw=10+((k*4+offset)%Math.max(1,width-d-20));
          const x=i%2?width-d-raw:raw,y=cy-r;
          if(peers.every(c=>Math.hypot(x+r-(c.x-page*width)-c.d/2,cy-c.y-c.d/2)>=(d+c.d)/2+gap)){point={x,y};break search;}
        }
      }
      if(!point){page++;floor=0;}
    }
    circles.push({...point,x:point.x+page*width,d,page});
    previous=counts[i];
  }
  return {circles,pages:page+1};
}

/** A dimension is always one plane; reduce its bubbles together when space is tight. */
export function fitRankedPlane(diameters:number[],counts:number[],width:number,height:number,gap=12){
  let factor=1;
  for(let attempt=0;attempt<60;attempt++){
    const packed=packRankedBubbles(diameters.map(d=>d*factor),counts,width,height,gap*factor,Math.min(40,height/(new Set(counts).size+2))*factor);
    if(packed.pages===1)return packed.circles;
    factor*=.9;
  }
  throw new Error("Unable to fit dimension into its depth plane");
}

/** Grow an organic cluster from its centre, rather than filling rows edge to edge. */
export function fitSpeechCluster(widths:number[],width:number,height:number,gap=5,seed=0,vertical=false){
  if(!widths.length)return [];
  for(let attempt=0;attempt<60;attempt++){
    const factor=.92**attempt;
    if(widths.length===2){
      const [a,b]=widths.map(d=>d*factor),ah=a*.76,bh=b*.76;
      const clearance=gap*factor+(a+b)*.028;
      const stagger=Math.min(ah,bh)*.19;
      if(!vertical&&a+b+clearance<=width-16&&Math.max(ah,bh)+stagger<=height-16){
        const left=(width-a-b-clearance)/2,top=(height-Math.max(ah,bh)-stagger)/2;
        return [{x:left,y:top+(seed%2?stagger:0),d:a,page:0},
          {x:left+a+clearance,y:top+(seed%2?0:stagger),d:b,page:0}];
      }
      const sideways=Math.min(a,b)*.16;
      if(Math.max(a,b)+sideways<=width-16&&ah+bh+clearance<=height-16){
        const left=(width-Math.max(a,b)-sideways)/2,top=(height-ah-bh-clearance)/2;
        return [{x:left+sideways,y:top,d:a,page:0},
          {x:left,y:top+ah+clearance,d:b,page:0}];
      }
      continue;
    }
    const placed:{x:number;y:number;d:number;page:number}[]=[];
    for(let i=0;i<widths.length;i++){
      const d=widths[i]*factor,h=d*.76;
      let point:{x:number;y:number}|undefined;
      for(let k=0;k<5000;k++){
        const angle=k*2.3999632297+seed*.61+i*.43,radius=5*Math.sqrt(k);
        const x=width/2+Math.cos(angle)*radius-d/2,y=height/2+Math.sin(angle)*radius-h/2;
        if(x<8||y<8||x+d>width-8||y+h>height-8)continue;
        if(placed.every(c=>{
          // Full rectangular footprint includes the tail and room for hover enlargement.
          const clearance=gap*factor+(d+c.d)*.028;
          const separated=x+d+clearance<=c.x||c.x+c.d+clearance<=x||y+h+clearance<=c.y||c.y+c.d*.76+clearance<=y;
          const staggered=Math.abs(x+d/2-c.x-c.d/2)>Math.min(d,c.d)*.10&&Math.abs(y+h/2-c.y-c.d*.38)>Math.min(h,c.d*.76)*.12;
          return separated&&staggered;
        })){point={x,y};break;}
      }
      if(!point)break;
      placed.push({...point,d,page:0});
    }
    if(placed.length===widths.length)return placed;
  }
  throw new Error("Unable to fit speech boxes");
}

export function fitCompactCluster(diameters:number[],width:number,height:number,gap=9){
  if(!diameters.length)return [];
  for(let attempt=0;attempt<60;attempt++){
    const factor=Math.pow(.92,attempt);
    const placed:{x:number;y:number;d:number;page:number}[]=[];
    let failed=false;
    for(let i=0;i<diameters.length;i++){
      const d=diameters[i]*factor,r=d/2;
      let point:{x:number;y:number}|undefined;
      for(let k=0;k<2400;k++){
        const angle=k*2.399963229728653+i*.43;
        const radius=6*Math.sqrt(k);
        const x=width/2+Math.cos(angle)*radius*1.22-r;
        const y=height/2+Math.sin(angle)*radius-r;
        if(x<6||y<6||x+d>width-6||y+d>height-6)continue;
        if(placed.every(c=>Math.hypot(x+r-c.x-c.d/2,y+r-c.y-c.d/2)>=(d+c.d)/2+gap*factor)){
          point={x,y};break;
        }
      }
      if(!point){failed=true;break;}
      placed.push({...point,d,page:0});
    }
    if(!failed)return placed;
  }
  throw new Error("Unable to fit compact cloud");
}

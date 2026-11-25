import {describe,it,expect} from "vitest";
import {packBubbles,packRankedBubbles,fitRankedPlane,fitCompactCluster} from "./bubble-pack";
describe("bubble packing",()=>{
  for(const [width,height] of [[1197,416],[343,500]]) it(`keeps every circle within ${width}px canvases without overlap`,()=>{
    const ds=Array.from({length:28},(_,i)=>i%2 ? 78 : Math.min(187,width*.43));
    const result=packBubbles(ds,width,height,12);
    expect(result.circles).toHaveLength(28);
    result.circles.forEach((a,i)=>{
      expect(a.x-a.page*width).toBeGreaterThanOrEqual(10);
      expect(a.x-a.page*width+a.d).toBeLessThanOrEqual(width-10);
      expect(a.y+a.d).toBeLessThanOrEqual(height-10);
      result.circles.slice(i+1).filter(b=>b.page===a.page).forEach(b=>expect(Math.hypot(a.x+a.d/2-b.x-b.d/2,a.y+a.d/2-b.y-b.d/2)).toBeGreaterThanOrEqual((a.d+b.d)/2+12));
    });
    expect(result).toEqual(packBubbles(ds,width,height,12));
  });
  it("fits more than six bubbles when space permits",()=>{
    const result=packBubbles(Array(12).fill(88),1197,416);
    expect(result.pages).toBe(1);
  });
  it("backfills small bubbles into earlier canvases",()=>{
    const result=packBubbles([180,180,180,40],300,300,10);
    expect(result.circles[2].page).toBeGreaterThan(0);
    expect(result.circles[3].page).toBe(0);
  });
});

it("ranks centers by response count without overlap",()=>{
  for(const width of [343,1197]){
    const counts=[8,7,6,5,4,3,2,1,0];
    const {circles}=packRankedBubbles(counts.map(n=>78+n*8),counts,width,416);
    circles.forEach((a,i)=>circles.slice(i+1).forEach(b=>{
      if(a.page===b.page){
        expect(a.y+a.d/2).toBeLessThanOrEqual(b.y+b.d/2);
        expect(Math.hypot(a.x+a.d/2-b.x-b.d/2,a.y+a.d/2-b.y-b.d/2)).toBeGreaterThanOrEqual((a.d+b.d)/2+12);
      }
    }));
  }
});

it("keeps a crowded dimension on a single depth plane",()=>{
  const ds=Array.from({length:18},(_,i)=>150-i*3);
  const circles=fitRankedPlane(ds,ds,311,416);
  expect(circles).toHaveLength(ds.length);
  expect(new Set(circles.map(c=>c.page))).toEqual(new Set([0]));
  circles.forEach((a,i)=>{
    expect(a.x+a.d).toBeLessThanOrEqual(311);
    expect(a.y+a.d).toBeLessThanOrEqual(416);
    circles.slice(i+1).forEach(b=>expect(Math.hypot(a.x+a.d/2-b.x-b.d/2,a.y+a.d/2-b.y-b.d/2)).toBeGreaterThanOrEqual((a.d+b.d)/2));
  });
});

describe("compact cluster",()=>{
 for(const [width,height] of [[600,320],[300,400]])it(`preserves ratios without collisions at ${width}px`,()=>{
  const diameters=[180,145,110,110,110,110,80,80,80,80,80,80,80];
  const circles=fitCompactCluster(diameters,width,height);
  expect(circles).toHaveLength(diameters.length);
  const factor=circles[0].d/diameters[0];
  circles.forEach((a,i)=>{
   expect(a.d/diameters[i]).toBeCloseTo(factor);
   expect(a.x).toBeGreaterThanOrEqual(0);expect(a.y).toBeGreaterThanOrEqual(0);
   expect(a.x+a.d).toBeLessThanOrEqual(width);expect(a.y+a.d).toBeLessThanOrEqual(height);
   circles.slice(i+1).forEach(b=>expect(Math.hypot(a.x+a.d/2-b.x-b.d/2,a.y+a.d/2-b.y-b.d/2)).toBeGreaterThanOrEqual((a.d+b.d)/2));
  });
 });
});

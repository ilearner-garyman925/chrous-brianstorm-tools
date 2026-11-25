import {describe,it,expect} from 'vitest';
import {fitSpeechCluster} from './bubble-pack';
describe('speech box packing',()=>{
 it('staggers a desktop pair vertically and keeps it close',()=>{
  const [a,b]=fitSpeechCluster([225,225],1050,340,5,3);
  expect(Math.abs(a.y-b.y)).toBeGreaterThan(20);
  expect(b.x-a.x-a.d).toBeLessThan(20);
 });
 it('staggers a mobile pair sideways without overlapping',()=>{
  const [a,b]=fitSpeechCluster([154,154],300,405,5,3);
  expect(Math.abs(a.x-b.x)).toBeGreaterThan(15);
  expect(b.y).toBeGreaterThan(a.y+a.d*.76);
 });
 for(const [width,height] of [[1050,340],[340,405]]){
  for(const sizes of [[225,225],[154,154],[90,90,90,90,90],[225,150,90,80,70,65,60]]){
   it(`keeps ${sizes.length} boxes apart in ${width}px`,()=>{
    const boxes=fitSpeechCluster(sizes,width,height,14,3);
    expect(boxes).toHaveLength(sizes.length);
    boxes.forEach((a,i)=>{
     expect(a.d/sizes[i]).toBeCloseTo(boxes[0].d/sizes[0]);
     expect(a.x).toBeGreaterThanOrEqual(0);expect(a.y).toBeGreaterThanOrEqual(0);
     expect(a.x+a.d).toBeLessThanOrEqual(width);expect(a.y+a.d*.76).toBeLessThanOrEqual(height);
     boxes.slice(i+1).forEach(b=>{
      const gap=(a.d+b.d)*.028;
      expect(a.x+a.d+gap<=b.x||b.x+b.d+gap<=a.x||a.y+a.d*.76+gap<=b.y||b.y+b.d*.76+gap<=a.y).toBe(true);
     });
    });
   });
  }
 }
});

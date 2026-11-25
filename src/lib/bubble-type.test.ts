import {describe,it,expect} from "vitest";
import {bubbleTypography} from "./bubble-type";
const measure=(text:string,size:number)=>Array.from(text).reduce((sum,char)=>sum+(/[\p{Script=Han}]/u.test(char)?size:size*.5),0);
describe("bubble concept typography",()=>{
  it("fits a full Chinese concept inside a mobile speech box without entering its tail",()=>{
    const text="先完成自己的文章，再參考人工智能的建議修改內容與表達方式";
    const result=bubbleTypography(text,240,measure,240*.68);
    expect(result.text.replaceAll("\n","")).toBe(text);
    expect(result.text.split("\n").length*result.fontSize*1.4).toBeLessThanOrEqual(240*.68*.66);
    result.text.split("\n").forEach(line=>expect(measure(line,result.fontSize)).toBeLessThanOrEqual(240*.78));
  });
  it("fits a full Chinese concept in a reading-size bubble",()=>{
    const text="希望每位同學都能使用相同工具，不會因為付費方案而影響學習機會";
    const result=bubbleTypography(text,196,measure);
    expect(result.text.replaceAll("\n","")).toBe(text);
    const lines=result.text.split("\n");
    expect(lines.length*result.fontSize*1.4).toBeLessThanOrEqual(196*.66);
    lines.forEach(line=>{expect(measure(line,result.fontSize)).toBeLessThanOrEqual(196*.7);expect(line).not.toMatch(/^[，。！？]/);});
  });
  it("keeps English words intact when balancing lines",()=>{
    const text="Keep our own voice when using AI feedback";
    const result=bubbleTypography(text,220,measure);
    expect(result.text.split(/\s+/)).toEqual(text.split(/\s+/));
  });
  it("uses an explicit summary instead of tiny text for small bubbles",()=>{
    const result=bubbleTypography("希望每位同學都能使用相同工具，不會因為付費方案而影響學習機會",78,measure);
    expect(result.fontSize).toBeGreaterThanOrEqual(14);
    expect(result.text.endsWith("…")).toBe(true);
    expect(result.text.split("\n").length*result.fontSize*1.4).toBeLessThanOrEqual(78*.66);
  });
});

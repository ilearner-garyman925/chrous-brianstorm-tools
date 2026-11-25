import {describe,it,expect} from "vitest";
import {countSupporters} from "./supporters";
import {detailForConcept} from "./concept-detail";
import {demoConcepts} from "./demo-concepts";
import {SAMPLE_LINES} from "./sample";
describe("distinct concept supporters",()=>{
 it("counts repeated responses from one student once, separately in each concept",()=>{
  const quotes=[{id:"a",text:"same idea",participantId:"p1"},{id:"b",text:"another wording",participantId:"p1"},{id:"c",text:"agree",participantId:"p2"}];
  const detail=detailForConcept({text:"summary",themeId:null,responseIds:["a","b","c"]},quotes,[]);
  expect(detail.quotes).toHaveLength(3);
  expect(countSupporters(detail.quotes)).toBe(2);
  expect(countSupporters(detailForConcept({text:"second idea",themeId:null,responseIds:["b"]},quotes,[]).quotes)).toBe(1);
  expect(countSupporters(detailForConcept({text:"summary",themeId:null,responseIds:["a","b","c"]},quotes.slice(0,2),[]).quotes)).toBe(1);
 });
 it("keeps unnamed students distinct by ID and never guesses missing identities",()=>{
  expect(countSupporters([{participantId:"anon1"},{participantId:"anon2"},{participantId:"anon1"},{}])).toBe(2);
 });
 it("demo groups retain source responses and exclude custom user text",()=>{
  const quotes=SAMPLE_LINES.map((line,i)=>({id:String(i),text:line.text,participantId:line.who}));
  const concepts=demoConcepts([...quotes,{id:"custom",text:"A real new comment",participantId:"p"}],[]);
  expect(concepts).toHaveLength(11);
  expect(concepts.every(c=>!c.responseIds?.includes("custom"))).toBe(true);
  const counts=concepts.map(c=>countSupporters(detailForConcept(c,quotes,[]).quotes));
  expect(new Set(SAMPLE_LINES.map(line=>line.who)).size).toBe(30);
  expect(counts).toEqual([15,3,8,3,3,3,15,8,3,1,3]);
  const aside = SAMPLE_LINES.filter(line=>line.facet==="aside");
  expect(aside.every(line=>SAMPLE_LINES.filter(other=>other.text===line.text).length===1)).toBe(true);
  expect(concepts.some(c=>c.responseIds!.length>countSupporters(detailForConcept(c,quotes,[]).quotes))).toBe(true);
 });
});

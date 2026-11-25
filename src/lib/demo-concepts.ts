import { SAMPLE_LINES, CHINESE_DEMO_CONCEPTS, type SampleFacet } from "@/lib/sample";
import type { Concept, Theme } from "@/lib/types";

// Curated mock semantic grouping ONLY for the shipped sample responses.
// Counts still come from real distinct demo participants, never invented weights.
const labels: Partial<Record<SampleFacet,string>> = {
 feedback:"Feedback on our drafts", literacy:"Check AI sources", access:"Equal access to AI",
 voice:"Keep our own voice", brainstorm:"Help with a blank page", dependency:"Think before using AI",
};
export function demoConcepts(items:{id:string;text:string}[], themes:Theme[]):Concept[] {
 const result:Concept[]=[];
 const chineseTexts=new Set<string>(CHINESE_DEMO_CONCEPTS.map(concept=>concept.text));
 const groups=[...Object.entries(labels).map(([facet,text])=>({text,originals:new Set(SAMPLE_LINES.filter(line=>line.facet===facet&&!chineseTexts.has(line.text)).map(line=>line.text))})),
  ...CHINESE_DEMO_CONCEPTS.map(concept=>({text:concept.text,originals:new Set<string>([concept.text])}))];
 for(const {text,originals} of groups){
  const responses=items.filter(item=>originals.has(item.text));
  if(!responses.length)continue;
  const ranked=[...themes].sort((a,b)=>responses.filter(r=>b.responseIds.includes(r.id)).length-responses.filter(r=>a.responseIds.includes(r.id)).length);
  result.push({text,weight:1,themeId:ranked[0]?.id??null,responseIds:responses.map(r=>r.id)});
 }
 return result;
}

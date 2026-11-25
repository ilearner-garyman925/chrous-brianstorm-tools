import {describe,it,expect} from "vitest";
import {conceptPhrase,phraseConcepts} from "./concept-phrases";
import {detailForConcept} from "./concept-detail";
import {tokenize} from "./text";
describe("short concept phrases",()=>{
 it("keeps negation and Chinese text",()=>{
  expect(conceptPhrase("Do not use AI for exams. Explain your reasoning.")).toBe("Do not use AI for exams");
  expect(conceptPhrase("我不想依賴AI，應該先自己思考。")).toBe("我不想依賴AI");
  expect(tokenize("保留自己的聲音").stems.length).toBeGreaterThan(0);
 });
 it("links clipped phrases to their exact responses",()=>{
  const items=[{id:"a",text:"I cannot afford the subscription that everyone else uses every day."},{id:"b",text:"I can afford the subscription."}];
  const concepts=phraseConcepts(items);
  expect(concepts[0].text).toContain("cannot");
  expect(detailForConcept(concepts[0],items,[]).quotes.map(q=>q.id)).toEqual(["a"]);
 });
 it("counts duplicates once per response and preserves minority phrases",()=>{
  const concepts=phraseConcepts([{id:"a",text:"Keep my voice"},{id:"b",text:"Keep my voice"},{id:"c",text:"不要代寫"}]);
  expect(concepts[0].weight).toBe(2);
  expect(concepts[0].responseIds).toEqual(["a","b"]);
  expect(concepts[1].text).toBe("不要代寫");
 });
});

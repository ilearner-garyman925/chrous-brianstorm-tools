import { describe, expect, it } from "vitest";
import { hottestConcepts, limitConceptsByLayer } from "./bubble-limit";
const items = [
  { text: "Cold", weight: 1, themeId: "a" },
  { text: "Hot", weight: 9, themeId: "b" },
  { text: "Warm", weight: 4, themeId: "a" },
];
describe("bubble visibility limit", () => {
  it("removes the lowest heat first across themes without mutating input", () => {
    expect(hottestConcepts(items, 2).map(item => item.text)).toEqual(["Hot", "Warm"]);
    expect(hottestConcepts(items, 1).map(item => item.text)).toEqual(["Hot"]);
    expect(items.map(item => item.text)).toEqual(["Cold", "Hot", "Warm"]);
  });
  it("restores all available bubbles and handles empty input", () => {
    expect(hottestConcepts(items, 20)).toHaveLength(3);
    expect(hottestConcepts([], 1)).toEqual([]);
  });
  it("breaks heat ties consistently regardless of incoming order", () => {
    const tied = items.map(item => ({ ...item, weight: 2 }));
    expect(hottestConcepts(tied, 2)).toEqual(hottestConcepts([...tied].reverse(), 2));
  });
});

it("limits only the selected layer and retains the hottest item within it", () => {
  expect(limitConceptsByLayer(items, new Map([["a", 1]]))).toEqual([items[2], items[1]]);
  expect(limitConceptsByLayer(items, new Map())).toHaveLength(3);
});
it("keeps independent limits and at least one bubble per nonempty layer", () => {
  const more = [...items, { text: "Other", weight: 2, themeId: "b" }];
  expect(limitConceptsByLayer(more, new Map([["a", 1], ["b", 1]]))).toEqual([items[2], items[1]]);
  expect(limitConceptsByLayer(more, new Map([["a", 0]]))).toHaveLength(3);
});

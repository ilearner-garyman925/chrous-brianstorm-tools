import { describe, it, expect } from "vitest";
import { parsePreferences, defaultPreferences, fontScales } from "./preferences";
describe("device preferences", () => {
  it("falls back safely for missing or corrupt storage", () => {
    for(const raw of [null,"{broken","null","42","[]"]) expect(parsePreferences(raw)).toEqual(defaultPreferences);
  });
  it("restores valid choices while rejecting unsupported values", () => {
    expect(parsePreferences('{"language":"zh-Hant","fontSize":"large","theme":"light"}')).toEqual({...defaultPreferences,language:"zh-Hant",fontSize:"large",theme:"light"});
    expect(parsePreferences('{"language":"fr","fontSize":"huge","theme":"system"}')).toEqual(defaultPreferences);
    expect(parsePreferences('{"theme":"light"}')).toEqual({...defaultPreferences,theme:"light"});
  });
  it("stores bubble sizing independently of interface sizing", () => {
    const preferences=parsePreferences('{"fontSize":"standard","bubbleFontSize":"xlarge"}');
    expect(preferences.fontSize).toBe("standard");
    expect(preferences.bubbleFontSize).toBe("xlarge");
    expect(parsePreferences('{"bubbleFontSize":"invalid"}').bubbleFontSize).toBe("standard");
  });
  it("keeps standard typography unchanged and offers distinct readable sizes", () => {
    expect(fontScales.small).toBeLessThan(fontScales.standard);
    expect(fontScales.standard).toBe(1);
    expect(fontScales.large).toBeGreaterThan(fontScales.standard);
  });
});

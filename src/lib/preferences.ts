export type Preferences = { bubbleFontSize: "standard" | "large" | "xlarge"; language: "en" | "zh-Hant"; fontSize: "small" | "standard" | "large" | "xlarge"; theme: "dark" | "light" };
export const defaultPreferences: Preferences = { bubbleFontSize: "standard", language: "en", fontSize: "standard", theme: "dark" };
export const fontScales = { small: .9, standard: 1, large: 1.15, xlarge: 1.3 };
export function parsePreferences(raw: string | null): Preferences {
  try {
    const value = JSON.parse(raw ?? "null");
    return { bubbleFontSize: ["standard", "large", "xlarge"].includes(value?.bubbleFontSize) ? value.bubbleFontSize : "standard", language: value?.language === "zh-Hant" ? "zh-Hant" : "en", fontSize: ["small", "standard", "large", "xlarge"].includes(value?.fontSize) ? value.fontSize : "standard", theme: value?.theme === "light" ? "light" : "dark" };
  } catch { return {...defaultPreferences}; }
}

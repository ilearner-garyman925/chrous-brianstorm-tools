export const PAPER_THEME_COLORS = [
  "#b8612d",
  "#1f6a56",
  "#1f5f86",
  "#9c3b3b",
  "#6d4a86",
  "#8a6416",
  "#3d5a45",
];

export const INK_THEME_COLORS = [
  "#e2a15a",
  "#7dcea0",
  "#8eb8d4",
  "#e08b84",
  "#c9b6e3",
  "#e6d27a",
  "#9bbf8a",
];

export function colorForTheme(
  themeId: string | null,
  themeIds: string[],
  tone: "paper" | "ink",
): string {
  const palette = tone === "ink" ? INK_THEME_COLORS : PAPER_THEME_COLORS;
  if (!themeId || themeId === "fresh") {
    return tone === "ink" ? "#d7cbb8" : "#5c5348";
  }
  const index = themeIds.indexOf(themeId);
  return palette[(index < 0 ? 0 : index) % palette.length];
}

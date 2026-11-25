export const PAPER_THEME_COLORS = [
  "#45b98a",
  "#7a83ed",
  "#ef9a4c",
  "#e673ad",
  "#a27cdc",
  "#48adc3",
  "#a6a13d",
];

export const INK_THEME_COLORS = [
  "#43dce5",
  "#a294ff",
  "#f08e89",
  "#e9b95f",
  "#6fddb5",
  "#92b8ff",
  "#e697d9",
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

import type { HostSnapshot } from "@/lib/types";

export function discussionMarkdown(snapshot: HostSnapshot, roundId: string): string {
  const round = snapshot.rounds.find((item) => item.id === roundId) ?? snapshot.rounds.at(-1);
  if (!round) return `# ${snapshot.room.title}\n`;
  const analysis = snapshot.analyses.find((item) => item.roundId === round.id) ?? null;
  const responses = snapshot.responses.filter(
    (response) => response.roundId === round.id && !response.hidden,
  );
  const lines = [
    `# ${snapshot.room.title}`,
    "",
    `Room ${snapshot.room.code} · Round ${round.index}`,
    "",
    `## ${round.prompt}`,
    "",
  ];
  if (analysis) {
    lines.push(analysis.overview, "");
    lines.push("## Themes", "");
    for (const theme of analysis.themes) {
      const quotes = theme.responseIds
        .map((id) => responses.find((response) => response.id === id))
        .filter((response) => response !== undefined);
      lines.push(`### ${theme.label} (${quotes.length})`, "", theme.summary, "");
      for (const quote of quotes) {
        lines.push(`- ${quote.text}`);
      }
      lines.push("");
    }
    if (analysis.tensions.length > 0) {
      lines.push("## Tensions", "");
      for (const tension of analysis.tensions) {
        lines.push(
          `### ${tension.leftLabel} ↔ ${tension.rightLabel}`,
          "",
          tension.summary,
          "",
        );
      }
    }
    if (analysis.followUps.length > 0) {
      lines.push("## Possible next prompts", "");
      for (const prompt of analysis.followUps) lines.push(`- ${prompt}`);
      lines.push("");
    }
  } else {
    lines.push(`${responses.length} responses, not grouped yet.`, "");
    for (const response of responses) lines.push(`- ${response.text}`);
    lines.push("");
  }
  return lines.join("\n");
}

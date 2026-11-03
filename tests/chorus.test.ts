import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_CODE, DEMO_HOST_KEY } from "@/lib/demo";
import { ChorusError } from "@/lib/errors";
import { groupLocally } from "@/lib/group";
import { normalizeModelResult } from "@/lib/llm";
import { discussionMarkdown } from "@/lib/markdown";
import { SAMPLE_LINES, SAMPLE_PROMPT, type SampleFacet } from "@/lib/sample";
import {
  analyzeRound,
  createRoom,
  deleteRoom,
  ensureDemo,
  hostView,
  joinRoom,
  openRound,
  pumpReplay,
  resetStoreForTests,
  restoreDemo,
  setCloudVisibility,
  setLatestLocked,
  setResponseHidden,
  startReplay,
  studentView,
  submitResponse,
} from "@/lib/store";
import { layoutCloud } from "@/lib/wordcloud";

beforeEach(() => {
  delete process.env.LLM_API_KEY;
  delete process.env.OPENAI_API_KEY;
  resetStoreForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetStoreForTests();
});

function facetMajority(facet: SampleFacet) {
  const rows = SAMPLE_LINES.map((line, index) => ({ ...line, id: `s${index}` }));
  const grouped = groupLocally(
    SAMPLE_PROMPT,
    rows.map((row) => ({ id: row.id, text: row.text })),
  );
  const themeOf = new Map<string, string>();
  for (const theme of grouped.themes) {
    for (const id of theme.responseIds) themeOf.set(id, theme.id);
  }
  const ids = rows.filter((row) => row.facet === facet).map((row) => row.id);
  const counts = new Map<string, number>();
  for (const id of ids) {
    const theme = themeOf.get(id) ?? "missing";
    counts.set(theme, (counts.get(theme) ?? 0) + 1);
  }
  const best = Math.max(...counts.values());
  return {
    grouped,
    share: best / ids.length,
    themeOf,
    rows,
  };
}

describe("local grouping of the sample discussion", () => {
  it("covers every response once and keeps the main threads together", () => {
    const feedback = facetMajority("feedback");
    const { grouped } = feedback;
    const ids = grouped.themes.flatMap((theme) => theme.responseIds);
    expect(new Set(ids).size).toBe(SAMPLE_LINES.length);
    expect(ids).toHaveLength(SAMPLE_LINES.length);
    expect(grouped.themes.length).toBeGreaterThanOrEqual(4);
    expect(grouped.themes.length).toBeLessThanOrEqual(8);
    expect(grouped.concepts.length).toBeGreaterThanOrEqual(8);
    expect(grouped.followUps.length).toBeGreaterThanOrEqual(2);
    expect(grouped.tensions.length).toBeGreaterThanOrEqual(1);

    for (const facet of [
      "feedback",
      "literacy",
      "access",
      "voice",
      "brainstorm",
      "dependency",
    ] as const) {
      const result = facet === "feedback" ? feedback : facetMajority(facet);
      expect(result.share, facet).toBeGreaterThanOrEqual(0.6);
    }

    const rowsById = new Map(feedback.rows.map((row) => [row.id, row.facet]));
    const asides = feedback.rows.filter((row) => row.facet === "aside");
    for (const aside of asides) {
      const themeId = feedback.themeOf.get(aside.id);
      const theme = grouped.themes.find((item) => item.id === themeId);
      const others = theme?.responseIds.filter((id) => rowsById.get(id) !== "aside") ?? [];
      expect(others, aside.text).toHaveLength(0);
    }
  });

  it("is deterministic", () => {
    const items = SAMPLE_LINES.map((line, index) => ({ id: `s${index}`, text: line.text }));
    expect(groupLocally(SAMPLE_PROMPT, items)).toEqual(groupLocally(SAMPLE_PROMPT, [...items].reverse()));
  });
});

describe("model output repair", () => {
  it("drops unknown ids and keeps missed responses visible", () => {
    const draft = normalizeModelResult(
      {
        overview: "Two threads, and one left out.",
        themes: [
          {
            label: "Drafts",
            summary: "People want feedback on drafts.",
            keywords: ["draft"],
            responseIds: ["a", "missing", "a"],
          },
        ],
        followUps: ["What would the next assignment change?"],
        concepts: [{ text: "Draft", weight: "8", themeLabel: "Drafts" }],
      },
      [
        { id: "a", text: "Feedback on a draft." },
        { id: "b", text: "I need office hours." },
      ],
    );
    const ids = draft.themes.flatMap((theme) => theme.responseIds);
    expect(ids).toEqual(["a", "b"]);
    expect(draft.themes[1]?.label).toBe("Left aside");
    expect(draft.concepts[0]).toMatchObject({ text: "Draft", weight: 8, themeId: "th_0" });
  });
});

describe("word cloud layout", () => {
  it("keeps words inside the frame without stacking them", () => {
    const words = [
      "Draft",
      "Feedback",
      "Voice",
      "Paid tools",
      "Sources",
      "Brainstorm",
      "Habit",
      "Office hours",
      "Rewrite",
      "Access",
      "Outline",
      "Energy",
    ].map((text, index) => ({ text, weight: 12 - index, themeId: index % 2 === 0 ? "th_0" : "th_1" }));
    const placed = layoutCloud(words, 800, 500, (text, fontSize) => ({
      w: text.length * fontSize * 0.48,
      h: fontSize * 1.15,
    }));
    expect(placed.length).toBeGreaterThanOrEqual(10);
    for (const word of placed) {
      expect(word.x).toBeGreaterThanOrEqual(6);
      expect(word.y).toBeGreaterThanOrEqual(6);
      expect(word.x + word.w).toBeLessThanOrEqual(794);
      expect(word.y + word.h).toBeLessThanOrEqual(494);
    }
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i]!;
        const b = placed[j]!;
        const separated =
          a.x + a.w + 4 <= b.x ||
          b.x + b.w + 4 <= a.x ||
          a.y + a.h + 4 <= b.y ||
          b.y + b.h + 4 <= a.y;
        expect(separated, `${a.text} overlaps ${b.text}`).toBe(true);
      }
    }
  });
});

describe("room flow", () => {
  it("keeps names and other people's sentences off the student view", () => {
    const room = createRoom({
      title: "Wednesday seminar",
      prompt: "What is getting in the way of the discussion?",
      showCloudToStudents: false,
      askForNames: true,
      maxPerPerson: 3,
    });
    const maya = joinRoom(room.code, "Maya Chen");
    const jonah = joinRoom(room.code, null);
    const sentence = "The silence after a hard question is the thing I want us to protect from rushing.";
    submitResponse(room.code, maya.token, sentence);
    submitResponse(room.code, jonah.token, "I need a moment before I speak.");

    const host = hostView(room.code, room.hostKey);
    expect(host.responses.map((response) => response.participant.label).sort()).toEqual([
      "Maya Chen",
      "Unnamed · 1",
    ]);

    const student = studentView(room.code, jonah.token);
    const encoded = JSON.stringify(student);
    expect(encoded).not.toContain(sentence);
    expect(encoded).not.toContain("Maya Chen");
    expect(student.responseCount).toBe(2);
    expect(student.concepts).toBeNull();
    expect(student.myResponses).toHaveLength(1);

    setCloudVisibility(room.code, room.hostKey, true);
    const revealed = studentView(room.code, jonah.token);
    expect(revealed.concepts?.length).toBeGreaterThan(0);
    expect(JSON.stringify(revealed)).not.toContain(sentence);
  });

  it("locks a round, caps responses, hides a line from the grouping, and opens the next question", async () => {
    const room = createRoom({
      title: "Studio",
      prompt: "Where should we start?",
      showCloudToStudents: false,
      askForNames: false,
      maxPerPerson: 1,
    });
    const a = joinRoom(room.code, "Ignored Name");
    const b = joinRoom(room.code, "Also ignored");
    const c = joinRoom(room.code, null);
    expect(a.participant.sharedName).toBe(false);
    const first = submitResponse(room.code, a.token, "Start with the reading.");
    submitResponse(room.code, b.token, "Start with a sketch.");
    submitResponse(room.code, c.token, "Start with a question we can't answer yet.");
    expect(() => submitResponse(room.code, a.token, "Another one.")).toThrow(ChorusError);

    setLatestLocked(room.code, room.hostKey, true);
    const late = joinRoom(room.code, null);
    expect(() => submitResponse(room.code, late.token, "Too late.")).toThrow(/closed/);

    setResponseHidden(room.code, room.hostKey, first.id, true);
    const analysis = await analyzeRound(room.code, room.hostKey);
    const ids = analysis.themes.flatMap((theme) => theme.responseIds);
    expect(ids).not.toContain(first.id);
    expect(ids).toHaveLength(2);

    const next = openRound(room.code, room.hostKey, "What would you try in the first ten minutes?");
    expect(next.index).toBe(2);
    const host = hostView(room.code, room.hostKey);
    expect(host.rounds[0]?.status).toBe("locked");
    expect(host.activeRoundId).toBe(next.id);
    submitResponse(room.code, a.token, "I would read one page aloud.");
    expect(studentView(room.code, a.token).round?.prompt).toMatch(/first ten minutes/);

    const markdown = discussionMarkdown(hostView(room.code, room.hostKey), host.rounds[0]!.id);
    expect(markdown).toContain("Start with a sketch.");
    expect(markdown).not.toContain("Start with the reading.");
  });

  it("rejects a bad host key and deletes a real room", () => {
    const room = createRoom({
      title: "Section B",
      prompt: "What should we carry into next week?",
      showCloudToStudents: false,
      askForNames: true,
      maxPerPerson: 3,
    });
    expect(() => hostView(room.code, "not-the-key")).toThrow(/host key/);
    deleteRoom(room.code, room.hostKey);
    expect(() => studentView(room.code, null)).toThrow(/No room/);
  });

  it("plays and restores the sample discussion", () => {
    ensureDemo();
    const before = hostView(DEMO_CODE, DEMO_HOST_KEY);
    expect(before.responses.length).toBe(SAMPLE_LINES.length);
    expect(before.analyses[0]?.source).toBe("local");
    expect(before.room.title).toBe("How we use AI here");

    startReplay(DEMO_CODE, DEMO_HOST_KEY, { timer: false });
    expect(hostView(DEMO_CODE, DEMO_HOST_KEY).responses).toHaveLength(0);
    expect(hostView(DEMO_CODE, DEMO_HOST_KEY).replay?.running).toBe(true);
    pumpReplay();
    const mid = hostView(DEMO_CODE, DEMO_HOST_KEY);
    expect(mid.responses).toHaveLength(1);
    expect(mid.responses[0]?.text).toBe(SAMPLE_LINES[0]?.text);
    expect(JSON.stringify(studentView(DEMO_CODE, null))).not.toContain(SAMPLE_LINES[0]!.text);

    restoreDemo(DEMO_CODE, DEMO_HOST_KEY);
    expect(hostView(DEMO_CODE, DEMO_HOST_KEY).responses).toHaveLength(SAMPLE_LINES.length);
    expect(hostView(DEMO_CODE, DEMO_HOST_KEY).replay).toBeNull();
    expect(() => deleteRoom(DEMO_CODE, DEMO_HOST_KEY)).toThrow(/sample room/);
  });

  it("falls back when the model cannot be reached", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL = "test-model";
    const room = createRoom({
      title: "Lab",
      prompt: "What should we change?",
      showCloudToStudents: false,
      askForNames: true,
      maxPerPerson: 3,
    });
    const a = joinRoom(room.code, "Ari");
    const b = joinRoom(room.code, "Noor");
    submitResponse(room.code, a.token, "Give feedback on the draft, not the final wording.");
    submitResponse(room.code, b.token, "The paid plan shuts people out.");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    const analysis = await analyzeRound(room.code, room.hostKey);
    expect(analysis.source).toBe("local");
    expect(analysis.warning).toMatch(/wording on this machine/);
    expect(analysis.themes.flatMap((theme) => theme.responseIds)).toHaveLength(2);
  });
});

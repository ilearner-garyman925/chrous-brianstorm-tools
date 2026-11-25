import { phraseConcepts } from "@/lib/concept-phrases";
import { z } from "zod";
import type { Concept, GroupDraft, Theme, Tension } from "@/lib/types";

const SYSTEM = `You group short student discussion responses for a teacher in the room.
Return only JSON, no markdown. Group by meaning, not by shared wording.
Keep minority views visible. Do not fold a lone objection into a cheerful majority.
Every response id from the input must appear in exactly one theme.
Never invent a response, a quote, or an id.
Theme labels are 2–5 words a teacher could say aloud.
Summaries are one or two concrete sentences, without praising the students.
Name at most two tensions: real disagreements or tradeoffs that are present in the texts.
Follow-up prompts are open questions that would deepen the next round. No yes/no questions.
Concepts are short meaningful statements, NOT isolated keywords: usually 2–6 English words or 4–14 Chinese characters. Preserve the language of each response, negation, stance and important qualifiers. Use readable phrases such as "AI costs too much" or "保留自己的聲音". Merge only equivalent ideas, never opposing views. For each concept supply responseIds containing all supporting input responses. Never include opposing views. The server computes weight from distinct participants; do not guess popularity.
If a response is off-topic, put it in a theme called "Asides".`;

const ModelSchema = z.object({
  overview: z.string().optional(),
  themes: z
    .array(
      z.object({
        label: z.string(),
        summary: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        responseIds: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  tensions: z
    .array(
      z.object({
        label: z.string().optional(),
        summary: z.string().optional(),
        leftLabel: z.string().optional(),
        rightLabel: z.string().optional(),
        leftResponseIds: z.array(z.string()).optional(),
        rightResponseIds: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  followUps: z.array(z.string()).optional(),
  concepts: z
    .array(
      z.object({
        text: z.string(),
        weight: z.coerce.number().optional(),
        themeLabel: z.string().optional(),
        responseIds: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export type LlmConfig = {
  configured: boolean;
  model: string | null;
  modelName: string;
  baseUrl: string;
  apiKey: string;
};

export function llmConfig(): LlmConfig {
  const apiKey = (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "").trim();
  const modelName = (process.env.LLM_MODEL || "gpt-4o-mini").trim();
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  return {
    configured: apiKey.length > 0,
    model: apiKey ? modelName : null,
    modelName,
    baseUrl,
    apiKey,
  };
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function normalizeModelResult(
  raw: unknown,
  items: { id: string; text: string }[],
): GroupDraft {
  const parsed = ModelSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("The model did not return the expected JSON.");
  }
  const data = parsed.data;
  const known = new Set(items.map((item) => item.id));
  const seen = new Set<string>();
  const themes: Theme[] = [];

  for (const theme of data.themes ?? []) {
    const label = clip(theme.label, 60);
    if (!label) continue;
    const responseIds: string[] = [];
    for (const id of theme.responseIds ?? []) {
      if (!known.has(id) || seen.has(id)) continue;
      seen.add(id);
      responseIds.push(id);
    }
    if (responseIds.length === 0) continue;
    themes.push({
      id: `th_${themes.length}`,
      label,
      summary: clip(theme.summary || "Students raised this thread.", 400),
      keywords: (theme.keywords ?? [])
        .map((keyword) => clip(keyword, 32))
        .filter(Boolean)
        .slice(0, 5),
      responseIds,
    });
  }

  const missing = items.map((item) => item.id).filter((id) => !seen.has(id));
  if (missing.length > 0) {
    themes.push({
      id: `th_${themes.length}`,
      label: "Left aside",
      summary:
        missing.length === 1
          ? "One response did not land in the other threads, so it stays visible on its own."
          : `${missing.length} responses did not land in the other threads, so they stay visible here.`,
      keywords: [],
      responseIds: missing,
    });
  }

  if (themes.length === 0) {
    throw new Error("The model returned no usable themes.");
  }

  const labelToId = new Map(themes.map((theme) => [theme.label.toLowerCase(), theme.id]));
  let concepts: Concept[] = (data.concepts ?? [])
    .map((concept) => {
      const text = clip(concept.text, 64);
      if (!text) return null;
      const themeId = concept.themeLabel
        ? (labelToId.get(concept.themeLabel.toLowerCase()) ?? null)
        : null;
      const weight = Math.max(1, Math.min(10, Math.round(concept.weight ?? 4)));
      const responseIds = concept.responseIds ? [...new Set(concept.responseIds)].filter(id =>
        known.has(id) && (!themeId || themes.find(theme=>theme.id===themeId)?.responseIds.includes(id))) : undefined;
      return { text, weight, themeId, ...(responseIds ? {responseIds} : {}) };
    })
    .filter((concept): concept is Concept => concept !== null)
    .slice(0, 32);

  if (concepts.length === 0) {
    concepts = themes.flatMap(theme => phraseConcepts(
      items.filter(item => theme.responseIds.includes(item.id)), theme.id, 3
    ));
  }

  const tensions: Tension[] = (data.tensions ?? []).slice(0, 2).map((tension, index) => {
    const placements: Tension["placements"] = [];
    const place = (ids: string[] | undefined, position: number) => {
      for (const id of ids ?? []) {
        if (!known.has(id)) continue;
        const existing = placements.find((item) => item.responseId === id);
        if (existing) existing.position = 0.5;
        else placements.push({ responseId: id, position });
      }
    };
    place(tension.leftResponseIds, 0.12);
    place(tension.rightResponseIds, 0.88);
    return {
      id: `tn_${index}`,
      label: clip(tension.label || "A tension in the room", 80),
      summary: clip(tension.summary || "The responses pull in two directions.", 400),
      leftLabel: clip(tension.leftLabel || "One side", 40),
      rightLabel: clip(tension.rightLabel || "The other side", 40),
      placements,
    };
  });

  const followUps = (data.followUps ?? [])
    .map((prompt) => clip(prompt, 180))
    .filter((prompt) => prompt.length >= 8)
    .slice(0, 3);

  const largest = [...themes].sort((a, b) => b.responseIds.length - a.responseIds.length)[0];
  if (followUps.length === 0 && largest) {
    followUps.push(
      `If we took “${largest.label}” seriously, what would we do differently next time?`,
    );
  }

  return {
    overview: clip(
      data.overview ||
        `${items.length} responses, gathered into ${themes.length} threads.`,
      400,
    ),
    themes,
    tensions,
    followUps,
    concepts,
    responseCount: items.length,
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]! : trimmed);
}

export async function groupWithModel(
  prompt: string,
  items: { id: string; text: string }[],
): Promise<{ draft: GroupDraft | null; model: string | null; warning: string | null }> {
  const config = llmConfig();
  if (!config.configured) return { draft: null, model: null, warning: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.modelName,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              discussionPrompt: prompt,
              responses: items,
              jsonShape: {
                overview: "string",
                themes: [
                  {
                    label: "string",
                    summary: "string",
                    keywords: ["string"],
                    responseIds: ["id"],
                  },
                ],
                tensions: [
                  {
                    label: "string",
                    summary: "string",
                    leftLabel: "string",
                    rightLabel: "string",
                    leftResponseIds: ["id"],
                    rightResponseIds: ["id"],
                  },
                ],
                followUps: ["string"],
                concepts: [{ text: "string", themeLabel: "string", responseIds: ["id"] }],
              },
            }),
          },
        ],
      }),
    });
    if (!response.ok) {
      return {
        draft: null,
        model: null,
        warning: `The model returned ${response.status}, so this grouping used the wording on this machine.`,
      };
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      return {
        draft: null,
        model: null,
        warning:
          "The model returned an empty reading, so this grouping used the wording on this machine.",
      };
    }
    const draft = normalizeModelResult(extractJson(content), items);
    return { draft, model: config.modelName, warning: null };
  } catch {
    return {
      draft: null,
      model: null,
      warning:
        "The model could not be reached, so this grouping used the wording on this machine.",
    };
  } finally {
    clearTimeout(timer);
  }
}

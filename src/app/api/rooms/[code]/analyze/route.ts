import { fail, hostKeyOf, json, live, readJson } from "@/lib/http";
import { analyzeRound } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    await live();
    const { code } = await ctx.params;
    const body = await readJson(request);
    const roundId = typeof body.roundId === "string" ? body.roundId : null;
    return json(await analyzeRound(code, hostKeyOf(request), roundId));
  } catch (error) {
    return fail(error);
  }
}

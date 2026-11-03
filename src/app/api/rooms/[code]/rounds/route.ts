import { ChorusError } from "@/lib/errors";
import { fail, hostKeyOf, json, live, readJson } from "@/lib/http";
import { openRound, setLatestLocked } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    await live();
    const { code } = await ctx.params;
    const body = await readJson(request);
    const hostKey = hostKeyOf(request);
    if (body.action === "lock" || body.action === "unlock") {
      setLatestLocked(code, hostKey, body.action === "lock");
      return json({ ok: true });
    }
    if (body.action === "open") {
      return json(openRound(code, hostKey, String(body.prompt ?? "")), 201);
    }
    throw new ChorusError("Choose lock, unlock, or a new prompt.", 400);
  } catch (error) {
    return fail(error);
  }
}

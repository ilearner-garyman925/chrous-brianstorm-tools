import { ChorusError } from "@/lib/errors";
import { fail, hostKeyOf, json, live, readJson } from "@/lib/http";
import { restoreDemo, startReplay } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    await live();
    const { code } = await ctx.params;
    const body = await readJson(request);
    const hostKey = hostKeyOf(request);
    if (body.mode === "play") return json(startReplay(code, hostKey));
    if (body.mode === "restore") {
      restoreDemo(code, hostKey);
      return json({ ok: true });
    }
    throw new ChorusError("Choose play or restore.", 400);
  } catch (error) {
    return fail(error);
  }
}

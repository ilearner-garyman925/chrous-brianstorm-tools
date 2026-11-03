import { fail, hostKeyOf, json, live, readJson } from "@/lib/http";
import { setResponseHidden } from "@/lib/store";

type Ctx = { params: Promise<{ code: string; id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await live();
    const { code, id } = await ctx.params;
    const body = await readJson(request);
    if (typeof body.hidden !== "boolean") {
      return json({ error: "Say whether the response should be hidden." }, 400);
    }
    setResponseHidden(code, hostKeyOf(request), id, body.hidden);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

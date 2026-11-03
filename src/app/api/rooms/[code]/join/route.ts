import { fail, json, live, readJson } from "@/lib/http";
import { joinRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    await live();
    const { code } = await ctx.params;
    const body = await readJson(request);
    const name = typeof body.displayName === "string" ? body.displayName : null;
    return json(joinRoom(code, name), 201);
  } catch (error) {
    return fail(error);
  }
}

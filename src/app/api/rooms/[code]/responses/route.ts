import { fail, json, live, readJson, seatOf } from "@/lib/http";
import { ChorusError } from "@/lib/errors";
import { submitResponse } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    await live();
    const { code } = await ctx.params;
    const token = seatOf(request);
    if (!token) throw new ChorusError("Join the room before sending a response.", 401);
    const body = await readJson(request);
    return json(submitResponse(code, token, String(body.text ?? "")), 201);
  } catch (error) {
    return fail(error);
  }
}

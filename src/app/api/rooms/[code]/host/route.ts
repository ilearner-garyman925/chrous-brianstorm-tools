import { fail, hostKeyOf, json, live } from "@/lib/http";
import { hostView } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    await live();
    const { code } = await ctx.params;
    return json(hostView(code, hostKeyOf(request)));
  } catch (error) {
    return fail(error);
  }
}

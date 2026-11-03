import { fail, hostKeyOf, json, live, readJson, seatOf } from "@/lib/http";
import { deleteRoom, setCloudVisibility, studentView } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    await live();
    const { code } = await ctx.params;
    return json(studentView(code, seatOf(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await live();
    const { code } = await ctx.params;
    const body = await readJson(request);
    if (typeof body.showCloudToStudents !== "boolean") {
      return json({ error: "Say whether students can see the cloud." }, 400);
    }
    setCloudVisibility(code, hostKeyOf(request), body.showCloudToStudents);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    await live();
    const { code } = await ctx.params;
    deleteRoom(code, hostKeyOf(request));
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

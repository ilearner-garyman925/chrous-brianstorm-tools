import { fail, json, live, readJson } from "@/lib/http";
import { createRoom } from "@/lib/store";

export async function POST(request: Request) {
  try {
    await live();
    const body = await readJson(request);
    const room = createRoom({
      title: String(body.title ?? ""),
      prompt: String(body.prompt ?? ""),
      showCloudToStudents: body.showCloudToStudents === true,
      askForNames: body.askForNames !== false,
      maxPerPerson: Number(body.maxPerPerson),
    });
    return json(room, 201);
  } catch (error) {
    return fail(error);
  }
}

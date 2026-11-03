import { connection } from "next/server";
import { ChorusError } from "@/lib/errors";

export async function live() {
  await connection();
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ChorusError("Send a JSON object.", 400);
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ChorusError) throw error;
    throw new ChorusError("Send a JSON body.", 400);
  }
}

export function hostKeyOf(request: Request) {
  return request.headers.get("x-host-key")?.trim() ?? "";
}

export function seatOf(request: Request) {
  const token = request.headers.get("x-participant-token")?.trim();
  return token || null;
}

export function fail(error: unknown) {
  if (error instanceof ChorusError) return json({ error: error.message }, error.status);
  console.error(error);
  return json({ error: "Something went wrong on the server." }, 500);
}

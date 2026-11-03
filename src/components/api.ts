export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(
  url: string,
  init?: { method?: string; json?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.json !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(url, {
    method: init?.method ?? (init?.json === undefined ? "GET" : "POST"),
    headers,
    body: init?.json === undefined ? undefined : JSON.stringify(init.json),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new ApiError(body.error || "Request failed.", response.status);
  return body as T;
}

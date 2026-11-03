import QRCode from "qrcode";
import { NextRequest } from "next/server";
import { fail, live } from "@/lib/http";
import { assertRoom } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    await live();
    const { code } = await ctx.params;
    assertRoom(code);
    const url = `${request.nextUrl.origin}/join/${code.toUpperCase()}`;
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      color: { dark: "#1e1a16", light: "#00000000" },
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}

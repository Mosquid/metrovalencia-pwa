import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const station = request.nextUrl.searchParams.get("station")?.trim().slice(0, 120);
  const startUrl = station ? `/?station=${encodeURIComponent(station)}` : "/";

  return NextResponse.json(
    {
      id: "/",
      name: "Próximo Metro",
      short_name: "Metro",
      description: "Upcoming Metrovalencia departures for your station.",
      start_url: startUrl,
      scope: "/",
      display: "standalone",
      background_color: "#f6f2ea",
      theme_color: "#f6f2ea",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-store",
      },
    },
  );
}

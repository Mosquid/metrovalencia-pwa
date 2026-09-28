import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDepartures, getStations, resolveStation } from "@/lib/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("station")?.trim().slice(0, 120) ?? "";

  try {
    const stations = await getStations();
    const resolution = resolveStation(query, stations);

    if (resolution.status !== "resolved") {
      return NextResponse.json(resolution, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const result = await getDepartures(resolution.matches);
    return NextResponse.json(
      {
        status: "ok",
        station: resolution.name,
        departures: result.departures,
        updatedAt: result.updatedAt,
        source: "Metrovalencia",
      },
      {
        headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=10" },
      },
    );
  } catch (error) {
    console.error("Departure adapter failed", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Metrovalencia is not responding as expected. Try again shortly.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

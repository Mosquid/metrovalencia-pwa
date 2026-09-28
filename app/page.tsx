import type { Metadata } from "next";
import { DeparturesApp } from "@/components/departures-app";

type PageProps = {
  searchParams: Promise<{ station?: string | string[] }>;
};

function readStation(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const station = readStation((await searchParams).station);
  const query = station ? `?station=${encodeURIComponent(station)}` : "";

  return {
    manifest: `/manifest.webmanifest${query}`,
    title: station ? `${station} · Próximo Metro` : "Próximo Metro",
  };
}

export default async function Page({ searchParams }: PageProps) {
  const station = readStation((await searchParams).station);
  return <DeparturesApp initialStation={station} />;
}

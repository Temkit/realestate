import type { Metadata } from "next";
import { getLegalMetadata } from "@/lib/seo/legal-metadata";
import { MentionsLegales } from "./content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getLegalMetadata("mentions-legales", locale);
}

export default function Page() {
  return <MentionsLegales />;
}

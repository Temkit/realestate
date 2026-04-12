import type { Metadata } from "next";
import { getLegalMetadata } from "@/lib/seo/legal-metadata";
import { TermsOfService } from "./content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getLegalMetadata("terms", locale);
}

export default function Page() {
  return <TermsOfService />;
}

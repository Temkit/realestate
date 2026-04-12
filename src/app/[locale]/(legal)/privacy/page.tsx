import type { Metadata } from "next";
import { getLegalMetadata } from "@/lib/seo/legal-metadata";
import { PrivacyPolicy } from "./content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getLegalMetadata("privacy", locale);
}

export default function Page() {
  return <PrivacyPolicy />;
}

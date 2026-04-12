import type { Metadata } from "next";
import { getLegalMetadata } from "@/lib/seo/legal-metadata";
import { CookiePolicy } from "./content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getLegalMetadata("cookies", locale);
}

export default function Page() {
  return <CookiePolicy />;
}

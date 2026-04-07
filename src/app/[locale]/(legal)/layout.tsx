import { Footer } from "@/components/footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {children}
      <Footer />
    </div>
  );
}

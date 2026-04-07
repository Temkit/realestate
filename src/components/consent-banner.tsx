"use client";

import { useTranslations } from "next-intl";
import { useConsent } from "@/hooks/use-consent";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConsentBanner() {
  const t = useTranslations("consent");
  const { hasConsented, loaded, acceptAll, rejectNonEssential } = useConsent();

  if (!loaded || hasConsented) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 animate-slide-up">
      <div className="max-w-lg mx-auto bg-card border rounded-2xl shadow-xl p-4 sm:p-5">
        <div className="flex gap-3">
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("title")}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {t("description")}
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={acceptAll} className="rounded-lg text-xs h-8">
                {t("acceptAll")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={rejectNonEssential}
                className="rounded-lg text-xs h-8"
              >
                {t("onlyEssential")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";

interface ConsentState {
  necessary: boolean; // always true
  functional: boolean; // favorites, preferences, recent searches
}

const COOKIE_NAME = "olu-consent";
const MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function writeConsent(state: ConsentState) {
  const value = encodeURIComponent(JSON.stringify(state));
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function useConsent() {
  const [consentState, setConsentState] = useState<ConsentState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setConsentState(readConsent());
    setLoaded(true);
  }, []);

  const hasConsented = consentState !== null;

  const acceptAll = useCallback(() => {
    const state: ConsentState = { necessary: true, functional: true };
    writeConsent(state);
    setConsentState(state);
  }, []);

  const rejectNonEssential = useCallback(() => {
    const state: ConsentState = { necessary: true, functional: false };
    writeConsent(state);
    setConsentState(state);
  }, []);

  const canStore = useCallback(
    (category: "necessary" | "functional"): boolean => {
      if (category === "necessary") return true;
      return consentState?.functional ?? false;
    },
    [consentState]
  );

  return {
    consentState,
    hasConsented,
    loaded,
    acceptAll,
    rejectNonEssential,
    canStore,
  };
}

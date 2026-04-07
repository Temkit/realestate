import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except API routes, static files, and Next.js internals
    "/((?!api|_next|.*\\..*).*)",
  ],
};

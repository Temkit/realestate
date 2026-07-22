import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except API routes, the admin back-office, static files, and Next.js internals
    "/((?!api|admin|_next|.*\\..*).*)",
  ],
};

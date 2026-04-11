---
name: Final Search Pipeline Workflow
description: The verified and tested search pipeline architecture with failover chains for all Luxembourg real estate search operations
type: project
---

# Final Search Pipeline Workflow (Verified April 2026)

## API Keys Available
- GEMINI_API_KEY (Google, gemini-2.5-flash-lite)
- BRAVE_API_KEY (Brave Search)
- FIRECRAWL_API_KEY (Firecrawl)
- PERPLEXITY_API_KEY (Perplexity, sonar + sonar-pro)
- OPENAI_API_KEY (OpenAI, gpt-4.1 + web_search)

## 4 Luxembourg Portals
1. athome.lu (191K monthly visits, #1)
2. immotop.lu (131K monthly visits, #2)
3. wortimmo.lu (29K monthly visits, #4)
4. vivi.lu (smaller, official chamber portal)

## Step 1: Parse User Query
Extract commune, neighborhood, property type, transaction mode, cleaned query.

**Fallback chain (most reliable → least):**
1. **Gemini** — tested 10 queries FR/EN/DE, all correct, free/$0.00004
2. **OpenAI** — not tested for parsing but capable
3. **Perplexity** — tested, works but $0.003 per call
4. **Regex fallback** — basic pattern matching, no AI

## Step 2: Find Listing URLs
Discover individual listing page URLs from all 4 portals.

**Fallback chain (most reliable → least):**
1. **Brave Search** (4 parallel queries, one per portal) — tested, returns real URLs, never fabricates, athome titles contain price+surface. $0.003/query. Max 20 results per query.
2. **OpenAI web_search** (GPT-4.1) — tested, found 4 URLs, sometimes fabricates paths. ~$0.03
3. **Perplexity Sonar** — tested, inconsistent 2-5 results per search. ~$0.01
4. **Gemini Google Search** — tested, fabricates URL paths — least reliable for discovery

## Step 3: For Each URL, Get Property Data
Extract price, surface, type, city, mode, description, rooms, image.

**Universal fallback chain per URL (no portal-specific logic):**
1. **HTTP fetch og:tags** (free) — works on 3/4 portals (immotop, wortimmo, vivi). Gets og:image, og:title, og:description. athome returns empty (JS-rendered).
2. **Gemini URL Context** (batch all incomplete URLs in 1 call) — tested all 4 portals, all correct for data. Supports up to 20 URLs per call. ~$0.001 for batch. **Fabricates image URLs — never trust Gemini for images.**
3. **Firecrawl** ($0.01/page) — tested all 4 portals, renders JS, gets real images. Sometimes misses price on immotop.
4. **Perplexity fetch_url** ($0.0005/page) — tested, works on athome + vivi, partial on immotop, fails on wortimmo.
5. **OpenAI** — not tested for URL reading
6. **Brave title data** — last resort. athome titles have price+surface ("Bureau • 109 m² • 2 600 €"). Other portals have no price in title.

**Key rule: Gemini gets DATA, Firecrawl gets IMAGES. Never trust Gemini for image URLs.**

## Step 4: AI Enrichment
Generate summary, market context, per-property insights, follow-up suggestions.

**Fallback chain:**
1. **Gemini** — tested, fast, cheap, good output. free/$0.00025
2. **OpenAI** — not tested for enrichment but capable
3. **Perplexity** — tested, works, more expensive
4. **Computed insights only** — no API needed. Data-driven badges: Lowest price, Best €/m², Largest, % below/above avg, Compact/Spacious, Only listing in X

## Step 5: Compare Properties (on user click only)
**Fallback chain:**
1. **Perplexity sonar-pro** — tested, best for real-time web research with market data
2. **OpenAI web_search** — tested, decent
3. **Gemini Google Search** — tested, less reliable

## Step 6: Neighborhood Analysis (on user click only)
**Fallback chain:**
1. **Perplexity sonar-pro** — tested, best for schools/commute/safety data
2. **OpenAI web_search** — decent alternative
3. **Gemini Google Search** — fallback

## Caches
- **Keyword cache**: exact query+mode → full SearchResult. TTL: 24 hours.
- **URL scrape cache**: listing URL → ScrapedListing. TTL: 7 days.

## Cost Per Search (estimated)
| Component | Cost |
|-----------|------|
| Gemini parse query | $0.00004 |
| Brave 4 queries | $0.012 |
| Gemini URL Context (10 URLs) | $0.001 |
| HTTP fetch og:image | free |
| Firecrawl (2-3 athome images) | $0.02-0.03 |
| Gemini enrichment | $0.00025 |
| **Total** | **$0.033-0.043** |

## Portal-Specific Test Results (for reference, NOT for code logic)

### og:image from simple HTTP fetch
- athome.lu: ❌ no og:image (JS-rendered)
- immotop.lu: ✅ pic.immotop.lu/image/...
- vivi.lu: ✅ storage.vivi.lu/...
- wortimmo.lu: ✅ static.wortimmo.lu/...

### Gemini URL Context
- athome.lu: ✅ price, surface, type, city, address, description
- immotop.lu: ✅ price, surface, type, city, address, description
- vivi.lu: ✅ price, surface, type, city
- wortimmo.lu: ✅ price (sometimes), type, city

### Perplexity fetch_url
- athome.lu: ✅ all data
- vivi.lu: ✅ all data
- immotop.lu: ⚠️ partial (surface+type but often missing price)
- wortimmo.lu: ❌ empty

### Firecrawl
- athome.lu: ✅ full content + title with price, NO ogImage
- immotop.lu: ✅ full content + ogImage, sometimes misses price
- vivi.lu: ✅ full content + ogImage
- wortimmo.lu: ✅ full content + ogImage, price found

### Brave Search titles
- athome.lu: ✅ price + surface + city in title
- immotop.lu: ❌ no price/surface in title
- wortimmo.lu: ❌ no price/surface in title
- vivi.lu: ❌ no price/surface in title

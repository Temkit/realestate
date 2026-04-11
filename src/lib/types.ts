export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  propertyType: string;
  yearBuilt: number | null;
  description: string;
  features: string[];
  imageUrl: string | null;
  source: string | null;
  /** All portal hostnames where this property was found */
  sources?: string[];
  listingUrl: string | null;
  /** All listing URLs across portals */
  listingUrls?: string[];
  listingStatus: string;
  aiInsight?: string;
  listingMode?: "rent" | "buy";
  pricePerSqm?: number;
  /** True if 2+ portals report the same price */
  priceVerified?: boolean;
  /** Portals with fuzzy match (not merged, just linked) */
  alsoOnPortals?: { name: string; url: string }[];
  /** Luxembourg true cost breakdown */
  trueCost?: {
    registrationTax?: number;
    notaryFees?: number;
    bankFees?: number;
    totalCost?: number;
    estimatedCharges?: number;
    securityDeposit?: number;
    agencyFee?: number;
    moveInCost?: number;
    monthlyTotal?: number;
  };
  /** Fair price vs search average */
  fairPrice?: {
    diffPercent: number;
    label: string;
    rating: "good" | "fair" | "high";
  };
  /** Estimated monthly charges (€/month) */
  chargesEstimate?: number;
  /** Gross rental yield (buy listings only) */
  rentalYield?: {
    grossPercent: number;
    estimatedMonthlyRent: number;
    source: "cache" | "turso" | "estimate";
  } | null;
  /** Price per m² vs commune average */
  communePriceComparison?: {
    communeAvgPpsqm: number;
    diffPercent: number;
    label: string;
  };
}

export interface NeighborhoodData {
  overview: string;
  schoolRating: string | null;
  walkScore: string | null;
  crimeLevel: string | null;
  nearbyAmenities: string[];
  commuteInfo: string | null;
  medianHomePrice: string | null;
  priceHistory: string | null;
  citations: string[];
}

export interface PerplexityImage {
  image_url: string;
  origin_url: string;
  height: number;
  width: number;
  title?: string;
}

export interface MarketAnalytics {
  priceRange: { min: number; max: number; avg: number; median: number } | null;
  pricePerSqm: { min: number; max: number; avg: number } | null;
  priceDistribution: { label: string; min: number; max: number; count: number }[];
  supplyLevel: "low" | "medium" | "high";
  portalCoverage: { portal: string; count: number }[];
  communeComparison: { commune: string; searchCount: number; avgResults: number }[] | null;
}

export interface SearchResult {
  properties: Property[];
  summary: string;
  citations: string[];
  suggestedFollowUps?: string[];
  marketContext?: string;
  categoryUrls?: string[];
  marketAnalytics?: MarketAnalytics;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ScrapedListing {
  url: string;
  source: string;
  price: number;
  surface: number;
  rooms: number;
  bathrooms: number;
  propertyType: string;
  city: string;
  address: string;
  imageUrl: string | null;
  contractType: "rent" | "buy";
  description: string;
}

export interface DiscoveryResult {
  searchResults: { url: string; title?: string; snippet?: string }[];
  summary: string;
  suggestedFollowUps: string[];
  marketContext: string;
}

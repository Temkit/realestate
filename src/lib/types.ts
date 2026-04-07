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
  listingUrl: string | null;
  listingStatus: string;
  aiInsight?: string;
  listingMode?: "rent" | "buy";
  pricePerSqm?: number;
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

export interface SearchResult {
  properties: Property[];
  summary: string;
  citations: string[];
  suggestedFollowUps?: string[];
  marketContext?: string;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

import { Skeleton } from "@/components/ui/skeleton";
import { Dots } from "@/components/marketplace/dots";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center">
          <Dots size={10} pulse className="mb-8" />
          <Skeleton className="h-12 w-80 max-w-full mx-auto mb-4" />
          <Skeleton className="h-5 w-64 max-w-full mx-auto" />
        </div>
      </div>
    </div>
  );
}

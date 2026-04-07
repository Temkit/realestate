import { Skeleton } from "@/components/ui/skeleton";

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
          <Skeleton className="h-12 w-80 mx-auto mb-4" />
          <Skeleton className="h-5 w-64 mx-auto" />
        </div>
      </div>
    </div>
  );
}

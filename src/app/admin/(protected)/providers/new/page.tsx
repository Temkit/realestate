import { listCategories, listVerticals } from "@/lib/marketplace/queries";
import { ProviderForm } from "../provider-form";

export const dynamic = "force-dynamic";

export default async function NewProviderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [verticals, categories] = await Promise.all([
    listVerticals(),
    listCategories(),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">New provider</h1>
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <ProviderForm
        provider={null}
        verticals={verticals}
        categories={categories}
        selectedCategoryIds={[]}
        coverage={[]}
      />
    </div>
  );
}

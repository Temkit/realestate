import { requireProvider } from "@/lib/marketplace/provider-auth";
import { getProvider } from "@/lib/marketplace/queries";
import { saveProfileAction } from "../../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";
const LANGUAGES = ["fr", "de", "lb", "en", "pt"] as const;

export default async function PortalProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const providerId = await requireProvider();
  const { saved, error } = await searchParams;
  const provider = await getProvider(providerId);
  if (!provider) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-lg font-semibold">Votre profil</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Ces informations apparaissent sur votre page publique. Pour changer votre nom,
        commune ou formule, contactez lux24.
      </p>
      {saved && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">Enregistré.</p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          Vérifiez les champs (URL du site / logo invalide ?).
        </p>
      )}

      <form action={saveProfileAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Téléphone</span>
            <input name="phone" defaultValue={provider.phone ?? ""} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">WhatsApp</span>
            <input name="whatsapp" defaultValue={provider.whatsapp ?? ""} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Site web (https://…)</span>
            <input name="website" defaultValue={provider.website ?? ""} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Logo (URL https://…)</span>
            <input name="logo_url" defaultValue={provider.logo_url ?? ""} className={inputCls} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Adresse</span>
            <input name="address" defaultValue={provider.address ?? ""} className={inputCls} />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Description (français)</span>
          <textarea name="description_fr" rows={3} defaultValue={provider.description_fr ?? ""} className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Description (anglais)</span>
          <textarea name="description_en" rows={3} defaultValue={provider.description_en ?? ""} className={inputCls} />
        </label>

        <div>
          <span className="mb-2 block text-sm text-muted-foreground">Langues parlées</span>
          <div className="flex gap-4 text-sm">
            {LANGUAGES.map((l) => (
              <label key={l} className="flex items-center gap-1.5">
                <input type="checkbox" name="languages" value={l} defaultChecked={provider.languages.includes(l)} />
                {l.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        <button className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Enregistrer
        </button>
      </form>
    </div>
  );
}

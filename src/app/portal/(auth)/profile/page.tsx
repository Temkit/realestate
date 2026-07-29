import { requireProvider } from "@/lib/marketplace/provider-auth";
import { getProvider } from "@/lib/marketplace/queries";
import { weeklyHours } from "@/lib/marketplace/hours";
import { saveProfileAction } from "../../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";
const LANGUAGES = ["fr", "de", "lb", "en", "pt"] as const;
const DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** First open/close range per weekday (Mon–Sun) prefilled from stored hours. */
function prefillHours(oh: string | null): { open: string; close: string; closed: boolean }[] {
  const weekly = weeklyHours(oh, "fr");
  return Array.from({ length: 7 }, (_, i) => {
    const day = weekly?.[i];
    const range = day?.ranges[0];
    if (!range) return { open: "09:00", close: "18:00", closed: true };
    const [open, close] = range.split("–");
    return { open, close, closed: false };
  });
}

export default async function PortalProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const providerId = await requireProvider();
  const { saved, error } = await searchParams;
  const provider = await getProvider(providerId);
  if (!provider) return null;
  const hours = prefillHours(provider.opening_hours);

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

        <fieldset className="rounded-xl border p-4">
          <legend className="px-1 text-sm font-medium">Horaires d&apos;ouverture</legend>
          <div className="space-y-1.5">
            {DAYS_FR.map((day, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">{day}</span>
                <input type="time" name={`day_${i}_open`} defaultValue={hours[i].open} className={inputCls + " w-auto"} />
                <span className="text-muted-foreground">–</span>
                <input type="time" name={`day_${i}_close`} defaultValue={hours[i].close} className={inputCls + " w-auto"} />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" name={`day_${i}_closed`} defaultChecked={hours[i].closed} />
                  Fermé
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            Photos (une URL https:// par ligne, max 8)
          </span>
          <textarea
            name="photos"
            rows={3}
            defaultValue={provider.photos.join("\n")}
            placeholder="https://…/photo1.jpg"
            className={inputCls}
          />
        </label>

        <button className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Enregistrer
        </button>
      </form>
    </div>
  );
}

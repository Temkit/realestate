import Image from "next/image";

/** Responsive photo grid for a provider's images. */
export function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const shown = photos.slice(0, 6);
  if (shown.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {shown.map((url, i) => (
        <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
          <Image
            src={url}
            alt={`${name} — ${i + 1}`}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

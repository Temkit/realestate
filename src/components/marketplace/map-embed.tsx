/** Free OpenStreetMap embed with a marker — no API key, no client JS. */
export function MapEmbed({
  lat,
  lon,
  title,
}: {
  lat: number;
  lon: number;
  title: string;
}) {
  const d = 0.004;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;

  return (
    <div className="overflow-hidden rounded-2xl border">
      <iframe
        src={src}
        title={title}
        loading="lazy"
        className="h-56 w-full"
        style={{ border: 0 }}
      />
      <a
        href={link}
        rel="nofollow noopener"
        target="_blank"
        className="block bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        OpenStreetMap ↗
      </a>
    </div>
  );
}

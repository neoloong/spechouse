import SearchBar from "@/components/SearchBar";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Logo / wordmark */}
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-black tracking-tight mb-2">
          Spec<span className="text-primary">House</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md">
          The GSMarena for homes — search, compare, and score properties side-by-side.
        </p>
      </div>

      <SearchBar />

      {/* Hints */}
      <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
        {["San Francisco CA", "San Jose CA", "Austin TX", "Seattle WA", "Miami FL", "Denver CO"].map((city) => (
          <a
            key={city}
            href={`/listings?city=${encodeURIComponent(city)}`}
            className="hover:text-primary hover:underline transition-colors"
          >
            {city}
          </a>
        ))}
      </div>

      {/* Feature bullets */}
      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl text-center text-sm">
        {[
          { icon: "📊", title: "Spec Comparison", desc: "Compare up to 4 properties spec-by-spec with diff highlighting." },
          { icon: "🔇", title: "Noise & Crime", desc: "See real noise dB and crime scores Zillow won't show you." },
          { icon: "📈", title: "Investment Scores", desc: "Rental yield, cap rate, and AVM discount — all in one score." },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="p-4 rounded-xl border bg-card">
            <div className="text-3xl mb-2">{icon}</div>
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

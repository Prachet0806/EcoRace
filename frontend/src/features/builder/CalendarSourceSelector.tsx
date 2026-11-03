"use client";

import type { CalendarSource } from "@/lib/scenario-store";

interface Props {
  source: CalendarSource;
  officialCount: number;
  onChange: (s: CalendarSource) => void;
}

// Calendar source: Official applies the 2026 venue-set preset; Custom keeps
// manual two-pane selection. Official mode never claims dates or order.
export function CalendarSourceSelector({ source, officialCount, onChange }: Props) {
  const cards: Array<{ id: CalendarSource; title: string; body: string }> = [
    {
      id: "official-2026-venues",
      title: "Official season",
      body: `Use the ${officialCount} official 2026 venues. The optimizer assigns dates and order.`,
    },
    {
      id: "custom",
      title: "Custom calendar",
      body: "Choose 20–24 circuits from the full library.",
    },
  ];
  return (
    <section aria-label="Calendar source" className="rounded-xl border border-hairline bg-card p-4">
      <div className="grid gap-3 md:grid-cols-2" role="group" aria-label="Calendar source">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={source === c.id}
            className={`min-h-24 rounded-lg border p-4 text-left transition-colors ${
              source === c.id ? "border-hairline bg-lift" : "border-hairline hover:bg-lift"
            }`}
          >
            <span className="flex items-center gap-2 font-display text-[16px] font-medium">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${source === c.id ? "bg-rosso" : "bg-mute/40"}`} />
              {c.title}
            </span>
            <span className="mt-2 block text-sm leading-5 text-mute">{c.body}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

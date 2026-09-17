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
      body: `Load the official 2026 venue set (${officialCount} circuits) into your calendar, then optimize when ready. Dates and order are optimizer outputs.`,
    },
    {
      id: "custom",
      title: "Custom calendar",
      body: "Build a 20–24 race calendar from the full circuit library.",
    },
  ];
  return (
    <section aria-label="Calendar source" className="rounded-lg border border-hairline bg-card p-3">
      <div className="grid gap-2 md:grid-cols-2" role="group" aria-label="Calendar source">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={source === c.id}
            className={`rounded border p-3 text-left transition-colors ${
              source === c.id ? "border-rosso bg-rosso/10" : "border-hairline hover:border-rosso"
            }`}
          >
            <span className="font-display text-sm font-bold tracking-widest uppercase">{c.title}</span>
            <span className="mt-1 block text-sm text-mute">{c.body}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

"use client";

import { Pinstripe } from "@/components/ui/Pinstripe";
import { TopBar } from "@/components/layout/TopBar";

interface Props {
  runId?: string;
  onBack?: () => void;
  children: React.ReactNode;
}

// Shared application shell: top bar + content + product footer.
export function AppShell({ runId, onBack, children }: Props) {
  return (
    <div className="min-h-screen bg-base text-ink">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <TopBar runId={runId} onBack={onBack} />
      </div>
      {children}
      <div className="mx-auto max-w-6xl px-4 pb-4">
        <footer className="text-xs text-mute">
          <Pinstripe className="mb-2 opacity-60" />
          Decision-support experiment, not an official F1 calendar. Distances are great-circle approximations; weather
          reflects the configured feasibility policy, not a forecast.
        </footer>
      </div>
    </div>
  );
}

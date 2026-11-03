"use client";

import { TopBar } from "@/components/layout/TopBar";
import { Toaster } from "@/components/ui/Toaster";

interface Props {
  runId?: string;
  onBack?: () => void;
  children: React.ReactNode;
}

// Shared application shell: top bar + content + product footer.
export function AppShell({ runId, onBack, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-base text-ink">
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6 lg:px-8">
        <TopBar runId={runId} onBack={onBack} />
      </div>
      {children}
      <div className="mx-auto mt-auto w-full max-w-[1440px] px-4 pb-6 sm:px-6 lg:px-8">
        <footer className="border-t border-hairline pt-4 text-xs leading-5 text-mute">
          Decision-support experiment, not an official F1 calendar. Distances are great-circle approximations; weather
          reflects the configured feasibility policy, not a forecast.
        </footer>
      </div>
      <Toaster />
    </div>
  );
}

import { Logo } from "./Logo";

export function LoadingScreen({ message = "Loading workspace…" }: { message?: string }) {
  return (
    <div className="forge-bg flex h-screen flex-col items-center justify-center gap-4">
      <Logo size="lg" />
      <div className="flex items-center gap-3 text-sm text-zinc-400">
        <div className="forge-spinner" />
        {message}
      </div>
    </div>
  );
}

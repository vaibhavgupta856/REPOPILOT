interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizes = {
  sm: { box: "h-8 w-8 text-sm", title: "text-base", sub: "hidden" },
  md: { box: "h-10 w-10 text-lg", title: "text-xl", sub: "text-xs" },
  lg: { box: "h-14 w-14 text-2xl", title: "text-2xl", sub: "text-sm" },
};

export function Logo({ size = "md", showText = true }: LogoProps) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-3">
      <div
        className={`forge-logo-glow flex ${s.box} items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 font-bold text-black shadow-lg`}
      >
        R
      </div>
      {showText && (
        <div>
          <h1 className={`${s.title} font-bold tracking-tight text-white`}>
            Repo<span className="text-orange-400">Pilot</span>
          </h1>
          {s.sub !== "hidden" && (
            <p className={`${s.sub} text-zinc-500`}>Autonomous engineering agent</p>
          )}
        </div>
      )}
    </div>
  );
}

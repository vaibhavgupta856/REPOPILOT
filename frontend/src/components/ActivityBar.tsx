export type SidebarView = "explorer" | "search" | "outline" | "settings";

interface ActivityBarProps {
  active: SidebarView;
  sidebarOpen: boolean;
  onSelect: (view: SidebarView) => void;
  onToggleSidebar: () => void;
}

const ITEMS: { id: SidebarView; icon: string; label: string }[] = [
  { id: "explorer", icon: "📁", label: "Explorer" },
  { id: "search", icon: "🔍", label: "Search" },
  { id: "outline", icon: "≡", label: "Outline" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

export function ActivityBar({ active, sidebarOpen, onSelect, onToggleSidebar }: ActivityBarProps) {
  return (
    <nav className="flex w-11 shrink-0 flex-col items-center border-r border-white/5 bg-[#0a0a0e] py-2">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          onClick={() => {
            if (active === item.id && sidebarOpen) onToggleSidebar();
            else onSelect(item.id);
          }}
          className={`mb-1 flex h-10 w-10 items-center justify-center rounded-lg text-base transition ${
            active === item.id && sidebarOpen
              ? "bg-white/10 text-orange-300 ring-1 ring-orange-500/30"
              : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          }`}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  );
}

interface GoToLineDialogProps {
  open: boolean;
  onClose: () => void;
  onGo: (line: number) => void;
}

export function GoToLineDialog({ open, onClose, onGo }: GoToLineDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[20vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        className="forge-glass-strong w-full max-w-sm overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const line = Number(fd.get("line"));
          if (line > 0) {
            onGo(line);
            onClose();
          }
        }}
      >
        <input
          autoFocus
          name="line"
          type="number"
          min={1}
          placeholder="Line number…"
          className="w-full border-b border-white/10 bg-transparent px-4 py-3 font-mono-forge text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
        <p className="px-4 py-2 text-[10px] text-zinc-600">Enter to go · Esc to cancel</p>
      </form>
    </div>
  );
}

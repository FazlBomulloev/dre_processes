export function Logo({ label = "EvoDash" }: { label?: string }) {
  return (
    <span className="flex items-center gap-2.5 text-white">
      <svg viewBox="0 0 24 20" className="h-5 w-6" aria-hidden>
        <rect x="1" y="11" width="5" height="8" rx="1.2" fill="#fff" />
        <rect x="9.5" y="6" width="5" height="13" rx="1.2" fill="#c5f135" />
        <rect x="18" y="1" width="5" height="18" rx="1.2" fill="#c5f135" />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">
        {label}
      </span>
    </span>
  );
}

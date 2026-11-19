const LIME = "#c5f135";

export function LogoMark() {
  return (
    <>
      <path
        d="M22.3 86.4A46 46 0 0 1 83 20.2"
        fill="none"
        stroke={LIME}
        strokeWidth="11"
      />
      <path
        d="M38 82L60 63"
        stroke="#fff"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M60 63L86 41"
        stroke={LIME}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle cx="38" cy="82" r="9" fill="#fff" />
      <circle cx="60" cy="63" r="9" fill="#fff" />
      <circle cx="86" cy="41" r="12" fill={LIME} />
    </>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex flex-col items-center gap-[7px] text-white">
      <svg
        viewBox="0 0 360 120"
        className={compact ? "h-auto w-[78px]" : "h-auto w-[148px]"}
        role="img"
        aria-label="DRE"
      >
        <LogoMark />
        <g fill="#fff" fillRule="evenodd">
          <path d="M142 25h46a16 16 0 0 1 16 16v38a16 16 0 0 1-16 16h-46zM158 40h28a2 2 0 0 1 2 2v36a2 2 0 0 1-2 2h-28z" />
          <path d="M218 25h48a14 14 0 0 1 14 14v15a14 14 0 0 1-11 13.7L283 95h-18l-13-27h-18v27h-16zM234 40h30a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-30z" />
          <path d="M296 25h62v15h-46v12.5h40v15h-40V80h46v15h-62z" />
        </g>
      </svg>
      {!compact && (
        <>
          <span className="whitespace-nowrap text-[8.5px] font-semibold leading-none tracking-[0.1em]">
            EVOLET · ВПЦ & RGS
          </span>
          <span className="whitespace-nowrap text-[8.5px] leading-none tracking-[0.06em] text-ink-fg-2">
            Offers. Registrations. Pipeline.
          </span>
        </>
      )}
    </span>
  );
}

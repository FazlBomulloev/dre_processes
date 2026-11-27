import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import clsx from "clsx";
import { useIsMobile } from "../../hooks/useIsMobile";
import BottomNav from "./BottomNav";
import Rail from "./Rail";
import TopBar from "./TopBar";

export default function Layout() {
  const mobile = useIsMobile();
  return (
    <div className="flex min-h-(--screen-h) flex-col">
      <div className="contents print:hidden">
        <TopBar />
        {!mobile && <Rail />}
      </div>
      <div className="flex flex-1 items-start pl-[calc(clamp(16px,2vw,28px)+72px)] max-md:pl-0 print:pl-0">
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
      {mobile && <div className="print:hidden"><BottomNav /></div>}
    </div>
  );
}

export function Page({
  maxWidth = 1280, dim = false, children,
}: {
  maxWidth?: number;
  dim?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      className={clsx(
        "anim-seq mx-auto flex w-full min-w-0 flex-col gap-6 px-[clamp(16px,3vw,40px)] pb-[72px] pt-6 max-md:gap-4 max-md:pb-8",
        dim && "page-dim",
      )}
      style={{ maxWidth }}
    >
      {children}
    </main>
  );
}

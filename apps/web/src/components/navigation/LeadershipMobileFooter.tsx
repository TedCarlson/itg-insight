// path: apps/web/src/components/navigation/LeadershipMobileFooter.tsx

"use client";

import { MoreHorizontal } from "lucide-react";

import NavLink from "@/components/navigation/NavLink";
import { buildMobileFooterItems } from "@/shared/navigation/mobile";
import type { ResolvedNavigationItem } from "@/shared/navigation/types";

type Props = {
  navItems: ResolvedNavigationItem[];
  onMore: () => void;
};

export default function LeadershipMobileFooter(props: Props) {
  const footerItems = buildMobileFooterItems(props.navItems);

  if (!footerItems.length) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {footerItems.map((item) => (
          <NavLink
            key={item.key}
            item={item}
            mobileLabel={item.mobileLabel}
            className="flex min-h-16 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px]"
            iconClassName="h-5 w-5"
          />
        ))}

        <button
          type="button"
          onClick={props.onMore}
          className="flex min-h-16 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] text-muted-foreground"
          aria-label="Open more navigation options"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
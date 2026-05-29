import type { ReactNode } from "react";

import CoreNav from "@/components/CoreNav";
import AppChrome from "@/components/AppChrome";
import { OrgProvider } from "@/state/org";
import { AccessProvider } from "@/state/access";

export default function LocateLayout({ children }: { children: ReactNode }) {
  return (
    <OrgProvider lob="LOCATE">
      <AccessProvider>
        <div className="min-h-screen">
          <CoreNav lob="LOCATE" />
          <AppChrome>{children}</AppChrome>
        </div>
      </AccessProvider>
    </OrgProvider>
  );
}

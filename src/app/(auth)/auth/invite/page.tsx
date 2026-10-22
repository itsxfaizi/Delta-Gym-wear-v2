import type { Metadata } from "next";

import { InviteLanding } from "@/components/account/invite-landing";

export const metadata: Metadata = {
  title: "Accept your staff invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function StaffInvitePage() {
  return <InviteLanding />;
}

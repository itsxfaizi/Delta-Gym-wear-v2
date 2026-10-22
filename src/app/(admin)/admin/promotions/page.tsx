import { PromoManager } from "@/components/admin/promo-manager";
import { resolveAdminAccess } from "@/server/admin/guard";
import { listPromotions } from "@/server/promotions/queries";

import "@/styles/promotions.css";

export const metadata = { title: "Promo codes — Delta admin" };

export default async function PromotionsPage() {
  const access = await resolveAdminAccess();
  const isOwner = access.state === "granted" && access.principal.membership.role === "owner";
  if (!isOwner) return <div className="admin-header"><div><h1>Promo codes</h1>
    <p className="admin-hint">Only an owner can manage promo codes.</p></div></div>;
  const promotions = await listPromotions();
  return <><div className="admin-header"><div><h1>Promo codes</h1>
    <p className="admin-hint">Discounts apply to merchandise before shipping. One code can be used per order.</p>
  </div></div><PromoManager promotions={promotions} /></>;
}

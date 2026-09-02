import Link from "next/link";

export default function NotFound() {
  return (
    <main className="route-state">
      <p className="section-label">Order</p>
      <h1>Order not found</h1>
      <p>Check the confirmation link or contact Delta Gym Wear support.</p>
      <Link className="primary-link" href="/shop">Continue shopping</Link>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";

import { NewsletterForm } from "@/components/ui/newsletter-form";

/**
 * Frame 142:5060 — the "STAY IN THE LOOP / NO FLUFF. JUST DROPS." newsletter
 * band over the invert footer, with the giant ghost DELTA wordmark bleeding off
 * the bottom-left.
 *
 * Composition measured off the authoritative prototype recording at f894:
 * three link columns at design x 806.5 / 1049 / 1288.5 (SHOP / BRAND / SUPPORT),
 * brand blurb on two lines, then three contact lines at 37.5px pitch, then the
 * ghost wordmark at design x 64, 348px wide, bleeding off the viewport bottom.
 *
 * Link destinations that have no route in this repo are rendered as plain text
 * rather than dead links: the four SHOP category names (the catalog model has
 * no category taxonomy, so all four would resolve to the same unfiltered list)
 * and Sizing Guide / Returns / FAQs (each implies unwritten policy content).
 *
 * `compact` is the home-route variant: home-view.tsx renders its own newsletter
 * section directly above this footer, so the band is suppressed there rather
 * than shipping two capture forms on one page.
 */
export function StorefrontFooter({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {!compact ? (
        <section className="landing-newsletter" aria-labelledby="footer-newsletter-title">
          <p>Stay in the loop</p>
          <h2 id="footer-newsletter-title">No fluff. Just drops.</h2>
          <p>New product launches, training content, and brand updates. That&rsquo;s it. We don&rsquo;t do noise.</p>
          <NewsletterForm idPrefix="footer-newsletter" />
        </section>
      ) : null}

      <footer id="contact" className="site-footer relative overflow-hidden">
        <section className="footer-identity relative z-10">
          <Link className="footer-brand" href="/" aria-label="Delta Gym Wear home">
            <Image src="/design-reference/assets/delta-logo.svg" width={147} height={37} alt="Delta Gym Wear" unoptimized />
          </Link>
          <p>Gymwear for men and women who train with intent. Born in Pakistan, with a focus on fit, movement, and purposeful design.</p>
          <address>
            <a href="tel:+923285386793">+92-328-5386793</a>
            <a href="mailto:info@deltagymwear.com">info@deltagymwear.com</a>
            <a href="https://www.deltagymwear.com">www.deltagymwear.com</a>
          </address>
        </section>
        <nav aria-label="Shop links" className="relative z-10">
          <strong>Shop</strong>
          <span>Compression T-shirts</span>
          <span>Performance Leggings</span>
          <span>Training Tank Tops</span>
          <span>Functional Trousers</span>
          <Link href="/shop">All Products</Link>
        </nav>
        <nav aria-label="Brand links" className="relative z-10">
          <strong>Brand</strong>
          <Link href="/#philosophy">About Delta</Link>
        </nav>
        <nav aria-label="Support links" className="relative z-10">
          <strong>Support</strong>
          <Link href="/track-order">Track your order</Link>
          <span>Sizing Guide</span>
          <span>Returns</span>
          <span>FAQs</span>
        </nav>
        {/*
          Decorative type, not a vector asset; colour token measured off 142:5060.
          Client request 2026-09-27: it sits on its own full-width row BELOW the
          description and contact block instead of behind it, and the footer is
          taller to make room. See .footer-ghost in globals.css.
        */}
        <span aria-hidden="true" className="footer-ghost">DELTA</span>
      </footer>
    </>
  );
}

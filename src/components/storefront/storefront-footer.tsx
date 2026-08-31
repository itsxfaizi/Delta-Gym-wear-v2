import Image from "next/image";
import Link from "next/link";
import { forwardRef } from "react";

export const StorefrontFooter = forwardRef<HTMLElement, { compact?: boolean }>(function StorefrontFooter({ compact = false }, ref) {
  return (
    <footer ref={ref} id="contact" className={`site-footer${compact ? " site-footer--compact" : ""}`}>
      <section className="footer-identity">
        <Link className="footer-brand" href="/" aria-label="Delta Gym Wear home">
          <Image src="/design-reference/assets/delta-logo.svg" width={147} height={37} alt="Delta Gym Wear" unoptimized />
        </Link>
        <p>Performance gymwear engineered for discipline. Built in Islamabad for those who train with intent.</p>
        <address><a href="tel:+923285386793">+92-328-5386793</a><a href="mailto:info@deltagymwear.com">info@deltagymwear.com</a><a href="https://deltagymwear.com">www.deltagymwear.com</a></address>
      </section>
      <nav aria-label="Shop links"><strong>Shop</strong><Link href="/shop">Compression T-shirts</Link><Link href="/shop">Performance Leggings</Link><Link href="/shop">Training Tank Tops</Link><Link href="/shop">Functional Trousers</Link><Link href="/shop">All Products</Link></nav>
      <nav aria-label="Brand links"><strong>Brand</strong><Link href="/#philosophy">About Delta</Link></nav>
      {!compact ? <nav aria-label="Support links"><strong>Support</strong><Link href="/#contact">Contact Us</Link><span>Sizing Guide</span><span>Returns</span><span>FAQs</span></nav> : null}
      <p className="footer-copyright">DELTA © 2023 All Rights Reserved</p>
    </footer>
  );
});

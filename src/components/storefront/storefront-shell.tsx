"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { cartStorageKey, restoreCartLines, serializeCartLines, type ResolvedCartLine } from "@/features/catalog/cart";
import { formatMoney } from "@/features/catalog/money";
import type { CatalogProduct, CatalogVariant } from "@/features/catalog/types";

import { StorefrontFooter } from "./storefront-footer";

export type CartLine = ResolvedCartLine;
type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (product: CatalogProduct, variant: CatalogVariant) => boolean;
  update: (key: string, quantity: number) => void;
  clear: () => void;
  open: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider missing");
  return value;
}

function StorefrontIcon({ name }: { name: string }) {
  return <Image src={`/design-reference/assets/icons/${name}.svg`} width={24} height={24} alt="" aria-hidden="true" unoptimized />;
}

const NAVIGATION = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/collections/all", label: "Collection" },
] as const;

const HOME_NAVIGATION = [
  { href: "/shop", label: "Shop" },
  { href: "#philosophy", label: "About" },
  { href: "#contact", label: "Contact Us" },
] as const;

export function StorefrontShell({ children, catalog }: { children: React.ReactNode; catalog: readonly CatalogProduct[] }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const navigation = isHome ? HOME_NAVIGATION : NAVIGATION;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hasRestoredCart, setHasRestoredCart] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(cartStorageKey());
      const restoredLines = restoreCartLines(stored ? JSON.parse(stored) : [], catalog);
      queueMicrotask(() => {
        setLines(restoredLines);
        setHasRestoredCart(true);
      });
    } catch {
      queueMicrotask(() => {
        setAnnouncement("Your saved cart could not be restored.");
        setHasRestoredCart(true);
      });
    }
  }, [catalog]);

  useEffect(() => {
    if (!hasRestoredCart) return;
    try {
      window.localStorage.setItem(cartStorageKey(), JSON.stringify(serializeCartLines(lines)));
    } catch {
      queueMicrotask(() => setAnnouncement("Your cart could not be saved."));
    }
  }, [hasRestoredCart, lines]);

  useEffect(() => {
    if (!isCartOpen) return;
    const pageRegions = [headerRef.current, mainRef.current, footerRef.current].filter((region): region is HTMLElement => region !== null);
    pageRegions.forEach((region) => { region.inert = true; });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    returnFocusRef.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsCartOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>("[data-cart-dialog]");
      const focusables = dialog ? [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')] : [];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      pageRegions.forEach((region) => { region.inert = false; });
      document.body.style.overflow = previousOverflow;
    };
  }, [isCartOpen]);

  useEffect(() => {
    if (!isCartOpen) returnFocusRef.current?.focus();
  }, [isCartOpen]);

  const add = (product: CatalogProduct, variant: CatalogVariant) => {
    if (!variant.isAvailable) return false;
    const key = `${product.handle}:${variant.id}`;
    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      return existing
        ? current.map((line) => line.key === key ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line)
        : [...current, { key, product, variant, quantity: 1 }];
    });
    setAnnouncement(`${product.title}, ${variant.color ?? ""} ${variant.size ?? ""}, added to cart.`);
    setIsCartOpen(true);
    return true;
  };

  const update = (key: string, quantity: number) => {
    setLines((current) => quantity < 1
      ? current.filter((line) => line.key !== key)
      : current.map((line) => line.key === key ? { ...line, quantity: Math.min(99, quantity) } : line));
    setAnnouncement(quantity < 1 ? "Item removed from cart." : "Cart updated.");
  };

  const clear = () => {
    setLines([]);
    setAnnouncement("Cart cleared after order placement.");
  };

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.variant.priceAmount * line.quantity, 0);
  const context = useMemo(() => ({ lines, count, subtotal, add, update, clear, open: () => setIsCartOpen(true) }), [lines, count, subtotal]);

  return (
    <CartContext.Provider value={context}>
      <header ref={headerRef} className={`site-header ${isHome ? "site-header--home" : ""}`}>
        <button className="menu-trigger" type="button" aria-expanded={isMenuOpen} aria-controls="primary-navigation" onClick={() => setIsMenuOpen((open) => !open)}>
          {isMenuOpen ? "Close" : "Menu"}
        </button>
        <nav id="primary-navigation" className={isMenuOpen ? "is-open" : ""} aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => setIsMenuOpen(false)}>{item.label}</Link>
          ))}
        </nav>
        <Link className="brand" href="/" aria-label="Delta Gym Wear home">
          <Image src={isHome ? "/design-reference/assets/delta-logo.svg" : "/design-reference/assets/delta-logo-dark.svg"} width={147} height={37} alt="Delta Gym Wear" priority unoptimized />
        </Link>
        <div className="header-actions">
          <Link className="icon-button" href="/shop#catalog-search" aria-label="Search products"><StorefrontIcon name="search" /></Link>
          <button className="icon-button cart-trigger" type="button" aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`} onClick={() => setIsCartOpen(true)}>
            <StorefrontIcon name={count ? "bag-filled" : "bag"} />
            <span className="cart-count" aria-hidden="true">{count}</span>
          </button>
        </div>
      </header>

      <div ref={mainRef} id="main-content">{children}</div>

      {!isHome ? <StorefrontFooter ref={footerRef} /> : null}

      <p className="sr-only" aria-live="polite">{announcement}</p>
      {isCartOpen ? (
        <>
          <div className="drawer-backdrop" onClick={() => setIsCartOpen(false)} aria-hidden="true" />
          <aside className="cart-drawer" data-cart-dialog role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <div className="drawer-header">
              <h2 id="cart-title">YOUR CART <span>({count})</span></h2>
              <button ref={closeRef} className="icon-button" type="button" aria-label="Close cart" onClick={() => setIsCartOpen(false)}><StorefrontIcon name="cross" /></button>
            </div>
            {lines.length === 0 ? (
              <div className="empty-state drawer-empty"><p>Your cart is empty.</p><Link href="/shop" onClick={() => setIsCartOpen(false)}>Continue shopping</Link></div>
            ) : (
              <>
                <div className="drawer-scroll"><CartLines lines={lines} update={update} /></div>
                <div className="drawer-footer">
                  <div className="drawer-total"><span>SUBTOTAL</span><strong>{formatMoney(subtotal, lines[0]?.variant.currency ?? "PKR")}</strong></div>
                  <Link className="primary-cta drawer-cart-link" href="/checkout" onClick={() => setIsCartOpen(false)}>Check out</Link>
                  <Link className="text-button drawer-cart-link" href="/cart" onClick={() => setIsCartOpen(false)}>View cart</Link>
                  <p className="drawer-note">Cash on Delivery only. We confirm by phone or WhatsApp before dispatch.</p>
                </div>
              </>
            )}
          </aside>
        </>
      ) : null}
    </CartContext.Provider>
  );
}

export function CartLines({ lines, update }: Pick<CartContextValue, "lines" | "update">) {
  return (
    <ul className="cart-lines">
      {lines.map((line) => (
        <li key={line.key}>
          <Image src={line.product.images[0]?.src ?? ""} width={100} height={113} alt={line.product.images[0]?.alt || line.product.title} />
          <div className="cart-line-content">
            <h3><Link href={`/products/${line.product.handle}`}>{line.product.title}</Link></h3>
            <p>{line.variant.color ?? ""} / {line.variant.size ?? ""}</p>
            <p>{formatMoney(line.variant.priceAmount, line.variant.currency)}</p>
            <div className="quantity">
              <button type="button" aria-label={`Decrease quantity of ${line.product.title}`} disabled={line.quantity <= 1} onClick={() => update(line.key, line.quantity - 1)}><StorefrontIcon name="minus" /></button>
              <span aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
              <button type="button" aria-label={`Increase quantity of ${line.product.title}`} disabled={line.quantity >= 99} onClick={() => update(line.key, line.quantity + 1)}><StorefrontIcon name="add" /></button>
            </div>
            <button className="text-button" type="button" onClick={() => update(line.key, 0)}>Remove</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

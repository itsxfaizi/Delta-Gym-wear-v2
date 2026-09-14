"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Bell, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchOrderAlertSnapshot } from "@/features/admin/alerts-actions";
import {
  ORDER_ALERT_INTERVAL_MS,
  alertTitle,
  countNewOrders,
  describeAlert,
  type OrderAlertSnapshot,
} from "@/features/admin/order-alerts";

/**
 * Tells the operator an order arrived without moving anything they are working on.
 *
 * The banner is the only thing that changes; the table refreshes when THEY click.
 * Re-sorting a list under someone mid-click is how fulfilment mistakes happen.
 *
 * Two triggers converge on the same check(): a Supabase Realtime subscription on
 * `orders` (instant), and a 30s poll that pauses while the tab is hidden (the
 * fallback for when the channel cannot connect). The RLS policy only streams rows
 * to an authenticated member of the tenant, so an unauthenticated page gets
 * nothing and silently falls back to polling.
 */
export function NewOrderAlerts({ snapshot }: { snapshot: OrderAlertSnapshot }) {
  const router = useRouter();
  const baseline = useRef<OrderAlertSnapshot>(snapshot);
  const [newCount, setNewCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // The baseline resets by remounting: the layout keys this on the newest order,
  // so a server render the operator can see is, by definition, already seen.

  const check = useCallback(async () => {
    try {
      const current = await fetchOrderAlertSnapshot();
      setNewCount(countNewOrders(baseline.current, current));
    } catch {
      // A failed poll is not worth interrupting anyone over; the next one retries.
    }
  }, []);

  // Realtime: push instead of poll. Failure here is not fatal — the interval below
  // keeps running regardless, so a blocked websocket degrades rather than breaks.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createBrowserClient(url, key);
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        void check();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        void check();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [check]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer === null) timer = setInterval(check, ORDER_ALERT_INTERVAL_MS);
    }
    function stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }
    function onVisibility() {
      if (document.hidden) stop();
      else {
        void check();
        start();
      }
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [check]);

  // The count belongs in the title too, or a backgrounded tab says nothing.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = alertTitle(newCount, base);
    return () => {
      document.title = base;
    };
  }, [newCount]);

  if (newCount <= 0 || dismissed) return null;

  return (
    <div className="order-alert" role="status" aria-live="polite">
      <Bell aria-hidden="true" />
      <span>{describeAlert(newCount)} since you opened this page.</span>
      <button className="admin-button admin-button--primary" type="button" onClick={() => router.refresh()}>
        Show
      </button>
      <button className="icon-button" type="button" aria-label="Dismiss" onClick={() => setDismissed(true)}>
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

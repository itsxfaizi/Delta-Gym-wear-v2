import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind utility conflicts without changing Delta's semantic CSS-token ownership. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskPII(value: string | undefined | null, type: 'phone' | 'email' = 'phone') {
  if (!value) return "Unavailable";
  if (type === 'phone') {
    return value.length > 7 
      ? value.replace(/^(\d{4})\d+(\d{3})$/, "$1****$2")
      : "****" + value.slice(-3);
  }
  return value;
}

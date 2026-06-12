import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases';

/**
 * The native unlock — CLIENT state only, never server state (ADR 0018: the server is the Host's
 * own; a self-hoster can flip any flag in their D1, so the Worker carries zero payment code).
 * The store of record is the App Store via RevenueCat: a price-0 "30-day Trial" non-consumable
 * (App Store guideline 3.1.1) starts the clock as an Apple-timestamped transaction — survives
 * reinstall, works offline — and the one-time unlock grants the `pro` entitlement forever.
 *
 * Same external-store shape as `server.ts`: module-scope state + `useSyncExternalStore`, so the
 * root gate re-renders when a purchase or restore flips the entitlement. Android ships dev-build
 * only in v1 (and the web export never sells) — both bypass to `unlocked`, as does a build with
 * no RevenueCat key (the key arrives via `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, inlined at build time).
 *
 * v1 LAUNCHES FREE — DELIBERATELY. `eas.json`'s production profile carries NO RevenueCat key, so
 * store builds bypass the gate and hide every purchase surface. This is the chosen launch state,
 * not a missing secret. The later paid flip: create the IAPs + the RevenueCat App Store app, put
 * the `appl_` public key in eas.json's production env, and grandfather free-era installs via the
 * receipt's `originalApplicationVersion` (on `CustomerInfo`) in `derive()`.
 */
export const TRIAL_PRODUCT_ID = 'sufra_trial_30';
export const UNLOCK_PRODUCT_ID = 'sufra_unlock';
const PRO_ENTITLEMENT = 'pro';
const TRIAL_DAYS = 30;

export type Entitlement =
  | { kind: 'loading' }
  | { kind: 'unlocked' }
  | { kind: 'trial'; endsAt: Date }
  | { kind: 'trialAvailable' }
  | { kind: 'expired' };

const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const gated = Platform.OS === 'ios' && !!apiKey;

/** Whether this build enforces the unlock — surfaces (the Profile row) hide on bypassed builds. */
export const unlockGated = gated;

if (Platform.OS === 'ios' && !apiKey) {
  console.warn('EXPO_PUBLIC_REVENUECAT_IOS_KEY is unset — the unlock gate is BYPASSED in this build.');
}

let state: Entitlement = gated ? { kind: 'loading' } : { kind: 'unlocked' };
const listeners = new Set<() => void>();
let started = false;

function set(next: Entitlement): void {
  state = next;
  listeners.forEach((notify) => notify());
}

function derive(info: CustomerInfo): Entitlement {
  if (info.entitlements.active[PRO_ENTITLEMENT]) return { kind: 'unlocked' };
  const purchasedAt = info.allPurchaseDates[TRIAL_PRODUCT_ID];
  if (!purchasedAt) return { kind: 'trialAvailable' };
  const endsAt = new Date(new Date(purchasedAt).getTime() + TRIAL_DAYS * 86_400_000);
  return endsAt.getTime() > Date.now() ? { kind: 'trial', endsAt } : { kind: 'expired' };
}

function start(): void {
  if (started || !gated) return;
  started = true;
  Purchases.configure({ apiKey: apiKey! });
  Purchases.addCustomerInfoUpdateListener((info) => set(derive(info)));
  Purchases.getCustomerInfo()
    .then((info) => set(derive(info)))
    // No cached CustomerInfo and no network (first-ever launch offline): fall open to the trial
    // screen — a prior purchaser recovers via Restore once online.
    .catch(() => set({ kind: 'trialAvailable' }));
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The root gate's reactive read — flips when a purchase, restore, or trial expiry lands. */
export function useEntitlement(): Entitlement {
  return useSyncExternalStore(subscribe, () => state);
}

/** Thrown purchase errors where the user just dismissed the sheet — not an error state. */
export function isUserCancelled(error: unknown): boolean {
  return (error as PurchasesError).userCancelled === true;
}

async function packageFor(productId: string): Promise<PurchasesPackage> {
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages.find((p) => p.product.identifier === productId);
  if (!pkg) throw new Error(`Product ${productId} is missing from the current offering`);
  return pkg;
}

/** The unlock's localized price for the paywall button, or null while/if the store is unreachable. */
export async function fetchUnlockPriceString(): Promise<string | null> {
  try {
    const pkg = await packageFor(UNLOCK_PRODUCT_ID);
    return pkg.product.priceString;
  } catch {
    return null;
  }
}

export async function startTrial(): Promise<void> {
  const { customerInfo } = await Purchases.purchasePackage(await packageFor(TRIAL_PRODUCT_ID));
  set(derive(customerInfo));
}

export async function purchaseUnlock(): Promise<void> {
  const { customerInfo } = await Purchases.purchasePackage(await packageFor(UNLOCK_PRODUCT_ID));
  set(derive(customerInfo));
}

/** Returns the post-restore entitlement so the paywall can say "nothing to restore" honestly. */
export async function restorePurchases(): Promise<Entitlement> {
  const next = derive(await Purchases.restorePurchases());
  set(next);
  return next;
}

export function trialDaysLeft(endsAt: Date): number {
  return Math.max(1, Math.ceil((endsAt.getTime() - Date.now()) / 86_400_000));
}

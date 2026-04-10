

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = typeof window !== "undefined" ? localStorage.getItem("sahayaa_token") : null;
  const sessionId = typeof window !== "undefined" ? localStorage.getItem("sh_device_hash") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (sessionId) headers["X-Session-Id"] = sessionId;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Session / Auth ──────────────────────────────────────────────────────────

/** Create or retrieve anonymous session. Stores session_id in localStorage. */
export async function initSession(): Promise<AnonSession> {
  let sessionId = localStorage.getItem("sh_device_hash");
  if (!sessionId) {
    sessionId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("sh_device_hash", sessionId);
  }
  const data = await apiFetch("/api/auth/session", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
  return data;
}

/** Fetch current session profile including subscription */
export async function getMe(): Promise<AnonSession & { subscription: Subscription | null }> {
  return apiFetch("/api/auth/me");
}

/** Admin JWT login */
export async function adminLogin(email: string, password: string): Promise<{ token: string; user: AdminUser }> {
  return apiFetch("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ─── Machines ────────────────────────────────────────────────────────────────

export async function listMachines(params?: { search?: string; status?: string; area?: string }): Promise<Machine[]> {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch(`/api/machines${q ? `?${q}` : ""}`);
}

export async function getMachine(id: number): Promise<Machine & { inventory: InventoryItem[] }> {
  return apiFetch(`/api/machines/${id}`);
}

export async function createMachine(data: CreateMachineInput): Promise<{ success: boolean; machine: Machine }> {
  return apiFetch("/api/machines", { method: "POST", body: JSON.stringify(data) });
}

export async function updateMachine(id: number, data: Partial<CreateMachineInput>): Promise<{ success: boolean; machine: Machine }> {
  return apiFetch(`/api/machines/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteMachine(id: number): Promise<{ success: boolean }> {
  return apiFetch(`/api/machines/${id}`, { method: "DELETE" });
}

export async function getNearestMachine(lat: number, lng: number, productId?: number): Promise<{ machine: Machine; distance_km: number }> {
  return apiFetch("/api/machines/nearest", {
    method: "POST",
    body: JSON.stringify({ lat, lng, product_id: productId }),
  });
}

export async function getEmergencyMachine(): Promise<{ machine: Machine | null; type?: string; fallback?: string[] }> {
  return apiFetch("/api/machines/emergency");
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function getProducts(params?: { brand?: string; type?: string }): Promise<Product[]> {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch(`/api/products${q ? `?${q}` : ""}`);
}

export async function getBrands(): Promise<Brand[]> {
  return apiFetch("/api/products/brands");
}

export async function getProductTypes(): Promise<string[]> {
  return apiFetch("/api/products/types");
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export async function getMachineInventory(machineId: number): Promise<InventoryItem[]> {
  return apiFetch(`/api/inventory/machine/${machineId}`);
}

export async function setInventory(data: { machine_id: number; product_id: number; quantity: number; sponsored_quantity?: number }): Promise<InventoryItem> {
  return apiFetch("/api/inventory", { method: "POST", body: JSON.stringify(data) });
}

export async function updateInventoryItem(invId: number, data: { quantity?: number; sponsored_quantity?: number }): Promise<InventoryItem> {
  return apiFetch(`/api/inventory/${invId}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function bulkUpdateInventory(machineId: number, items: Array<{ product_id: number; quantity: number; sponsored_quantity?: number }>): Promise<{ success: boolean; updated: InventoryItem[] }> {
  return apiFetch("/api/inventory/bulk", {
    method: "POST",
    body: JSON.stringify({ machine_id: machineId, items }),
  });
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export async function getPlans(): Promise<Plan[]> {
  return apiFetch("/api/subscriptions/plans");
}

export async function subscribe(sessionId: string, plan: string): Promise<{ success: boolean; subscription: Subscription }> {
  return apiFetch("/api/subscriptions", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, plan }),
  });
}

export async function getSubscription(sessionId: string): Promise<{ subscription: Subscription | null }> {
  return apiFetch(`/api/subscriptions/${sessionId}`);
}

export async function cancelSubscription(sessionId: string): Promise<{ success: boolean; message: string }> {
  return apiFetch("/api/subscriptions/cancel", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

// ─── Dispense ────────────────────────────────────────────────────────────────

export type DispenseMode = "pay" | "subscription" | "community" | "sponsor_request";

export async function checkDispenseEligibility(sessionId: string): Promise<DispenseCheck> {
  return apiFetch("/api/dispense/check", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function dispense(params: {
  session_id: string;
  product_id: number;
  quantity?: number;
  lat?: number;
  lng?: number;
  machine_id?: number;
  mode: DispenseMode;
  payment_method?: string;
  area?: string;
}): Promise<DispenseResult> {
  return apiFetch("/api/dispense", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ─── Donate ──────────────────────────────────────────────────────────────────

export async function createDonation(params: {
  session_id: string;
  brand?: string;
  product_type?: string;
  qty: number;
  lat?: number;
  lng?: number;
  area?: string;
}): Promise<DonationResult> {
  return apiFetch("/api/donate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getDonationImpact(): Promise<DonationImpact> {
  return apiFetch("/api/donate/impact");
}

// ─── Live Care / NeedSignals ─────────────────────────────────────────────────

export async function getLiveSignals(area?: string): Promise<LiveSignalsResponse> {
  return apiFetch(`/api/livecare/signals${area ? `?area=${encodeURIComponent(area)}` : ""}`);
}

export async function createNeedSignal(params: {
  session_id: string;
  lat?: number;
  lng?: number;
  area?: string;
  brand?: string;
  product_type?: string;
  product_id?: number;
  qty?: number;
}): Promise<{ success: boolean; signal: NeedSignal; message: string }> {
  return apiFetch("/api/livecare/signal", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function sponsorSignal(signalId: number, params: {
  session_id: string;
  sponsor_method: "digital" | "physical" | "subscription";
}): Promise<SponsorResult> {
  return apiFetch(`/api/livecare/sponsor/${signalId}`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getLiveCareStats(): Promise<LiveCareStats> {
  return apiFetch("/api/livecare/stats");
}

// ─── Pharmacies ──────────────────────────────────────────────────────────────

export async function findNearbyPharmacies(lat: number, lng: number, radius = 2000): Promise<PharmacyResponse> {
  return apiFetch("/api/pharmacies/nearby", {
    method: "POST",
    body: JSON.stringify({ lat, lng, radius }),
  });
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getOverviewStats(): Promise<OverviewStats> {
  return apiFetch("/api/stats/overview");
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return apiFetch("/api/stats/leaderboard");
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function getTransactions(params?: { machine_id?: number; page?: number }): Promise<TransactionsResponse> {
  const q = new URLSearchParams(params as any).toString();
  return apiFetch(`/api/transactions${q ? `?${q}` : ""}`);
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function adminGetStats(): Promise<AdminStats> {
  return apiFetch("/api/admin/stats");
}

export async function adminListMachines(): Promise<(Machine & { inventory: InventoryItem[]; transaction_count: number })[]> {
  return apiFetch("/api/admin/machines");
}

export async function adminGetPool(): Promise<{ pool: CommunityPool; product_breakdown: GlobalPoolItem[] }> {
  return apiFetch("/api/admin/pool");
}

// ─── Geocode ─────────────────────────────────────────────────────────────────

export async function reverseGeocode(lat: number, lng: number): Promise<{ area: string; city: string }> {
  return apiFetch("/api/geocode/reverse", {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnonSession {
  session_id: string;
  area: string;
  total_donated: number;
  total_sponsored: number;
  total_received: number;
  last_claim_date: string | null;
  badges: string[];
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface Machine {
  id: number;
  name: string;
  location: string;
  area: string;
  latitude: number;
  longitude: number;
  status: "active" | "inactive" | "maintenance";
  is_free_zone: boolean;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  created_at: string;
}

export interface CreateMachineInput {
  name?: string;
  location?: string;
  latitude: number;
  longitude: number;
  status?: string;
  is_free_zone?: boolean;
  initial_quantity?: number;
}

export interface Product {
  id: number;
  brand: string;
  name: string;
  tagline: string;
  description: string;
  type: string;
  price: number;
  color_accent: string;
  image_url: string;
  logo_url: string;
}

export interface Brand {
  id: string;
  name: string;
  tagline: string;
  color: string;
  logo_url: string;
}

export interface InventoryItem {
  id: number;
  machine_id: number;
  product_id: number;
  product_name: string;
  brand: string;
  quantity: number;
  sponsored_quantity: number;
  last_restocked: string | null;
}

export interface Plan {
  id: string;
  name: string;
  price_inr: number;
  pads_per_month: number;
  description: string;
}

export interface Subscription {
  plan: string;
  plan_name: string;
  price_inr: number;
  pads_remaining: number;
  pads_total: number;
  status: string;
  is_valid: boolean;
  activated_at: string;
  expires_at: string;
}

export interface DispenseCheck {
  can_claim: boolean;
  last_claim_date: string | null;
  next_claim_time: string | null;
  subscription: Subscription | null;
  subscription_valid: boolean;
  donated_pads_available: boolean;
  available_modes: Array<{ id: string; label: string; description: string }>;
}

export interface DispenseResult {
  success: boolean;
  transaction_id: string;
  machine: Machine | null;
  product: Product;
  quantity: number;
  amount: number;
  distance_km?: number;
  message: string;
  subscription_pads_remaining?: number;
  mode?: string;
  signal?: NeedSignal;
}

export interface DonationResult {
  success: boolean;
  donation: {
    id: number;
    brand: string;
    product_type: string;
    qty: number;
    area: string;
    created_at: string;
  };
  pool: CommunityPool;
  impact: {
    your_total_donated: number;
    donated_today_all: number;
    pool_available: number;
    message: string;
  };
}

export interface DonationImpact {
  total_donated: number;
  total_dispensed: number;
  total_available: number;
  donated_today: number;
  people_helped: number;
  product_breakdown: Array<{
    product_id: number;
    product_name: string;
    brand: string;
    available: number;
  }>;
}

export interface NeedSignal {
  id: number;
  session_id: string;
  area: string;
  user_lat: number | null;
  user_lng: number | null;
  nearest_machine: { id: number; name: string; location: string; area: string; latitude: number; longitude: number } | null;
  brand: string | null;
  product_type: string | null;
  product_id: number | null;
  qty: number;
  status: "open" | "matched" | "expired" | "fulfilled";
  sponsored_by: string | null;
  sponsor_method: string | null;
  fulfilled_at: string | null;
  expires_at: string;
  created_at: string;
  minutes_left: number;
}

export interface LiveSignalsResponse {
  signals: NeedSignal[];
  total_open: number;
  recently_matched: number;
  avg_response_time_mins: number | null;
}

export interface SponsorResult {
  success: boolean;
  message: string;
  signal: NeedSignal;
  recipient_nearest_machine: { name: string; location: string; area: string; latitude: number; longitude: number } | null;
  pool_remaining: number;
  sponsor_method: string;
}

export interface LiveCareStats {
  requests_today: number;
  fulfilled_today: number;
  fulfillment_rate_pct: number;
  total_all_time: number;
  total_fulfilled: number;
  top_supporters: Array<{ id: string; total_sponsored: number; area: string }>;
}

export interface PharmacyResponse {
  pharmacies: Pharmacy[];
  total: number;
  radius_m: number;
  location: { lat: number; lng: number };
  source: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  distance_km: number;
  phone: string | null;
  timings: string;
  lat: number;
  lng: number;
}

export interface OverviewStats {
  total_pads_dispensed: number;
  total_donations: number;
  total_donated_pads: number;
  pool_available: number;
  cities_covered: number;
  people_helped: number;
  active_machines: number;
  total_machines: number;
  active_subscribers: number;
}

export interface LeaderboardEntry {
  id: string;
  total_donated: number;
  total_sponsored: number;
  total_impact: number;
  area: string;
  badges: string[];
}

export interface Transaction {
  id: number;
  transaction_id: string;
  session_id: string;
  machine_id: number | null;
  machine_name: string;
  product_id: number | null;
  product_name: string;
  amount: number;
  quantity: number;
  type: string;
  payment_method: string;
  status: string;
  timestamp: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  pages: number;
  current_page: number;
}

export interface AdminStats {
  overview: {
    total_machines: number;
    active_machines: number;
    total_txns: number;
    total_revenue_inr: number;
    today_txns: number;
    today_revenue_inr: number;
    active_subscribers: number;
  };
  most_used_machines: Array<{ name: string; location: string; txn_count: number }>;
  low_stock_alerts: Array<{
    inventory_id: number;
    machine_id: number;
    machine_name: string;
    product_id: number;
    product_name: string;
    quantity: number;
    sponsored: number;
  }>;
}

export interface CommunityPool {
  total_donated: number;
  total_available: number;
  total_dispensed: number;
}

export interface GlobalPoolItem {
  product_id: number;
  product_name: string;
  count: number;
}
// Server-only access to the Nilo project. The company is fixed per deployment by NILO_COMPANY
// and never taken from the browser; approvers come from NILO_APPROVER_EMAILS.
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import type { Company } from "./ledger";

export type NiloSession = { email: string; company: Company; isApprover: boolean; db: SupabaseClient };

export async function niloSession(): Promise<NiloSession | null> {
  const {
    data: { user },
  } = await (await createSessionClient()).auth.getUser();
  if (!user?.email) return null;

  const company = process.env.NILO_COMPANY;
  const url = process.env.NILO_SUPABASE_URL;
  const key = process.env.NILO_SERVICE_ROLE_KEY;
  if ((company !== "royal" && company !== "impala") || !url || !key) {
    throw new Error("Nilo is not configured (NILO_COMPANY, NILO_SUPABASE_URL, NILO_SERVICE_ROLE_KEY)");
  }
  const approvers = (process.env.NILO_APPROVER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return {
    email: user.email,
    company,
    isApprover: approvers.includes(user.email.toLowerCase()),
    db: createSupabase(url, key, { auth: { autoRefreshToken: false, persistSession: false } }),
  };
}

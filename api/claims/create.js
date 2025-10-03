// /api/claims/create.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// einfache, eindeutige Schadennummer
function genClaimNumber() {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CL-${ts}-${rnd}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // optional: Basic Origin-Check (gleiche Domain)
    // const allowed = process.env.ALLOWED_ORIGIN || "https://schadenaufnahme.vercel.app";
    // if ((req.headers.origin || req.headers.referer || "").indexOf(allowed) !== 0) {
    //   return res.status(403).json({ error: "Forbidden" });
    // }

    const body = req.body || {};
    const {
      date_of_loss,
      claim_type,
      description,
      location,
      vehicle_id,
      third_party_involved
    } = body;

    // Minimal-Validierung
    if (!date_of_loss || !claim_type || !description) {
      return res.status(400).json({ error: "date_of_loss, claim_type, description sind Pflichtfelder" });
    }

    const payload = {
      claim_number: genClaimNumber(),
      date_of_loss,
      claim_type,
      description,
      location: location || null,
      vehicle_id: vehicle_id || null,
      third_party_involved: !!third_party_involved,
      status: "submitted"
    };

    // falls owner_id nötig ist (NOT NULL), über ENV setzen
    if (process.env.SYSTEM_PUBLIC_OWNER_ID) {
      payload.owner_id = process.env.SYSTEM_PUBLIC_OWNER_ID;
    }

    const { data, error } = await supabase
      .from("claims")
      .insert(payload)
      .select("id, claim_number")
      .single();

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      claim_id: data.id,
      claim_number: data.claim_number
    });
  } catch (err) {
    console.error("[api/claims/create] ", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}

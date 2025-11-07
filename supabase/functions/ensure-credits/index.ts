import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase env missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Resolve user id from JWT or body
    let resolvedUserId: string | undefined = body.userId;
    try {
      const { data: authData } = await supabaseAuthed.auth.getUser();
      resolvedUserId = authData?.user?.id ?? resolvedUserId;
    } catch (_) {}

    if (!resolvedUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing credits
    const { data: userCredits, error: creditsError } = await supabaseAdmin
      .from("user_credits")
      .select("*")
      .eq("user_id", resolvedUserId)
      .maybeSingle();

    if (creditsError) {
      console.error("ensure-credits: fetch error", creditsError);
      return new Response(JSON.stringify({ error: "Unable to fetch credits" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userCredits) {
      // Initialize with 40 credits
      const { error: insertError } = await supabaseAdmin
        .from("user_credits")
        .insert({
          user_id: resolvedUserId,
          credits_remaining: 40,
          last_reset_date: new Date().toISOString(),
        });

      if (insertError) {
        console.error("ensure-credits: insert error", insertError);
        return new Response(JSON.stringify({ error: "Unable to initialize credits" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Daily/monthly reset for free users
      const now = new Date();
      const lastReset = new Date(userCredits.last_reset_date);
      const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

      if (hoursSinceReset >= 24 && !userCredits.subscription_active) {
        const dayOfMonth = now.getDate();
        const lastResetDay = lastReset.getDate();

        if (dayOfMonth === 1 && lastResetDay !== 1) {
          await supabaseAdmin
            .from("user_credits")
            .update({
              credits_remaining: 40,
              last_reset_date: now.toISOString(),
            })
            .eq("user_id", resolvedUserId);
        } else {
          await supabaseAdmin
            .from("user_credits")
            .update({
              credits_remaining: Math.min(userCredits.credits_remaining + 2, 40),
              last_reset_date: now.toISOString(),
            })
            .eq("user_id", resolvedUserId);
        }
      }
    }

    // Return current credits
    const { data: current } = await supabaseAdmin
      .from("user_credits")
      .select("*")
      .eq("user_id", resolvedUserId)
      .single();

    return new Response(JSON.stringify({ credits: current }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ensure-credits: server error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
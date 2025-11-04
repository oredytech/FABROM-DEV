import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Supabase configuration missing");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user from JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { phoneNumber, paymentMethod } = await req.json();
    
    if (!phoneNumber || !paymentMethod) {
      throw new Error("Missing required fields: phoneNumber, paymentMethod");
    }

    if (!['airtel', 'orange'].includes(paymentMethod)) {
      throw new Error("Invalid payment method. Use 'airtel' or 'orange'");
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        amount: 10.00,
        currency: 'USD',
        payment_method: paymentMethod,
        phone_number: phoneNumber,
        status: 'pending',
        credits_purchased: 200
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Payment creation error:", paymentError);
      throw new Error("Failed to create payment record");
    }

    // In a real implementation, you would integrate with Airtel/Orange Money API here
    // For now, we'll simulate a successful payment
    console.log(`Payment initiated for ${paymentMethod}: ${phoneNumber}, amount: 10 USD`);

    // Simulate payment processing
    // In production, this would be handled by webhooks from payment provider
    const simulateSuccess = Math.random() > 0.1; // 90% success rate for demo

    if (simulateSuccess) {
      // Update payment status
      await supabase
        .from('payments')
        .update({ 
          status: 'completed',
          transaction_id: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        })
        .eq('id', payment.id);

      // Update user credits
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const { error: creditsError } = await supabase
        .from('user_credits')
        .update({
          credits_remaining: 200,
          subscription_active: true,
          subscription_expires_at: expiresAt.toISOString(),
          last_reset_date: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (creditsError) {
        console.error("Credits update error:", creditsError);
        throw new Error("Payment processed but failed to update credits");
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Paiement réussi! Vous avez maintenant 200 crédits.",
          payment_id: payment.id,
          credits: 200
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // Update payment status to failed
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Le paiement a échoué. Veuillez réessayer.",
          payment_id: payment.id
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("Payment processing error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error) 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

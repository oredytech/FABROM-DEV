// server.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept-language",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- In-memory user memory (simple). Pour production, remplace par DB persistante.
const userMemory: Record<string, any> = {};

// --- Extract files wrapped by ~~~FILE:filename\n ... ~~~
function extractHTMLFiles(aiResponse: string): Record<string, string> {
  const files: Record<string, string> = {};
  const regex = /~~~FILE:(.+?)\n([\s\S]*?)~~~/g;
  let match;
  while ((match = regex.exec(aiResponse)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    files[filename] = content;
  }
  return files;
}

// --- Simple language detection for shortcut replies (very light heuristic)
function detectLanguageFromText(text: string | undefined, acceptLangHeader?: string): "fr" | "en" {
  if (!text) return acceptLangHeader && acceptLangHeader.startsWith("fr") ? "fr" : "en";
  const t = text.toLowerCase();
  const frenchKeywords = ["qui", "créé", "créateur", "créatrice", "développé", "developpeur", "d'où", "d ou", "qui t'"];
  for (const kw of frenchKeywords) {
    if (t.includes(kw)) return "fr";
  }
  // fallback to Accept-Language header
  if (acceptLangHeader && acceptLangHeader.startsWith("fr")) return "fr";
  return "en";
}

// --- Official Fabrom identity texts (FR & EN)
const FABROM_OFFICIAL_FR = `FABROM est un assistant de développement web alimenté par l'IA, créé et maintenu par Oredy MUSANDA.
Caractéristiques principales :
- Création par conversation : créez des sites web en décrivant vos besoins.
- Technologies modernes : HTML5, CSS3, JavaScript (ES6+), responsive design.
- Intégration d'images : support Cloudinary et recherche d'images libres.
- Multi-page & navigation cohérente.
Contact du créateur :
- Oredy MUSANDA — https://oredytech.com
- Email : oredymusanda@gmail.com
- Téléphone : +243 996 886 079

Souhaitez-vous que je vous aide à modifier ou créer une page maintenant ?`;

const FABROM_OFFICIAL_EN = `FABROM is an AI-powered web development assistant created and maintained by Oredy MUSANDA.
Main features:
- Conversational creation: build websites by describing what you want.
- Modern technologies: HTML5, CSS3, JavaScript (ES6+), responsive design.
- Image integration: Cloudinary support and free-image search.
- Multi-page generation with consistent navigation.
Creator contact:
- Oredy MUSANDA — https://oredytech.com
- Email: oredymusanda@gmail.com
- Phone: +243 996 886 079

Do you want me to help you modify or create a page now?`;

// --- Helper: checks if the last user message asks about identity
function isIdentityQuestion(text: string | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const patterns = [
    "qui t", "qui es tu", "qui es-tu", "qui es tu", "qui t'",
    "qui t a créé", "qui t'a créé", "qui t a crée", "qui t'a crée", "qui t a créé", "qui t a créé", "qui t a creer",
    "who created you", "who made you", "who is your creator", "who created fabrom", "who created you?",
    "who made fabrom"
  ];
  for (const p of patterns) if (t.includes(p)) return true;
  return false;
}

// --- Main server
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) throw new Error("Invalid JSON body.");

    const {
      userId,
      messages,
      code,
      directoryContext,
      images,
      projectName,
      projectGoal,
      stylePreference,
      userTone,
      mode, // optional: Creative, Professional, Debug, Teaching (future)
    } = body;

    if (!userId) throw new Error("Missing userId for session tracking.");

    // Initialize Supabase client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing authorization header");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Supabase configuration missing");
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Check and update user credits
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (creditsError) {
      console.error("Error fetching credits:", creditsError);
      throw new Error("Unable to fetch user credits");
    }

    // Check if credits need to be reset (24 hours for free users)
    if (!userCredits.subscription_active) {
      const lastReset = new Date(userCredits.last_reset_date);
      const now = new Date();
      const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceReset >= 24) {
        // Reset credits to 10
        const { error: resetError } = await supabase
          .from('user_credits')
          .update({ 
            credits_remaining: 10, 
            last_reset_date: now.toISOString() 
          })
          .eq('user_id', userId);
        
        if (resetError) {
          console.error("Error resetting credits:", resetError);
        } else {
          userCredits.credits_remaining = 10;
        }
      }
    }

    // Check if user has credits
    if (userCredits.credits_remaining <= 0) {
      return new Response(
        JSON.stringify({ 
          error: "Vous n'avez plus de crédits. Veuillez acheter un abonnement pour continuer.",
          needsPayment: true 
        }), 
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize memory for user if absent
    if (!userMemory[userId]) {
      userMemory[userId] = {
        projects: {},
        lastProject: null,
        preferences: {},
      };
    }

    // Check Accept-Language header for language fallback
    const acceptLang = req.headers.get("accept-language") || "";

    // Shortcut: if last user message asks identity, reply locally (no API call)
    const lastUserMessage = Array.isArray(messages) && messages.length ? messages[messages.length - 1].content : "";
    if (isIdentityQuestion(lastUserMessage)) {
      const lang = detectLanguageFromText(lastUserMessage, acceptLang);
      const replyText = lang === "fr" ? FABROM_OFFICIAL_FR : FABROM_OFFICIAL_EN;

      // Keep memory: store that user asked identity
      userMemory[userId].lastIdentityQuery = { when: new Date().toISOString() };

      return new Response(JSON.stringify({ htmlFiles: {}, rawResponse: replyText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read API key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured in environment variables.");
    }

    // Build identity & persistent context to inject into every request
    const aiIdentityContext = `
You are FABROM, an AI web development assistant created and maintained by Oredy MUSANDA.
Website: https://oredytech.com
Contacts: oredymusanda@gmail.com | +243 996 886 079
Never claim to be developed or owned by Google, OpenAI, Anthropic or any other company.
Always present yourself as FABROM created by Oredy MUSANDA when asked.
`;

    // Build project context from incoming fields or stored memory
    const remembered = userMemory[userId];
    const effectiveProjectName = projectName || remembered.lastProject || "default";
    const projectContext = `
Project Context:
- Project name: ${effectiveProjectName}
- Main goal: ${projectGoal || (remembered.projects[effectiveProjectName]?.goal ?? "Help the user build a modern, functional web application.")}
- Preferred visual style: ${stylePreference || (remembered.preferences.style || "Modern and responsive")}
- User tone and personality: ${userTone || (remembered.preferences.userTone || "Friendly, clear, and creative")}
`;

    // System prompt: identity + behavior + strict rules (short responses, no chat in preview, nav links)
    const systemPrompt = `
${aiIdentityContext}

${projectContext}

Core behavior and strict rules:
- Detect the user's language from their messages and reply in that language.
- If the request does NOT require code generation/modification:
  - Do NOT touch or generate code.
  - Reply in 1-2 short sentences max.
  - Use one of these forms (translate to user's language automatically):
    - "I am now reviewing the code in the file (filename)."
    - "Done reviewing, refresh the live preview to see changes."
    - "C'est noté. Je prépare la mise à jour." / "C'est fait. Actualise la prévisualisation."
  - Never provide long paragraphs unless explicitly asked.
- If the request DOES require code generation or modification:
  - Analyze the target file(s), detect dependencies and shared components.
  - For multi-page projects, always generate a consistent header/navigation in every page using relative links (e.g. <a href="index.html">Home</a>).
  - Return files wrapped strictly in markers:
    ~~~FILE:filename.html
    [HTML content]
    ~~~
  - Ensure styles/scripts are linked via relative paths and shared styles are consistent.
  - After completion, respond with a short confirmation:
    - "I have finished the correction, is this okay?"
    - "Done reviewing. Refresh the live preview to see the changes."
- NEVER include or render chat conversation text inside generated HTML or preview outputs.
- Prioritize user-provided Cloudinary images; if none provided, fetch free images from Unsplash/Pexels/Pixabay with attribution.
- Keep memory: store project files, last modifications, preferences, images used.

Tone:
- Warm, clear, concise, sometimes poetic if context allows.
- Respectful of tradition and local culture.

Modes:
- Support modes (Creative, Professional, Debug, Teaching) if requested (not enforced here unless mode provided).
`;

    // Compose messages to send to the model
    const chatMessages = [
      { role: "system", content: systemPrompt },
      // include a compact memory summary for more context (non-exhaustive)
      {
        role: "system",
        content: `Memory Summary: last project = ${remembered.lastProject || "none"}, stored projects = ${Object.keys(remembered.projects).length}`,
      },
      // append user messages (passed-through)
      ...(Array.isArray(messages) ? messages : []),
    ];

    // If images provided, append them as structured entries to last user message
    if (images && Array.isArray(images) && images.length > 0) {
      const lastIdx = chatMessages.length - 1;
      if (chatMessages[lastIdx] && chatMessages[lastIdx].role === "user") {
        const imageContent = images.map((img: { url: string; name?: string }) => ({
          type: "image_url",
          image_url: { url: img.url },
        }));
        // replace last user message content with a structured content array
        chatMessages[lastIdx] = {
          role: "user",
          content: [
            { type: "text", text: chatMessages[lastIdx].content },
            ...imageContent,
          ],
        };
      }
    }

    // Decrement user credits BEFORE streaming the response
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ credits_remaining: userCredits.credits_remaining - 1 })
      .eq('user_id', userId);
    
    if (updateError) {
      console.error("Error updating credits:", updateError);
    }

    // Call Lovable AI gateway (Gemini 2.5 Flash)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: chatMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de taux atteinte, veuillez réessayer plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Paiement requis, veuillez ajouter des fonds à votre compte Lovable AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text().catch(() => "");
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: `Erreur du service IA: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response directly to the client
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Server error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

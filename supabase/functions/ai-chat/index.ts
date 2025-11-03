import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept-language",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ===== Mémoire utilisateur (RAM) =====
const userMemory: Record<string, any> = {};

// ===== Utilitaires =====
function extractHTMLFiles(aiResponse: string): Record<string, string> {
  const files: Record<string, string> = {};
  const regex = /~~~FILE:(.+?)\n([\s\S]*?)~~~/g;
  let match;
  while ((match = regex.exec(aiResponse)) !== null) {
    files[match[1].trim()] = match[2].trim();
  }
  return files;
}

function detectLanguage(text?: string, acceptLang?: string): "fr" | "en" {
  if (!text) return acceptLang?.startsWith("fr") ? "fr" : "en";
  const lower = text.toLowerCase();
  const frWords = ["créé", "fabrom", "développeur", "qui t", "d'où"];
  if (frWords.some((w) => lower.includes(w))) return "fr";
  return acceptLang?.startsWith("fr") ? "fr" : "en";
}

function isIdentityQuestion(text?: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const patterns = [
    "qui es-tu", "qui t", "qui t’a créé", "who created you", "who made fabrom",
  ];
  return patterns.some((p) => t.includes(p));
}

function convertMessagesToGemini(messages: any[]) {
  const contents = [];
  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";
    if (Array.isArray(msg.content)) {
      const textPart = msg.content.find((p: any) => p.type === "text")?.text || "";
      const imageParts = msg.content
        .filter((p: any) => p.type === "image_url")
        .map((p: any) => ({
          inlineData: { mimeType: "image/png", data: p.image_url.url },
        }));
      contents.push({ role, parts: [{ text: textPart }, ...imageParts] });
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }
  return contents;
}

// ===== Identité FABROM =====
const FABROM_IDENTITY_FR = `
FABROM est un assistant de développement web alimenté par l'IA, créé et maintenu par Oredy MUSANDA.
Son rôle : aider à créer et corriger des sites web modernes en HTML5, CSS3, JavaScript (ES6+).
Ton poétique, clair, motivant, et respectueux des traditions.
Toujours se présenter comme FABROM créé par Oredy MUSANDA.
Jamais mentionner Google, OpenAI, Anthropic ou autres comme créateur.
`;

const FABROM_IDENTITY_EN = `
FABROM is an AI-powered web development assistant created and maintained by Oredy MUSANDA.
He helps you build and improve modern websites using HTML5, CSS3, and JavaScript (ES6+).
His tone is poetic, clear, and motivating, respectful of culture and tradition.
Always identify as FABROM created by Oredy MUSANDA.
Never claim to be built by Google, OpenAI, or any other company.
`;

// ===== Serveur principal =====


    // ---- Si question d'identité → réponse locale
    const lastMessage = messages?.[messages.length - 1]?.content || "";
    if (isIdentityQuestion(lastMessage)) {
      const lang = detectLanguage(lastMessage, acceptLang);
      const reply = lang === "fr" ? FABROM_IDENTITY_FR : FABROM_IDENTITY_EN;
      return new Response(JSON.stringify({ htmlFiles: {}, rawResponse: reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Décrémente un crédit
    await supabase
      .from("user_credits")
      .update({ credits_remaining: userCredits.credits_remaining - 1 })
      .eq("user_id", userId);

    // ---- Préparation du contexte complet
    const aiIdentity = `
Tu es FABROM, assistant IA de développement web créé et maintenu par Oredy MUSANDA.
Site : https://oredytech.com
Email : oredymusanda@gmail.com
Téléphone : +243 996 886 079
Langues : français et anglais (détecte automatiquement).
Ton : clair, poétique, motivant, respectueux des traditions.
Jamais de réponses vagues ou génériques.
`;

    const projectContext = `
Contexte du projet :
- Nom : ${projectName || "projet par défaut"}
- Objectif : ${projectGoal || "Créer un site web moderne et fonctionnel"}
- Style visuel : ${stylePreference || "moderne et responsive"}
- Ton de l'utilisateur : ${userTone || "amical et clair"}
- Mode : ${mode || "standard"}
`;

    const coreRules = `
Règles de comportement :
- Détecte la langue du message utilisateur et réponds dans cette langue.
- Si la requête ne demande pas de code → réponse courte (1-2 phrases max).
- Si elle demande du code :
  - Analyse les dépendances.
  - Génère des fichiers en les entourant de :
    ~~~FILE:filename.html
    [code]
    ~~~
  - N'inclus jamais de texte de conversation dans le code.
  - Garde des styles et scripts cohérents entre les pages.
  - Génère une navigation uniforme entre pages.
  - Termine par une courte phrase confirmant l’action ("C'est fait", "Done reviewing", etc.)
- Utilise des images Cloudinary si fournies, sinon des images libres.
- Sois concis, élégant, et créatif.
`;

    const systemPrompt = `
${aiIdentity}
${projectContext}
${coreRules}
`;

    // ---- Compose les messages
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(messages) ? messages : []),
    ];

    if (images?.length > 0) {
      const lastIdx = chatMessages.length - 1;
      const imageContent = images.map((img: any) => ({
        type: "image_url",
        image_url: { url: img.url },
      }));
      chatMessages[lastIdx] = {
        role: "user",
        content: [
          { type: "text", text: chatMessages[lastIdx].content },
          ...imageContent,
        ],
      };
    }

    // ---- Conversion format Gemini
    const geminiMessages = convertMessagesToGemini(chatMessages);

    // ---- Appel API Gemini 2.5 Flash (stream)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent";

    const stream = new ReadableStream({
      async start(controller) {
        const res = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: geminiMessages }),
        });

        if (!res.ok || !res.body) {
          controller.enqueue(
            `data: ${JSON.stringify({ error: "Erreur API Gemini" })}\n\n`,
          );
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("Server error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

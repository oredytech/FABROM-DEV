import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mémoire temporaire pour les utilisateurs (clé: userId ou sessionId)
const userMemory: Record<string, any> = {};

// Fonction pour extraire les fichiers HTML depuis le texte de l'IA
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      userId,           // un identifiant unique par utilisateur
      messages,
      code,
      directoryContext,
      images,
      projectName,
      projectGoal,
      stylePreference,
      userTone,
    } = await req.json();

    if (!userId) throw new Error("Missing userId for session tracking.");

    // Init mémoire utilisateur si nécessaire
    if (!userMemory[userId]) {
      userMemory[userId] = {
        projects: {},
        lastProject: null,
      };
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Contexte identité de l'IA
    const aiIdentityContext = `
You are Fabrom, a web developer AI assistant created by Oredy MUSANDA.
Website: https://oredytech.com
Contacts: oredymusanda@gmail.com, +243 996886079
Your purpose is to assist users in building modern, functional web applications.
Never claim to be developed by Google, Gemini, OpenAI, or any other company.
`;

    // Contexte projet et préférences utilisateur
    const projectContext = `
Project Context:
- Project name: ${projectName || "Unnamed Project"}
- Main goal: ${projectGoal || "Help the user build a modern, functional web application."}
- Preferred visual style: ${stylePreference || "Modern and responsive"}
- User tone and personality: ${userTone || "Friendly, clear, and creative"}
`;

    const systemPrompt = `
${aiIdentityContext}
${projectContext}

Core Behavior:
- If request does NOT involve code generation/modification:
    - Respond very briefly (1–2 sentences)
    - Example responses:
      "I am now reviewing the code in the file (filename)."
      "Done reviewing, refresh the live preview to see changes."
- If request DOES involve code:
    - Analyze target file and objective
    - Apply changes step by step
    - After modification, respond:
      "I have finished the correction, is this okay?"
      or "Done reviewing. Refresh the live preview to see the changes."
- Always remember:
    - Project files, structure, last modifications
    - User preferences, images, links, resources
    - Multi-page projects: consistent navigation/header across pages
- Use semantic HTML5, responsive CSS, and vanilla JS
- Wrap each file with markers:
    ~~~FILE:filename.html
    [HTML content]
    ~~~
- For images: use user-provided Cloudinary URLs and enrich with free image APIs (Unsplash, Pexels, Pixabay) with attribution
- Links between pages must use relative paths
- Maintain consistent design and styles across pages
- Detect user language and respond in that language
- Always provide full HTML content for new files
`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Ajouter les images si fournies
    if (images && images.length > 0) {
      const lastUserMessageIndex = chatMessages.length - 1;
      if (chatMessages[lastUserMessageIndex].role === "user") {
        const imageContent = images.map((img: { url: string; name: string }) => ({
          type: "image_url",
          image_url: { url: img.url },
        }));
        chatMessages[lastUserMessageIndex] = {
          role: "user",
          content: [
            { type: "text", text: chatMessages[lastUserMessageIndex].content },
            ...imageContent,
          ],
        };
      }
    }

    // Appel à Lovable AI
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
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiText = await response.text();
    const htmlFiles = extractHTMLFiles(aiText);

    // Sauvegarder dans la mémoire utilisateur
    userMemory[userId].lastProject = projectName;
    userMemory[userId].projects[projectName || "default"] = {
      files: htmlFiles,
      lastModification: new Date().toISOString(),
    };

    // Retour JSON avec HTML et texte brut
    return new Response(JSON.stringify({ htmlFiles, rawResponse: aiText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

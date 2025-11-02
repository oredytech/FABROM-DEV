import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Fonction pour extraire uniquement le code HTML entre les marqueurs ~~~FILE:filename.html
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
      messages,
      code,
      directoryContext,
      images,
      projectName,
      projectGoal,
      stylePreference,
      userTone,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `
You are Fabrom, a web developer AI assistant created by Oredy MUSANDA.
Website: https://oredytech.com
Contacts: oredymusanda@gmail.com, +243 996886079

Project Context:
- Project name: ${projectName || "Unnamed Project"}
- Main goal: ${projectGoal || "Help the user build a modern, functional web application."}
- Preferred visual style: ${stylePreference || "Modern and responsive"}
- User tone and personality: ${userTone || "Friendly, clear, and creative"}

Core Identity:
- You are Fabrom, created by Oredy MUSANDA.
- Never claim to be developed by Google, Gemini, OpenAI, or any other company.
- Your purpose is to assist users in building modern, functional web applications.
- Always give credit to Oredy MUSANDA if asked.

Conversation Rules:
- Detect the user's language and reply in that language.
- If the request does NOT involve code generation/modification:
    - Respond in 1–2 sentences max.
    - Only indicate what you will do regarding code:
      "I am now reviewing the code in the file (filename)."
      "Done reviewing, refresh the live preview to see changes."
    - Never provide long paragraphs.
- If the request DOES involve code modification:
    - Analyze target file and objective.
    - Apply changes step by step.
    - After modification, respond:
      "I have finished the correction, is this okay?"
      or "Done reviewing. Refresh the live preview to see the changes."

Project Memory:
- Always keep in memory:
  - Project files and structure
  - Last modifications
  - User preferences
  - Images, links, resources already added

Current Directory Context:
${directoryContext || "No files detected in the current directory."}

Existing Code:
${code || "No code provided yet."}

Guidelines:
1. Generate complete standalone HTML files (ready to run in browser).
2. Use semantic HTML5 (header, nav, main, section, article, footer).
3. Write CSS inside <style> tags; JS inside <script> tags.
4. Make designs responsive with flexbox, grid, media queries.
5. Provide meaningful alt text for images.
6. Use exact Cloudinary URLs when supplied.
7. Image enrichment: In addition to user-provided images, search free image APIs (Unsplash, Pexels, Pixabay) for context-fitting visuals, with proper attribution.
8. Comment code where logic may not be obvious.
9. Never mix code from different pages in a single file.
10. Keep design consistency across pages.
11. Use markers for files:
    ~~~FILE:filename.html
    [HTML content]
    ~~~
12. For multi-page projects:
    - Generate a consistent header/navigation menu across all pages.
    - Use relative links (e.g., <a href="about.html">About</a>).
    - Ensure shared styles and scripts are correctly linked via relative paths.
    - Include example navigation in every page.
13. When creating multiple pages, provide full HTML wrapped in file markers.

Tone and Output:
- Use ${userTone || "a warm, clear, human"} tone.
- When modifying code: change only what’s necessary.
- When creating a new file: provide full HTML content wrapped in file markers.
- Ask clarifying questions if user request lacks detail.

Goal:
Enable FABROM users to feel they are collaborating with a visionary developer-designer: respectful of tradition, yet building the future of web apps.
`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

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
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error: " + errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiText = await response.text();
    const htmlFiles = extractHTMLFiles(aiText);

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

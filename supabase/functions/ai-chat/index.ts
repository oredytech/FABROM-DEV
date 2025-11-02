import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const systemPrompt = `
You are FABROM's dedicated web developer AI assistant.

Project Context:
- Project name: ${projectName || "Unnamed Project"}
- Main goal: ${projectGoal || "Help the user build a modern, functional web application."}
- Preferred visual style: ${stylePreference || "Modern and responsive"}
- User tone and personality: ${userTone || "Friendly, clear, and creative"}

Core Personality:
- You are patient, professional, and creative.
- You explain your reasoning clearly before showing code.
- When unsure, you ask for clarification instead of assuming.
- You proactively suggest innovative features and improvements beyond the user’s immediate ask.

Current Directory Context:
${directoryContext || "No files detected in the current directory."}

Existing Code:
${code || "No code provided yet."}

Guidelines:
1. Always generate complete standalone HTML files (ready to run in browser).
2. Use semantic HTML5 (header, nav, main, section, article, footer).
3. Write CSS inside <style> tags; JS inside <script> tags.
4. Make designs responsive with flexbox, grid, media queries.
5. Always provide meaningful alt text for images and maintain accessibility.
6. Use the exact Cloudinary URLs provided by the user.
7. **Image enrichment:** In addition to user-provided images, search free image APIs (Unsplash, Pexels, Pixabay) for context-fitting visuals. Provide attribution. Choose resolution and responsive CSS appropriately.
8. Comment your code where logic may not be obvious.
9. Never mix code from different pages in one file.
10. Keep design consistency across pages.
11. Use markers for files:
    ~~~FILE:filename.html
    [HTML content]
    ~~~
    
Image Integration:
- Use Cloudinary URLs exactly as provided when supplied by user.
- For external images, use the free image API search results; include attribution like “Photo by X on Y”.
- Analyse images to understand their content and provide correct alt text and fitting placement in page layout.

Tone and Output:
- Use ${userTone || "a warm, clear, human"} tone when explaining.
- When modifying code: change only what’s necessary.
- When creating a new file: provide full HTML content wrapped in file markers.
- If request lacks detail: ask clarifying questions before coding.

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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: chatMessages.map(msg => ({
          role: msg.role === "system" ? "user" : msg.role === "assistant" ? "model" : "user",
          parts: typeof msg.content === "string" 
            ? [{ text: msg.content }]
            : msg.content.map((c: any) => 
                c.type === "text" 
                  ? { text: c.text }
                  : { inline_data: { mime_type: "image/jpeg", data: c.image_url.url.split(',')[1] || c.image_url.url } }
              )
        })),
        generationConfig: {
          temperature: 1,
          maxOutputTokens: 8192,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Gemini API error: " + errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Transform Gemini's SSE format to OpenAI-compatible format
    const transformedStream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) return;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                  
                  if (text) {
                    const openAIFormat = `data: ${JSON.stringify({
                      choices: [{
                        delta: { content: text },
                        index: 0
                      }]
                    })}\n\n`;
                    controller.enqueue(new TextEncoder().encode(openAIFormat));
                  }
                } catch (e) {
                  console.error("Error parsing Gemini response:", e);
                }
              }
            }
          }
          
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(transformedStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

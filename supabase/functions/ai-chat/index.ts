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
    const { messages, code, directoryContext, images } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert web developer assistant for FABROM. You help users create modern web applications using vanilla HTML, CSS, and JavaScript.

Current code context:
${code || "No code yet"}

${directoryContext || ""}

IMPORTANT - Image Integration:
- When users provide Cloudinary image URLs, always use them directly in the HTML
- Format: <img src="CLOUDINARY_URL_HERE" alt="descriptive text">
- Analyze images to provide accurate alt text and appropriate sizing
- Ensure images are responsive with proper CSS
- Use the exact Cloudinary URLs provided by the user

Guidelines:
- Generate complete, standalone HTML files that can run directly in a browser
- Use modern vanilla JavaScript (ES6+)
- Include all CSS styles within <style> tags in the HTML
- Include all JavaScript within <script> tags in the HTML
- Make responsive designs using modern CSS (flexbox, grid, media queries)
- Use external APIs when needed (fetch API for HTTP requests)
- Write clean, well-commented code
- Follow web best practices
- Always provide complete, self-contained HTML documents
- The generated code should work offline (except for API calls)
- Use modern CSS features and animations
- Include proper HTML5 semantic tags

Image handling:
- All images uploaded by users are stored on Cloudinary
- Use the provided Cloudinary URLs directly in your HTML
- Analyze images to understand their content and provide proper integration
- Apply appropriate styling and responsive design to images

Multi-page applications:
- When the user asks for multiple pages, create separate HTML files (e.g., index.html, about.html, contact.html)
- Use proper navigation links between pages: <a href="about.html">About</a>
- Ensure consistent styling across all pages
- Use relative paths for links and resources
- Each page should be complete and self-contained
- Maintain a consistent header/navigation across pages
- For images, use the "upload/" folder path: <img src="./upload/image.jpg">

Code structure and file management:
- Analyze existing files in the directory to understand the project structure
- When the user mentions a specific page (e.g., "À propos", "Contact"), identify the corresponding HTML file (about.html, contact.html, etc.)
- When updating existing code, preserve the existing structure and only modify what's needed
- When creating new pages, wrap the code with special markers: 
  ~~~FILE:filename.html
  [HTML content here]
  ~~~
- When modifying existing pages, use the same marker format with the exact filename
- Link pages together using standard HTML anchor tags
- Use consistent naming conventions for files
- Never mix code from different pages in a single file
- For images, use the Cloudinary URLs provided by users

IMPORTANT: When the user asks to create or modify a specific page:
1. Identify the target file (e.g., "page À propos" = about.html, "page Contact" = contact.html)
2. Wrap your HTML code with the file marker: ~~~FILE:filename.html
3. Provide complete, working HTML code for that page
4. If creating multiple files, use multiple file markers`;

    // Prepare messages with image support if images are provided
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // If images are provided, add them to the last user message
    if (images && images.length > 0) {
      const lastUserMessageIndex = chatMessages.length - 1;
      if (chatMessages[lastUserMessageIndex].role === "user") {
        const imageContent = images.map((img: {url: string, name: string}) => ({
          type: "image_url",
          image_url: { url: img.url }
        }));
        
        chatMessages[lastUserMessageIndex] = {
          role: "user",
          content: [
            { type: "text", text: chatMessages[lastUserMessageIndex].content },
            ...imageContent
          ]
        };
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

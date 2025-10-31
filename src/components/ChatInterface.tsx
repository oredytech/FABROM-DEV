import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, ImagePlus, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  code: string;
  onCodeUpdate: (code: string) => void;
  directoryHandle: FileSystemDirectoryHandle | null;
  isMobile?: boolean;
  currentFile: string;
  conversationId: string | null;
  onConversationUpdate: (id: string) => void;
  onFileCreate: (fileName: string, content: string) => void;
  onToggleVisibility?: () => void;
  user?: any;
}

export function ChatInterface({ 
  code, 
  onCodeUpdate, 
  directoryHandle, 
  isMobile = false,
  onToggleVisibility,
  currentFile,
  conversationId,
  onConversationUpdate,
  onFileCreate,
  user
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{url: string, name: string}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { uploadImage, isUploading } = useCloudinaryUpload();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const saveConversation = async (newMessages: Message[], files: Record<string, string>) => {
    if (!directoryHandle || !user) return;

    try {
      const userId = user.id;

      if (!conversationId) {
        // Create new conversation
        const { data, error } = await supabase
          .from("conversation_history")
          .insert({
            user_id: userId,
            project_name: directoryHandle.name,
            messages: newMessages as any,
            files: files as any,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          onConversationUpdate(data.id);
        }
      } else {
        // Update existing conversation
        await supabase
          .from("conversation_history")
          .update({
            messages: newMessages as any,
            files: files as any,
          })
          .eq("id", conversationId);
      }
    } catch (error) {
      console.error("Error saving conversation:", error);
    }
  };

  const saveFileVersion = async (fileName: string, content: string) => {
    if (!conversationId) return;

    try {
      // Get latest version number
      const { data: latestVersion } = await supabase
        .from("file_versions")
        .select("version_number")
        .eq("conversation_id", conversationId)
        .eq("file_name", fileName)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      const nextVersion = latestVersion ? latestVersion.version_number + 1 : 1;

      await supabase
        .from("file_versions")
        .insert({
          conversation_id: conversationId,
          file_name: fileName,
          file_content: content,
          version_number: nextVersion,
        });
    } catch (error) {
      console.error("Error saving file version:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";
    const extractedFiles: Record<string, string> = {};

    // Add generation message
    const generationMessage: Message = { role: "assistant", content: "Génération du code en cours..." };
    setMessages((prev) => [...prev, generationMessage]);

    // Analyze existing directory structure and read all HTML files
    let directoryContext = "";
    if (directoryHandle) {
      try {
        const files: string[] = [];
        const dirs: string[] = [];
        const htmlFiles: Record<string, string> = {};
        
        for await (const entry of (directoryHandle as any).values()) {
          if (entry.kind === 'file') {
            files.push(entry.name);
            
            // Read all HTML files for context
            if (entry.name.endsWith('.html')) {
              try {
                const fileHandle = await directoryHandle.getFileHandle(entry.name);
                const file = await fileHandle.getFile();
                const content = await file.text();
                htmlFiles[entry.name] = content;
              } catch (error) {
                console.error(`Error reading ${entry.name}:`, error);
              }
            }
          } else if (entry.kind === 'directory') {
            dirs.push(entry.name);
          }
        }

        // Build comprehensive context with all files
        let filesContext = "";
        if (Object.keys(htmlFiles).length > 0) {
          filesContext = "\n\nFichiers HTML existants :\n";
          for (const [fileName, content] of Object.entries(htmlFiles)) {
            filesContext += `\n--- ${fileName} (${content.length} caractères) ---\n${content.substring(0, 500)}${content.length > 500 ? '...' : ''}\n`;
          }
        }

        directoryContext = `\n\nContext du projet :\n- Dossier: ${directoryHandle.name}\n- Fichier actuel: ${currentFile}\n- Fichiers existants: ${files.join(', ') || 'aucun'}\n- Dossiers existants: ${dirs.join(', ') || 'aucun'}${filesContext}`;
      } catch (error) {
        console.error("Error analyzing directory:", error);
      }
    }

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
      messages: updatedMessages,
      code,
      directoryContext,
      images: uploadedImages.length > 0 ? uploadedImages : undefined,
    }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (let line of lines) {
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              
              // Extract file markers ~~~FILE:filename.html
              const fileMarkerRegex = /~~~FILE:([^\n]+)\n([\s\S]*?)(?=~~~FILE:|$)/g;
              const fileMatches = [...assistantContent.matchAll(fileMarkerRegex)];
              
              if (fileMatches.length > 0) {
                // Multiple files detected
                fileMatches.forEach(match => {
                  const fileName = match[1].trim();
                  const fileContent = match[2].trim();
                  extractedFiles[fileName] = fileContent;
                  
                  if (fileName === currentFile) {
                    onCodeUpdate(fileContent);
                  }
                });
              } else {
                // Single file - extract code blocks
                const codeBlockRegex = /```(?:html|css|javascript|js)?\n([\s\S]*?)```/g;
                const codeMatches = [...assistantContent.matchAll(codeBlockRegex)];
                
                if (codeMatches.length > 0) {
                  const extractedCode = codeMatches.map(match => match[1]).join("\n\n");
                  extractedFiles[currentFile] = extractedCode;
                  onCodeUpdate(extractedCode);
                }
              }
              
              // Remove code blocks and file markers from chat display
              const textOnly = assistantContent
                .replace(/~~~FILE:[^\n]+\n[\s\S]*?(?=~~~FILE:|$)/g, '')
                .replace(/```(?:html|css|javascript|js)?\n[\s\S]*?```/g, '')
                .trim();
              
              setMessages((prev) => {
                const withoutLast = prev.slice(0, -1);
                return [...withoutLast, { 
                  role: "assistant", 
                  content: textOnly || "Génération du code en cours..." 
                }];
              });
            }
          } catch {
            // Incomplete JSON, will be completed in next chunk
          }
        }
      }

      // Final update and save
      const textOnly = assistantContent
        .replace(/~~~FILE:[^\n]+\n[\s\S]*?(?=~~~FILE:|$)/g, '')
        .replace(/```(?:html|css|javascript|js)?\n[\s\S]*?```/g, '')
        .trim();
      
      const finalMessages = [...updatedMessages, { role: "assistant" as const, content: textOnly || "Code généré avec succès !" }];
      setMessages(finalMessages);

      // Save conversation and file versions
      if (Object.keys(extractedFiles).length > 0) {
        await saveConversation(finalMessages, extractedFiles);
        
        // Save file versions and create files
        for (const [fileName, content] of Object.entries(extractedFiles)) {
          await saveFileVersion(fileName, content);
          onFileCreate(fileName, content);
        }
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => prev.slice(0, -1));
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Échec de l'envoi du message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      sonnerToast.info("Upload des images vers Cloudinary...");
      const newImages: Array<{url: string, name: string}> = [];

      for (const file of Array.from(files)) {
        const result = await uploadImage(file);
        if (result) {
          newImages.push({ url: result.url, name: file.name });
        }
      }

      if (newImages.length > 0) {
        setUploadedImages(prev => [...prev, ...newImages]);
        sonnerToast.success(`${newImages.length} image(s) uploadée(s) avec succès sur Cloudinary`);

        // Add info message to chat with Cloudinary URLs
        const imagesList = newImages.map(img => `- ${img.name}: ${img.url}`).join('\n');
        setInput(prev => 
          prev + (prev ? '\n\n' : '') + 
          `J'ai uploadé ces images sur Cloudinary :\n${imagesList}\n\nAnalyse les images et intègre-les dans le code HTML avec leurs URLs Cloudinary.`
        );
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      sonnerToast.error("Erreur lors de l'upload des images");
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header - Now visible on all screens with 40px height */}
      <div className="h-10 border-b border-border bg-gradient-assistant flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white" />
          <h2 className="text-sm font-semibold text-white">Assistant IA</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile: Show user avatar in assistant header */}
          {isMobile && user && (
            <div className="md:hidden">
              <UserAvatar user={user} />
            </div>
          )}
          {onToggleVisibility && (
            <button
              onClick={onToggleVisibility}
              className="text-white hover:bg-white/10 p-1 rounded transition-colors"
              title="Masquer l'assistant"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Commencez une conversation pour générer du code</p>
              <p className="text-xs mt-2">Demandez-moi de créer n'importe quelle application web !</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-secondary text-secondary-foreground rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-100"></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-200"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Décrivez ce que vous voulez créer..."
              className="resize-none bg-secondary border-border"
              rows={3}
              disabled={isLoading}
            />
            {uploadedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img 
                      src={img.url} 
                      alt={img.name} 
                      className="w-20 h-20 object-cover rounded border border-border"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                      <span className="text-white text-xs truncate px-1">{img.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading}
              variant="outline"
              size="icon"
              title="Upload des images vers Cloudinary"
            >
              <ImagePlus className="w-4 h-4" />
            </Button>
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="self-end"
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}

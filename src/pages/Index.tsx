import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChatInterface } from "@/components/ChatInterface";
import { CodeEditor } from "@/components/CodeEditor";
import { PreviewPane } from "@/components/PreviewPane";
import { FileManager } from "@/components/FileManager";
import { VersionHistory } from "@/components/VersionHistory";
import { Code2, Monitor, FolderOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import fabromLogo from "@/assets/fabrom-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/UserAvatar";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [code, setCode] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const [showMobileCode, setShowMobileCode] = useState(false);
  const [currentFile, setCurrentFile] = useState("index.html");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [filesKey, setFilesKey] = useState(0);
  const [showFileManager, setShowFileManager] = useState(false);
  const [showAssistant, setShowAssistant] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const saveCodeToFile = async (fileName: string = currentFile, fileCode: string = code) => {
    if (!fileCode || !directoryHandleRef.current) {
      toast.error("Veuillez d'abord sélectionner un dossier d'enregistrement");
      return;
    }

    try {
      const dir: any = directoryHandleRef.current;
      if (dir?.queryPermission) {
        let status = await dir.queryPermission({ mode: "readwrite" });
        if (status !== "granted") {
          status = await dir.requestPermission({ mode: "readwrite" });
          if (status !== "granted") return;
        }
      }

      const fileHandle = await directoryHandleRef.current.getFileHandle(fileName, { create: true });
      const fh: any = fileHandle as any;
      if (fh?.queryPermission) {
        let fstatus = await fh.queryPermission({ mode: "readwrite" });
        if (fstatus !== "granted") {
          fstatus = await fh.requestPermission({ mode: "readwrite" });
          if (fstatus !== "granted") return;
        }
      }

      const writable = await fileHandle.createWritable();
      await writable.write(fileCode);
      await writable.close();
      toast.success(`Fichier ${fileName} enregistré avec succès!`);
    } catch (error) {
      console.error("Error saving file:", error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleFileCreate = async (fileName: string, content: string) => {
    await saveCodeToFile(fileName, content);
    setFilesKey(prev => prev + 1);
  };

  const handleFileSelect = async (fileName: string) => {
    if (!directoryHandleRef.current) return;

    try {
      const fileHandle = await directoryHandleRef.current.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const content = await file.text();
      setCode(content);
      setCurrentFile(fileName);
    } catch (error) {
      console.error("Error loading file:", error);
      setCode("");
      setCurrentFile(fileName);
    }
  };

  const handleVersionRestore = async (content: string, version: number) => {
    setCode(content);
    await saveCodeToFile(currentFile, content);
  };

  // Save code automatically when it changes using File System Access API
  useEffect(() => {
    const autoSave = async () => {
      if (!code || !directoryHandleRef.current) return;

      try {
        const dir: any = directoryHandleRef.current;
        if (dir?.queryPermission) {
          let status = await dir.queryPermission({ mode: "readwrite" });
          if (status !== "granted") {
            status = await dir.requestPermission({ mode: "readwrite" });
            if (status !== "granted") return;
          }
        }

        const fileHandle = await directoryHandleRef.current.getFileHandle(currentFile, { create: true });
        const fh: any = fileHandle as any;
        if (fh?.queryPermission) {
          let fstatus = await fh.queryPermission({ mode: "readwrite" });
          if (fstatus !== "granted") {
            fstatus = await fh.requestPermission({ mode: "readwrite" });
            if (fstatus !== "granted") return;
          }
        }

        const writable = await fileHandle.createWritable();
        await writable.write(code);
        await writable.close();
      } catch (error) {
        console.error("Error saving file:", error);
      }
    };

    const timeoutId = setTimeout(autoSave, 1000);
    return () => clearTimeout(timeoutId);
  }, [code, currentFile]);

  const loadExistingFiles = async (handle: FileSystemDirectoryHandle) => {
    try {
      const files: string[] = [];
      
      // Scan all files in the directory
      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.html')) {
          files.push(entry.name);
        }
      }

      // If index.html exists, load it automatically
      if (files.includes('index.html')) {
        try {
          const fileHandle = await handle.getFileHandle('index.html');
          const file = await fileHandle.getFile();
          const content = await file.text();
          setCode(content);
          setCurrentFile('index.html');
          toast.success(`${files.length} fichier(s) détecté(s) - index.html chargé`);
        } catch (error) {
          console.error("Error loading index.html:", error);
        }
      } else if (files.length > 0) {
        // Load the first HTML file found
        try {
          const firstFile = files[0];
          const fileHandle = await handle.getFileHandle(firstFile);
          const file = await fileHandle.getFile();
          const content = await file.text();
          setCode(content);
          setCurrentFile(firstFile);
          toast.success(`${files.length} fichier(s) détecté(s) - ${firstFile} chargé`);
        } catch (error) {
          console.error("Error loading file:", error);
        }
      } else {
        toast.success("Dossier prêt - aucun fichier HTML trouvé");
      }

      // Trigger files update to refresh FileManager
      setFilesKey(prev => prev + 1);
    } catch (error) {
      console.error("Error loading existing files:", error);
    }
  };

  const selectDirectory = async () => {
    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      toast.error("Votre navigateur ne supporte pas la sauvegarde automatique. Veuillez utiliser Chrome ou Edge.");
      return;
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: "readwrite"
      });

      // Verify permission was granted
      const permission = await handle.queryPermission({ mode: "readwrite" });
      
      if (permission === "granted") {
        directoryHandleRef.current = handle;
        toast.success(`Dossier sélectionné : ${handle.name}`);
        await loadExistingFiles(handle);
      } else if (permission === "prompt") {
        const newPermission = await handle.requestPermission({ mode: "readwrite" });
        if (newPermission === "granted") {
          directoryHandleRef.current = handle;
          toast.success(`Dossier sélectionné : ${handle.name}`);
          await loadExistingFiles(handle);
        } else {
          toast.error("Permission refusée. Veuillez autoriser l'accès en écriture.");
        }
      } else {
        toast.error("Permission refusée. Veuillez autoriser l'accès en écriture.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Directory selection error:", error);
        toast.error("La sélection a été annulée ou votre navigateur ne supporte pas cette fonctionnalité.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header - Visible on all screens */}
      <header className="h-14 border-b border-border bg-black flex items-center px-3 md:px-6 justify-between md:relative absolute top-0 left-0 right-0 z-50">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg overflow-hidden flex items-center justify-center">
            <img src={fabromLogo} alt="FABROM Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base md:text-xl font-bold text-white">FABROM</h1>
            <p className="hidden sm:block text-xs text-white/80">Créez plus vite avec l'IA</p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileView(mobileView === "preview" ? "chat" : "preview")}
            className="md:hidden gap-1 text-xs"
          >
            <Monitor className="w-3 h-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={selectDirectory}
            className="gap-1 md:gap-2 text-xs md:text-sm"
          >
            <span className="hidden md:inline">📁 Dossier</span>
            <span className="md:hidden">📁</span>
          </Button>
          <Popover open={showFileManager} onOpenChange={setShowFileManager}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!directoryHandleRef.current}
                className="gap-1 md:gap-2 text-xs md:text-sm"
              >
                <FolderOpen className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden md:inline">Fichiers</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <FileManager
                key={filesKey}
                directoryHandle={directoryHandleRef.current}
                currentFile={currentFile}
                onFileSelect={(file) => {
                  handleFileSelect(file);
                  setShowFileManager(false);
                }}
                onFilesUpdate={() => setFilesKey(prev => prev + 1)}
              />
            </PopoverContent>
          </Popover>
          <VersionHistory
            conversationId={conversationId}
            currentFile={currentFile}
            onRestore={handleVersionRestore}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.innerWidth < 768) {
                setShowMobileCode(true);
              } else {
                setShowEditor(!showEditor);
              }
            }}
            className="gap-1 md:gap-2 text-xs md:text-sm"
          >
            <Code2 className="w-3 h-3 md:w-4 md:h-4" />
            <span className="hidden md:inline">{showEditor ? "Masquer" : "Afficher"} Code</span>
          </Button>
          {/* Desktop: Avatar at the very end */}
          <div className="hidden md:block">
            <UserAvatar user={user} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="hidden md:flex">
          {/* Chat Sidebar - Can be hidden */}
          {showAssistant && (
            <>
              <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                <ChatInterface 
                  code={code} 
                  onCodeUpdate={setCode} 
                  directoryHandle={directoryHandleRef.current}
                  currentFile={currentFile}
                  conversationId={conversationId}
                  onConversationUpdate={setConversationId}
                  onFileCreate={handleFileCreate}
                  onToggleVisibility={() => setShowAssistant(false)}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          
          {/* Button to reopen assistant when hidden */}
          {!showAssistant && (
            <button
              onClick={() => setShowAssistant(true)}
              className="fixed left-0 top-1/2 -translate-y-1/2 bg-gradient-assistant text-white p-2 rounded-r-lg shadow-lg hover:shadow-xl transition-all z-50"
              title="Ouvrir l'assistant"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Editor and Preview */}
          <ResizablePanel defaultSize={70}>
            {showEditor && showPreview ? (
              <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={50} minSize={30}>
                  <CodeEditor
                    code={code}
                    onChange={setCode}
                    showPreview={showPreview}
                    onTogglePreview={() => setShowPreview(!showPreview)}
                    onSave={saveCodeToFile}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={30}>
                  <PreviewPane 
                    directoryHandle={directoryHandleRef.current} 
                    onSelectDirectory={selectDirectory}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : showEditor ? (
              <CodeEditor
                code={code}
                onChange={setCode}
                showPreview={showPreview}
                onTogglePreview={() => setShowPreview(!showPreview)}
                onSave={saveCodeToFile}
              />
            ) : (
              <PreviewPane 
                directoryHandle={directoryHandleRef.current} 
                onSelectDirectory={selectDirectory}
              />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Mobile Layout */}
        <div className="flex md:hidden flex-col h-full relative">
          {/* Main content area */}
          <div className="flex-1 overflow-hidden pb-12 pt-14">
            {mobileView === "chat" && (
              <ChatInterface 
                code={code} 
                onCodeUpdate={setCode} 
                directoryHandle={directoryHandleRef.current}
                currentFile={currentFile}
                conversationId={conversationId}
                onConversationUpdate={setConversationId}
                onFileCreate={handleFileCreate}
                isMobile={true}
                user={user}
              />
            )}
            {mobileView === "preview" && (
              <PreviewPane 
                directoryHandle={directoryHandleRef.current} 
                onSelectDirectory={selectDirectory}
                isMobile={true}
              />
            )}
          </div>

          {/* Code Sheet - slides from bottom */}
          <Sheet open={showMobileCode} onOpenChange={setShowMobileCode}>
            <SheetContent side="bottom" className="h-[85vh] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Éditeur de code</SheetTitle>
              </SheetHeader>
              <CodeEditor
                code={code}
                onChange={setCode}
                showPreview={false}
                onTogglePreview={() => {}}
                onSave={saveCodeToFile}
                onClose={() => setShowMobileCode(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Signature at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-secondary/50 border-t border-border flex items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Fièrement conçu par <span className="font-semibold text-primary">Oredy TECHNOLOGIES</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

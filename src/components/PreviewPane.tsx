import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Tablet, Maximize, FolderOpen, RefreshCw, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface PreviewPaneProps {
  directoryHandle: FileSystemDirectoryHandle | null;
  onSelectDirectory: () => void;
  isMobile?: boolean;
}

export function PreviewPane({ directoryHandle, onSelectDirectory, isMobile = false }: PreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewportSize, setViewportSize] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>("index.html");
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);

  const viewportSizes = {
    mobile: "375px",
    tablet: "768px",
    desktop: "100%",
  };

  const loadAvailableFiles = async () => {
    if (!directoryHandle) return;

    try {
      const files: string[] = [];
      for await (const entry of (directoryHandle as any).values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.html')) {
          files.push(entry.name);
        }
      }
      setAvailableFiles(files.sort());
    } catch (error) {
      console.error("Error loading files:", error);
    }
  };

  const loadPreview = async (fileName: string = currentPath) => {
    if (!directoryHandle) {
      setPreviewUrl("");
      return;
    }

    setIsLoading(true);
    try {
      // Request permission if needed
      const dir: any = directoryHandle;
      if (dir?.queryPermission) {
        let status = await dir.queryPermission({ mode: "read" });
        if (status !== "granted") {
          status = await dir.requestPermission({ mode: "read" });
          if (status !== "granted") {
            setIsLoading(false);
            return;
          }
        }
      }

      // Read the specified HTML file
      const fileHandle = await directoryHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const content = await file.text();
      
      // Create a blob URL
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      
      // Clean up previous URL if it exists
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      setPreviewUrl(url);
      setCurrentPath(fileName);
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error(`Impossible de charger ${fileName}`);
      setPreviewUrl("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadPreview(currentPath);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleFileSelect = (fileName: string) => {
    loadPreview(fileName);
  };

  const handlePathChange = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const newPath = (e.target as HTMLInputElement).value;
      if (newPath.endsWith('.html')) {
        loadPreview(newPath);
      }
    }
  };

  const openInBrowser = async () => {
    if (!directoryHandle) {
      toast.error("Veuillez d'abord sélectionner un dossier");
      return;
    }

    try {
      const fileHandle = await directoryHandle.getFileHandle("index.html");
      const file = await fileHandle.getFile();
      const content = await file.text();
      
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      
      window.open(url, "_blank");
      
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error) {
      console.error("Error opening in browser:", error);
      toast.error("Erreur lors de l'ouverture dans le navigateur");
    }
  };

  useEffect(() => {
    if (!directoryHandle) return;
    
    loadAvailableFiles();
    loadPreview("index.html");
    
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [directoryHandle]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleIframeClick = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && e.data?.path) {
        loadPreview(e.data.path);
      }
    };

    window.addEventListener('message', handleIframeClick);
    return () => window.removeEventListener('message', handleIframeClick);
  }, [directoryHandle]);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className={`${isMobile ? 'p-2' : 'p-3'} border-b border-border bg-secondary space-y-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-accent`} />
            <h2 className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold`}>Aperçu en Direct</h2>
          </div>
          <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || !directoryHandle}
            className="gap-2"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={openInBrowser}
            disabled={!directoryHandle}
            className="gap-2"
            title="Ouvrir dans le navigateur"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border" />
          <Button
            variant={viewportSize === "mobile" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewportSize("mobile")}
            className="gap-2"
          >
            <Smartphone className="w-4 h-4" />
          </Button>
          <Button
            variant={viewportSize === "tablet" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewportSize("tablet")}
            className="gap-2"
          >
            <Tablet className="w-4 h-4" />
          </Button>
          <Button
            variant={viewportSize === "desktop" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewportSize("desktop")}
            className="gap-2"
          >
            <Maximize className="w-4 h-4" />
          </Button>
          </div>
        </div>

        {/* URL Bar and Pages Selector */}
        {directoryHandle && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <Input
                value={currentPath}
                onChange={(e) => setCurrentPath(e.target.value)}
                onKeyDown={handlePathChange}
                placeholder="Chemin du fichier..."
                className="flex-1 h-8 text-sm"
              />
            </div>
            <Select value={currentPath} onValueChange={handleFileSelect}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="Pages" />
              </SelectTrigger>
              <SelectContent>
                {availableFiles.map((file) => (
                  <SelectItem key={file} value={file}>
                    {file}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="flex-1 bg-background flex items-center justify-center overflow-auto">
        {!directoryHandle ? (
          <div className="text-center p-8">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Aucun dossier sélectionné</h3>
            <p className="text-muted-foreground mb-4">
              Veuillez sélectionner un dossier pour enregistrer et prévisualiser votre application
            </p>
            <Button onClick={onSelectDirectory} className="gap-2">
              <FolderOpen className="w-4 h-4" />
              Sélectionner un dossier
            </Button>
            <p className="text-xs text-muted-foreground mt-8 opacity-60">
              Fièrement conçu par <a href="https://oredytech.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors underline">Oredy TECHNOLOGIES</a>
            </p>
          </div>
        ) : isLoading ? (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement de l'aperçu...</p>
          </div>
        ) : (
          <div 
            className="h-full transition-all duration-300 ease-in-out bg-white"
            style={{ 
              width: viewportSizes[viewportSize],
              maxWidth: "100%"
            }}
          >
            <iframe
              ref={iframeRef}
              key={previewUrl}
              src={previewUrl}
              title="Preview"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface VersionHistoryProps {
  conversationId: string | null;
  currentFile: string;
  onRestore: (content: string, version: number) => void;
}

interface FileVersion {
  id: string;
  file_name: string;
  file_content: string;
  version_number: number;
  created_at: string;
}

export function VersionHistory({ conversationId, currentFile, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadVersions = async () => {
    if (!conversationId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("file_versions")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("file_name", currentFile)
        .order("version_number", { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error("Error loading versions:", error);
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (conversationId && currentFile) {
      loadVersions();
    }
  }, [conversationId, currentFile]);

  const handleRestore = (version: FileVersion) => {
    if (confirm(`Restaurer la version ${version.version_number} de ${version.file_name} ?`)) {
      onRestore(version.file_content, version.version_number);
      toast.success(`Version ${version.version_number} restaurée`);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="w-4 h-4" />
          <span className="hidden md:inline">Historique</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Historique des versions</SheetTitle>
          <SheetDescription>
            Fichier: {currentFile}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune version enregistrée
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-semibold">
                        Version {version.version_number}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(version.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(version)}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                  <pre className="text-xs bg-secondary p-2 rounded max-h-32 overflow-auto">
                    {version.file_content.substring(0, 200)}...
                  </pre>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
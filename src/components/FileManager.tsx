import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Plus, Trash2, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FileManagerProps {
  directoryHandle: FileSystemDirectoryHandle | null;
  currentFile: string;
  onFileSelect: (fileName: string) => void;
  onFilesUpdate: () => void;
}

export function FileManager({ directoryHandle, currentFile, onFileSelect, onFilesUpdate }: FileManagerProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [newFileName, setNewFileName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loadFiles = async () => {
    if (!directoryHandle) {
      setFiles([]);
      return;
    }

    try {
      const fileList: string[] = [];
      for await (const entry of (directoryHandle as any).values()) {
        if (entry.kind === 'file') {
          fileList.push(entry.name);
        } else if (entry.kind === 'directory') {
          fileList.push(`📁 ${entry.name}`);
        }
      }
      setFiles(fileList.sort());
    } catch (error) {
      console.error("Error loading files:", error);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [directoryHandle]);

  const createNewFile = async () => {
    if (!directoryHandle || !newFileName.trim()) {
      toast.error("Veuillez entrer un nom de fichier");
      return;
    }

    try {
      let fileName = newFileName.trim();
      if (!fileName.endsWith('.html')) {
        fileName += '.html';
      }

      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName.replace('.html', '')}</title>
</head>
<body>
    <h1>Nouvelle page: ${fileName.replace('.html', '')}</h1>
</body>
</html>`);
      await writable.close();

      toast.success(`Fichier ${fileName} créé avec succès`);
      setNewFileName("");
      setIsDialogOpen(false);
      await loadFiles();
      onFileSelect(fileName);
      onFilesUpdate();
    } catch (error) {
      console.error("Error creating file:", error);
      toast.error("Erreur lors de la création du fichier");
    }
  };

  const deleteFile = async (fileName: string) => {
    if (!directoryHandle) return;

    try {
      await directoryHandle.removeEntry(fileName);
      toast.success(`Fichier ${fileName} supprimé`);
      await loadFiles();
      if (currentFile === fileName) {
        onFileSelect("index.html");
      }
      onFilesUpdate();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <div className="flex flex-col w-full max-h-[400px] bg-card">
      <div className="p-3 border-b border-border bg-secondary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Fichiers</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={!directoryHandle}>
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un nouveau fichier</DialogTitle>
              <DialogDescription>
                Entrez le nom du fichier HTML à créer
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                placeholder="exemple: about.html"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createNewFile()}
              />
              <Button onClick={createNewFile}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucun fichier
            </p>
          ) : (
            files.map((file) => (
              <div
                key={file}
                className={`group flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer ${
                  currentFile === file ? "bg-accent" : ""
                }`}
                onClick={() => onFileSelect(file)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm truncate">{file}</span>
                </div>
                {file !== "index.html" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Supprimer ${file} ?`)) {
                        deleteFile(file);
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
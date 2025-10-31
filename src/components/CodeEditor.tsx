import { Editor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Code2, Eye, Save, X } from "lucide-react";
import { toast } from "sonner";

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  onSave?: () => void;
  onClose?: () => void;
}

export function CodeEditor({ code, onChange, showPreview, onTogglePreview, onSave, onClose }: CodeEditorProps) {
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || "");
  };

  const handleSave = () => {
    if (!code || code.trim() === "") {
      toast.error("Aucun code à enregistrer");
      return;
    }
    
    if (onSave) {
      onSave();
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header - 40px height with rounded top corners */}
      <div className="h-10 border-b border-border flex items-center justify-between bg-secondary px-3 rounded-tl-lg rounded-tr-lg">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Éditeur de Code</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            className="h-7 px-2"
          >
            <Save className="w-4 h-4" />
            <span className="ml-1 text-xs">Enregistrer</span>
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 px-2"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          {!onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onTogglePreview}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? "Masquer" : "Afficher"} l'aperçu
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="html"
          theme="vs-dark"
          value={code}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 16 },
          }}
        />
      </div>
    </div>
  );
}

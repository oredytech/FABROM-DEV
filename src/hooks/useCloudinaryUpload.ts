import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
}

export const useCloudinaryUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = async (file: File): Promise<CloudinaryUploadResult | null> => {
    setIsUploading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Image = await base64Promise;

      // Upload via edge function
      const { data, error } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { image: base64Image },
      });

      if (error) {
        console.error("Upload error:", error);
        toast.error("Erreur lors de l'upload de l'image");
        return null;
      }

      toast.success("Image uploadée avec succès!");
      return data;
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Échec de l'upload de l'image");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadImage, isUploading };
};

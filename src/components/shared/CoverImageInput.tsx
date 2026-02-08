import { useState, useRef } from "react";
import { Upload, Link, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface CoverImageInputProps {
  value: string;
  onChange: (value: string) => void;
  setId?: string;
}

export function CoverImageInput({ value, onChange, setId }: CoverImageInputProps) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${setId || crypto.randomUUID()}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("set-covers")
      .upload(fileName, file);

    if (uploadError) {
      toast.error("Failed to upload image: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("set-covers")
      .getPublicUrl(fileName);

    onChange(publicUrl);
    setUploading(false);
    toast.success("Cover image uploaded");
  }

  function handleUrlSubmit() {
    if (!urlInput.trim()) {
      toast.error("Please enter an image URL");
      return;
    }

    try {
      new URL(urlInput);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    onChange(urlInput.trim());
    setUrlInput("");
    toast.success("Cover image URL set");
  }

  function handleRemove() {
    onChange("");
  }

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt="Cover preview"
            className="w-full h-32 object-contain rounded-lg border bg-muted"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="text-xs">
              <Upload className="h-3 w-3 mr-1" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs">
              <Link className="h-3 w-3 mr-1" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Click to upload image</span>
                  <span className="text-[10px] opacity-60">Max 5MB</span>
                </div>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="url" className="mt-2">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/image.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleUrlSubmit();
                  }
                }}
              />
              <Button type="button" onClick={handleUrlSubmit} size="sm">
                Set
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

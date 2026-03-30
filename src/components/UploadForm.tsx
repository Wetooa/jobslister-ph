'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { FileUp, Loader2 } from 'lucide-react';

interface UploadFormProps {
  onUploadSuccess: (profile: any) => void;
  localCVs?: string[];
}

export function UploadForm({ onUploadSuccess, localCVs = [] }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (localFileName?: string) => {
    setUploading(true);
    
    try {
      let res;
      if (localFileName) {
        res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localFileName }),
        });
      } else {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
      }
      
      const data = await res.json();
      if (data.success) {
        toast.success(localFileName ? `Local CV "${localFileName}" processed!` : 'CV Processed successfully!');
        onUploadSuccess(data.profile);
      } else {
        toast.error(data.error || 'Failed to process CV');
      }
    } catch (err) {
      toast.error('An error occurred during process');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="w-5 h-5" />
          Upload Your CV (PDF)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {localCVs.length > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg space-y-2">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Found files in project root:</p>
            <div className="flex flex-wrap gap-2">
              {localCVs.map((pdfName) => (
                <Button 
                  key={pdfName}
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleUpload(pdfName)}
                  disabled={uploading}
                  className="bg-white dark:bg-slate-950 text-xs gap-2"
                >
                  <FileUp className="w-3 h-3" />
                  Use {pdfName}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        <Input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="cursor-pointer"
        />
        <Button 
          onClick={() => handleUpload()} 
          disabled={!file || uploading} 
          className="w-full font-bold transition-all hover:scale-[1.02]"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing Resume...
            </>
          ) : (
            'Upload & Process'
          )}
        </Button>
        {uploading && (
          <div className="space-y-2">
            <Progress value={45} className="h-2" />
            <p className="text-xs text-center text-muted-foreground animate-pulse">
              Reading PDF and generating profile summary...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import React from 'react';
import { useDictionary } from '@/contexts/DictionaryContext';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export const DictionaryLoader: React.FC = () => {
  const { isLoading, isLoaded, error, wordCount } = useDictionary();

  if (!isLoading && isLoaded) {
    return (
      <Alert className="mb-4">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Dictionary loaded with {wordCount.toLocaleString()} words
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Dictionary loading failed: {error}. Using fallback dictionary.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">Loading ENABLE Dictionary...</div>
            <Progress value={undefined} className="w-full" />
            <div className="text-xs text-muted-foreground">
              Loading 173,000+ words for enhanced gameplay
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
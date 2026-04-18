'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, X, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Profile } from '@/lib/types';

interface JobSearchProps {
  onSearchStarted: (queries: string[]) => void;
  isLoading: boolean;
  profile?: Profile;
}

export function JobSearch({ onSearchStarted, isLoading, profile }: JobSearchProps) {
  const [query, setQuery] = useState('');
  
  const [queries, setQueries] = useState<string[]>(() => {
    if (profile && profile.skills) {
      const processedSkills: string[] = [];
      const allSkills = Object.values(profile.skills).flat();
      
      allSkills.forEach(skill => {
        // Split composite skills like "JavaScript/TypeScript"
        if (skill.includes('/')) {
          skill.split('/').forEach(s => processedSkills.push(s.trim()));
        } else {
          processedSkills.push(skill);
        }
        
        // Add common variations
        if (skill.toLowerCase() === 'next.js') {
          processedSkills.push('Nextjs');
        }
      });

      const uniqueSkills = Array.from(new Set(processedSkills));
      const topSkills = uniqueSkills.slice(0, 15);
      if (topSkills.length > 0) return topSkills;
    }
    return ['Software Engineer', 'AI', 'Node.js', 'Python'];
  });

  const addQuery = () => {
    if (query.trim() && !queries.includes(query.trim())) {
      setQueries([...queries, query.trim()]);
      setQuery('');
    }
  };

  const removeQuery = (q: string) => {
    setQueries(queries.filter(item => item !== q));
  };

  const handleSearch = () => {
    if (queries.length === 0) {
      toast.error('Add at least one search query');
      return;
    }
    onSearchStarted(queries);
  };

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/50">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Search className="h-5 w-5 text-primary" />
          Job Search Parameters
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-400">
          Specify keywords for the job search on OnlineJobs.ph
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Input 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="e.g. React Developer"
            onKeyDown={(e) => e.key === 'Enter' && addQuery()}
            disabled={isLoading}
            className="h-10 rounded-xl border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50"
          />
          <Button variant="outline" size="icon" onClick={addQuery} disabled={isLoading}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {queries.map((q, idx) => (
            <Badge key={idx} variant="secondary" className="px-3 py-1 flex items-center gap-2 pr-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border-blue-100">
              {q}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-4 w-4 p-0 hover:bg-transparent" 
                onClick={() => removeQuery(q)}
                disabled={isLoading}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>

        <Button 
          onClick={handleSearch} 
          disabled={isLoading || queries.length === 0}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-bold shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Searching & Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Start Automated Scan
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

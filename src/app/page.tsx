'use client';

import { useEffect, useState } from 'react';
import { UploadForm } from '@/components/UploadForm';
import { JobList } from '@/components/JobList';
import { JobSearch } from '@/components/JobSearch';
import { ScanTerminal } from '@/components/ScanTerminal';
import { Job, Analysis, Profile } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Briefcase, UserCircle, Sparkles, LayoutDashboard, RefreshCw, Globe, Plus, Search, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analysis, setAnalysis] = useState<Record<string, Analysis>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [localCVs, setLocalCVs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [isScanComplete, setIsScanComplete] = useState(false);
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [isScrapingPortfolio, setIsScrapingPortfolio] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data.jobs || []);
      setAnalysis(data.analysis || {});
      
      const profRes = await fetch('/api/upload');
      if (profRes.ok) {
        const profData = await profRes.json();
        setProfile(profData.profile);
        setLocalCVs(profData.localCVs || []);
      }
    } catch (err) {
      console.error('Failed to fetch data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await fetchData();
      toast.info('Scanning for closed jobs in the background...');
      
      fetch('/api/jobs/sync', { method: 'POST' })
        .then(r => r.json())
        .then(data => {
          if (data.updatedCount > 0) {
            toast.success(`Removed ${data.updatedCount} closed jobs!`);
            fetchData();
          } else if (data.success) {
            toast.success('All active jobs are still open.');
          }
        })
        .catch(() => console.error('Background sync failed'));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeepScan = async () => {
    if (!portfolioUrl) return;
    setIsScrapingPortfolio(true);
    toast.info('Starting recursive scan of your portfolio... This may take a minute.');
    
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioUrl })
      });
      
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        setPortfolioUrl('');
        toast.success('Portfolio deep scan complete! Profile updated.');
      } else {
        toast.error(data.error || 'Failed to scan portfolio');
      }
    } catch (err) {
      toast.error('An error occurred during portfolio scan');
    } finally {
      setIsScrapingPortfolio(false);
    }
  };

  const handleSearch = async (queries: string[]) => {
    setIsLoading(true);
    setScanLogs([]);
    setIsScanComplete(false);
    
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to start scan');
      }
      
      const streamRes = await fetch('/api/jobs/stream');
      if (!streamRes.body) throw new Error('No streaming response body found');
      
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const data = JSON.parse(line.trim().slice(6));
              if (data.event === 'log') {
                setScanLogs(prev => [...prev, data.message]);
              } else if (data.event === 'error') {
                toast.error(data.message);
                setScanLogs(prev => [...prev, `**Error:** ${data.message}`]);
              } else if (data.event === 'analysisAdded') {
                fetchData();
              } else if (data.event === 'complete') {
                setIsScanComplete(true);
                toast.success('Scan completed successfully!');
                fetchData();
              }
            } catch (e) {
              // Incomplete chunk parsing
            }
          }
        }
      }
    } catch (err) {
      toast.error('An error occurred during scanning');
      setScanLogs(prev => [...prev, '**Error:** Connection failed or stream interrupted.']);
    } finally {
      setIsLoading(false);
      setIsScanComplete(true);
      fetchData();
    }
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] text-slate-900 dark:text-slate-50 pb-20">
      {/* Premium Gradient Background */}
      <div className="fixed inset-0 pointer-events-none opacity-20 dark:opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-indigo-400 blur-[100px]" />
      </div>

      <header className="sticky top-0 z-50 w-full border-b bg-white/70 dark:bg-slate-950/70 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg shadow-blue-500/20 shadow-lg">
              <Briefcase className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">JobsPH <span className="text-primary font-black">AI</span></h1>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:flex">
            <TabsList className="bg-slate-100 dark:bg-slate-800">
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="profile" className="gap-2">
                <UserCircle className="w-4 h-4" />
                My Profile
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 relative">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsContent value="dashboard" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-6">
                {!profile ? (
                  <UploadForm 
                    onUploadSuccess={(p) => { setProfile(p); setActiveTab('dashboard'); }} 
                    localCVs={localCVs}
                  />
                ) : (
                  <div className="space-y-6">
                    <JobSearch onSearchStarted={handleSearch} isLoading={isLoading} profile={profile} />
                    {(isLoading || scanLogs.length > 0) && (
                      <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                        <ScanTerminal logs={scanLogs} isComplete={isScanComplete} />
                        {isScanComplete && (
                          <Button variant="ghost" onClick={() => setScanLogs([])} className="w-full mt-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
                            Clear Terminal
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {profile && (
                  <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none overflow-hidden relative shadow-xl">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Sparkles className="w-20 h-20" />
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm uppercase tracking-widest opacity-70">Active Profile</CardTitle>
                      <CardDescription className="text-white text-sm leading-relaxed line-clamp-3">
                        {profile.summary || profile.profile_summary || 'Profile Summary...'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white" onClick={() => setActiveTab('profile')}>
                        View/Edit Profile
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Recommended Jobs</h2>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="h-7 text-xs px-2 data-[state=open]:bg-muted">
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                      Refresh List
                    </Button>
                    <Badge variant="outline" className="px-3 py-1 text-xs border-slate-200 bg-white dark:bg-slate-900">
                      {jobs.length} Opportunities found
                    </Badge>
                  </div>
                </div>
                <JobList jobs={jobs} analysis={analysis} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Metadata & Portfolios */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Portfolios & Web Presence</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {profile?.portfolios?.map((url, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-900 border text-xs">
                          <span className="truncate max-w-[150px]">{url}</span>
                          <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                      
                      <div className="space-y-2 pt-2">
                        <Input 
                          placeholder="https://portfolio.com" 
                          value={portfolioUrl} 
                          onChange={(e) => setPortfolioUrl(e.target.value)}
                          className="text-xs h-8"
                        />
                        <Button 
                          size="sm" 
                          className="w-full h-8 text-xs gap-2" 
                          onClick={handleDeepScan}
                          disabled={isScrapingPortfolio || !portfolioUrl}
                        >
                          {isScrapingPortfolio ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Search className="w-3 h-3" />
                          )}
                          Deep Scan Portfolio
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {profile?.skills && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Tech Stack</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {Object.entries(profile.skills).map(([category, items], i) => (
                          <div key={i} className="space-y-1">
                            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{category}</h4>
                            <div className="flex flex-wrap gap-1">
                              {items.map((skill, si) => (
                                <Badge key={si} variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right Column: Experience and Projects */}
                <div className="lg:col-span-2 space-y-6">
                  <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="px-0 pt-0">
                      <CardTitle className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600">
                        Professional Profile
                      </CardTitle>
                      <CardDescription className="text-base leading-relaxed">
                        {profile?.summary || profile?.profile_summary}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-0 space-y-8">
                                            
                      <section className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-primary" />
                          Experience & Projects
                        </h3>
                        <div className="space-y-4">
                          {profile?.projects?.map((proj, i) => (
                            <div key={i} className="p-5 rounded-xl border bg-white dark:bg-slate-950 shadow-sm hover:shadow-md transition-shadow space-y-3">
                              <div className="flex justify-between items-start">
                                <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">{proj.name}</h4>
                                {proj.url && (
                                  <a href={proj.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {proj.description}
                              </p>
                              {proj.technologies && (
                                <div className="flex flex-wrap gap-1.5">
                                  {proj.technologies.map((t, ti) => (
                                    <Badge key={ti} variant="secondary" className="text-[10px] px-2 py-0">
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {proj.achievements && (
                                <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 dark:text-slate-400 pl-2">
                                  {proj.achievements.map((a, ai) => (
                                    <li key={ai}>{a}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>

                      {profile && (
                         <Button variant="outline" onClick={() => { if(confirm('Are you sure you want to reset your profile?')) setProfile(null); }} className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 opacity-50 hover:opacity-100 transition-opacity">
                            Reset Profile & Re-upload CV
                         </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <Toaster position="top-right" />
    </main>
  );
}

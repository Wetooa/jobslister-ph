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
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null);
  const [lastScannedUrl, setLastScannedUrl] = useState<string | null>(null);

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
              } else if (data.event === 'scanProgress') {
                setScanImageUrl(data.screenshot);
                setLastScannedUrl(data.url);
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

          <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-4 duration-700 outline-none">
            <div className="max-w-6xl mx-auto space-y-10">
              
              {/* Premium Header */}
              <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 md:p-12 text-white shadow-2xl">
                <div className="absolute top-0 right-0 -m-12 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="absolute bottom-0 left-0 -m-12 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
                
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                  <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <UserCircle className="w-14 h-14" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                      Professional Profile
                    </h2>
                    <p className="text-slate-400 max-w-2xl text-lg leading-relaxed italic">
                      {profile?.summary || profile?.profile_summary || 'No active profile summary found.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left Column: Tools & Control */}
                <div className="space-y-8">
                  {/* Portfolio Manager Card */}
                  <Card className="border-none shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Globe className="w-5 h-5 text-indigo-500" />
                        Web Presence
                      </CardTitle>
                      <CardDescription>Portfolios & Personal Links</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {profile?.portfolios?.map((url, i) => (
                          <div key={i} className="group flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-transparent hover:border-indigo-500/30 border transition-all">
                            <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">{url}</span>
                            <a href={url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                      
                      <div className="pt-4 space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input 
                            placeholder="https://portfolio.me" 
                            value={portfolioUrl} 
                            onChange={(e) => setPortfolioUrl(e.target.value)}
                            className="pl-9 pr-4 py-6 bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500"
                          />
                        </div>
                        <Button 
                          className="w-full py-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-lg hover:shadow-indigo-500/20 gap-2 font-bold"
                          onClick={handleDeepScan}
                          disabled={isScrapingPortfolio || !portfolioUrl}
                        >
                          {isScrapingPortfolio ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Sparkles className="w-5 h-5" />
                          )}
                          {isScrapingPortfolio ? 'Deep Scanning...' : 'Start Deep Scan'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tech Stack Visualization */}
                  <Card className="border-none shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="text-lg">Tech Stack</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {profile?.skills && Object.entries(profile.skills).map(([category, items], i) => (
                        <div key={i} className="space-y-3">
                          <h4 className="text-xs uppercase tracking-widest text-slate-400 font-black flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            {category.replace(/_/g, ' ')}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {items.map((skill, si) => (
                              <Badge key={si} variant="secondary" className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-500 hover:text-white transition-colors cursor-default border-none shadow-sm">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Live Feed & Projects */}
                <div className="lg:col-span-2 space-y-8">
                  
                  {/* LIVE CRAWL FEED */}
                  {isScrapingPortfolio && (
                    <Card className="border-2 border-indigo-500/20 shadow-2xl bg-slate-950 overflow-hidden animate-in zoom-in-95 duration-500">
                      <CardHeader className="bg-slate-900/50 border-b border-white/5 flex flex-row items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                           <div className="flex gap-1.5">
                              <div className="h-3 w-3 rounded-full bg-red-500" />
                              <div className="h-3 w-3 rounded-full bg-yellow-500" />
                              <div className="h-3 w-3 rounded-full bg-green-500" />
                           </div>
                           <CardTitle className="text-xs font-mono text-slate-400 ml-4">
                              {lastScannedUrl || 'Starting crawler...'}
                           </CardTitle>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-tighter text-indigo-400 border-indigo-400/30 animate-pulse">
                          Live Crawl Feed
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-0 relative bg-slate-900 aspect-video flex items-center justify-center">
                        {scanImageUrl ? (
                          <img 
                            src={scanImageUrl} 
                            alt="Crawl Screenshot" 
                            className="w-full h-full object-cover object-top opacity-80"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-4 text-slate-500">
                            <RefreshCw className="w-10 h-10 animate-spin opacity-20" />
                            <p className="text-sm font-mono">Initializing browser instance...</p>
                          </div>
                        )}
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                      </CardContent>
                    </Card>
                  )}

                  {/* Projects Experience */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                       <Briefcase className="w-8 h-8 text-indigo-500" />
                       <h3 className="text-3xl font-black">Experience & Projects</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                      {profile?.projects?.map((proj, i) => (
                        <Card key={i} className="group border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                          <CardContent className="p-8 space-y-5">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <h4 className="text-2xl font-black group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                  {proj.name}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {proj.technologies?.map((t, ti) => (
                                    <Badge key={ti} variant="outline" className="text-[10px] border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-tighter font-black">
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              {proj.url && (
                                <a href={proj.url} target="_blank" rel="noreferrer" className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500 hover:text-white transition-all shadow-sm">
                                  <ExternalLink className="w-5 h-5" />
                                </a>
                              )}
                            </div>
                            
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg font-medium italic border-l-4 border-indigo-500 pl-4 py-1">
                              {proj.description}
                            </p>

                            {proj.achievements && (
                              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-6 space-y-3">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Key Achievements</h5>
                                <ul className="space-y-3">
                                  {proj.achievements.map((a, ai) => (
                                    <li key={ai} className="text-sm flex gap-3 text-slate-600 dark:text-slate-400 font-medium">
                                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                                      {a}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {profile && (
                      <div className="pt-10 flex justify-center">
                        <Button 
                          variant="ghost" 
                          onClick={() => { if(confirm('Are you sure you want to reset your profile?')) setProfile(null); }} 
                          className="text-slate-400 hover:text-red-500 hover:bg-red-500/5 transition-all text-xs uppercase tracking-widest font-black"
                        >
                          Reset Profile & Re-upload CV
                        </Button>
                      </div>
                    )}
                  </div>
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

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
import { Briefcase, UserCircle, Sparkles, LayoutDashboard, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analysis, setAnalysis] = useState<Record<string, Analysis>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [localCVs, setLocalCVs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [isScanComplete, setIsScanComplete] = useState(false);

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
            <div className="max-w-4xl mx-auto space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Professional Profile</CardTitle>
                  <CardDescription>Generated from your CV analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {profile ? (
                    <>
                      <section className="space-y-3">
                        <h3 className="font-bold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          Summary
                        </h3>
                        <p className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-600 dark:text-slate-400">
                          {profile.summary || profile.profile_summary}
                        </p>
                      </section>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <section className="space-y-3">
                          <h3 className="font-bold border-b pb-2">Core Skills</h3>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {Object.values(profile.skills || {}).flat().map((skill, i) => (
                              <Badge key={i} variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </section>
                        <section className="space-y-3">
                          <h3 className="font-bold border-b pb-2">Experience Highlights</h3>
                          <ul className="list-disc list-inside text-sm space-y-2 text-slate-600 dark:text-slate-400 pt-1">
                            {(profile.experience || profile.experience_highlights || []).map((exp, i) => (
                              <li key={i}>{exp}</li>
                            ))}
                          </ul>
                        </section>
                      </div>
                      
                      <Button variant="outline" onClick={() => { if(confirm('Are you sure you want to reset your profile?')) setProfile(null); }} className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 mt-8">
                        Reset Profile & Re-upload CV
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No profile active. Please upload a CV first.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <Toaster position="top-right" />
    </main>
  );
}

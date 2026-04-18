'use client';

import { useState, useEffect } from 'react';
import { Job, Analysis } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { ExternalLink, CheckCircle2, XCircle, AlertCircle, X, Bookmark, BookmarkCheck, CheckSquare, Square, Trash2, EyeOff, MapPin, CircleDollarSign, Pin, UserMinus, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface JobListProps {
  jobs: Job[];
  analysis: Record<string, Analysis>;
}

export function JobList({ jobs, analysis }: JobListProps) {
  const [sortBy, setSortBy] = useState('match_desc');
  const [skillFilter, setSkillFilter] = useState('');

  const [showFullTime, setShowFullTime] = useState(false);
  const [showPartTime, setShowPartTime] = useState(false);
  const [showGig, setShowGig] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [hideApplied, setHideApplied] = useState(false);
  const [showBlacklisted, setShowBlacklisted] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  type JobWithMatch = Job & { match?: Analysis };
  const [selectedJob, setSelectedJob] = useState<JobWithMatch | null>(null);

  const [localJobs, setLocalJobs] = useState<Job[]>(jobs);

  const allTags = Array.from(new Set(localJobs.flatMap(j => j.tags || []))).filter(Boolean).sort();

  useEffect(() => {
    setLocalJobs(jobs);
  }, [jobs]);

  const toggleStatus = async (link: string, key: 'isSaved' | 'hasApplied' | 'isClosed' | 'isBlacklisted', currentValue: boolean) => {
    // Optimistic UI update
    setLocalJobs(prev => prev.map(j => j.link === link ? { ...j, [key]: !currentValue } : j));
    if (selectedJob?.link === link) {
      setSelectedJob(prev => prev ? { ...prev, [key]: !currentValue } : null);
    }

    // Server Sync
    try {
      await fetch('/api/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link, [key]: !currentValue })
      });
    } catch (e) { console.error('Failed to toggle', e); }
  };

  const filteredJobs = [...localJobs]
    .map(job => {
      const matchData = analysis[job.link];
      const match = matchData ? { ...matchData, matchScore: matchData.matchScore ?? matchData.match_score ?? 0 } : undefined;
      return { ...job, match };
    })
    .filter(job => {
      if (job.isClosed) return false;

      let typeMatch = true;
      if (showFullTime || showPartTime || showGig) {
        const titleAndType = (job.typeOfWork || '').toLowerCase();
        typeMatch =
          titleAndType.includes('any') ||
          (showFullTime && titleAndType.includes('full time')) ||
          (showPartTime && titleAndType.includes('part time')) ||
          (showGig && titleAndType.includes('gig'));
      }

      let statusMatch = true;
      if (showSaved && !job.isSaved) statusMatch = false;
      if (hideApplied && !!job.hasApplied) statusMatch = false;
      if (!showBlacklisted && job.isBlacklisted) statusMatch = false;

      let skillMatch = true;
      if (skillFilter.trim()) {
        const query = skillFilter.toLowerCase().trim();
        const searchPool = `${job.title} ${job.skills || ''} ${job.description || ''}`.toLowerCase();
        skillMatch = searchPool.includes(query);
      }

      let tagMatch = true;
      if (selectedTags.length > 0) {
        tagMatch = selectedTags.some(tag => (job.tags || []).includes(tag));
      }

      return typeMatch && statusMatch && skillMatch && tagMatch;
    });

  const sortedJobs = filteredJobs.sort((a, b) => {
    if (sortBy === 'match_desc') return (b.match?.matchScore || 0) - (a.match?.matchScore || 0);
    if (sortBy === 'match_asc') return (a.match?.matchScore || 0) - (b.match?.matchScore || 0);
    return 0;
  });

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-slate-50 rounded-xl border-2 border-dashed">
        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
        <p>No jobs analyzed yet. Start by uploading a CV or searching for jobs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="w-full flex-1 sm:max-w-md">
            <Input
              type="text"
              placeholder="Search keywords or skills (e.g. Node.js, Python)..."
              value={skillFilter}
              onChange={e => setSkillFilter(e.target.value)}
              className="h-10 w-full rounded-xl border-slate-200 bg-slate-50/90 text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-sm font-medium text-slate-500 whitespace-nowrap">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary focus:border-primary block w-full sm:w-[220px] p-2 dark:bg-slate-800 dark:border-slate-700 dark:placeholder-slate-400 dark:text-white"
            >
              <option value="match_desc">Match Score (High to Low)</option>
              <option value="match_asc">Match Score (Low to High)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-slate-500">Job Type:</span>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={showFullTime} onChange={e => setShowFullTime(e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" /> Full Time
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={showPartTime} onChange={e => setShowPartTime(e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" /> Part Time
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={showGig} onChange={e => setShowGig(e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" /> Gig
            </label>
          </div>

          <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-700"></div>

          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-slate-500">Status:</span>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-amber-700 dark:text-amber-500">
              <input type="checkbox" checked={showSaved} onChange={e => setShowSaved(e.target.checked)} className="rounded border-amber-300 text-amber-500 focus:ring-amber-500" />
              <Pin className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Saved only
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={hideApplied} onChange={e => setHideApplied(e.target.checked)} className="rounded border-slate-300 text-slate-500 focus:ring-slate-500" />
              <UserMinus className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Hide applied
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={showBlacklisted} onChange={e => setShowBlacklisted(e.target.checked)} className="rounded border-slate-300 text-slate-500 focus:ring-slate-500" />
              <Eye className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Show blacklisted
            </label>
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-sm font-medium text-slate-500 mb-2 block">Filter by Search Tag:</span>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'secondary'}
                  className="cursor-pointer hover:bg-primary/90 hover:text-white transition-colors"
                  onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedJobs.map((job, idx) => (
          <Card key={idx}
            onClick={() => setSelectedJob(job)}
            className={`flex flex-col hover:shadow-lg transition-all group border-l-4 overflow-hidden cursor-pointer active:scale-[0.99] ${job.hasApplied ? 'opacity-60 grayscale hover:grayscale-0' : ''}`}
            style={{ borderLeftColor: getScoreColor(job.match?.matchScore) }}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex flex-col items-start gap-1 mb-2">
                  <Badge variant={job.match?.matchScore && job.match.matchScore >= 70 ? 'default' : (job.match?.matchScore === -1 || job.scrapeError ? 'destructive' : 'secondary')}>
                    {job.scrapeError ? `Scrape Failed: ${job.scrapeError}` : (job.match ? (job.match.matchScore === -1 ? 'Analysis Failed' : `${job.match.matchScore ?? 0}% Match`) : 'Not Analyzed')}
                  </Badge>
                  {job.hasApplied && <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] uppercase">Applied</Badge>}
                  {job.tags && job.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {job.tags.map(t => (
                        <Badge key={t} variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200 capitalize">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-slate-900 rounded p-1 shadow-sm border border-slate-100 dark:border-slate-800">
                  <button onClick={e => { e.stopPropagation(); toggleStatus(job.link, 'isSaved', !!job.isSaved); }} className="text-slate-400 hover:text-amber-500 transition-colors p-1" title={job.isSaved ? "Remove Bookmark" : "Bookmark Job"}>
                    {job.isSaved ? <BookmarkCheck className="w-4 h-4 text-amber-500" /> : <Bookmark className="w-4 h-4" />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); toggleStatus(job.link, 'hasApplied', !!job.hasApplied); }} className="text-slate-400 hover:text-emerald-500 transition-colors p-1" title={job.hasApplied ? "Mark unapplied" : "Mark as applied"}>
                    {job.hasApplied ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); toggleStatus(job.link, 'isBlacklisted', !!job.isBlacklisted); }} className="text-slate-400 hover:text-orange-500 transition-colors p-1" title={job.isBlacklisted ? "Un-blacklist" : "Blacklist / Hide 👁️‍🗨️"}>
                    <EyeOff className={`w-4 h-4 ${job.isBlacklisted ? 'text-orange-500' : ''}`} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); toggleStatus(job.link, 'isClosed', false); }} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Mark as Closed / Delete 🚫">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <a href={job.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-slate-400 hover:text-primary transition-colors p-1">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                {job.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  {job.typeOfWork || 'N/A'}
                </p>
                <p className="flex items-center gap-1.5">
                  <CircleDollarSign className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  {job.salary || 'N/A'}
                </p>
              </div>

              {job.match && (
                <div className="space-y-3">
                  <div className="text-sm border-t pt-2 mt-2">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Reasoning</p>
                    <p className="text-slate-700 dark:text-slate-300 line-clamp-3 italic">{job.match.reasoning}</p>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full">
                    {job.match.pros?.slice(0, 2).map((pro, i) => (
                      <Badge key={i} variant="outline" title={pro} className="text-[10px] bg-green-50 text-green-700 border-green-200 max-w-full justify-start">
                        <span className="truncate">+ {pro}</span>
                      </Badge>
                    ))}
                    {job.match.cons?.slice(0, 1).map((con, i) => (
                      <Badge key={i} variant="outline" title={con} className="text-[10px] bg-red-50 text-red-700 border-red-200 max-w-full justify-start">
                        <span className="truncate">- {con}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!job.match && (
                <div className="text-xs text-muted-foreground italic mt-4">
                  Processing analysis...
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedJob(null)}>
          <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={selectedJob.match?.matchScore && selectedJob.match.matchScore >= 70 ? 'default' : (selectedJob.match?.matchScore === -1 ? 'destructive' : 'secondary')} className="text-sm px-3 py-1">
                  {selectedJob.match ? (selectedJob.match.matchScore === -1 ? 'Analysis Failed' : `${selectedJob.match.matchScore ?? 0}% Match`) : 'Not Analyzed'}
                </Badge>
                {selectedJob.hasApplied && <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">Applied</Badge>}
                {selectedJob.tags && selectedJob.tags.map(t => (
                  <Badge key={t} variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 capitalize">{t}</Badge>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleStatus(selectedJob.link, 'isSaved', !!selectedJob.isSaved)} className="p-2 text-slate-500 hover:bg-slate-200 hover:text-amber-500 dark:hover:bg-slate-800 transition-colors rounded-full" title={selectedJob.isSaved ? "Remove Bookmark" : "Bookmark Job"}>
                  {selectedJob.isSaved ? <BookmarkCheck className="w-5 h-5 text-amber-500" /> : <Bookmark className="w-5 h-5" />}
                </button>
                <button onClick={() => toggleStatus(selectedJob.link, 'hasApplied', !!selectedJob.hasApplied)} className="p-2 text-slate-500 hover:bg-slate-200 hover:text-emerald-500 dark:hover:bg-slate-800 transition-colors rounded-full" title={selectedJob.hasApplied ? "Mark unapplied" : "Mark as applied"}>
                  {selectedJob.hasApplied ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5" />}
                </button>
                <button onClick={() => toggleStatus(selectedJob.link, 'isBlacklisted', !!selectedJob.isBlacklisted)} className="p-2 text-slate-500 hover:bg-slate-200 hover:text-orange-500 dark:hover:bg-slate-800 transition-colors rounded-full" title={selectedJob.isBlacklisted ? "Un-blacklist" : "Blacklist / Hide 👁️‍🗨️"}>
                  <EyeOff className={`w-5 h-5 ${selectedJob.isBlacklisted ? 'text-orange-500' : ''}`} />
                </button>
                <button onClick={() => { toggleStatus(selectedJob.link, 'isClosed', false); setSelectedJob(null); }} className="p-2 text-slate-500 hover:bg-slate-200 hover:text-red-500 dark:hover:bg-slate-800 transition-colors rounded-full" title="Mark as Closed / Delete 🚫">
                  <Trash2 className="w-5 h-5" />
                </button>
                <button onClick={() => setSelectedJob(null)} className="p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 rounded-full transition-colors ml-2 border border-slate-200 dark:border-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white leading-tight">
                    {selectedJob.title}
                  </h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                      {selectedJob.typeOfWork || 'N/A'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CircleDollarSign className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                      {selectedJob.salary || 'N/A'}
                    </span>
                    <a href={selectedJob.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 ml-auto">
                      View original post <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {selectedJob.match && (
                  <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">AI Reasoning</h3>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic border-l-2 border-primary/40 pl-3">
                        {selectedJob.match.reasoning}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-green-600 mb-2">Pros</h3>
                        <ul className="space-y-1.5">
                          {selectedJob.match.pros?.map((pro, i) => (
                            <li key={i} className="text-sm flex items-start text-slate-700 dark:text-slate-300">
                              <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                              <span>{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">Cons / Missing Required</h3>
                        <ul className="space-y-1.5">
                          {selectedJob.match.cons?.map((con, i) => (
                            <li key={i} className="text-sm flex items-start text-slate-700 dark:text-slate-300">
                              <XCircle className="w-4 h-4 text-red-500 mr-2 shrink-0 mt-0.5" />
                              <span>{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {selectedJob.description && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 border-b pb-2 text-slate-900 dark:text-white">Job Description</h3>
                    <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {selectedJob.description}
                    </div>
                  </div>
                )}

                {selectedJob.skills && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 border-b pb-2 text-slate-900 dark:text-white">Required Skills Listed</h3>
                    <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {selectedJob.skills}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getScoreColor(score?: number) {
  if (!score || score === 0) return '#cbd5e1'; // slate-300
  if (score === -1) return '#ef4444'; // red-500
  if (score >= 70) return '#22c55e'; // green-500
  if (score >= 40) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

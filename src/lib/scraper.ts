import { chromium, Browser, Page } from 'playwright';
import { Job } from './types';
import { scanEmitter } from './events';
import path from 'path';

export class JobScraper {
  private baseUrl: string = 'https://www.onlinejobs.ph';
  private browser: Browser | null = null;

  async init() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async searchJobs(query: string): Promise<Job[]> {
    await this.init();
    const page: Page = await this.browser!.newPage();
    
    try {
      await page.goto(`${this.baseUrl}/jobseekers/jobsearch?jobkeyword=${encodeURIComponent(query)}`);
      await page.waitForSelector('.jobpost-cat-box', { timeout: 10000 });

      const jobs = await page.evaluate(() => {
        const jobNodes = document.querySelectorAll('.jobpost-cat-box');
        const results: { title: string; link: string }[] = [];
        
        jobNodes.forEach(node => {
          const titleNode = node.querySelector('h4');
          const linkNode = node.querySelector('a') as HTMLAnchorElement;
          if (titleNode && linkNode) {
            results.push({
              title: titleNode.innerText.trim(),
              link: linkNode.href
            });
          }
        });
        return results;
      });

      return jobs;
    } catch (error: any) {
      console.error('Error during search:', error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  async getJobDetails(url: string): Promise<Partial<Job> | null> {
    await this.init();
    const page: Page = await this.browser!.newPage();
    
    try {
      await page.goto(url);
      await page.waitForSelector('#job-description', { timeout: 15000 });

      const details = await page.evaluate(() => {
        const getText = (selector: string) => {
          const el = document.querySelector(selector);
          return el ? (el as HTMLElement).innerText.trim() : 'N/A';
        };

        const getInfoValue = (label: string) => {
          const headers = Array.from(document.querySelectorAll('h3.fs-12'));
          const header = headers.find(h => (h as HTMLElement).innerText.includes(label));
          if (header && header.nextElementSibling) {
            return (header.nextElementSibling as HTMLElement).innerText.trim();
          }
          return 'N/A';
        };

        const skills = Array.from(document.querySelectorAll('.card-worker-topskill'))
                            .map(s => (s as HTMLElement).innerText.trim());

        return {
          typeOfWork: getInfoValue('TYPE OF WORK'),
          salary: getInfoValue('WAGE / SALARY'),
          hoursPerWeek: getInfoValue('HOURS PER WEEK'),
          description: getText('#job-description'),
          skills: skills.join(', ')
        };
      });

      return details;
    } catch (error: any) {
      console.error(`Error scraping details for ${url}:`, error.message);
      throw error; // Rethrow to handle in the scanner routine
    } finally {
      await page.close();
    }
  }
}

export class ProfileScraper {
  private browser: Browser | null = null;

  async init() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scanPortfolio(url: string, maxDepth: number = 2): Promise<string> {
    await this.init();
    const visited = new Set<string>();
    const queue: { url: string; depth: number }[] = [{ url, depth: 0 }];
    const domain = new URL(url).hostname;
    let combinedText = '';

    while (queue.length > 0 && visited.size < 20) { // Limit to 20 pages for sanity
      const { url: currentUrl, depth } = queue.shift()!;
      
      if (visited.has(currentUrl) || depth > maxDepth) continue;
      visited.add(currentUrl);

      const page = await this.browser!.newPage();
      try {
        console.log(`[Crawler] Scraping: ${currentUrl} (Depth: ${depth})`);
        
        // Use a standard desktop viewport for better screenshots
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Capture screenshot for live feed
        const screenshotPath = path.join(process.cwd(), 'public', 'scans', 'snapshot.png');
        await page.screenshot({ path: screenshotPath });
        
        // Emit progress with screenshot URL
        scanEmitter.emit('scanProgress', { 
          url: currentUrl, 
          screenshot: `/scans/snapshot.png?t=${Date.now()}` // Cache busting
        });

        // Extract plain text
        const text = await page.innerText('body');
        combinedText += `\n--- SOURCE: ${currentUrl} ---\n${text}\n`;

        // Find more links if not at max depth
        if (depth < maxDepth) {
          const links = await page.evaluate((parentDomain) => {
            return Array.from(document.querySelectorAll('a'))
              .map(a => a.href)
              .filter(href => {
                try {
                  const u = new URL(href);
                  return u.hostname === parentDomain && !href.includes('#') && !href.endsWith('.pdf');
                } catch {
                  return false;
                }
              });
          }, domain);

          links.forEach(l => {
            if (!visited.has(l)) {
              queue.push({ url: l, depth: depth + 1 });
            }
          });
        }
      } catch (err: any) {
        console.error(`Failed to scrape ${currentUrl}: ${err.message}`);
      } finally {
        await page.close();
      }
    }

    return combinedText;
  }
}

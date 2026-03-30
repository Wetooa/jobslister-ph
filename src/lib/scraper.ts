import { chromium, Browser, Page } from 'playwright';
import { Job } from './types';

export class JobScraper {
  private baseUrl: string = 'https://www.onlinejobs.ph';

  async searchJobs(query: string): Promise<Job[]> {
    const browser: Browser = await chromium.launch({ headless: true });
    const page: Page = await browser.newPage();
    
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
      await browser.close();
    }
  }

  async getJobDetails(url: string): Promise<Partial<Job> | null> {
    const browser: Browser = await chromium.launch({ headless: true });
    const page: Page = await browser.newPage();
    
    try {
      await page.goto(url);
      await page.waitForSelector('#job-description', { timeout: 10000 });

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
      return null;
    } finally {
      await browser.close();
    }
  }
}

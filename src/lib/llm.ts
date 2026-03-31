import axios from 'axios';
import { Profile, Analysis } from './types';

export class LLMClient {
  private model: string;
  private endpoint: string;

  constructor(model: string = 'qwen3.5:cloud', endpoint: string = 'http://localhost:11434/api/generate') {
    this.model = model;
    this.endpoint = endpoint;
  }

  async generate(prompt: string, systemMessage: string = ''): Promise<string> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.post(this.endpoint, {
          model: this.model,
          prompt: prompt,
          system: systemMessage,
          stream: false,
          format: "json"
        }, {
          timeout: 600000 // 10 minutes for heavy local inference
        });
        return response.data.response;
      } catch (error: any) {
        if (error.response && error.response.status === 429) {
          attempts++;
          const waitTime = attempts * 5000;
          console.log(`Rate limited (429). Retrying in ${waitTime / 1000}s... (Attempt ${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          let errorMsg = error.message;
          if (error.response) {
            // Detailed error from status + data
            const status = error.response.status;
            const data = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
            errorMsg = `Status ${status}: ${data}`;
          } else if (error.code === 'ECONNABORTED') {
            errorMsg = 'Inference timed out (10min limit)';
          }
          console.error('Error generating response from LLM:', errorMsg);
          throw new Error(errorMsg);
        }
      }
    }
    throw new Error("Max retry attempts reached for LLM generation.");
  }

  async analyzeResume(resumeText: string): Promise<Profile | { error: string; raw: string }> {
    const systemMessage = `You are a high-level technical career strategist. 
Your goal is to extract a comprehensive professional profile from a resume. 
Identify not just keywords, but context: 
- Categorize skills (Languages, Frameworks, Cloud, Tools, Databases).
- Extract projects with descriptive names, technologies used, and key achievements/impact.
- Summarize experience highlighting unique value propositions.
- Identify social or portfolio links if present.

Output strictly in JSON following this schema:
{
  "skills": { [category: string]: string[] },
  "projects": [{ "name": string, "description": string, "technologies": string[], "art": string, "achievements": string[] }],
  "experience_highlights": string[],
  "portfolios": string[],
  "socialLinks": { "github": string, "linkedin": string, "twitter": string },
  "profile_summary": string
}`;
    const prompt = `Analyze the following resume text:
${resumeText}

Extracted JSON:`;

    const response = await this.generate(prompt, systemMessage);
    try {
      const parsed = JSON.parse(response);
      return parsed as Profile;
    } catch (e: any) {
      console.warn("Parsing failure in analyzeResume. Raw response:", response);
      return { error: `Failed to parse JSON: ${e.message}`, raw: response };
    }
  }

  async compareJob(profile: Profile, jobContext: string): Promise<Analysis | { error: string; raw: string }> {
    const systemMessage = `You are a recruitment specialist. You will compare a user's profile with a job description and determine if it's a good fit. 
Output MUST be a JSON object with the following schema:
{
  "matchScore": number (0-100),
  "pros": string[],
  "cons": string[],
  "recommendation": "Apply" | "Skip",
  "reasoning": string
}`;
    const prompt = `User Profile:
${JSON.stringify(profile, null, 2)}

Job Description:
${jobContext}

Compare them and provide:
1. Match Score (0-100)
2. Pros
3. Cons
4. Recommendation (Apply/Skip)
5. Reasoning (Concise)

Output strictly in JSON.`;

    const response = await this.generate(prompt, systemMessage);
    try {
      const parsed = JSON.parse(response);
      
      // Simple normalization for common schema variations
      const normalized: any = { ...parsed };
      if (parsed.match_score !== undefined && parsed.matchScore === undefined) {
        normalized.matchScore = parsed.match_score;
      }
      if (parsed.reason !== undefined && parsed.reasoning === undefined) {
        normalized.reasoning = parsed.reason;
      }

      return normalized as Analysis;
    } catch (e: any) {
      console.warn("Parsing failure in compareJob. Raw response:", response);
      return { error: `Failed to parse JSON: ${e.message}`, raw: response };
    }
  }

  async enhanceProfileWithScrapedData(currentProfile: Profile, scrapedContent: string): Promise<Profile | { error: string; raw: string }> {
    const systemMessage = `You are an expert profile consolidator. 
You will be given an existing Profile (from a CV) and a large block of text scraped from the user's personal website/portfolio.
Your task is to MERGE and ENHANCE the profile:
1. Add new projects found on the website that were not in the CV.
2. Enrich existing projects with more detailed achievements or technologies from the web content.
3. Update the skills list with any new technologies found.
4. Refine the profile summary to include a more comprehensive view of the user's work.

Existing Profile:
${JSON.stringify(currentProfile, null, 2)}

Scraped Portfolio Content:
${scrapedContent}

Output the updated Profile object in the same JSON format.`;

    const prompt = "Updated Profile JSON:";
    const response = await this.generate(prompt, systemMessage);
    try {
      return JSON.parse(response) as Profile;
    } catch (e: any) {
      console.warn("Parsing failure in enhanceProfileWithScrapedData. Raw response:", response);
      return { error: `Failed to parse JSON: ${e.message}`, raw: response };
    }
  }
}

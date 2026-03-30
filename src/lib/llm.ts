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
          stream: false
        });
        return response.data.response;
      } catch (error: any) {
        if (error.response && error.response.status === 429) {
          attempts++;
          const waitTime = attempts * 5000; // 5s, 10s...
          console.log(`Rate limited (429). Retrying in ${waitTime/1000}s... (Attempt ${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.error('Error generating response from LLM:', error.message);
          throw error;
        }
      }
    }
    throw new Error("Max retry attempts reached for LLM generation.");
  }

  async analyzeResume(resumeText: string): Promise<Profile | { error: string; raw: string }> {
    const systemMessage = "You are a specialized career agent. Your goal is to analyze a resume and extract key skills, projects, and a professional summary. Output the result in JSON format.";
    const prompt = `Analyze the following resume and extract:
1. Skills (categorized)
2. Significant Projects
3. Experience Highlights
4. Overall Profile Summary (who is this person?)

Resume Text:
${resumeText}

Output strictly in JSON.`;
    
    const response = await this.generate(prompt, systemMessage);
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Failed to parse JSON", raw: response };
    } catch (e: any) {
      console.warn("Raw response from LLM:", response);
      return { error: e.message, raw: response };
    }
  }

  async compareJob(profile: Profile, jobContext: string): Promise<Analysis | { error: string; raw: string }> {
    const systemMessage = "You are a recruitment specialist. You will compare a user's profile with a job description and determine if it's a good fit. Provide a match score (0-100) and a brief reasoning.";
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
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Failed to parse JSON", raw: response };
    } catch (e: any) {
      return { error: e.message, raw: response };
    }
  }
}

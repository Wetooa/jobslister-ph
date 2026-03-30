import fs from 'fs';
const pdf = require('pdf-parse');

export async function parseResume(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error: any) {
    console.error('Error parsing PDF:', error.message);
    throw error;
  }
}

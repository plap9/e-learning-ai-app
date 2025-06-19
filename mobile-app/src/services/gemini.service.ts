import { GeminiApiRequest, GeminiApiResponse } from '../types/common.types';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Note: In production, API key should be stored securely and accessed from backend
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export class GeminiService {
  private static instance: GeminiService;

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  async generateInspirationalSentence(): Promise<string> {
    try {
      const prompt = "Generate a short, simple, and encouraging English sentence for someone learning the language. The sentence should be easy to understand for a beginner.";
      
      const requestBody: GeminiApiRequest = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      };

      const response = await fetch(`${GEMINI_API_BASE_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      const result: GeminiApiResponse = await response.json();

      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        return result.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error('Invalid response format from Gemini API');
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      
      // Fallback messages if API fails
      const fallbackMessages = [
        "Learning English opens doors to new opportunities!",
        "Every word you learn brings you closer to fluency.",
        "Practice makes progress. Keep going!",
        "Your English journey is unique and valuable.",
        "Believe in yourself and your ability to learn.",
        "Small steps lead to big achievements.",
        "Mistakes are proof that you're trying.",
        "You're doing great! Keep practicing!"
      ];
      
      const randomIndex = Math.floor(Math.random() * fallbackMessages.length);
      return fallbackMessages[randomIndex];
    }
  }

  async generateCustomPrompt(prompt: string): Promise<string> {
    try {
      const requestBody: GeminiApiRequest = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      };

      const response = await fetch(`${GEMINI_API_BASE_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      const result: GeminiApiResponse = await response.json();

      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        return result.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error('Invalid response format from Gemini API');
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  // Validate API key
  isApiKeyConfigured(): boolean {
    return GEMINI_API_KEY.length > 0;
  }

  // Test API connection
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.generateCustomPrompt('Hello');
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const geminiService = GeminiService.getInstance(); 
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import fetch from 'node-fetch';

const pipelineAsync = promisify(pipeline);

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured');
  }
  return openaiClient;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration?: number;
}

export class AudioTranscriptionService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Download audio file from Telegram
   */
  async downloadAudio(fileUrl: string, fileName: string): Promise<string> {
    const filePath = path.join(this.tempDir, fileName);
    
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }
      
      const fileStream = fs.createWriteStream(filePath);
      await pipelineAsync(response.body!, fileStream);
      
      return filePath;
    } catch (error) {
      console.error('Error downloading audio:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   * Supports Russian and Kazakh languages
   */
  async transcribeAudio(filePath: string): Promise<TranscriptionResult> {
    try {
      const client = getOpenAIClient();
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('Audio file not found');
      }

      // Get file stats for duration estimation
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      // OpenAI Whisper API has a 25MB limit
      if (fileSizeInMB > 25) {
        throw new Error('Audio file too large (max 25MB)');
      }

      const audioFile = fs.createReadStream(filePath);

      // Transcribe with language detection
      // Whisper can automatically detect Russian and Kazakh
      const transcription = await client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'ru', // Set to Russian as base, but Whisper can detect Kazakh too
        response_format: 'verbose_json', // Get detailed response with language info
      });

      // Clean up temporary file
      this.cleanupFile(filePath);

      return {
        text: transcription.text,
        language: transcription.language || 'ru',
        duration: transcription.duration,
      };
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      // Clean up file even on error
      this.cleanupFile(filePath);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Process audio message end-to-end
   */
  async processAudioMessage(fileUrl: string, originalFileName?: string): Promise<TranscriptionResult> {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const extension = originalFileName ? path.extname(originalFileName) : '.ogg';
    const fileName = `audio_${timestamp}${extension}`;

    try {
      // Download audio file
      const filePath = await this.downloadAudio(fileUrl, fileName);
      
      // Transcribe audio
      const result = await this.transcribeAudio(filePath);
      
      console.log(`Audio transcribed successfully: ${result.text.substring(0, 100)}...`);
      
      return result;
    } catch (error) {
      console.error('Error processing audio message:', error);
      throw error;
    }
  }

  /**
   * Clean up temporary file
   */
  private cleanupFile(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn('Failed to cleanup temp file:', filePath, error);
    }
  }

  /**
   * Detect if text is in Kazakh language (basic detection)
   */
  detectKazakhLanguage(text: string): boolean {
    // Common Kazakh letters that don't exist in Russian
    const kazakhLetters = /[әіңғүұқөһ]/i;
    const kazakhWords = /\b(мен|сен|ол|біз|сіз|олар|қалай|қайда|не|кім|неше|қашан)\b/i;
    
    return kazakhLetters.test(text) || kazakhWords.test(text);
  }

  /**
   * Get appropriate language code for AI response
   */
  getLanguageForAI(transcription: TranscriptionResult): 'ru' | 'kk' {
    // Check if detected as Kazakh by Whisper
    if (transcription.language === 'kk') {
      return 'kk';
    }
    
    // Additional check for Kazakh content
    if (this.detectKazakhLanguage(transcription.text)) {
      return 'kk';
    }
    
    // Default to Russian
    return 'ru';
  }
}

export const audioTranscriptionService = new AudioTranscriptionService();
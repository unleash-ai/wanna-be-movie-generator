const OpenAI = require('openai');
require('dotenv').config();

class TTSService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate speech from text using OpenAI TTS
   * @param {string} text - The text to convert to speech
   * @param {string} voiceDescription - Description of tone, accent, and other audio elements
   * @returns {Promise<Object>} - Audio generation result
   */
  async generateSpeech(text, voiceDescription) {
    try {
      console.log(`🔊 Generating TTS for: "${text.substring(0, 50)}..."`);
      console.log(`🎭 Voice description: ${voiceDescription}`);

      // Determine voice based on description
      const voice = this.selectVoice(voiceDescription);
      
      const response = await this.openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: voice,
        input: text,
        response_format: "mp3",
        speed: 1.0
      });

      // Convert the response to a buffer
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Generate a unique filename
      const filename = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
      
      // Save the audio file
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../uploads/audio');
      
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);

      console.log(`✅ TTS generated successfully: ${filename}`);
      
      return {
        success: true,
        filename: filename,
        filePath: filePath,
        size: buffer.length,
        duration: this.estimateDuration(text),
        voice: voice,
        voiceDescription: voiceDescription
      };

    } catch (error) {
      console.error('❌ TTS generation error:', error);
      throw new Error(`TTS generation failed: ${error.message}`);
    }
  }

  /**
   * Select appropriate voice based on description
   * @param {string} description - Voice description
   * @returns {string} - OpenAI voice identifier
   */
  selectVoice(description) {
    const desc = description.toLowerCase();
    
    if (desc.includes('male') || desc.includes('man') || desc.includes('guy')) {
      return 'alloy';
    } else if (desc.includes('female') || desc.includes('woman') || desc.includes('girl')) {
      return 'nova';
    } else if (desc.includes('child') || desc.includes('kid') || desc.includes('young')) {
      return 'echo';
    } else if (desc.includes('narrator') || desc.includes('story') || desc.includes('deep')) {
      return 'onyx';
    } else {
      // Default to a neutral voice
      return 'alloy';
    }
  }

  /**
   * Estimate audio duration based on text length
   * @param {string} text - The text content
   * @returns {number} - Estimated duration in seconds
   */
  estimateDuration(text) {
    // Rough estimate: 150 words per minute
    const words = text.split(' ').length;
    return Math.max(1, Math.round((words / 150) * 60));
  }

  /**
   * Get available voices
   * @returns {Array} - List of available voices
   */
  getAvailableVoices() {
    return [
      { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice' },
      { id: 'echo', name: 'Echo', description: 'Warm, friendly voice' },
      { id: 'fable', name: 'Fable', description: 'Storytelling voice' },
      { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative voice' },
      { id: 'nova', name: 'Nova', description: 'Clear, expressive voice' },
      { id: 'shimmer', name: 'Shimmer', description: 'Bright, energetic voice' }
    ];
  }
}

module.exports = new TTSService();

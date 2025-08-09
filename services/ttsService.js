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

  /**
   * Generate music for a scene using MusicGPT API
   * @param {string} prompt - Music description prompt
   * @param {string} musicStyle - Style of music (e.g., "cinematic", "dramatic", "upbeat")
   * @param {number} sceneIndex - Index of the scene for organization
   * @returns {Promise<Object>} - Music generation result
   */
  async generateMusic(prompt, musicStyle, sceneIndex) {
    try {
      console.log(`🎵 Generating music for scene ${sceneIndex}: "${prompt.substring(0, 50)}..."`);
      console.log(`🎼 Music style: ${musicStyle}`);

      const url = 'https://api.musicgpt.com/api/public/v1/MusicAI';
      const options = {
        method: 'POST',
        headers: {
          'Authorization': process.env.MUSIC_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          music_style: musicStyle,
          lyrics: "",
          make_instrumental: true,
          vocal_only: false,
          voice_id: "",
          webhook_url: ""
        })
      };

      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`MusicGPT API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Music generation response for scene ${sceneIndex}:`, data);

      // Check if we have a conversion_id to retrieve the music
      if (data.conversion_id || data.conversion_id_2) {
        const conversionId = data.conversion_id || data.conversion_id_2;
        console.log(`🔄 Retrieving music file for conversion ID: ${conversionId}`);
        
        // Wait a bit for processing, then retrieve the music
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const musicFile = await this.retrieveMusic(conversionId, sceneIndex);
        
        return {
          success: true,
          filename: musicFile.filename,
          filePath: musicFile.filePath,
          responseData: data,
          musicFile: musicFile,
          sceneIndex: sceneIndex,
          prompt: prompt,
          musicStyle: musicStyle,
          message: 'Music generation and retrieval completed'
        };
      } else {
        console.warn(`⚠️ No conversion ID found in response for scene ${sceneIndex}`);
        return {
          success: false,
          responseData: data,
          sceneIndex: sceneIndex,
          prompt: prompt,
          musicStyle: musicStyle,
          message: 'Music generation completed but no conversion ID found'
        };
      }

    } catch (error) {
      console.error(`❌ Music generation error for scene ${sceneIndex}:`, error);
      throw new Error(`Music generation failed for scene ${sceneIndex}: ${error.message}`);
    }
  }

  /**
   * Retrieve generated music file using conversion ID
   * @param {string} conversionId - The conversion ID from the generation response
   * @param {number} sceneIndex - Index of the scene for organization
   * @returns {Promise<Object>} - Retrieved music file result
   */
  async retrieveMusic(conversionId, sceneIndex) {
    try {
      console.log(`🎵 Retrieving music for scene ${sceneIndex} with conversion ID: ${conversionId}`);
      
      const url = `https://api.musicgpt.com/api/public/v1/byId?conversion_id=${conversionId}`;
      const options = {
        method: 'GET',
        headers: {
          'Authorization': process.env.MUSIC_KEY
        }
      };

      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Attempt ${attempts}/${maxAttempts} to retrieve music for scene ${sceneIndex}`);
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`MusicGPT retrieval API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`📡 Retrieval response for scene ${sceneIndex}:`, data);

        if (data.success && data.conversion && data.conversion.status === 'COMPLETED') {
          console.log(`✅ Music ready for scene ${sceneIndex}!`);
          
          // Download the music file
          const audioUrl = data.conversion.audio_url;
          if (audioUrl) {
            return await this.downloadMusicFile(audioUrl, sceneIndex, data);
          } else {
            throw new Error('No audio URL found in completed conversion');
          }
        } else if (data.success && data.conversion && data.conversion.status === 'PROCESSING') {
          console.log(`⏳ Music still processing for scene ${sceneIndex}, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        } else {
          console.log(`⚠️ Unexpected status for scene ${sceneIndex}:`, data.conversion?.status);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        }
      }
      
      throw new Error(`Failed to retrieve music after ${maxAttempts} attempts for scene ${sceneIndex}`);

    } catch (error) {
      console.error(`❌ Music retrieval error for scene ${sceneIndex}:`, error);
      throw new Error(`Music retrieval failed for scene ${sceneIndex}: ${error.message}`);
    }
  }

  /**
   * Download music file from URL and save locally
   * @param {string} audioUrl - URL to download the music file from
   * @param {number} sceneIndex - Index of the scene for organization
   * @param {Object} metadata - Metadata about the music
   * @returns {Promise<Object>} - Downloaded file result
   */
  async downloadMusicFile(audioUrl, sceneIndex, metadata) {
    try {
      console.log(`📥 Downloading music file for scene ${sceneIndex} from: ${audioUrl}`);
      
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to download music file: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Generate a unique filename for the music
      const filename = `music_scene_${sceneIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
      
      // Save the music file
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../uploads/music');
      
      // Ensure uploads directory exists
      const filePath = path.join(uploadsDir, filename);
      
      // Save the audio file
      fs.writeFileSync(filePath, buffer);
      
      // Save metadata
      const metadataPath = filePath.replace('.mp3', '_metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      console.log(`✅ Music file downloaded and saved for scene ${sceneIndex}: ${filename}`);
      
      return {
        success: true,
        filename: filename,
        filePath: filePath,
        size: buffer.length,
        duration: metadata.conversion?.duration || 4, // Default 4 seconds
        metadata: metadata,
        audioUrl: audioUrl
      };

    } catch (error) {
      console.error(`❌ Music download error for scene ${sceneIndex}:`, error);
      throw new Error(`Music download failed for scene ${sceneIndex}: ${error.message}`);
    }
  }
}

module.exports = new TTSService();

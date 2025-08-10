require('dotenv').config();

class VideoService {
  constructor() {
    if (!process.env.LEONARDO_API_KEY) {
      throw new Error('LEONARDO_API_KEY environment variable is required');
    }
    
    this.apiKey = process.env.LEONARDO_API_KEY;
    this.baseUrl = 'https://cloud.leonardo.ai/api/rest/v1';
    
    console.log(`🔑 Leonardo AI initialized`);
    console.log(`🔑 API Key (first 10 chars): ${this.apiKey.substring(0, 10)}...`);
  }

  /**
   * Generate video for a scene using Leonardo AI
   * @param {string} sceneDescription - Description of the scene to generate video for
   * @param {number} sceneIndex - Index of the scene for organization
   * @param {string} sceneTitle - Title of the scene
   * @returns {Promise<Object>} - Video generation result
   */
  async generateVideo(sceneDescription, sceneIndex, sceneTitle) {
    try {
      console.log(`🎬 Starting video generation for scene ${sceneIndex}: "${sceneTitle}"`);
      console.log(`📝 Scene description: "${sceneDescription.substring(0, 100)}..."`);

      // Create a cinematic prompt for the scene
      const prompt = this.createCinematicPrompt(sceneDescription, sceneTitle);
      console.log(`🎭 Generated prompt: "${prompt}"`);

      // Start video generation with Leonardo AI Motion 2
      console.log(`🎬 Calling Leonardo AI API with model: Motion 2`);
      const generationId = await this.createVideoGeneration(prompt);
      console.log(`🔄 Video generation started for scene ${sceneIndex}, generation ID: ${generationId}`);

      // Poll the generation status until the video is ready
      let attempts = 0;
      const maxAttempts = 60; // 30 minutes max (60 × 30 seconds)
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`⏳ Waiting for video generation to complete for scene ${sceneIndex}... (attempt ${attempts}/${maxAttempts})`);
        
        const status = await this.checkGenerationStatus(generationId);
        
        if (status.status === 'COMPLETE') {
          console.log(`✅ Video generation completed for scene ${sceneIndex}!`);
          break;
        } else if (status.status === 'FAILED') {
          throw new Error(`Video generation failed for scene ${sceneIndex}: ${status.error || 'Unknown error'}`);
        }
        
        // Wait 30 seconds before next check
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }

      if (attempts >= maxAttempts) {
        throw new Error(`Video generation timed out after ${maxAttempts} attempts for scene ${sceneIndex}`);
      }

      // Download the generated video
      const videoFile = await this.downloadVideo(generationId, sceneIndex, sceneTitle);
      
      return {
        success: true,
        sceneIndex: sceneIndex,
        sceneTitle: sceneTitle,
        prompt: prompt,
        generationId: generationId,
        videoFile: videoFile,
        message: 'Video generation completed successfully'
      };

    } catch (error) {
      console.error(`❌ Video generation error for scene ${sceneIndex}:`, error);
      throw new Error(`Video generation failed for scene ${sceneIndex}: ${error.message}`);
    }
  }

  /**
   * Create a video generation request with Leonardo AI
   * @param {string} prompt - The prompt for video generation
   * @returns {Promise<string>} - Generation ID
   */
  async createVideoGeneration(prompt) {
    try {
      const response = await fetch(`${this.baseUrl}/generations-text-to-video`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${this.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          height: 480,
          width: 832,
          prompt: prompt,
          resolution: "RESOLUTION_480",
          frameInterpolation: true,
          isPublic: false,
          promptEnhance: true,
          "elements": [
            {
             "akUUID": "ece8c6a9-3deb-430e-8c93-4d5061b6adbf",
             "weight":1
            }
      ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Leonardo AI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`📤 Leonardo AI generation created:`, JSON.stringify(data, null, 2));
      
      if (!data.sdGenerationJob || !data.sdGenerationJob.generationId) {
        throw new Error('No generation ID received from Leonardo AI');
      }

      return data.sdGenerationJob.generationId;
    } catch (error) {
      console.error('❌ Error creating video generation:', error);
      throw error;
    }
  }

  /**
   * Check the status of a video generation
   * @param {string} generationId - The generation ID to check
   * @returns {Promise<Object>} - Generation status
   */
  async checkGenerationStatus(generationId) {
    try {
      const response = await fetch(`${this.baseUrl}/generations/${generationId}`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Leonardo AI status check error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`📡 Generation status for ${generationId}:`, JSON.stringify(data, null, 2));
      
      return {
        status: data.generations?.[0]?.status || 'UNKNOWN',
        error: data.generations?.[0]?.error || null,
        videoUrl: data.generations?.[0]?.videoUrl || null
      };
    } catch (error) {
      console.error('❌ Error checking generation status:', error);
      throw error;
    }
  }

  /**
   * Create a cinematic prompt for video generation
   * @param {string} sceneDescription - Original scene description
   * @param {string} sceneTitle - Title of the scene
   * @returns {string} - Enhanced cinematic prompt
   */
  createCinematicPrompt(sceneDescription, sceneTitle) {
    // Enhance the scene description to be more cinematic
    let prompt = sceneDescription;
    
    // Add cinematic elements if not already present
    if (!prompt.toLowerCase().includes('cinematic') && !prompt.toLowerCase().includes('camera')) {
      prompt = `Cinematic shot: ${prompt}. Professional lighting, high quality, smooth camera movement.`;
    }
    
    // Add scene context
    prompt = `${prompt} Scene: ${sceneTitle}.`;
    
    // Ensure it's descriptive enough for video generation
    if (prompt.length < 100) {
      prompt = `${prompt} Rich visual details, atmospheric lighting, professional cinematography.`;
    }
    
    return prompt;
  }

  /**
   * Download the generated video file
   * @param {string} generationId - The generation ID
   * @param {number} sceneIndex - Index of the scene
   * @param {string} sceneTitle - Title of the scene
   * @returns {Promise<Object>} - Downloaded video file info
   */
  async downloadVideo(generationId, sceneIndex, sceneTitle) {
    try {
      console.log(`📥 Downloading video for scene ${sceneIndex}...`);
      
      // Get the final status to get the video URL
      const status = await this.checkGenerationStatus(generationId);
      
      if (!status.videoUrl) {
        throw new Error('No video URL found in generation status');
      }

      // Download the video file
      const videoResponse = await fetch(status.videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      
      // Generate a unique filename
      const filename = `video_scene_${sceneIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
      
      // Save the video file
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../uploads/videos');
      
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, Buffer.from(videoBuffer));

      console.log(`✅ Video downloaded successfully: ${filename}`);
      
      return {
        success: true,
        filename: filename,
        filePath: filePath,
        size: videoBuffer.byteLength,
        videoUrl: status.videoUrl,
        generationId: generationId
      };

    } catch (error) {
      console.error(`❌ Video download error for scene ${sceneIndex}:`, error);
      throw new Error(`Video download failed for scene ${sceneIndex}: ${error.message}`);
    }
  }

  /**
   * Get available Leonardo AI models
   * @returns {Promise<Array>} - Available models
   */
  async getAvailableModels() {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('❌ Error getting available models:', error);
      return [];
    }
  }
}

module.exports = VideoService;

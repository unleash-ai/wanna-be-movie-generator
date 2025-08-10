const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

class VideoService {
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }

  /**
   * Generate video for a scene using Google Veo AI
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

      // Start video generation
      let operation = await this.ai.models.generateVideos({
        model: "veo-3.0-generate-preview",
        prompt: prompt,
      });

      console.log(`🔄 Video generation started for scene ${sceneIndex}, operation ID: ${operation.name}`);

      // Poll the operation status until the video is ready
      let attempts = 0;
      const maxAttempts = 60; // 10 minutes max (60 × 10 seconds)
      
      while (!operation.done && attempts < maxAttempts) {
        attempts++;
        console.log(`⏳ Waiting for video generation to complete for scene ${sceneIndex}... (attempt ${attempts}/${maxAttempts})`);
        
        await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds
        
        try {
          operation = await this.ai.operations.getVideosOperation({
            operation: operation,
          });
        } catch (error) {
          console.error(`❌ Error checking operation status for scene ${sceneIndex}:`, error);
          // Continue polling even if there's an error
        }
      }

      if (!operation.done) {
        throw new Error(`Video generation timed out after ${maxAttempts} attempts for scene ${sceneIndex}`);
      }

      console.log(`✅ Video generation completed for scene ${sceneIndex}!`);

      // Download the generated video
      const videoFile = await this.downloadVideo(operation, sceneIndex, sceneTitle);
      
      return {
        success: true,
        sceneIndex: sceneIndex,
        sceneTitle: sceneTitle,
        prompt: prompt,
        operationId: operation.name,
        videoFile: videoFile,
        message: 'Video generation completed successfully'
      };

    } catch (error) {
      console.error(`❌ Video generation error for scene ${sceneIndex}:`, error);
      throw new Error(`Video generation failed for scene ${sceneIndex}: ${error.message}`);
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
   * @param {Object} operation - Completed operation object
   * @param {number} sceneIndex - Index of the scene
   * @param {string} sceneTitle - Title of the scene
   * @returns {Promise<Object>} - Downloaded video file info
   */
  async downloadVideo(operation, sceneIndex, sceneTitle) {
    try {
      console.log(`📥 Downloading video for scene ${sceneIndex}...`);
      
      if (!operation.response || !operation.response.generatedVideos || !operation.response.generatedVideos[0]) {
        throw new Error('No generated videos found in operation response');
      }

      const video = operation.response.generatedVideos[0].video;
      console.log(`🎥 Video details:`, video);

      // Generate a unique filename
      const filename = `video_scene_${sceneIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
      
      // Ensure uploads directory exists
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../uploads/videos');
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, filename);
      
      // Download the video file
      await this.ai.files.download({
        file: video,
        downloadPath: filePath,
      });

      console.log(`✅ Video downloaded for scene ${sceneIndex}: ${filename}`);
      
      // Save metadata
      const metadataPath = filePath.replace('.mp4', '_metadata.json');
      const metadata = {
        sceneIndex: sceneIndex,
        sceneTitle: sceneTitle,
        filename: filename,
        filePath: filePath,
        videoDetails: video,
        operationId: operation.name,
        downloadTime: new Date().toISOString()
      };
      
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      return {
        success: true,
        filename: filename,
        filePath: filePath,
        metadataPath: metadataPath,
        videoDetails: video,
        size: fs.statSync(filePath).size
      };

    } catch (error) {
      console.error(`❌ Video download error for scene ${sceneIndex}:`, error);
      throw new Error(`Video download failed for scene ${sceneIndex}: ${error.message}`);
    }
  }

  /**
   * Get available video models
   * @returns {Promise<Array>} - List of available models
   */
  async getAvailableModels() {
    try {
      const models = await this.ai.models.list();
      return models.filter(model => model.name.includes('veo'));
    } catch (error) {
      console.error('❌ Error getting available models:', error);
      return [];
    }
  }
}

module.exports = new VideoService();

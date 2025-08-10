require('dotenv').config();

class VeoService {
  constructor() {
    this.ai = null;
  }

  getClient() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required for Veo');
    }
    if (!this.ai) {
      const { GoogleGenAI } = require('@google/genai');
      this.ai = new GoogleGenAI({ apiKey });
      console.log('🔑 Gemini API client initialized for Veo');
    }
    return this.ai;
  }

  /**
   * Generate video for a scene using Veo 3 via Gemini API
   * @param {string} sceneDescription
   * @param {number} sceneIndex
   * @param {string} sceneTitle
   * @param {Array} dialogues
   */
  async generateVideo(sceneDescription, sceneIndex, sceneTitle, dialogues = [], continuity = {}) {
    try {
      console.log(`🎬 [VEO] Generating video for scene ${sceneIndex}: "${sceneTitle}"`);

      const prompt = this.createCinematicPrompt(sceneDescription, sceneTitle, dialogues, continuity);
      console.log(`🎭 [VEO] Prompt: "${prompt}"`);

      const ai = this.getClient();

      // If a reference image is provided, use image-to-video to improve identity cohesion
      const model = process.env.VEO_MODEL || 'veo-3.0-fast-generate-preview';
      let operation;
      const attemptGenerate = async () => {
        if (continuity && continuity.referenceImage) {
          const fs = require('fs');
          const { extname } = require('path');
          const imagePath = continuity.referenceImage;
          const mime = extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
          const imageBase64 = fs.readFileSync(imagePath).toString('base64');
          return ai.models.generateVideos({
            model,
            prompt,
            image: { imageBytes: imageBase64, mimeType: mime }
          });
        }
        return ai.models.generateVideos({ model, prompt });
      };

      // simple retry/backoff for 429s
      let retries = 3;
      while (true) {
        try {
          operation = await attemptGenerate();
          break;
        } catch (err) {
          const msg = String(err?.message || '');
          if (retries > 0 && (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED'))) {
            const backoffMs = (4 - retries) * 20000; // 20s, 40s, 60s
            console.warn(`⚠️ [VEO] 429/RESOURCE_EXHAUSTED. Backing off ${backoffMs}ms and retrying...`);
            await new Promise(r => setTimeout(r, backoffMs));
            retries -= 1;
            continue;
          }
          throw err;
        }
      }

      const finalOp = await this.pollOperation(operation);

      const videoFile = await this.downloadVideo(finalOp, sceneIndex, sceneTitle);

      return {
        success: true,
        sceneIndex,
        sceneTitle,
        prompt,
        operation: finalOp,
        videoFile,
        message: 'Veo video generation completed successfully',
      };
    } catch (error) {
      console.error(`❌ [VEO] Video generation error for scene ${sceneIndex}:`, error);
      throw new Error(`Veo video generation failed for scene ${sceneIndex}: ${error.message}`);
    }
  }

  async pollOperation(operation) {
    const ai = this.getClient();
    let attempts = 0;
    const maxAttempts = 60; // up to ~10 minutes
    while (!operation.done) {
      attempts += 1;
      console.log(`⏳ [VEO] Waiting for video... (attempt ${attempts}/${maxAttempts})`);
      if (attempts > maxAttempts) {
        throw new Error('Veo video generation timed out');
      }
      await new Promise((r) => setTimeout(r, 10000));
      operation = await ai.operations.getVideosOperation({ operation });
    }
    console.log('✅ [VEO] Operation complete');
    return operation;
  }

  createCinematicPrompt(sceneDescription, sceneTitle, dialogues = [], continuity = {}) {
    let prompt = sceneDescription || '';

    if (!prompt.toLowerCase().includes('cinematic') && !prompt.toLowerCase().includes('camera')) {
      prompt = `Cinematic shot: ${prompt}. Professional lighting, high quality, smooth camera movement.`;
    }

    // Persistent character continuity
    if (continuity && continuity.characterProfile) {
      prompt = `${prompt} Maintain character continuity: ${continuity.characterProfile}.`;
    }
    prompt = `${prompt} Scene: ${sceneTitle}.`;

    if (Array.isArray(dialogues) && dialogues.length > 0) {
      const beats = dialogues
        .map((d, i) => {
          const who = (d && d.name) ? d.name : 'character';
          const tone = (d && d.description) ? d.description : 'neutral tone';
          return `beat ${i + 1}: ${who} speaks with ${tone}`;
        })
        .join('; ');
      prompt = `${prompt} Narrative beats: ${beats}.`;
    }

    if (prompt.length < 100) {
      prompt = `${prompt} Rich visual details, atmospheric lighting, professional cinematography.`;
    }

    return prompt;
  }

  async downloadVideo(operation, sceneIndex, sceneTitle) {
    const fileRef = operation.response?.generatedVideos?.[0]?.video;
    if (!fileRef) {
      throw new Error('No Veo video reference found in operation response');
    }

    const path = require('path');
    const fs = require('fs');
    const uploadsDir = path.join(__dirname, '../uploads/videos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filename = `video_scene_${sceneIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
    const filePath = path.join(uploadsDir, filename);

    // Prefer SDK-managed download (handles auth and redirects)
    try {
      const ai = this.getClient();
      await ai.files.download({ file: fileRef, downloadPath: filePath });
    } catch (e) {
      console.warn('⚠️ [VEO] SDK download failed, attempting manual download...', e?.message);
      const fetch = global.fetch || (await import('node-fetch')).default;
      if (fileRef.uri) {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        const res = await fetch(fileRef.uri, { headers: { 'x-goog-api-key': apiKey } });
        if (!res.ok) {
          throw new Error(`Failed to download Veo video: ${res.status} ${res.statusText}`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filePath, buffer);
      } else if (fileRef.videoBytes || fileRef.bytes) {
        const buffer = Buffer.from(fileRef.videoBytes || fileRef.bytes);
        fs.writeFileSync(filePath, buffer);
      } else {
        throw new Error('Unable to obtain Veo video bytes or URI');
      }
    }

    console.log(`✅ [VEO] Video saved: ${filename}`);
    return {
      success: true,
      filename,
      filePath,
    };
  }
}

module.exports = new VeoService();



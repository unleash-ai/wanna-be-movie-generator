require('dotenv').config();
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('langchain/schema');

class MovieController {
  constructor() {
    this.chatModel = null; // Initialize lazily
    
    // Bind methods to preserve 'this' context
    this.renderHomePage = this.renderHomePage.bind(this);
    this.generateMovie = this.generateMovie.bind(this);
    this.healthCheck = this.healthCheck.bind(this);
    this.testVeo = this.testVeo.bind(this);
  }

  // Lazy initialization of the chat model
  getChatModel() {
    if (!this.chatModel) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set in environment variables');
      }
      
      this.chatModel = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-5-mini',
        reasoning: {
            effort: "minimal"
          },
          text: {
            verbosity: "high"
          }
      });
      
      console.log('🤖 LangChain ChatOpenAI initialized with API key:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
    }
    return this.chatModel;
  }

  // Test endpoint: generate a single Veo 3 video and return result JSON
  async testVeo(req, res) {
    try {
      const promptFromBody = (req.body && req.body.prompt) ? String(req.body.prompt) : '';
      const promptFromQuery = (req.query && req.query.prompt) ? String(req.query.prompt) : '';
      const sceneDescription = (promptFromBody || promptFromQuery || 'a close-up shot of a golden retriever playing in a field of sunflowers').slice(0, 2000);

      const veoService = require('../services/veoService');
      const result = await veoService.generateVideo(sceneDescription, 0, 'Veo Test Scene', []);

      const vf = result.videoFile || {};
      return res.json({
        success: true,
        message: 'Veo 3 video created successfully',
        scene: {
          index: 0,
          title: 'Veo Test Scene',
        },
        prompt: result.prompt,
        file: {
          filename: vf.filename,
          path: vf.filePath,
        }
      });
    } catch (error) {
      console.error('❌ Veo test error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // Render the main movie generator page
  async renderHomePage(req, res) {
    try {
      res.render('index', { 
        title: 'Movie Generator',
        appName: 'Wanna Be'
      });
    } catch (error) {
      console.error('Error rendering home page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  // Generate movie story using LangChain
  async generateMovie(req, res) {
    const startTime = Date.now();
    
    try {
      const { message, referenceImagePath } = req.body || {};
      
      if (!message || !message.trim()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Please provide a movie description' 
        });
      }

      console.log('🎬 Movie Generation Request:');
      console.log('User Prompt:', message);
      console.log('Photo uploaded:', req.file ? 'Yes' : 'No');
      console.log('---');

      // Prepare messages for LangChain
      const systemMessage = new SystemMessage(`You are a creative movie script writer. Create engaging, personalized short movie stories based on user descriptions.

Guidelines:
- Create a complete short story that lasts about 30 seconds in total.
- Structure into 4 scenes of ~8 seconds each to align with fixed-length video generation.
- Make it cinematic and engaging; include clear camera language and visual details.
- The user is the protagonist always.
- Ensure character, face, clothing, and identity continuity across scenes.
- Include a satisfying conclusion (three-act arc mapped across the 4 scenes).
- Make it suitable for all audiences unless specifically requested otherwise.

The user ${req.file ? 'has uploaded a photo of themselves and ' : ''}wants you to create a movie story.`);

      const humanMessage = new HumanMessage(`Create a movie story based on this description: "${message}"

Please write a complete, engaging short movie story using the three acts structure.

Use a JSON format for the output:
{
    "title": "Title of the movie",
    "description": "Description of the movie",
    "music": "description as a prompt to generate music",
            
    "scenes": [
        {
            "title": "Title of the scene",
            "index": "Index of the scene",
            "description": "Description of the scene as a prompt to generate video",
            "dialogues": [
                {
                    "name": "Name of the character",
                    "description": "Description of the gender, tone, accent and other elements of the audio, as a prompt to generate audio from text",
                    "dialogue": "Dialogue of the character"
                }
            ],
            "fx": "description to generate the fx",
        }
    ]
}`);

      console.log('🤖 Calling LangChain with GPT-5-mini...');

      // Generate story using LangChain
      const chatModel = this.getChatModel();
      const response = await chatModel.call([systemMessage, humanMessage]);
      let generatedStory;
      try {
        generatedStory = JSON.parse(response.content);
      } catch (e) {
        // Attempt to extract JSON block heuristically
        const text = String(response.content || '');
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
          generatedStory = JSON.parse(text.slice(start, end + 1));
        } else {
          throw e;
        }
      }
      const generationTime = Date.now() - startTime;

      // Extract all dialogues from scenes for text-to-speech
      const allDialogues = [];
      generatedStory.scenes.forEach((scene, sceneIndex) => {
        scene.dialogues.forEach((dialogue, dialogueIndex) => {
          allDialogues.push({
            sceneIndex,
            dialogueIndex,
            name: dialogue.name,
            description: dialogue.description,
            dialogue: dialogue.dialogue
          });
        });
      });

      console.log(`🎭 Found ${allDialogues.length} dialogues to process`);

      // Generate video with all components
      let videoResult = null;
      try {
        const refFile = referenceImagePath
          ? { path: referenceImagePath, filename: referenceImagePath.split('/').pop() }
          : req.file;
        videoResult = await this.generate_video(generatedStory, allDialogues, refFile);
        console.log('✅ Video generation completed:', videoResult);
      } catch (videoError) {
        console.error('❌ Video generation failed:', videoError);
        // Continue with story generation even if video fails
      }



      console.log('✅ Story Generated Successfully!');
      console.log('Generation Time:', `${generationTime}ms`);
      console.log('---');
      console.log('Generated Story:');
      console.log(generatedStory);

      // Return successful response
      res.json({
        success: true,
        story: JSON.stringify(generatedStory),
        generationTime: generationTime,
        finalMovie: videoResult && videoResult.finalMovie ? videoResult.finalMovie : null
      });

    } catch (error) {
      console.error('❌ Movie Generation Error:', error);
      
      const generationTime = Date.now() - startTime;
      console.log('Error occurred after:', `${generationTime}ms`);

      // Handle specific LangChain/OpenAI errors
      if (error.message?.includes('insufficient_quota')) {
        res.status(429).json({ 
          success: false, 
          error: 'OpenAI API quota exceeded. Please try again later.' 
        });
      } else if (error.message?.includes('rate_limit_exceeded')) {
        res.status(429).json({ 
          success: false, 
          error: 'Too many requests. Please wait a moment and try again.' 
        });
      } else if (error.message?.includes('invalid_api_key')) {
        res.status(401).json({ 
          success: false, 
          error: 'Invalid API key. Please check your OpenAI API key configuration.' 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: 'Failed to generate movie story. Please try again.' 
        });
      }
    }
  }

  // Generate video with all components
  async generate_video(story, dialogues, uploadedFile) {
    try {
      console.log('🎬 Starting video generation process...');
      
      // Import the TTS service
      const ttsService = require('../services/ttsService');
      
      // Generate audio for all dialogues AND music for all scenes in parallel
      console.log('🔊 Generating text-to-speech for dialogues...');
      console.log('🎵 Generating music for scenes...');
      
      // Create arrays for parallel processing
      const dialoguePromises = dialogues.map(async (dialogue) => {
        try {
          const audioResult = await ttsService.generateSpeech(
            dialogue.dialogue,
            dialogue.description
          );
          return {
            ...dialogue,
            audio: audioResult
          };
        } catch (error) {
          console.error(`❌ Failed to generate audio for dialogue ${dialogue.sceneIndex}-${dialogue.dialogueIndex}:`, error);
          return {
            ...dialogue,
            audio: null,
            error: error.message
          };
        }
      });

      console.log(`🎬 Total scenes to process: ${story.scenes.length}`);
      story.scenes.forEach((scene, idx) => {
        console.log(`  Scene ${idx}: "${scene.title}" - Music: "${scene.music}"`);
      });

      // Generate music for the entire movie first
      console.log('🎵 Generating music for the entire movie...');
      console.log(`🔍 Story object keys:`, Object.keys(story));
      console.log(`🔍 Story.music value:`, story.music);
      console.log(`🔍 Story.music type:`, typeof story.music);
      
      let musicResult = null;
      try {
        // Validate that story.music exists
        if (!story.music || typeof story.music !== 'string') {
          throw new Error(`Invalid story.music: ${story.music} (type: ${typeof story.music})`);
        }
        
        // Determine music style based on movie description and music prompt
        const musicStyle = this.determineMusicStyle(story.description, story.music);
        console.log(`🎼 Movie music style: ${musicStyle}`);
        
        // Generate music first
        musicResult = await ttsService.generateMusic(
          story.music,
          musicStyle,
          'movie' // Use 'movie' instead of sceneIndex
        );
        
        console.log(`✅ Music generation completed for the movie`);
      } catch (error) {
        console.error(`❌ Failed to generate music for the movie:`, error);
        musicResult = {
          success: false,
          error: error.message
        };
      }

      // Generate videos for all scenes in parallel
      console.log('🎬 Generating videos for scenes (Veo 3)...');
      const veoService = require('../services/veoService');
      const continuity = this.buildCharacterContinuity(story, uploadedFile);

      // Sequential Veo to reduce 429 rate limits
      const videoResults = [];
      for (let sceneIndex = 0; sceneIndex < story.scenes.length; sceneIndex++) {
        const scene = story.scenes[sceneIndex];
        try {
          console.log(`🎬 Starting video generation for scene ${sceneIndex}: "${scene.title}"`);
          const videoResult = await veoService.generateVideo(
            scene.description,
            sceneIndex,
            scene.title,
            Array.isArray(scene.dialogues) ? scene.dialogues : [],
            continuity
          );
          console.log(`✅ Video generation completed for scene ${sceneIndex}`);
          videoResults.push({ sceneIndex, sceneTitle: scene.title, video: videoResult });
        } catch (error) {
          console.error(`❌ Failed to generate video for scene ${sceneIndex}:`, error);
          videoResults.push({ sceneIndex, sceneTitle: scene.title, video: null, error: error.message });
        }
      }

      // Wait for all dialogues (already started) while videos ran sequentially
      const audioResults = await Promise.all(dialoguePromises);

      console.log(`✅ Generated audio for ${audioResults.filter(r => r.audio).length}/${audioResults.length} dialogues`);
      console.log(`✅ Generated music for the movie: ${musicResult.success ? 'Success' : 'Failed'}`);
      console.log(`✅ Generated videos for ${videoResults.filter(r => r.video).length}/${videoResults.length} scenes (Veo 3)`);

      // Assemble final ~30s movie with music
      const editingService = require('../services/editingService');
      const assembled = await editingService.assembleMovie(
        videoResults,
        musicResult,
        30,
        audioResults
      );
      console.log('🎞️ Final movie assembled at:', assembled.filePath);
      
      // TODO: Add effects generation
      
      return {
        success: true,
        audioResults,
        musicResult,
        videoResults,
        finalMovie: assembled,
        message: 'Video generation pipeline completed'
      };
      
    } catch (error) {
      console.error('❌ Video generation error:', error);
      throw error;
    }
  }

  buildCharacterContinuity(story, uploadedFile) {
    const base = {
      characterProfile: `Maintain the same main character appearance, face, clothing style, hair, and color palette across scenes. Keep consistent proportions and identity even when the camera, lighting, and backgrounds change. Avoid adding text overlays or subtitles.`
    };
    if (uploadedFile && uploadedFile.filename) {
      base.referenceImage = uploadedFile.path || `uploads/${uploadedFile.filename}`;
      base.characterProfile += ` Use the uploaded photo as a visual reference for identity continuity.`;
    }
    return base;
  }

  /**
   * Determine music style based on scene description and music prompt
   * @param {string} sceneDescription - Description of the scene
   * @param {string} musicPrompt - Music description prompt
   * @returns {string} - Music style identifier
   */
  determineMusicStyle(sceneDescription, musicPrompt) {
    const combinedText = `${sceneDescription} ${musicPrompt}`.toLowerCase();
    
    // Determine style based on content
    if (combinedText.includes('action') || combinedText.includes('chase') || combinedText.includes('battle')) {
      return 'action';
    } else if (combinedText.includes('romantic') || combinedText.includes('love') || combinedText.includes('tender')) {
      return 'romantic';
    } else if (combinedText.includes('sad') || combinedText.includes('melancholy') || combinedText.includes('emotional')) {
      return 'emotional';
    } else if (combinedText.includes('mystery') || combinedText.includes('suspense') || combinedText.includes('thriller')) {
      return 'mystery';
    } else if (combinedText.includes('comedy') || combinedText.includes('funny') || combinedText.includes('light')) {
      return 'comedy';
    } else if (combinedText.includes('epic') || combinedText.includes('grand') || combinedText.includes('heroic')) {
      return 'epic';
    } else if (combinedText.includes('calm') || combinedText.includes('peaceful') || combinedText.includes('ambient')) {
      return 'ambient';
    } else {
      return 'cinematic'; // Default cinematic style
    }
  }

  // Health check endpoint
  async healthCheck(req, res) {
    try {
      res.json({
        status: 'healthy',
        service: 'Movie Generator API',
        timestamp: new Date().toISOString(),
        openaiApiKey: !!process.env.OPENAI_API_KEY,
        langchainEnabled: !!this.chatModel
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }
}

module.exports = new MovieController();

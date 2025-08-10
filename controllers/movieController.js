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
      const { message } = req.body;
      
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
- Create a complete short story that last about 12 seconds. 
- Include vivid descriptions and dialogue, separated by scenes of 4 seconds (so about 3 scenes). 
- Make it cinematic and engaging
- The user is the protagonist always
- Include character development and a satisfying conclusion (three acts)
- Make it suitable for all audiences unless specifically requested otherwise

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
      const generatedStory = JSON.parse(response.content);
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
      try {
        const videoResult = await this.generate_video(generatedStory, allDialogues);
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
  async generate_video(story, dialogues) {
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

      // Prepare music generation promise (but don't await it yet)
      console.log('🎵 Preparing music generation for the entire movie...');
      console.log(`🔍 Story object keys:`, Object.keys(story));
      console.log(`🔍 Story.music value:`, story.music);
      console.log(`🔍 Story.music type:`, typeof story.music);
      
      let musicPromise = null;
      try {
        // Validate that story.music exists
        if (!story.music || typeof story.music !== 'string') {
          throw new Error(`Invalid story.music: ${story.music} (type: ${typeof story.music})`);
        }
        
        // Determine music style based on movie description and music prompt
        const musicStyle = this.determineMusicStyle(story.description, story.music);
        console.log(`🎼 Movie music style: ${musicStyle}`);
        
        // Create the promise but don't await it yet
        musicPromise = ttsService.generateMusic(
          story.music,
          musicStyle,
          'movie' // Use 'movie' instead of sceneIndex
        );
        
        console.log(`🎵 Music generation promise created for the movie`);
      } catch (error) {
        console.error(`❌ Failed to create music generation promise:`, error);
        musicPromise = Promise.resolve({
          success: false,
          error: error.message
        });
      }

      // Generate videos for all scenes in parallel
      console.log('🎬 Generating videos for scenes...');
      
      const videoPromises = story.scenes.map(async (scene, sceneIndex) => {
        try {
          console.log(`🎬 Starting video generation for scene ${sceneIndex}: "${scene.title}"`);
          
          const videoService = require('../services/videoService');
          const videoResult = await videoService.generateVideo(
            scene.description,
            sceneIndex,
            scene.title
          );
          
          console.log(`✅ Video generation completed for scene ${sceneIndex}`);
          
          return {
            sceneIndex,
            sceneTitle: scene.title,
            video: videoResult
          };
        } catch (error) {
          console.error(`❌ Failed to generate video for scene ${sceneIndex}:`, error);
          return {
            sceneIndex,
            sceneTitle: scene.title,
            video: null,
            error: error.message
          };
        }
      });

      // Execute audio, music, and video generation in parallel
      const [audioResults, musicResult, videoResults] = await Promise.all([
        Promise.all(dialoguePromises),
        musicPromise,
        Promise.all(videoPromises)
      ]);

      console.log(`✅ Generated audio for ${audioResults.filter(r => r.audio).length}/${audioResults.length} dialogues`);
      console.log(`✅ Generated music for the movie: ${musicResult.success ? 'Success' : 'Failed'}`);
      console.log(`✅ Generated videos for ${videoResults.filter(r => r.video).length}/${videoResults.length} scenes`);
      
      // TODO: Add effects generation
      
      return {
        success: true,
        audioResults,
        musicResult,
        videoResults,
        message: 'Video generation pipeline completed'
      };
      
    } catch (error) {
      console.error('❌ Video generation error:', error);
      throw error;
    }
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

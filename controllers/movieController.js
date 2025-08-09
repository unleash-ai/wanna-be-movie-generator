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
- Create a complete short story that last about 20 seconds. 
- Include vivid descriptions and dialogue, separated by scenes. 
- Make it cinematic and engaging
- If the user mentions being in the movie, make them the protagonist
- Include character development and a satisfying conclusion
- Use proper formatting with paragraphs
- Make it suitable for all audiences unless specifically requested otherwise

The user ${req.file ? 'has uploaded a photo of themselves and ' : ''}wants you to create a movie story.`);

      const humanMessage = new HumanMessage(`Create a movie story based on this description: "${message}"

${req.file ? 'The user has uploaded a photo of themselves to be included as the main character.' : ''}

Please write a complete, engaging short movie story.

use a JSON format for the output:
{
    "title": "Title of the movie",
    "description": "Description of the movie",
    "scenes": [
        {
            "title": "Title of the scene",
            "index": "Index of the scene",
            "description": "Description of the scene to generate a video (prompt)",
            "dialogues": [
                {
                    "name": "Name of the character",
                    "dialogue": "Dialogue of the character"
                }
            ],
            "music": "description to generate the music",
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

      console.log('✅ Story Generated Successfully!');
      console.log('Generation Time:', `${generationTime}ms`);
      console.log('Story Length:', `${generatedStory.split(' ').length} words`);
      console.log('---');
      console.log('📖 Generated Story:');
      console.log(generatedStory);
      console.log('='.repeat(80));

      // Return successful response
      res.json({
        success: true,
        story: generatedStory,
        generationTime: generationTime,
        wordCount: generatedStory.split(' ').length
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

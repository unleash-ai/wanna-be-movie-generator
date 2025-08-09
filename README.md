# Wanna Be - AI Movie Generator

A ChatGPT-like interface for generating personalized movie stories using LangChain and OpenAI GPT-4. Upload your photo and describe your movie idea to get a custom short story!

## ✨ Features

- 🤖 **AI Story Generation**: Powered by LangChain + OpenAI GPT-5-mini for creative, engaging stories
- 📸 **Photo Integration**: Upload your photo to become the protagonist
- 💬 **ChatGPT-like Interface**: Familiar, intuitive chat-based interaction
- 🎬 **Structured Movie Output**: JSON-formatted stories with scenes, dialogues, music, and effects
- 🎥 **20-Second Stories**: Optimized for short video generation
- 📱 **Responsive Design**: Beautiful, modern UI inspired by ChatGPT
- 🚀 **Real-time Generation**: Live story creation with progress indicators
- 🏗️ **Clean Architecture**: Separated controllers, routes, and views
- 🎨 **External CSS**: Modular styling with separate CSS files
- 📝 **Console Logging**: Detailed generation logs for development
- 🔄 **No Database**: Simplified architecture without database dependencies

## Prerequisites

Before running this application, make sure you have the following:

- [Node.js](https://nodejs.org/) (version 16 or higher)
- [OpenAI API Key](https://platform.openai.com/api-keys) (for GPT-4 access)
- [npm](https://www.npmjs.com/) (comes with Node.js)

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd /media/r2/714c3552-6a28-492e-9513-c4ddab283488/Nosocomial
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```bash
   touch .env
   ```
   
   Add the following configuration to your `.env` file:
   ```
   PORT=3000
   NODE_ENV=development
   OPENAI_API_KEY=your_openai_api_key_here
   ```
   
   **Important:** Replace `your_openai_api_key_here` with your actual OpenAI API key from https://platform.openai.com/api-keys

## Running the Application

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will be available at: http://localhost:3000

## Project Structure

```
Nosocomial/
├── app.js              # Main application file
├── package.json        # Dependencies and scripts
├── README.md          # This file
├── controllers/       # Application controllers
│   └── movieController.js # Movie generation logic
├── routes/            # Express routes
│   └── movieRoutes.js # Movie-related routes
├── views/             # Pug templates
│   ├── layout.pug     # Base layout template
│   ├── index.pug      # Home page template
│   ├── gallery.pug    # Gallery page template
│   └── error.pug      # Error page template
├── public/            # Static assets
│   ├── css/
│   │   └── styles.css # Main stylesheet
│   └── js/            # Client-side JavaScript
└── uploads/           # User uploaded photos
```

## 🎯 Core Functionality

### 🏠 Movie Generator (`/`)
- ChatGPT-like interface with dark theme
- Text input for movie descriptions
- Photo upload for personalization
- Real-time story generation with AI
- Conversation-style interaction

### 📁 Gallery (`/gallery`)
- View previously generated movie stories
- Search and filter functionality
- Story details and metadata
- Export and sharing options

## 🚀 API Endpoints

### Movie Generation

#### POST /api/generate-movie
- **Description:** Generate a structured movie story using LangChain + GPT-5-mini
- **Content-Type:** multipart/form-data
- **Body:** 
  - `message` (string): Movie description/prompt
  - `photo` (file, optional): User photo for personalization
- **Response:** 
  ```json
  {
    "success": true,
    "story": {
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
          "fx": "description to generate the fx"
        }
      ]
    },
    "generationTime": 2500,
    "wordCount": 450
  }
  ```

#### GET /api/health
- **Description:** Health check endpoint
- **Response:** Service status and configuration info

## 🏗️ Architecture

### Controllers
- **movieController.js**: Handles movie generation logic using LangChain
  - `renderHomePage()`: Renders the main interface
  - `generateMovie()`: Processes user input and calls GPT-4
  - `healthCheck()`: API health status

### Routes
- **movieRoutes.js**: Express routes with middleware
  - File upload handling with Multer
  - Route definitions and error handling
  - Photo upload validation

### Views
- **layout.pug**: Base template with header and navigation
- **index.pug**: ChatGPT-like interface with chat functionality
- **gallery.pug**: Gallery page template
- **error.pug**: Error page template

### Public Assets
- **styles.css**: Complete stylesheet with ChatGPT-like styling
- Responsive design with dark theme
- Smooth animations and transitions

## Features Included

### Express.js Features
- Route handling
- Middleware setup
- Static file serving
- JSON parsing
- URL encoding

### Pug Template Features
- Template inheritance (layout.pug)
- Variable interpolation
- Form handling
- Responsive CSS styling

### Mongoose Features
- Schema definition with validation
- Pre-save middleware
- Instance methods
- Static methods
- Data transformation

## Development Tips

1. **Adding new routes:** Add them in `app.js`
2. **Creating new models:** Add them in the `models/` directory
3. **Adding new templates:** Add them in the `views/` directory
4. **Static assets:** Place them in the `public/` directory

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `sudo systemctl status mongod`
- Check the connection string in your `.env` file
- Verify MongoDB is accessible on the specified port

### Port Already in Use
- Change the PORT in your `.env` file
- Or kill the process using the port: `sudo lsof -t -i:3000 | xargs kill`

### Module Not Found Errors
- Run `npm install` to ensure all dependencies are installed
- Check that you're in the correct directory

## Next Steps

This is a basic setup. You can extend it by adding:

- User authentication and sessions
- More complex data models
- File upload functionality
- API documentation with Swagger
- Testing with Jest or Mocha
- Deployment configuration
- Logging with Winston
- Rate limiting and security middleware

## License

MIT License - feel free to use this project as a starting point for your applications!

# AI Movie Generator

A sophisticated AI-powered movie generation application that creates short stories, generates music, creates videos, and produces audio dialogues using cutting-edge AI services.

## 🚀 Features

- 🎥 **12-Second Stories**: Optimized for short video generation (3 scenes)
- 🎵 **AI Music Generation**: Background music for each movie using MusicGPT API
- 🎬 **AI Video Generation**: Scene videos using Leonardo AI Motion 2 (cost-effective)
- 🔊 **Text-to-Speech**: AI-generated dialogue audio using OpenAI TTS
- 📱 **Responsive Design**: Beautiful, modern UI inspired by ChatGPT

## 🏗️ Architecture

- **Backend**: Node.js + Express.js
- **Templating**: Pug/Jade
- **AI Services**: 
  - OpenAI GPT-4o-mini for story generation
  - OpenAI TTS for audio generation
  - MusicGPT for background music
  - Leonardo AI Motion 2 for video generation
- **File Storage**: Local file system with organized uploads

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- API keys for the following services:
  - `OPENAI_API_KEY`: Your OpenAI API key from https://platform.openai.com/api-keys
  - `MUSIC_KEY`: Your MusicGPT API key for music generation
  - `LEONARDO_API_KEY`: Your Leonardo AI API key for video generation

## 🚀 Running the Application

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd nosocomial-express-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   MUSIC_KEY=your_musicgpt_api_key_here
   LEONARDO_API_KEY=your_leonardo_api_key_here
   ```

4. **Start the application**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3001`

## 🎬 How It Works

1. **Story Generation**: User describes a movie concept, and GPT-4o-mini generates a 12-second story with 3 scenes
2. **Music Creation**: MusicGPT generates background music for the entire movie
3. **Video Generation**: Leonardo AI Motion 2 creates videos for each scene (480p, cost-effective)
4. **Audio Generation**: OpenAI TTS converts dialogue text to speech
5. **Parallel Processing**: Music, audio, and video generation run efficiently in parallel

## 📁 Project Structure

```
├── app.js                 # Main Express application
├── controllers/           # Business logic controllers
│   └── movieController.js # Movie generation logic
├── routes/               # API route definitions
│   └── movieRoutes.js    # Movie-related routes
├── services/             # External service integrations
│   ├── ttsService.js     # Text-to-speech and music services
│   └── videoService.js   # Leonardo AI video generation
├── views/                # Pug templates
│   ├── layout.pug        # Base layout template
│   └── index.pug         # Main landing page
├── public/               # Static assets
│   └── css/             # Stylesheets
└── uploads/              # Generated media files
    ├── audio/            # TTS audio files
    ├── music/            # Generated music files
    └── videos/           # Generated video files
```

## 🔧 Configuration

### Leonardo AI Motion 2 Settings
- **Resolution**: 480p (832x480)
- **Frame Interpolation**: Enabled for smooth motion
- **Prompt Enhancement**: Automatic prompt improvement
- **Model**: Motion 2 (cost-effective alternative to VEO3)

### Music Generation
- **API**: MusicGPT
- **Scope**: One music track per movie (not per scene)
- **Polling**: 30-second intervals for completion

### Video Generation
- **API**: Leonardo AI
- **Format**: MP4
- **Polling**: 30-second intervals for completion
- **Timeout**: 30 minutes maximum

## 🐛 Troubleshooting

### Common Issues
- **Port Already in Use**: Kill existing Node processes with `pkill -f "node"`
- **API Key Errors**: Ensure all environment variables are set correctly
- **File Upload Issues**: Check uploads directory permissions

### Debug Mode
Enable detailed logging by setting `DEBUG=true` in your environment variables.

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions, please open an issue on GitHub or contact the development team.

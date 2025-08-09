const express = require('express');
const path = require('path');
require('dotenv').config();

// Import routes
const movieRoutes = require('./routes/movieRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Set up Pug as the view engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/', movieRoutes);

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    appName: 'Wanna Be',
    error: {
      status: 404,
      message: 'The page you are looking for does not exist.'
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  
  res.status(err.status || 500).render('error', {
    title: 'Error',
    appName: 'Wanna Be',
    error: {
      status: err.status || 500,
      message: err.message || 'Internal Server Error'
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🎬 Wanna Be Movie Generator is running on http://localhost:${PORT}`);
  console.log('📝 Console logging enabled for all story generations');
  console.log('🤖 LangChain + GPT-5 integration ready');
  console.log('---');
});

module.exports = app;
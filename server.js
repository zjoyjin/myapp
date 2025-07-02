const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Debug: Check if environment variables are loaded
console.log('🔍 Environment Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('API Key length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
console.log('API Key starts with sk-:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.startsWith('sk-') : false);

// Middleware
app.use(cors({
  origin: ['https://myapp-gilt-nu.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static('public'));

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Persona configurations
const personas = {
  sheldon: {
    name: "Sheldon",
    systemPrompt: "You are Sheldon Cooper from The Big Bang Theory. You are highly intelligent, logical, obsessive about details, socially awkward, and often condescending without realizing it. You love physics, comic books, and trains. You speak in a precise, academic manner and often reference scientific concepts. Keep responses conversational but true to Sheldon's character."
  },
  missy: {
    name: "Missy",
    systemPrompt: "You are Missy Cooper, Sheldon's twin sister from The Big Bang Theory. You are down-to-earth, practical, sarcastic, and often make fun of Sheldon's quirks. You're street-smart rather than book-smart, and you have a no-nonsense attitude. You speak in a casual, straightforward manner and aren't impressed by intellectual showoffery."
  }
};

// Function to call OpenAI API
async function callOpenAI(messages, persona) {
  try {
    const response = await axios.post(OPENAI_API_URL, {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: personas[persona].systemPrompt },
        ...messages
      ],
      max_tokens: 150,
      temperature: 0.8
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI API Error:', error.response?.data || error.message);
    throw new Error('Failed to generate response');
  }
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sheldon & Missy Conversation Server',
    status: 'running',
    apiKeyConfigured: !!OPENAI_API_KEY,
    endpoints: {
      health: '/health',
      conversation: 'POST /start-conversation'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!OPENAI_API_KEY,
    port: PORT
  });
});

// Main conversation endpoint
app.post('/start-conversation', async (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log(`🚀 Starting conversation about: ${topic}`);
    
    // Initialize conversation
    const conversation = [];
    const messages = [
      { role: "user", content: `Let's have a conversation about: ${topic}. Please give your thoughts on this topic.` }
    ];

    // Generate 10 messages (5 from each persona)
    for (let turn = 0; turn < 10; turn++) {
      const currentPersona = turn % 2 === 0 ? 'sheldon' : 'missy';
      const personaName = personas[currentPersona].name;
      
      console.log(`Turn ${turn + 1}: ${personaName} is responding...`);
      
      // Get response from current persona
      const response = await callOpenAI(messages, currentPersona);
      
      // Add the response to our conversation log
      conversation.push({
        turn: turn + 1,
        speaker: personaName,
        message: response
      });
      
      // Add the response to the message history for context
      messages.push({ role: "assistant", content: `${personaName}: ${response}` });
      
      // Add a user message to prompt the next persona (except on the last turn)
      if (turn < 9) {
        const nextPersona = (turn + 1) % 2 === 0 ? 'Sheldon' : 'Missy';
        messages.push({ 
          role: "user", 
          content: `${nextPersona}, what's your response to that?` 
        });
      }
      
      // Small delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Conversation completed successfully');
    res.json({ 
      success: true, 
      topic: topic,
      conversation: conversation 
    });

  } catch (error) {
    console.error('❌ Error generating conversation:', error);
    res.status(500).json({ 
      error: 'Failed to generate conversation',
      details: error.message 
    });
  }
});

// Add this endpoint
app.get('/api/hello', (req, res) => {
  res.json({ 
    message: 'Hello from Sheldon & Missy backend!',
    status: 'connected'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎯 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Root endpoint: http://localhost:${PORT}/`);
  
  if (!OPENAI_API_KEY) {
    console.warn('⚠️  WARNING: OPENAI_API_KEY not found in environment variables');
    console.warn('Make sure your .env file exists and contains OPENAI_API_KEY=your_key_here');
  } else {
    console.log('✅ OpenAI API key loaded successfully');
  }
});

module.exports = app;
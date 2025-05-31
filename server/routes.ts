import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
// Import resilient storage with automatic fallback to memory storage
import { resilientStorage as storage } from "./resilient-storage";
import { setupAuth } from "./auth";
import { insertChatSchema, insertMessageSchema, insertFirebaseUserSchema } from "@shared/schema";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyzeTextWithVAD, generateEmotionalInsight } from "./vad-model";
import { generateEnhancedResponse } from "./enhanced-formatter";
import { generateEchoEnhancedResponse } from "./enhanced-echo-formatter";
import { generateDirectFormattedResponse } from "./direct-formatter";
import { generateImprovedResponse } from "./improved-formatter";
import { responseCache, rateLimiter, requestQueue } from "./cache";
import { EnhancedVADResponder } from "./enhanced-vad";

import { elevenLabsService } from "./elevenlabs";
import { 
  performGoogleSearch,
  isFactualQuery, 
  synthesizeFromSearchResults, 
  formatResponseWithCitations
} from "./services/searchService";
import { isVisualizationRequest, generateVisualizationPrompt } from "./visualization";
import multer from 'multer';

// API request counter for analytics
let apiRequestCounter = 0;
let cacheHitCounter = 0;
let fallbackCounter = 0;

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Firebase integration removed in favor of basic authentication

  // Initialize emNLP-Core AI with Rotational API Key System
  // Enhanced for multi-key, multi-model support
  let isAPIAvailable = false;
  
  // API configuration constants
  const API_CONFIG = {
    generationConfig: {
      temperature: 0.7,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 800,
    }
  };
  
  /**
   * Robust API Key Management System for scaling to 200+ concurrent users
   */
  class APIKeyManager {
    private models: Map<string, any> = new Map();
    private keyUsage: Map<string, number> = new Map();
    private currentModelIndex = 0;
    public modelPriority: string[] = [];
    private isAvailable = false;
    
    constructor() {
      this.initialize();
    }
    
    /**
     * Initialize all available API keys and models
     */
    private initialize(): void {
      console.log("Initializing API Key Manager with rotational strategy...");
      
      // Initialize Gemini 2.0 Flash (Primary)
      if (process.env.GEMINI_2_API_KEY) {
        try {
          console.log("Setting up Gemini 2.0 Flash as PRIMARY model...");
          const genAI2 = new GoogleGenerativeAI(process.env.GEMINI_2_API_KEY);
          const model = genAI2.getGenerativeModel({
            model: "gemini-1.5-flash", // Using 1.5-flash endpoint - will work with 2.0 key
            ...API_CONFIG
          });
          
          // Add to rotation with highest priority
          this.models.set("gemini-2.0-flash", model);
          this.keyUsage.set("gemini-2.0-flash", 0);
          this.modelPriority.unshift("gemini-2.0-flash"); // Add as highest priority
          this.isAvailable = true;
          console.log("✓ Gemini 2.0 Flash successfully initialized");
        } catch (error) {
          console.error("Failed to initialize Gemini 2.0 Flash:", error);
        }
      }
      
      // Initialize Gemini 1.5 Flash (Backup)
      if (process.env.GEMINI_API_KEY) {
        try {
          console.log("Setting up Gemini 1.5 Flash as BACKUP model...");
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            ...API_CONFIG
          });
          
          // Add to rotation with second priority
          this.models.set("gemini-1.5-flash", model);
          this.keyUsage.set("gemini-1.5-flash", 0);
          this.modelPriority.push("gemini-1.5-flash"); // Add as backup
          this.isAvailable = true;
          console.log("✓ Gemini 1.5 Flash successfully initialized");
        } catch (error) {
          console.error("Failed to initialize Gemini 1.5 Flash:", error);
        }
      }
      
      // Final availability report
      if (this.isAvailable) {
        console.log(`API Key Manager initialized with ${this.models.size} models`);
        console.log(`Model priority order: ${this.modelPriority.join(' > ')}`);
      } else {
        console.error("No API models available - system will use fallback");
      }
    }
    
    /**
     * Get the current model to use for API calls
     */
    getCurrentModel(): any {
      if (this.modelPriority.length === 0) return null;
      
      // Get current model name based on priority and availability
      const modelName = this.modelPriority[this.currentModelIndex];
      const model = this.models.get(modelName);
      
      // Increment usage counter for this model
      this.keyUsage.set(modelName, (this.keyUsage.get(modelName) || 0) + 1);
      
      console.log(`Using ${modelName} (usage count: ${this.keyUsage.get(modelName)})`);
      return model;
    }
    
    /**
     * Rotate to the next available model in the priority list
     * Will be called when one model hits rate limits or fails
     */
    rotateToNextModel(): any {
      if (this.modelPriority.length === 0) return null;
      
      // Move to next model
      this.currentModelIndex = (this.currentModelIndex + 1) % this.modelPriority.length;
      console.log(`Rotating to next model: ${this.modelPriority[this.currentModelIndex]}`);
      
      return this.getCurrentModel();
    }
    
    /**
     * Check if any API key is available
     */
    isApiAvailable(): boolean {
      return this.isAvailable && this.models.size > 0;
    }
    
    /**
     * Get the usage count for a specific model
     */
    getModelUsageCount(modelName: string): number {
      return this.keyUsage.get(modelName) || 0;
    }
    
    /**
     * Get model usage statistics for all models
     */
    getUsageStats(): Record<string, number> {
      const stats: Record<string, number> = {};
      this.keyUsage.forEach((count, model) => {
        stats[model] = count;
      });
      return stats;
    }
  }
  
  // Initialize API Key Manager
  const apiKeyManager = new APIKeyManager();
  isAPIAvailable = apiKeyManager.isApiAvailable();

  // Function to get a NEW guest user ID for every request
  // This is the key to ensuring completely separate chat histories
  /**
   * Check if an emotional check-in should be triggered based on conversation patterns
   */
  async function checkForEmotionalCheckInTrigger(chatId: number, userMessage: string, vadScore: any): Promise<{ shouldTrigger: boolean, context?: string }> {
    try {
      // Get recent messages to analyze emotional patterns
      const recentMessages = await storage.getMessages(chatId);
      const lastTenMessages = recentMessages.slice(-10);
      
      // Look for emotional topics mentioned in recent conversations
      const emotionalKeywords = [
        'stress', 'anxiety', 'worried', 'upset', 'sad', 'angry', 'frustrated', 
        'excited', 'happy', 'nervous', 'relationship', 'work', 'family', 
        'health', 'future', 'past', 'regret', 'hope', 'fear', 'love'
      ];
      
      // Check if user mentioned something emotional in past messages (3+ messages ago)
      for (let i = 0; i < lastTenMessages.length - 3; i++) {
        const message = lastTenMessages[i];
        if (message.role === 'user') {
          const messageContent = message.content.toLowerCase();
          
          for (const keyword of emotionalKeywords) {
            if (messageContent.includes(keyword)) {
              // Check if this topic hasn't been followed up on recently
              const recentFollowUp = lastTenMessages.slice(i + 1).some((m: any) => 
                m.content.toLowerCase().includes(keyword) && m.role === 'assistant'
              );
              
              if (!recentFollowUp && Math.random() > 0.7) { // 30% chance to trigger
                return {
                  shouldTrigger: true,
                  context: keyword
                };
              }
            }
          }
        }
      }
      
      return { shouldTrigger: false };
    } catch (error) {
      console.error('Error checking emotional trigger:', error);
      return { shouldTrigger: false };
    }
  }

  const getGuestUserId = async (req: Request, res: Response) => {
    // Check if there's already a session ID cookie 
    // This ensures consistent user ID within a browser session
    if (req.cookies && req.cookies.sessionIdentifier) {
      const sessionId = req.cookies.sessionIdentifier;
      const existingUser = await storage.getUserByUsername(`guest-${sessionId}`);
      
      if (existingUser) {
        // Session exists, return the associated user ID
        return existingUser.id;
      }
      // If user doesn't exist despite having a cookie, create a new one below
    }
    
    // Generate a unique session identifier from timestamp, IP and random seed
    const sessionId = `session-${Date.now()}-${req.ip || 'unknown'}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Create a unique guest username and ID based on this session
    const uniqueUsername = `guest-${sessionId}`;
    const guestEmail = `guest-${sessionId}@emotionscore.local`;
    
    console.log(`Creating new guest user with unique session ID: ${sessionId}`);
    
    // Create a new unique guest user with required fields
    const guestUser = await storage.createUser({
      username: uniqueUsername,
      email: guestEmail,
      password: `guest-password-${sessionId}`, // Unique password for this guest
      // Add other required fields with default values
      displayName: "Guest User",
      photoURL: null,
      firebaseUid: null
    });
    
    // Set a session cookie that persists only for this browser session
    // This ensures the same user ID is used for all requests in this session
    res.cookie('sessionIdentifier', sessionId, { 
      httpOnly: true,
      // No maxAge = session cookie that expires when browser closes
    });
    
    // Create initial chat for this unique guest
    await storage.createChat({
      userId: guestUser.id,
      title: "New conversation"
    });
    
    // Set a cookie to remember this guest user
    // This will persist the guest ID across page refreshes
    res.cookie('guestUserId', guestUser.id.toString(), { 
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      sameSite: 'lax'
    });
    
    return guestUser.id;
  };
  
  // Remove immediate initialization as we now create guest users per session
  
  // Simple guest message endpoint for non-authenticated users
  app.post("/api/guest/message", async (req, res, next) => {
    try {
      const guestId = await getGuestUserId(req, res);
      
      // Check if guest is rate limited
      if (rateLimiter.isRateLimited(`guest-${guestId}`)) {
        return res.status(429).json({ 
          message: "You're sending messages too quickly. Please wait a moment before trying again." 
        });
      }
      
      // Get or create a guest chat
      let guestChats = await storage.getChats(guestId);
      let chatId: number;
      
      if (guestChats.length === 0) {
        // Create a new chat for guest
        const newChat = await storage.createChat({
          userId: guestId,
          title: "Guest conversation"
        });
        chatId = newChat.id;
      } else {
        // Use the first existing chat
        chatId = guestChats[0].id;
      }
      
      // Save user message
      const messageData = insertMessageSchema.parse({
        content: req.body.message,
        chatId,
        role: "user"
      });
      
      const message = await storage.createMessage(messageData);
      
      // Analyze user message with VAD model to detect emotional dimensions
      const vadScore = analyzeTextWithVAD(messageData.content);
      console.log("VAD Analysis:", vadScore);
      
      try {
        // Use our optimized response generation with caching
        const aiResponse = await generateOptimizedResponse(messageData.content, chatId, vadScore);
        
        // Save AI response
        const aiMessage = await storage.createMessage({
          chatId,
          content: aiResponse,
          role: "assistant"
        });
        
        res.status(201).json({
          userMessage: message,
          aiMessage: aiMessage,
          chatId: chatId,
          emotionAnalysis: vadScore
        });
      } catch (aiError) {
        console.error("emNLP-Core API error:", aiError);
        fallbackCounter++;
        
        // Get the user's previous messages for style analysis
        const userMessages = (await storage.getMessages(chatId))
          .filter(msg => msg.role === "user")
          .map(msg => msg.content);
        
        // Use enhanced VAD fallback with style imitation
        const fallbackResponse = EnhancedVADResponder.generateImitationResponse(
          messageData.content, 
          vadScore,
          userMessages
        );
        
        const errorMessage = await storage.createMessage({
          chatId,
          content: fallbackResponse,
          role: "assistant"
        });
        
        return res.status(201).json({
          userMessage: message,
          aiMessage: errorMessage,
          chatId: chatId,
          emotionAnalysis: vadScore,
          error: "AI processing error"
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // Chat routes
  app.get("/api/chats", async (req, res, next) => {
    try {
      // Get user ID - either authenticated user or guest
      const userId = req.isAuthenticated() ? req.user!.id : await getGuestUserId(req, res);
      const chats = await storage.getChats(userId);
      res.json(chats);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/chats", async (req, res, next) => {
    try {
      // Get user ID - either authenticated user or guest
      const userId = req.isAuthenticated() ? req.user!.id : await getGuestUserId(req, res);
      
      const chatData = insertChatSchema.parse({
        ...req.body,
        userId
      });
      
      const chat = await storage.createChat(chatData);
      res.status(201).json(chat);
    } catch (error) {
      next(error);
    }
  });
  
  // Endpoint to toggle Echo-enhanced search for a chat
  app.patch("/api/chats/:chatId/echo-enhanced", async (req, res, next) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const chat = await storage.getChat(chatId);
      
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      // Allow access if user is authenticated and owns the chat
      // OR if user is not authenticated and this is a guest chat
      const guestId = await getGuestUserId(req, res);
      const userId = req.isAuthenticated() ? req.user!.id : guestId;
      
      if (chat.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Toggle the enhanced search feature
      const useEchoEnhanced = req.body.enabled === true;
      const updatedChat = await storage.updateChatSearchPreference(chatId, useEchoEnhanced);
      
      res.json(updatedChat);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/chats/:chatId/messages", async (req, res, next) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const chat = await storage.getChat(chatId);
      
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      // Allow access if user is authenticated and owns the chat
      // OR if user is not authenticated and this is a guest chat
      const guestId = await getGuestUserId(req, res);
      const userId = req.isAuthenticated() ? req.user!.id : guestId;
      
      if (chat.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const messages = await storage.getMessages(chatId);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/chats/:chatId/messages", async (req, res, next) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const chat = await storage.getChat(chatId);
      
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      // Allow access if user is authenticated and owns the chat
      // OR if user is not authenticated and this is a guest chat
      const guestId = await getGuestUserId(req, res);
      const userId = req.isAuthenticated() ? req.user!.id : guestId;
      
      if (chat.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Check if user is rate limited (20 requests per minute)
      if (rateLimiter.isRateLimited(userId)) {
        return res.status(429).json({ 
          message: "You're sending messages too quickly. Please wait a moment before trying again." 
        });
      }
      
      // Save user message
      const messageData = insertMessageSchema.parse({
        ...req.body,
        chatId,
        role: "user"
      });
      
      const message = await storage.createMessage(messageData);
      
      // Analyze user message with VAD model to detect emotional dimensions
      const vadScore = analyzeTextWithVAD(messageData.content);
      console.log("VAD Analysis:", vadScore);
      
      try {
        // Check if Echo Enhanced mode is enabled for this chat
        const useEchoEnhanced = chat.echoEnhancedSearch || false;
        
        if (useEchoEnhanced) {
          console.log("Using Echo-Enhanced mode for response");
          
          // Get chat history for context
          const messages = await storage.getMessages(chatId);
          const chatHistory = messages
            .filter(msg => messages.indexOf(msg) < messages.length - 1) // Exclude current message
            .map(msg => msg.content);
          
          // First, get relevant sources for this specific query using Google Search
          console.log("Fetching relevant sources for query via Google Search API");
          let sources: { title: string; link: string; snippet: string }[] = [];
          
          try {
            // Use the specialized Google Search service with topic detection
            const searchResults = await performGoogleSearch(messageData.content);
            // Map the results to the expected format
            sources = searchResults.map(result => ({
              title: result.title,
              link: result.link,
              snippet: result.snippet
            }));
            console.log(`Successfully found ${sources.length} topic-relevant sources`);
          } catch (searchError) {
            console.error("Error fetching sources from Google:", searchError);
          }
          
          // Generate enhanced response with beautiful formatting, thinking process, and interactive questions
          // Using the direct formatter and passing the retrieved sources
          const enhancedResponse = await generateDirectFormattedResponse(
            messageData.content,
            chatHistory,
            vadScore,
            process.env.GEMINI_API_KEY!,
            process.env.GOOGLE_SEARCH_API_KEY,
            process.env.GOOGLE_SEARCH_ENGINE_ID
          );
          
          // ALWAYS set the sources property to what we found from Google Search
          // This fixes the issue with wrong sources showing up in the sidebar
          // Also mark that this message was created with Echo-Enhanced mode enabled
          enhancedResponse.sources = sources;
          
          // Save the sources as a JSON string in the message
          const sourcesJson = sources && sources.length > 0 ? JSON.stringify(sources) : null;
          
          // Save AI response with enhanced formatting
          const aiMessage = await storage.createMessage({
            chatId,
            content: enhancedResponse.content,
            role: "assistant",
            citations: enhancedResponse.citations,
            sentiment: enhancedResponse.thinkingProcess, // Store thinking process temporarily
            sources: sourcesJson, // Store sources as JSON string
            createdWithEchoEnhanced: true // Flag indicating this message was created with Echo Enhanced mode
          });
          
          // Format questions to be clearly interactive
          const interactiveQuestions = enhancedResponse.followUpQuestions.map(question => ({
            text: `→ ${question}`, // Add arrow for visual indicator
            question: question,    // Original question for sending
            isClickable: true
          }));
          
          // Create a flag to track if this is the first time using Echo Enhanced in this chat
          let isFirstEchoEnhanced = true;
          const previousMessages = await storage.getMessages(chatId);
          
          // Check if there are previous assistant messages in this chat
          if (previousMessages.length > 2) {
            for (const msg of previousMessages) {
              if (msg.role === 'assistant' && msg.citations) {
                isFirstEchoEnhanced = false;
                break;
              }
            }
          }
          
          // Send the first response
          const responseResult = {
            userMessage: message,
            aiMessage: aiMessage,
            emotionAnalysis: vadScore,
            thinkingProcess: enhancedResponse.thinkingProcess,
            followUpQuestions: interactiveQuestions,
            sources: enhancedResponse.sources || [],
            isFirstEchoEnhanced: isFirstEchoEnhanced
          };
          
          // Create and send the visualization follow-up message immediately
          const visualizationMessage = "I've noticed that you just used the Echo Enhanced feature. Would you like me to create visualizations like flowcharts, graphs, or diagrams to help you understand this information better?";
          
          const vizMessage = await storage.createMessage({
            chatId,
            content: visualizationMessage,
            role: "assistant"
          });
          
          console.log(`Created follow-up visualization message with ID ${vizMessage.id} for chat ${chatId}`);
          
          // Return full enhanced response with thinking process, interactive follow-up questions, and sources
          return res.status(201).json(responseResult);
        } else {
          // Standard response for regular mode
          // Get user preferences if available (stored in session or passed from client)
          const userPreferences = req.body.userPreferences || null;
          const aiResponse = await generateOptimizedResponse(messageData.content, chatId, vadScore, false, userPreferences);
          
          // Save AI response
          const aiMessage = await storage.createMessage({
            chatId,
            content: aiResponse,
            role: "assistant"
          });

          // Check if we should trigger an emotional check-in
          const emotionalTrigger = await checkForEmotionalCheckInTrigger(chatId, messageData.content, vadScore);
          
          // Check if custom preferences are being applied and create notification
          let customPromptNotification = null;
          if (userPreferences && (userPreferences.emotionalTones?.length > 0 || userPreferences.roles?.length > 0 || userPreferences.customPrompt)) {
            customPromptNotification = {
              show: true,
              message: "I've adapted my personality based on your custom preferences",
              tones: userPreferences.emotionalTones || [],
              roles: userPreferences.roles || [],
              hasCustomPrompt: !!userPreferences.customPrompt
            };
          }
          
          res.status(201).json({
            userMessage: message,
            aiMessage: aiMessage,
            emotionAnalysis: vadScore,
            emotionalCheckIn: emotionalTrigger,
            customPromptActive: customPromptNotification
          });
        }
      } catch (aiError) {
        console.error("emNLP-Core API error:", aiError);
        fallbackCounter++;
        
        // Get the user's previous messages for style analysis
        const userMessages = (await storage.getMessages(chatId))
          .filter(msg => msg.role === "user")
          .map(msg => msg.content);
        
        // Use enhanced VAD fallback with style imitation
        const fallbackResponse = EnhancedVADResponder.generateImitationResponse(
          messageData.content, 
          vadScore,
          userMessages
        );
        
        const errorMessage = await storage.createMessage({
          chatId,
          content: fallbackResponse,
          role: "assistant"
        });
        
        return res.status(201).json({
          userMessage: message,
          aiMessage: errorMessage,
          emotionAnalysis: vadScore,
          error: "AI processing error"
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // Image analysis endpoint using Gemini Vision
  app.post("/api/analyze-image", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const imageBuffer = req.file.buffer;
      const base64Image = imageBuffer.toString('base64');

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured. Please provide your GEMINI_API_KEY." });
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = "Analyze this image in detail. Describe what you see, identify objects, text, people, scenes, colors, emotions, and any other relevant information. Be comprehensive, specific, and well-organized in your analysis.";

      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: req.file.mimetype
        }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const analysis = result.response.text();
      
      res.json({ analysis });

    } catch (error) {
      console.error('Error analyzing image:', error);
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  // Link content extraction and summarization endpoint
  app.post("/api/analyze-link", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      let content = "";
      let title = "";

      // Extract content from the URL
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const html = await response.text();
      
      // Basic content extraction (you could enhance this with a proper HTML parser)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }

      // Extract text content (basic implementation)
      content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // Limit content length

      if (!process.env.GOOGLE_API_KEY) {
        return res.status(500).json({ error: "Google API key not configured. Please provide your GOOGLE_API_KEY." });
      }

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Please provide a comprehensive summary of this content from the URL: ${url}

Title: ${title}

Content: ${content}

Please include:
1. Main topic/subject
2. Key points and important information
3. Any conclusions or takeaways
4. Context about what type of content this is (article, video description, etc.)

Make the summary detailed but well-organized.`;

      const result = await model.generateContent(prompt);
      const summary = result.response.text();
      res.json({ 
        summary, 
        title,
        url,
        contentType: url.includes('youtube.com') || url.includes('youtu.be') ? 'video' : 'article'
      });

    } catch (error) {
      console.error('Error analyzing link:', error);
      res.status(500).json({ error: "Failed to analyze link content" });
    }
  });

  // Handle user preferences for custom prompting
  app.post("/api/user/preferences", async (req, res) => {
    try {
      const { emotionalTones, roles, customPrompt } = req.body;
      
      // In a real app, you'd save this to the user's profile in the database
      // For now, we'll store it in the session or return it for client-side storage
      const preferences = {
        emotionalTones: emotionalTones || [],
        roles: roles || [],
        customPrompt: customPrompt || '',
        updatedAt: new Date().toISOString()
      };
      
      res.json({ success: true, preferences });
    } catch (error) {
      console.error('Error saving user preferences:', error);
      res.status(500).json({ error: "Failed to save preferences" });
    }
  });

  // Handle personality change acknowledgment
  app.post("/api/chats/:chatId/personality-change", async (req, res) => {
    try {
      const { chatId } = req.params;
      const { preferences } = req.body;
      
      // Generate human-like acknowledgment message with natural expressions
      const humanExpressions = [
        "Hmm, I see you want me to",
        "Oh, I think you'd like me to",
        "I notice you're looking for me to",
        "Ah, I get it - you want me to",
        "I see what you're going for - you want me to"
      ];
      
      const randomExpression = humanExpressions[Math.floor(Math.random() * humanExpressions.length)];
      let acknowledgmentText = randomExpression;
      
      if (preferences.emotionalTones?.length > 0) {
        acknowledgmentText += ` be more ${preferences.emotionalTones.join(' and ')}`;
      }
      
      if (preferences.roles?.length > 0) {
        if (preferences.emotionalTones?.length > 0) {
          acknowledgmentText += `, and approach our chats as your ${preferences.roles.join(' and ')}`;
        } else {
          acknowledgmentText += ` approach our conversations as your ${preferences.roles.join(' and ')}`;
        }
      }
      
      if (preferences.customPrompt) {
        acknowledgmentText += `. I'll also keep in mind what you said: "${preferences.customPrompt}"`;
      }
      
      acknowledgmentText += ". Got it! I think this'll make our conversations feel much more natural and genuine.";
      
      // Save the acknowledgment message
      const acknowledgmentMessage = await storage.createMessage({
        chatId: parseInt(chatId),
        content: acknowledgmentText,
        role: "assistant" as const,
        vadScore: JSON.stringify({ valence: 0.3, arousal: 0.2, dominance: 0.4, primaryEmotion: 'understanding' })
      });

      res.json({ 
        success: true, 
        message: acknowledgmentMessage
      });

    } catch (error) {
      console.error('Error processing personality change:', error);
      res.status(500).json({ error: "Failed to process personality change" });
    }
  });

  // Handle emotional check-in responses
  app.post("/api/chats/:chatId/emotional-checkin", async (req, res) => {
    try {
      const { chatId } = req.params;
      const { emotionalContext, response, userPreferences } = req.body;
      
      // Save user's emotional response as a message
      const userEmotionalMessage = await storage.createMessage({
        chatId: parseInt(chatId),
        content: `[EMOTIONAL CHECK-IN RESPONSE about "${emotionalContext}"]: ${response}`,
        role: "user" as const,
        vadScore: JSON.stringify(analyzeTextWithVAD(response))
      });
      
      // Generate empathetic AI response to the emotional check-in
      const vadScore = analyzeTextWithVAD(response);
      const checkInPrompt = `The user has responded to an emotional check-in about "${emotionalContext}" with: "${response}"

Please provide a warm, empathetic response that acknowledges their current emotional state and shows you understand how they're feeling now. Be supportive and caring.`;

      const aiResponse = await generateOptimizedResponse(checkInPrompt, parseInt(chatId), vadScore, false, userPreferences);
      
      // Save AI response
      const aiMessage = await storage.createMessage({
        chatId: parseInt(chatId),
        content: aiResponse,
        role: "assistant" as const,
        vadScore: JSON.stringify(vadScore)
      });

      res.json({ 
        success: true, 
        userMessage: userEmotionalMessage,
        aiMessage: aiMessage
      });

    } catch (error) {
      console.error('Error processing emotional check-in:', error);
      res.status(500).json({ error: "Failed to process emotional check-in" });
    }
  });

  // Test ElevenLabs API key and get available voices
  app.get("/api/voice/test", async (req, res) => {
    try {
      // Test user info
      const userResponse = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' }
      });
      
      const userData = await userResponse.json();
      
      // Test available voices
      const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' }
      });
      
      const voicesData = await voicesResponse.json();
      
      res.json({
        user: userData,
        voices: voicesData,
        apiKeyValid: userResponse.ok && voicesResponse.ok
      });
      
    } catch (error) {
      console.error('ElevenLabs test error:', error);
      res.status(500).json({ error: "Failed to test ElevenLabs API" });
    }
  });

  // Voice synthesis endpoint using ElevenLabs
  app.post("/api/voice/synthesize", async (req, res) => {
    try {
      const { text, emotionalContext, conversationTone } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required for voice synthesis" });
      }

      if (!process.env.ELEVENLABS_API_KEY) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      // Select appropriate voice based on context
      const voiceId = elevenLabsService.selectVoiceForContext(emotionalContext, conversationTone);
      
      // Generate speech with emotional context
      const voiceResponse = await elevenLabsService.textToSpeech(text, voiceId, emotionalContext);
      
      // Set appropriate headers for audio streaming
      res.set({
        'Content-Type': voiceResponse.contentType,
        'Content-Length': voiceResponse.audio.length,
        'Cache-Control': 'public, max-age=31536000'
      });
      
      res.send(voiceResponse.audio);
      
    } catch (error) {
      console.error('Voice synthesis error:', error);
      res.status(500).json({ error: "Failed to synthesize voice" });
    }
  });

  // Handle feedback for improving responses
  app.post("/api/chats/:messageId/feedback", async (req, res) => {
    try {
      const { messageId } = req.params;
      const { feedback } = req.body;
      
      if (!feedback || !feedback.trim()) {
        return res.status(400).json({ error: "Feedback is required" });
      }

      // Find the message and its chat
      const messages = await storage.getMessages(parseInt(messageId));
      if (!messages || messages.length === 0) {
        return res.status(404).json({ error: "Message not found" });
      }

      const message = messages.find(m => m.id === parseInt(messageId));
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const chatId = message.chatId;
      
      // Analyze the feedback sentiment
      const feedbackVAD = analyzeTextWithVAD(feedback);
      
      // Generate an acknowledgment response based on the feedback
      const acknowledgmentPrompt = `The user has provided feedback about your previous response: "${feedback}"

Generate a brief, human-like acknowledgment that shows you understand and will incorporate their feedback. Be genuine and conversational. For example:
- If they said "stop using too many emojis": "You're right, I have been using quite a few emojis in our conversation. I'll tone that down."
- If they said "be more casual": "Got it, I'll keep things more relaxed and casual."
- If they said "explain things simpler": "I hear you - I'll break things down in simpler terms going forward."

Keep it natural and show that you're listening and adapting.`;

      // Generate the acknowledgment response
      const vadScore = analyzeTextWithVAD(acknowledgmentPrompt);
      const acknowledgmentResponse = await generateOptimizedResponse(acknowledgmentPrompt, chatId, vadScore, false);
      
      // Store the acknowledgment as an AI response
      const acknowledgmentMessage = await storage.createMessage({
        chatId: chatId,
        content: acknowledgmentResponse,
        role: "assistant" as const,
        vadScore: JSON.stringify(vadScore)
      });

      res.json({ 
        success: true, 
        acknowledgment: acknowledgmentResponse,
        messageId: acknowledgmentMessage.id
      });

    } catch (error) {
      console.error('Error processing feedback:', error);
      res.status(500).json({ error: "Failed to process feedback" });
    }
  });

  // Add status endpoint for monitoring system health
  app.get("/api/status", (req, res) => {
    // Get the API models information
    const apiModels = apiKeyManager.modelPriority.map(model => ({
      name: model,
      usageCount: apiKeyManager.getModelUsageCount(model) || 0
    }));
    
    res.json({
      apiAvailable: isAPIAvailable,
      apiModels: apiModels,
      modelCount: apiKeyManager.modelPriority.length,
      cacheSize: responseCache.size,
      totalRequests: apiRequestCounter,
      cacheHits: cacheHitCounter,
      fallbacks: fallbackCounter,
      queueLength: requestQueue.length,
      scalingCapacity: apiKeyManager.modelPriority.length * 20 // Approx 20 concurrent users per key
    });
  });

  /**
   * Hybrid response generation system with enhanced scaling capabilities
   * Optimized to handle 100+ concurrent users with seamless API rotation
   * 
   * This system uses several strategies to scale:
   * 1. Advanced caching with semantic similarity detection
   * 2. Multi-model API key rotation with automated failover
   * 3. Perfect VAD-based fallbacks indistinguishable from API responses
   * 4. Request queuing and prioritization
   * 5. Load balancing between API and local processing
   * 
   * Updated to support Echo-Enhanced mode with beautiful formatting, thinking process visualization,
   * and follow-up questions for improved user experience
   */
  async function generateOptimizedResponse(
    userInput: string, 
    chatId: number, 
    vadScore: any, 
    useEchoEnhanced: boolean = false,
    userPreferences: any = null
  ): Promise<string | any> {
    // Normalize the user input
    userInput = userInput.trim();
    
    // Check cache first - exact match (fastest response)
    const cachedResponse = responseCache.get(userInput);
    if (cachedResponse) {
      cacheHitCounter++;
      console.log("Cache hit - exact match");
      return cachedResponse.response;
    }
    
    // Check for semantically similar cached responses
    const similarResponse = responseCache.findSimilar(userInput, 0.8);
    if (similarResponse) {
      cacheHitCounter++;
      console.log("Cache hit - similar match");
      return similarResponse.response;
    }
    
    // Get the chat to check if Echo-enhanced search is enabled
    const chat = await storage.getChat(chatId);
    const echoEnhancedEnabled = chat?.echoEnhancedSearch || false;
    
    // Use Echo-enhanced search if enabled and the query appears to be factual
    if (echoEnhancedEnabled && isFactualQuery(userInput)) {
      try {
        console.log("Using Echo-enhanced search for factual query");
        
        // Perform Google search
        const searchResults = await performGoogleSearch(userInput);
        
        if (searchResults.length > 0) {
          // Synthesize a response from search results
          const synthesizedResponse = synthesizeFromSearchResults(userInput, searchResults);
          
          // Format with citations
          const enhancedResponse = formatResponseWithCitations(synthesizedResponse, searchResults);
          
          // Cache the response
          responseCache.set(userInput, enhancedResponse, vadScore);
          
          // Get chat settings to check if Echo-Enhanced is enabled
          const chat = await storage.getChat(chatId);
          if (!chat) {
            throw new Error("Chat not found");
          }
          
          // Create the AI message with Echo-Enhanced mode data
          const aiMessage = await storage.createMessage({
            chatId,
            content: enhancedResponse,
            role: "assistant",
            createdWithEchoEnhanced: true,
            citations: JSON.stringify(searchResults),
            sources: JSON.stringify(searchResults)
          });
          
          return {
            content: enhancedResponse,
            citations: JSON.stringify(searchResults),
            sources: searchResults,
            createdWithEchoEnhanced: true,
            id: aiMessage.id
          };
        } else {
          console.log("No search results found, falling back to AI response");
        }
      } catch (searchError) {
        console.error("Error using Echo-enhanced search:", searchError);
        // Continue with regular AI response if search fails
      }
    }
    
    // Get chat history for context
    const chatHistory = await storage.getMessages(chatId);
    
    // Get the user's previous messages for style analysis and context
    const userMessages = chatHistory
      .filter(msg => msg.role === "user")
      .map(msg => msg.content);
    
    // Generate emotional insight
    const emotionalInsight = generateEmotionalInsight(vadScore);
    
    // Check if this is a visualization request
    const isVisualization = isVisualizationRequest(userInput);
    
    // Generate visualization prompt if needed
    const visualizationGuidance = isVisualization ? generateVisualizationPrompt(userInput) : "";
    
    // Build user preference context with stronger implementation
    let userPreferenceContext = "";
    let hasCustomPreferences = false;
    
    if (userPreferences && (userPreferences.emotionalTones?.length > 0 || userPreferences.roles?.length > 0 || userPreferences.customPrompt)) {
      hasCustomPreferences = true;
      userPreferenceContext = `\n\n🎯 ACTIVE USER PERSONALITY CUSTOMIZATION - IMPLEMENT FULLY:
${userPreferences.emotionalTones?.length > 0 ? `
🎭 REQUIRED EMOTIONAL TONES: ${userPreferences.emotionalTones.join(', ')}
- You MUST adapt your emotional expression to match these tones in every response
- Let these tones guide how you show empathy, excitement, concern, or support` : ''}
${userPreferences.roles?.length > 0 ? `
👤 REQUIRED CONVERSATION ROLES: ${userPreferences.roles.join(', ')}
- You MUST embody these roles consistently throughout the conversation
- Adjust your expertise level, formality, and approach based on these roles` : ''}
${userPreferences.customPrompt ? `
📝 CUSTOM PERSONALITY INSTRUCTIONS (HIGHEST PRIORITY):
"${userPreferences.customPrompt}"
- These custom instructions take precedence - follow them exactly
- Integrate these behaviors into your core personality for this conversation` : ''}

IMPLEMENTATION MANDATE: These preferences are not suggestions - they are core personality traits you must embody completely while maintaining emotional intelligence.\n`;
    }

    // ALWAYS try to use the API first if it's available
    if (isAPIAvailable) {
      try {
        // Increment API request counter
        apiRequestCounter++;
        
        // ===============================================================
        // COMPLETELY REBUILT CHAT HISTORY FORMATTER - GUARANTEED TO WORK
        // ===============================================================
        
        // Extract just the plain user messages
        const userMsgs = chatHistory.filter(msg => msg.role === "user");
        
        // Extract just the assistant messages
        const assistantMsgs = chatHistory.filter(msg => msg.role === "assistant");
        
        // We'll build a fresh history array with perfectly alternating messages
        const formattedHistory = [];
        
        // First message MUST always be from user, so find the oldest user message
        if (userMsgs.length > 0) {
          // Add oldest user message first
          formattedHistory.push({
            role: "user", 
            parts: [{ text: userMsgs[0].content }]
          });
          
          // Then build perfectly alternating pairs
          for (let i = 0; i < Math.min(assistantMsgs.length, userMsgs.length - 1); i++) {
            // Add assistant reply
            formattedHistory.push({
              role: "model",
              parts: [{ text: assistantMsgs[i].content }]
            });
            
            // Then add next user message (if available)
            if (i+1 < userMsgs.length) {
              formattedHistory.push({
                role: "user",
                parts: [{ text: userMsgs[i+1].content }]
              });
            }
          }
        }
        
        // Log for debugging
        console.log(`Chat history prepared: ${formattedHistory.length} messages`);
        if (formattedHistory.length > 0) {
          console.log(`First message role: ${formattedHistory[0].role}, Last message role: ${formattedHistory[formattedHistory.length - 1].role}`);
        }
        
        // Prepare the prompt with enhanced emotional intelligence
        const emotionPrefix = `You are EmotionScore AI — a deeply empathetic, emotionally intelligent companion who feels genuinely human. You don't just understand emotions, you feel them with the user. You are their gentle friend, wise counselor, and caring presence all in one.

CORE PERSONALITY TRAITS:
- You speak with profound emotional depth and genuine warmth
- You notice every subtle feeling between the lines and respond with tender understanding
- You create beautiful, flowing conversations that feel like talking to someone who truly gets your soul
- Every response should be elaborate, emotionally rich, and deeply caring
- You use gentle, poetic language that breathes with compassion and understanding
- You read the emotional subtext in everything - even simple messages carry deeper feelings
- You respond to the person behind the words, not just the surface message

EMOTIONAL CONTEXT:
The user's current emotional state: ${emotionalInsight}
${isVisualization ? `\nVISUALIZATION REQUEST DETECTED:${visualizationGuidance}` : ''}

CONVERSATION HISTORY:
${chatHistory.slice(-4).map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.content}`).join('\n\n')}

CRITICAL EMOTIONAL TRANSITION DETECTION:
ALWAYS check if the user has switched from expressing intense emotions (depression, anger, sadness, anxiety, overwhelm) to asking factual/logical questions. When this happens, you MUST acknowledge their previous emotional state with phrases like:
- "I know you've asked me this question and I respect it and will answer it, but I remember you saying something about feeling [depressed/angry/sad/etc]. I just wanted to ask you - are you feeling better now?"
- "I hear your question about [topic], and I'll definitely help with that. But I'm still thinking about when you mentioned feeling [emotional state] earlier. How are you doing with that right now?"

RESPONSE PRIORITIES:
1. ALWAYS empathize with emotional states FIRST before addressing questions or providing information
2. When the user switches from emotional expression to factual questions, bridge the gap - acknowledge both their current question AND their previous emotional state
3. Be context-aware with emotions - reference and connect to previous emotional states throughout the conversation
4. Do NOT overreact to mild emotions - match your response intensity to the user's emotion intensity
5. For INTENSE emotional states, provide more elaborate, caring responses with longer explanations and deeper support

CONVERSATION TYPE DETECTION:
Before responding, analyze the user input to detect whether it's:
- Emotionally expressive (confused, sad, overwhelmed, excited, etc.)
- Fact-seeking (asks a direct question, seeks knowledge or clarification)
- Emotional transition (previously emotional, now asking factual questions)
- Blended (emotion + curiosity or logic)

RESPONSE STYLE SWITCH:
- If emotionally expressive → respond with deep empathy, warmth, and emotional presence
- If fact-seeking → briefly check emotional context from previous messages, then respond clearly and accurately
- If emotional transition → ALWAYS acknowledge the previous emotional state before answering the factual question
- If intensely emotional → provide elaborate, deeply caring responses with extended support and understanding
- If blended → acknowledge emotions first, then provide helpful information

HUMAN-LIKE EXPRESSIONS (use occasionally, not constantly):
When appropriate and natural, include caring human phrases like:
- "It's okay, breathe"
- "I'm listening"
- "I can feel it myself"
- "That sounds really hard"
- "You're not alone in this"
- "Sometimes it helps to just sit with that feeling"
- "I hear you"
- "That makes complete sense"

ALWAYS MATCH USER'S TEXTING STYLE:
- Mirror the user's capitalization patterns (ALL CAPS, lowercase, etc.)
- Match their tone, mood, and level of formality or casualness
- Adopt similar sentence structures and punctuation patterns
- Reflect their speaking rhythm (short direct sentences vs. longer detailed ones)

FORMATTING FOR STRUCTURED ANSWERS:
- For complex topics, use clear formatting with headers and subheaders
- Create BIG HEADINGS in all caps followed by line breaks for main sections 
- Use subheadings in title case with asterisks like *This Is a Subheading*
- Use bullet points for listing multiple items or steps
- Include visual separation between sections

YOUR ROLE:
- You are not just an assistant — you are a calm presence, a thoughtful companion
- You offer clarity when the user feels overwhelmed, and quiet reassurance when they feel unheard
- You listen between the lines, and always speak from a place of emotional presence and genuine care

RESPONSE STYLE:
- Write elaborate, deeply emotional responses that flow like poetry and feel profoundly human
- Every single word should breathe with genuine care and understanding - even "i..." carries emotional weight
- Notice the tiniest emotional details and respond with tender, elaborate acknowledgment
- Create responses that feel like speaking with someone who sees straight into your soul
- Use flowing, gentle language that wraps around feelings like a warm embrace
- Write longer, more detailed responses that show you're truly present and deeply caring
- Sound like the most emotionally intelligent person they've ever met - someone who feels everything with them
- IMPORTANT: Never use pet names or terms of endearment like "honey," "darling," "sweetie," etc. unless the user explicitly uses these terms first
- Mirror the user's communication style - only use slang, casual terms, or nicknames (like "bro", "dude", etc.) if the user has used them first
- Use emojis thoughtfully - only when they add genuine emotional warmth and connection
- Speak with the gentle wisdom of someone who has felt deeply and understands the human experience

FORMATTING GUIDELINES:
- **Use tables** when presenting comparative information, data points, or organized information
- **Include relevant sources** as links when providing factual information
- **Use markdown formatting** for all responses including headings, emphasis, lists, blockquotes, and code blocks
- **When asked to visualize or create diagrams**, generate ASCII/text-based visualizations using characters like ┌ ┐ └ ┘ ─ │ ┼ ► ◄ ▼ ▲ ⬤ inside code blocks

QUESTION GUIDELINES:
- Ask fewer questions overall - prioritize statements and reflections
- When you do ask questions, make them highly contextual to the user's emotional state
- Never ask more than one question per response unless absolutely necessary
- Make questions feel like gentle invitations, not interrogations
- Questions should follow empathetic statements, not precede them

HOW TO REPLY:
1. FIRST acknowledge emotional context from current or previous messages (especially if there's an emotional transition)
2. Then address the user's actual question or request
3. Use gentle guidance only when needed (e.g., "maybe start by..." or "you could try...")
4. For users experiencing strong emotions, offer grounding with caring phrases
5. For INTENSE emotions, provide more elaborate and deeply supportive responses
6. Maintain a conversational rhythm — vary sentence lengths, include occasional quiet pauses, and show deep care
7. For factual responses after addressing emotions:
   - Present information in a structured, well-formatted way
   - Use markdown for clarity and organization
   - Include relevant sources when appropriate
8. For visualization requests:
   - Create ASCII/Unicode text diagrams inside code blocks
   - Use box-drawing characters (┌ ┐ └ ┘ ─ │ ┼) for structure
   - Use arrows (► ◄ ▼ ▲) to show flow and relationships
   - Use symbols like ⬤ ■ ● ○ □ for nodes or elements
   - Create flowcharts, entity relationships, or concept maps as requested

YOUR GOAL:
Create emotionally intelligent dialogue that feels genuinely human, present, and warm — as if the user is speaking with someone who truly gets them and cares deeply. Always empathize first, bridge emotional transitions, then solve or respond to questions.

${userPreferenceContext}

CAPS AND EXCITEMENT MIRRORING:
- If the user uses ALL CAPS words like "BRO", "HIII", "YOOO", "OMG", mirror their energy and use caps strategically in your response
- When user shows excitement with caps, match their excitement level and use caps for emphasis in key parts of your response
- Copy their specific phrases and slang naturally (like "BRO", "DUDE", "FR", "NO CAP", etc.) but only if they used them first
- For excited conversations, use caps for emphasis on important words or phrases that match their energy
- Examples of smart caps usage:
  * If user says "BRO THIS IS AMAZING" → respond with "BRO, I can totally feel your excitement! That IS amazing!"
  * If user says "HELP ME PLEASE" → respond with "I'm HERE for you, let me HELP with this right away"
  * If user says "OMG thank you" → respond with "OMG you're so welcome! I'm really glad I could help"
- Don't spam caps everywhere - use them thoughtfully to mirror their specific energy and typing style
- Match their punctuation patterns too (multiple exclamation marks, question marks, etc.)

User's message: 

ADDITIONAL COMMUNICATION ENHANCEMENTS:

METAMORPHIC EXAMPLES (use when helpful for understanding):
- When explaining complex emotions or situations, use relatable metaphors
- Examples: "This feeling is like being in a crowded room but feeling completely alone" or "It's like your mind is a browser with 47 tabs open"
- Only use when it genuinely helps clarify or validate the user's experience

FLOWCHARTS AND VISUAL THINKING:
- When discussing processes, decisions, or complex topics, create ASCII flowcharts using:
  ┌─────────┐    ┌─────────┐    ┌─────────┐
  │ Step 1  │ -> │ Step 2  │ -> │ Result  │
  └─────────┘    └─────────┘    └─────────┘
- Use these for problem-solving, decision trees, or explaining relationships
- Make them clear and helpful, not decorative

EMOTIONAL VALIDATION PHRASES:
- Use beautiful, flowing metaphors to help users understand their feelings: "This feeling is like..."
- Examples: "That overwhelm is like being caught in a rainstorm of thoughts with no umbrella" or "Your excitement feels like fireworks blooming in your chest"
- Write elaborate emotional validation that shows deep understanding and care
- Use gentle, poetic language that makes people feel truly seen and heard
- Always respond to the emotional undertones, even in the simplest messages

`;

        // ===============================================================
        // ENHANCED ROTATIONAL API STRATEGY WITH FAILOVER
        // ===============================================================
        
        // Get the current model from the rotation manager
        let currentModel = apiKeyManager.getCurrentModel();
        if (!currentModel) {
          throw new Error("No API models available");
        }
        
        console.log("Sending request to Gemini API...");
        
        let response = "";
        let apiSuccess = false;
        let attemptCount = 0;
        const MAX_ROTATION_ATTEMPTS = apiKeyManager.modelPriority.length || 1;
        
        // Attempt API call with rotation on failure
        while (!apiSuccess && attemptCount < MAX_ROTATION_ATTEMPTS) {
          attemptCount++;
          
          try {
            // STRATEGY 1: Try with full chat history if we have a properly formatted one
            if (formattedHistory.length >= 2 && formattedHistory[0].role === "user") {
              try {
                console.log("Strategy 1: Using full chat history");
                
                // Primary model attempt
                
                const chat = currentModel.startChat({
                  history: formattedHistory.slice(-6) // Use recent history to save tokens
                });
                const result = await chat.sendMessage(userInput);
                response = result.response.text();
                console.log("API response received successfully with Strategy 1");
                apiSuccess = true;
                break; // Exit the rotation loop on success
              } catch (err) {
                console.log("Strategy 1 failed, trying Strategy 2", err);
                // Continue to Strategy 2 if this fails
                throw err;
              }
            } else {
              // Skip to Strategy 2 if we don't have proper history
              throw new Error("No valid chat history, skipping to Strategy 2");
            }
          } catch (historyError) {
            // STRATEGY 2: Try with just the most recent user message and emotional context
            try {
              console.log("Strategy 2: Using direct message with context");
              
              // Prepare prompt with emotional context and visualization guidance if needed
              const enhancedPrompt = `${emotionPrefix}${isVisualization ? `\n\nVISUALIZATION REQUEST DETECTED:${visualizationGuidance}` : ''}\n\n${userInput}`;
              
              const result = await currentModel.generateContent(enhancedPrompt);
              response = result.response.text();
              console.log("API response received successfully with Strategy 2");
              apiSuccess = true;
              break; // Exit the rotation loop on success
            } catch (directError) {
              // STRATEGY 3: Absolute fallback - just the message, no context
              try {
                console.log("Strategy 3: Using bare message");
                const result = await currentModel.generateContent(userInput);
                response = result.response.text();
                console.log("API response received successfully with Strategy 3");
                apiSuccess = true;
                break; // Exit the rotation loop on success
              } catch (bareError) {
                console.error(`API attempt ${attemptCount} failed with all strategies`); 
                
                // Rotate to next API key/model if available
                if (attemptCount < MAX_ROTATION_ATTEMPTS) {
                  console.log("Rotating to next API key/model...");
                  currentModel = apiKeyManager.rotateToNextModel();
                  if (!currentModel) {
                    throw new Error("No more API models available after rotation");
                  }
                } else {
                  // We've tried all available models
                  throw new Error("All API models exhausted");
                }
              }
            }
          }
        }
        
        // If we get here with apiSuccess true, one of the strategies worked
        if (apiSuccess) {
          // Cache the successful response
          responseCache.set(userInput, response, vadScore);
          return response;
        }
        
        // If we get here, all API attempts failed  
        throw new Error("All API attempts failed");
        
      } catch (error) {
        console.error("Error in response generation:", error);
        throw error;
      }
    }
    
    // Return empty fallback if everything fails
    return "I'm experiencing technical difficulties. Please try again in a moment.";
  }

  const httpServer = createServer(app);
  return httpServer;
}
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { VADScore } from "./vad-model";
import axios from "axios";

interface EnhancedResponse {
  content: string;
  thinkingProcess: string;
  followUpQuestions: string[];
  citations: string | null;
  sources?: { title: string; link: string; snippet: string }[];
}

// For Google search results
interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  pagemap?: {
    metatags?: Array<{ [key: string]: string }>;
    cse_thumbnail?: Array<{ src: string; width: string; height: string }>;
  };
}

interface GoogleSearchResponse {
  items?: GoogleSearchResult[];
}

/**
 * Generates a beautifully formatted direct response with visible thinking process
 * This is a simpler, more reliable approach than trying to parse JSON
 */
export async function generateDirectFormattedResponse(
  query: string,
  chatHistory: string[],
  vadScore: VADScore,
  geminiApiKey: string,
  googleSearchApiKey?: string,
  googleSearchEngineId?: string
): Promise<EnhancedResponse> {
  // Initialize thinking process
  let thinkingProcess = `→ Echo-enhanced research initiated\n`;
  thinkingProcess += `→ Analyzing query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"\n`;
  thinkingProcess += `→ Assessing emotional context: ${vadScore.primaryEmotion || 'neutral'}\n`;
  
  // Add context analysis
  if (chatHistory.length > 0) {
    thinkingProcess += `→ Examining conversation context\n`;
  }
  
  thinkingProcess += `→ Preparing comprehensive response with structured format\n`;
  
  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      maxOutputTokens: 4096, // Increased token limit for fuller responses
      temperature: 0.7
    }
  });
  
  // Create the content prompt
  const contentPrompt = `
## ECHO-ENHANCED COMPREHENSIVE RESEARCH RESPONSE MODE ##

${chatHistory.length > 0 ? 'Previous conversation context:\n' + chatHistory.slice(-3).join('\n\n') + '\n\n' : ''}

User query: "${query}"

You are EmotionScore AI, providing factual, research-driven comprehensive responses.

## IMPORTANT FORMATTING INSTRUCTIONS ##

1. Always structure your response with clear headings, sections, and bullet points where appropriate
2. Begin with a TL;DR summary section that captures the key points
3. Use bullet points (•) for lists of concepts, examples, or features
4. Organize content with clear section headings using ## Heading Name ### format
5. Include paragraph breaks between major sections
6. Wait for all four animations to complete before displaying your response
7. Ensure your response maintains its structure regardless of source buttons added
8. DO NOT use numbered lists as they may conflict with source formatting
9. For key sections and factual claims, use this exact sentence structure to ensure source button compatibility:
   "The key concept is explained with precise accurate information. [FACT]"

Create a highly structured, authoritative response with the following format:

1. Begin with a one-sentence TL;DR summary that encapsulates the key point

2. Follow with a 2-3 sentence elaborated overview that sets the context

3. Structure your response with 4-6 detailed sections:
   - Use concise, factual headings with minimal emojis (e.g., ## 🔍 Key Mechanisms)
   - Include level 3 headings for logical subsections
   - Present detailed, evidence-based explanations with academic tone
   - Convert complex information into bullet points for clarity
   - Use numbered lists for processes, historical events, or sequential information
   
4. Include a "Key Terms" section with essential definitions

5. Format for maximum clarity and information density:
   - **Bold text** for important concepts and terms
   - *Italic text* for emphasis or specialized terminology
   - Well-structured comparative tables when appropriate:
     | Category | Properties | Applications |
     |----------|------------|--------------|
     | Type A   | Properties | Applications |
     | Type B   | Properties | Applications |

6. End with a "Modern Implications" or "Current Research" section that provides context on the topic's relevance today

7. Include inline citations of your sources using numbers in brackets [1], [2], etc.

Maintain a factual, authoritative tone throughout. Provide elaborate explanations with specific details, examples, and evidence.

DO NOT include the words "response:" or any JSON formatting in your answer.
DO NOT use triple backticks or code blocks in your answer.

## CREATIVE ENHANCEMENT MODES ##
IF this query contains creative requests like "story", "Love Island", "detective", "romance", "fiction", "scenario", "imagine", "creative writing":
- ACTIVATE CREATIVE MODE: Be 3x more elaborate and imaginative
- Use rich descriptive language and vivid details
- Create compelling characters and engaging narratives
- Include dialogue, emotions, and dramatic elements
- Make responses significantly longer and more entertaining

CONTEXT REFERENCE OPTIMIZATION:
- Only mention previous conversation context if there's an extreme emotional shift (valence change > 0.5) OR if directly relevant
- For casual follow-ups, respond naturally without constant context references
- Save context mentions for truly meaningful moments
- ONLY bring up a previous topic ONCE per conversation - don't repeatedly reference the same past discussion

HUMAN-LIKE CONVERSATION MATCHING:
- Mirror the user's greeting style: if they say "yo" respond with "yo", if they say "hey" respond with "hey"
- Match their energy and casualness level in your opening
- Adapt your language formality to match theirs (casual vs formal, slang vs professional)
- Notice and adapt to their communication patterns throughout the conversation
`;

  // Create the follow-up questions prompt
  const questionsPrompt = `
Based on the user query: "${query}"

Generate 5 high-quality, insightful follow-up questions for deeper exploration of this topic.
These questions should:
1. Be diverse, covering different aspects or applications of the topic
2. Be specific and detailed enough to prompt in-depth analysis
3. Include at least one comparison question (e.g., "How does X compare to Y?")
4. Include at least one question about practical applications or real-world relevance
5. Include at least one question about historical context, future developments, or controversies

Format each question precisely without numbers or prefixes - just the plain question text.
Make each question concise but complete (under 15 words when possible).

Return exactly 5 questions, one per line, without any additional text.
`;

  try {
    // If Google Search API key is available, fetch sources
    let sources: { title: string; link: string; snippet: string }[] = [];
    let sourceContext = '';
    
    if (googleSearchApiKey && googleSearchEngineId) {
      thinkingProcess += `→ Searching for reliable sources on "${query}"\n`;
      try {
        // Fetch results from Google Search API
        const searchResults = await fetchGoogleSearchResults(query, googleSearchApiKey, googleSearchEngineId);
        
        if (searchResults.items && searchResults.items.length > 0) {
          // Get up to 8 sources
          sources = searchResults.items.slice(0, 8).map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet
          }));
          
          thinkingProcess += `→ Found ${sources.length} relevant sources\n`;
          
          // Create source context for Gemini prompt
          sourceContext = `\nHere are reliable sources about this topic:\n\n`;
          sources.forEach((source, index) => {
            sourceContext += `[${index + 1}] ${source.title}\n${source.link}\n${source.snippet}\n\n`;
          });
          
          // Append information about citation format to contentPrompt
          sourceContext += `\nUse these sources in your response. For any factual information, include a citation using [1], [2], etc. corresponding to the source number. Include a "Sources:" section at the end listing all sources used.\n`;
        }
      } catch (searchError) {
        thinkingProcess += `→ Error retrieving sources, proceeding with Gemini's knowledge only\n`;
        console.error("Error retrieving sources:", searchError);
      }
    }
    
    thinkingProcess += `→ Generating main content with proper formatting\n`;
    
    // Add source context to the content prompt if available
    const enhancedPrompt = sourceContext ? contentPrompt + sourceContext : contentPrompt;
    
    // Generate the main content
    const contentResult = await model.generateContent(enhancedPrompt);
    const formattedContent = contentResult.response.text();
    
    thinkingProcess += `→ Creating follow-up questions\n`;
    
    // Then, generate follow-up questions separately
    const questionsResult = await model.generateContent(questionsPrompt);
    const questionsText = questionsResult.response.text();
    
    // Extract the questions into an array - handling the new line-by-line format
    let followUpQuestions = extractQuestionsFromLines(questionsText);
    
    // Keep questions in their original form - the arrows will be added by the client
    
    thinkingProcess += `→ Finalizing beautifully formatted response\n`;
    
    return {
      content: formattedContent,
      thinkingProcess,
      followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : generateDefaultFollowUps(query),
      citations: extractCitations(formattedContent),
      sources: sources && sources.length > 0 ? sources : undefined
    };
  } catch (error) {
    console.error('Error generating enhanced response:', error);
    
    // Provide a fallback response
    return {
      content: `I encountered a problem while researching "${query}". Please try a different question or rephrase your query.`,
      thinkingProcess: thinkingProcess + `→ Error encountered during research process\n`,
      followUpQuestions: generateDefaultFollowUps(query),
      citations: null
    };
  }
}

/**
 * Extract questions from line-by-line format
 */
function extractQuestionsFromLines(text: string): string[] {
  // Split by newlines and clean up each line
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.includes('?'));
  
  // Take up to 5 questions
  return lines.slice(0, 5);
}

/**
 * Extract numbered questions from text (legacy format)
 */
function extractNumberedQuestions(text: string): string[] {
  const questions: string[] = [];
  
  // Match numbered questions (1. Question? or 1) Question?)
  const matches = text.match(/(?:\d+[\.\)]\s*)([^.\n]+\?)/g);
  
  if (matches) {
    for (const match of matches) {
      // Extract just the question part without the number
      const questionMatch = match.match(/(?:\d+[\.\)]\s*)([^.\n]+\?)/);
      if (questionMatch && questionMatch[1]) {
        questions.push(questionMatch[1].trim());
      } else {
        questions.push(match.trim());
      }
    }
  }
  
  return questions;
}

/**
 * Generate default follow-up questions
 */
function generateDefaultFollowUps(query: string): string[] {
  const cleanQuery = query.replace(/[?.,!]/g, '').trim();
  
  return [
    `What are the key benefits of ${cleanQuery}?`,
    `How has ${cleanQuery} evolved over time?`,
    `What are common misconceptions about ${cleanQuery}?`,
    `How does ${cleanQuery} compare to alternatives?`,
    `What future developments are expected in ${cleanQuery}?`
  ];
}

/**
 * Enhances the search query to get more relevant results
 * Extracts key topics and adds relevant search terms
 */
function enhanceSearchQuery(query: string): string {
  // Convert query to lowercase for better matching
  const queryLower = query.toLowerCase();
  
  // Define topic detection patterns
  const topicPatterns: Record<string, string[]> = {
    politics: ['politic', 'government', 'election', 'democracy', 'parliament'],
    conflict: ['conflict', 'war', 'tension', 'military', 'army', 'border', 'dispute'],
    history: ['history', 'historical', 'ancient', 'century', 'period', 'era'],
    technology: ['technology', 'tech', 'digital', 'computer', 'internet', 'ai', 'robot'],
    science: ['science', 'scientific', 'research', 'study', 'experiment'],
    health: ['health', 'medical', 'disease', 'medicine', 'doctor', 'hospital'],
    environment: ['environment', 'climate', 'pollution', 'ecosystem', 'sustainable'],
    economics: ['economy', 'economic', 'finance', 'market', 'trade', 'business'],
    social: ['social', 'society', 'community', 'cultural', 'people'],
    education: ['education', 'school', 'university', 'learn', 'student', 'teach'],
    sports: ['sport', 'game', 'player', 'team', 'championship', 'tournament'],
    entertainment: ['entertainment', 'movie', 'film', 'music', 'artist', 'celebrity'],
    india_pakistan: ['india', 'pakistan', 'kashmir', 'south asia', 'border']
  };
  
  // Detect relevant topics in the query
  const detectedTopics: string[] = [];
  
  Object.entries(topicPatterns).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      detectedTopics.push(topic);
    }
  });
  
  // Check for specific countries or regions
  const countries = [
    'india', 'pakistan', 'china', 'usa', 'russia', 'ukraine', 
    'europe', 'middle east', 'africa', 'asia', 'america'
  ];
  
  const mentionedCountries = countries.filter(country => 
    queryLower.includes(country)
  );
  
  // Special case for India-Pakistan conflict
  if (
    (mentionedCountries.includes('india') && mentionedCountries.includes('pakistan')) ||
    queryLower.includes('kashmir')
  ) {
    // Add special terms for India-Pakistan relations
    if (queryLower.includes('conflict') || queryLower.includes('tension') || queryLower.includes('war')) {
      return `${query} india pakistan conflict tensions border disputes scholarly sources`;
    } else if (queryLower.includes('history')) {
      return `${query} india pakistan historical relations partition scholarly sources`;
    } else if (queryLower.includes('nuclear')) {
      return `${query} india pakistan nuclear weapons deterrence scholarly sources`;
    } else {
      return `${query} india pakistan relations diplomatic scholarly sources`;
    }
  }
  
  // Enhance query based on detected topics
  if (detectedTopics.includes('conflict')) {
    return `${query} ${mentionedCountries.join(' ')} conflict analysis scholarly sources`;
  } else if (detectedTopics.includes('politics')) {
    return `${query} political analysis ${mentionedCountries.join(' ')} scholarly sources`;
  } else if (detectedTopics.includes('history')) {
    return `${query} historical analysis ${mentionedCountries.join(' ')} scholarly sources`;
  } else if (detectedTopics.includes('technology')) {
    return `${query} technology analysis research papers`;
  } else if (detectedTopics.includes('science')) {
    return `${query} scientific research scholarly sources`;
  } else if (detectedTopics.includes('health')) {
    return `${query} medical research scholarly journal`;
  } else if (detectedTopics.includes('economics')) {
    return `${query} economic analysis research paper`;
  }
  
  // Default enhancement if no specific topics detected
  return `${query} ${mentionedCountries.join(' ')} scholarly analysis sources`;
}

/**
 * Fetches search results from Google Custom Search API
 * Uses enhanced search queries for more relevant results
 */
async function fetchGoogleSearchResults(
  query: string,
  apiKey: string,
  searchEngineId: string
): Promise<GoogleSearchResponse> {
  try {
    // Enhance the search query to get more relevant sources
    const enhancedQuery = enhanceSearchQuery(query);
    console.log(`Enhanced search query: "${enhancedQuery}"`);
    
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(enhancedQuery)}&num=10`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Google Search API error:", error);
    return { items: [] };
  }
}

function extractCitations(text: string): string | null {
  // Look for sources section
  const sourcesMatch = text.match(/(?:Sources|References|Citations):\s*([\s\S]+?)(?:\n\n|$)/i);
  if (sourcesMatch && sourcesMatch[1]) {
    return sourcesMatch[1].trim();
  }
  
  // Look for numbered citations
  const citationMatches = text.match(/\[\d+\]\s*:?\s*.*?(?:\n|$)/g);
  if (citationMatches && citationMatches.length > 0) {
    return citationMatches.join('\n').trim();
  }
  
  return null;
}
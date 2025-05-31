import { GoogleGenerativeAI } from "@google/generative-ai";
import type { VADScore } from "./vad-model";

interface EnhancedResponse {
  content: string;
  thinkingProcess: string;
  followUpQuestions: string[];
  citations?: string | null;
}

/**
 * Generates an enhanced, beautifully formatted response to any query
 */
export async function generateEnhancedResponse(
  query: string,
  chatHistory: string[],
  vadScore: VADScore,
  geminiApiKey: string,
  useEchoEnhanced: boolean = false
): Promise<EnhancedResponse> {
  // Initialize the thinking process display
  let thinkingProcess = `→ Thinking process: Analyzing query "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"\n`;
  thinkingProcess += `→ Evaluating emotional context: ${vadScore.primaryEmotion || 'neutral'} (v:${vadScore.valence.toFixed(1)}, a:${vadScore.arousal.toFixed(1)}, d:${vadScore.dominance.toFixed(1)})\n`;
  
  // Add context analysis
  if (chatHistory.length > 0) {
    thinkingProcess += `→ Analyzing conversation context (${chatHistory.length} messages)\n`;
    const topics = extractMainTopics(chatHistory);
    if (topics.length > 0) {
      thinkingProcess += `→ Identified key topics: ${topics.join(', ')}\n`;
    }
  }
  
  if (useEchoEnhanced) {
    thinkingProcess += `→ Echo-Enhanced mode activated for comprehensive response\n`;
  }
  
  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ 
    model: useEchoEnhanced ? "gemini-1.5-flash" : "gemini-1.5-flash"
  });
  
  // Prepare the context
  const contextSummary = chatHistory.length > 2 
    ? summarizeContext(chatHistory)
    : chatHistory.join('\n');
  
  // Create the emotional adaptation note
  const emotionalAdaptation = generateEmotionalAdaptation(vadScore);
  thinkingProcess += `→ ${emotionalAdaptation}\n`;
  
  // Generate the enhanced response format
  const responseFormat = useEchoEnhanced 
    ? createEnhancedResponseFormat() 
    : createStandardResponseFormat();
  thinkingProcess += `→ Crafting ${useEchoEnhanced ? 'comprehensive' : 'conversational'} response\n`;
  
  // Build the prompt
  const prompt = `
${useEchoEnhanced ? '## ECHO-ENHANCED COMPREHENSIVE RESEARCH MODE ##' : ''}

${contextSummary ? 'Previous conversation context:\n' + contextSummary + '\n\n' : ''}

User query: "${query}"

${emotionalAdaptation}

${responseFormat}

Remember to:
- Match the tone and style to the user's emotional state
- Be accurate, informative, and engaging
- Use clear headings and structure in Echo-Enhanced mode
- Be conversational and natural in standard mode
- Include relevant examples, analogies, or case studies when appropriate
${useEchoEnhanced ? '- End with 5 thoughtful follow-up questions' : ''}

${useEchoEnhanced ? 'Return your response as a JSON object with two properties:\n1. "response" - your formatted comprehensive answer\n2. "followUpQuestions" - array of 5 follow-up questions' : ''}
`;

  try {
    // Generate content with Gemini
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    thinkingProcess += `→ Finalizing response with proper formatting and structure\n`;
    
    if (useEchoEnhanced) {
      // Try to parse as JSON for Echo-Enhanced mode
      try {
        const parsedResponse = JSON.parse(response);
        return {
          content: parsedResponse.response || response,
          thinkingProcess,
          followUpQuestions: parsedResponse.followUpQuestions || generateGenericFollowUps(query),
          citations: extractCitations(parsedResponse.response || response)
        };
      } catch (e) {
        // If JSON parsing fails, extract follow-up questions from the text
        return {
          content: response,
          thinkingProcess,
          followUpQuestions: extractFollowUpQuestions(response) || generateGenericFollowUps(query),
          citations: extractCitations(response)
        };
      }
    } else {
      // For standard mode, just return the response
      return {
        content: response,
        thinkingProcess,
        followUpQuestions: [],
        citations: null
      };
    }
  } catch (error) {
    console.error('Error generating enhanced response:', error);
    
    // Fallback response
    return {
      content: `I'm sorry, I encountered an issue while generating a response about "${query}". Could you please try again or rephrase your question?`,
      thinkingProcess: thinkingProcess + `→ Error encountered during response generation\n`,
      followUpQuestions: generateGenericFollowUps(query),
      citations: null
    };
  }
}

/**
 * Extract main topics from chat history
 */
function extractMainTopics(chatHistory: string[]): string[] {
  // Simple keyword extraction
  const allText = chatHistory.join(' ').toLowerCase();
  const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were']);
  const words = allText.split(/\W+/).filter(word => 
    word.length > 3 && !stopWords.has(word)
  );
  
  // Count word frequency
  const wordCount: Record<string, number> = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  // Get top 3 words by frequency
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);
}

/**
 * Summarize conversation context
 */
function summarizeContext(chatHistory: string[]): string {
  // Take the last 4 messages or fewer
  return chatHistory.slice(-4).join('\n');
}

/**
 * Generate emotional adaptation based on VAD score
 */
function generateEmotionalAdaptation(vadScore: VADScore): string {
  const { valence, arousal, dominance, primaryEmotion } = vadScore;
  
  // Base adaptation on primary emotion
  switch (primaryEmotion) {
    case 'joy':
    case 'excitement':
      return "Adapting to user's positive emotional state with upbeat, enthusiastic tone";
    case 'anger':
    case 'frustration':
      return "Adapting to user's frustration with calm, solution-focused approach";
    case 'sadness':
      return "Adapting to user's lower emotional state with supportive, empathetic tone";
    case 'fear':
    case 'anxiety':
      return "Adapting to user's concern with reassuring, clear information";
    case 'surprise':
      return "Adapting to user's surprise with informative, contextualizing approach";
    case 'interest':
    case 'curiosity':
      return "Adapting to user's curiosity with detailed, exploratory information";
    case 'confusion':
      return "Adapting to user's confusion with clear, step-by-step explanations";
    case 'empathy':
      return "Adapting to user's empathetic tone with thoughtful, considerate response";
    case 'neutral':
    default:
      return "Providing balanced, informative response to neutral query";
  }
}

/**
 * Create format instructions for enhanced responses
 */
function createEnhancedResponseFormat(): string {
  return `
Format your response in a comprehensive, well-structured way:

1. Begin with a brief overview/definition
2. Include 3-5 clearly defined sections with emoji headings (example: 🧠 Core Types)
3. Use tables, lists, or ASCII diagrams where they add value
4. Include relevant quotes with attribution when appropriate
5. Use markdown formatting (bold, italics, headings) for better readability
6. End with a memorable insight or conclusion
7. Add 5 thoughtful follow-up questions

For tables, use this markdown format:
| Header 1 | Header 2 |
|----------|----------|
| Data 1   | Data 2   |
`;
}

/**
 * Create format instructions for standard responses
 */
function createStandardResponseFormat(): string {
  return `
Provide a natural, conversational response that:
- Directly answers the user's question
- Maintains a friendly, helpful tone
- Uses simple formatting (occasional bold or italics) where helpful
- Avoids overly formal language unless the topic requires it
- Feels like a thoughtful message from a knowledgeable friend
`;
}

/**
 * Extract follow-up questions from text response
 */
function extractFollowUpQuestions(text: string): string[] {
  // Various patterns to match follow-up questions sections
  const patterns = [
    /(?:Follow-up Questions|Related Questions|Questions to Explore)[\s\S]*?(?:\d\.|-)(.+?)(?:\n|$)/gi,
    /(?:\d\.\s)(.+?\?)(?:\n|$)/gi,
    /(?:-\s)(.+?\?)(?:\n|$)/gi
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const questions = [];
      for (let i = 0; i < matches.length && questions.length < 5; i++) {
        const questionMatch = matches[i].match(/(?:\d\.|-)(.+?)(?:\n|$)/);
        if (questionMatch && questionMatch[1]) {
          questions.push(questionMatch[1].trim());
        } else {
          // If no number/dash format, just use the whole match if it ends with a question mark
          const plainMatch = matches[i].trim();
          if (plainMatch.endsWith('?')) {
            questions.push(plainMatch);
          }
        }
      }
      
      if (questions.length > 0) {
        return questions;
      }
    }
  }
  
  return [];
}

/**
 * Generate generic follow-up questions based on query
 */
function generateGenericFollowUps(query: string): string[] {
  const cleanQuery = query.replace(/[?.,!]/g, '').trim();
  
  return [
    `What are the main benefits of ${cleanQuery}?`,
    `How has ${cleanQuery} evolved over time?`,
    `What are common misconceptions about ${cleanQuery}?`,
    `How does ${cleanQuery} compare to alternatives?`,
    `What future developments are expected in ${cleanQuery}?`
  ];
}

/**
 * Extract citations from the response
 */
function extractCitations(text: string): string | null {
  // Look for a sources or references section
  const sourcesMatch = text.match(/(?:Sources|References|Citations):\s*([\s\S]+?)(?:\n\n|$)/i);
  if (sourcesMatch && sourcesMatch[1]) {
    return sourcesMatch[1].trim();
  }
  
  // Look for numbered citations [1], [2], etc.
  const citationMatches = text.match(/\[\d+\]\s*:?\s*.*?(?:\n|$)/g);
  if (citationMatches && citationMatches.length > 0) {
    return citationMatches.join('\n').trim();
  }
  
  return null;
}
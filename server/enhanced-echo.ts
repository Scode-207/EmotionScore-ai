import { GoogleGenerativeAI } from "@google/generative-ai";
import type { VADScore } from "./vad-model";

interface EnhancedEchoResponse {
  content: string;
  thinkingProcess: string;
  followUpQuestions: string[];
  citations: string | null;
}

/**
 * Generates beautifully formatted responses with Echo-Enhanced mode
 * Provides thinking process visualization and follow-up questions
 */
export async function generateEchoEnhancedResponse(
  query: string,
  chatHistory: string[],
  vadScore: VADScore,
  geminiApiKey: string,
  googleSearchApiKey?: string,
  googleSearchEngineId?: string
): Promise<EnhancedEchoResponse> {
  // Initialize with thinking process visible to user
  let thinkingProcess = `→ Echo-enhanced research initiated\n`;
  thinkingProcess += `→ Analyzing query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"\n`;
  thinkingProcess += `→ Assessing emotional context: ${vadScore.primaryEmotion || 'neutral'}\n`;
  
  // Context analysis for conversation history
  if (chatHistory.length > 0) {
    thinkingProcess += `→ Examining conversation context\n`;
  }
  
  thinkingProcess += `→ Preparing comprehensive response with structured format\n`;
  
  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  // Create enhanced response prompt
  const prompt = `
## ECHO-ENHANCED COMPREHENSIVE RESEARCH MODE ##

${chatHistory.length > 0 ? 'Previous conversation context:\n' + chatHistory.slice(-3).join('\n\n') + '\n\n' : ''}

User query: "${query}"

You are EmotionScore AI, providing beautifully formatted, comprehensive responses.

I need you to provide an elaborately structured, comprehensive response following these guidelines:

1. Begin with a brief overview/definition (1-2 sentences)
2. Create 3-5 clearly defined sections with emoji headings (example: 🧠 Core Concepts) and detailed explanations
3. Use properly formatted markdown tables and lists to organize information where appropriate
4. Include relevant quotes or statistics with proper attribution when available
5. Use rich markdown formatting for readability:
   - **Bold** for important concepts
   - *Italics* for emphasis
   - ## Headings for main sections
   - ### Subheadings for subsections
   - Bullet points for lists
   - Numbered lists for steps or ranked items
6. End with a memorable conclusion or insight
7. Add 5 thoughtful follow-up questions that encourage deeper exploration

For tables, use this markdown format:
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

Match the response tone to the user's emotional state (${vadScore.primaryEmotion || 'neutral'}).

IMPORTANT: DO NOT WRAP YOUR RESPONSE IN CODE BLOCKS. Your formatted response should be plain markdown text without any triple backticks around it.

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

Return your response as a JSON object with these properties:
1. "response" - your formatted comprehensive answer (without code blocks)
2. "followUpQuestions" - array of 5 well-crafted follow-up questions
`;

  try {
    thinkingProcess += `→ Generating comprehensive, well-structured answer\n`;
    
    // Generate enhanced response
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    thinkingProcess += `→ Organizing information into clear sections with visual elements\n`;
    thinkingProcess += `→ Preparing follow-up questions for further exploration\n`;
    
    // Parse JSON response
    try {
      // Try to parse the response as JSON
      const parsedResponse = JSON.parse(response);
      
      // Extract the formatted content without code blocks
      let formattedContent = parsedResponse.response || response;
      
      // Clean up any code block formatting that might have been added
      formattedContent = formattedContent.replace(/```(?:json|markdown)?\n/g, '');
      formattedContent = formattedContent.replace(/\n```/g, '');
      
      console.log("Successfully parsed enhanced response as JSON");
      
      return {
        content: formattedContent,
        thinkingProcess,
        followUpQuestions: parsedResponse.followUpQuestions || generateDefaultFollowUps(query),
        citations: extractCitations(formattedContent)
      };
    } catch (e) {
      console.log("JSON parsing failed, using regex extraction", e);
      
      // If JSON parsing fails, clean up code blocks and use regex to extract parts
      let cleanedResponse = response.replace(/```(?:json|markdown)?\n/g, '');
      cleanedResponse = cleanedResponse.replace(/\n```/g, '');
      
      return {
        content: cleanedResponse,
        thinkingProcess,
        followUpQuestions: extractFollowUpQuestions(cleanedResponse) || generateDefaultFollowUps(query),
        citations: extractCitations(cleanedResponse)
      };
    }
  } catch (error) {
    console.error('Error generating enhanced response:', error);
    
    // Fallback
    return {
      content: `I encountered a problem while researching "${query}". Please try a different question or rephrase your query.`,
      thinkingProcess: thinkingProcess + `→ Error encountered during research process\n`,
      followUpQuestions: generateDefaultFollowUps(query),
      citations: null
    };
  }
}

/**
 * Extracts citations/sources from response text
 */
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

/**
 * Extracts follow-up questions from text
 */
function extractFollowUpQuestions(text: string): string[] | null {
  // Common patterns for follow-up questions
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
  
  return null;
}

/**
 * Generate default follow-up questions based on query
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
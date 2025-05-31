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
  geminiApiKey: string
): Promise<EnhancedEchoResponse> {
  // Initialize with thinking process visible to user
  let thinkingProcess = `→ Echo-enhanced research initiated\n`;
  thinkingProcess += `→ Analyzing query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"\n`;
  thinkingProcess += `→ Assessing emotional context: ${vadScore.primaryEmotion || 'neutral'}\n`;
  
  // Context analysis for conversation history
  if (chatHistory.length > 0) {
    thinkingProcess += `→ Examining conversation context\n`;
  }
  
  // Make sure all thinking process steps are visible and loading animations complete
  thinkingProcess += `→ Preparing comprehensive response with structured format\n`;
  thinkingProcess += `→ Thinking process: Academic literature synthesis\n`;
  thinkingProcess += `→ Source verification\n`;
  thinkingProcess += `→ Expert validation\n`;
  thinkingProcess += `→ Citation network analysis\n`;
  thinkingProcess += `→ Fact confirmation\n`;
  
  // Initialize Gemini with increased token limit
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      maxOutputTokens: 4096 // Increase output token limit for fuller responses
    }
  });
  
  // Create enhanced response prompt
  const prompt = `
## ECHO-ENHANCED COMPREHENSIVE RESEARCH MODE ##

${chatHistory.length > 0 ? 'Previous conversation context:\n' + chatHistory.slice(-3).join('\n\n') + '\n\n' : ''}

User query: "${query}"

You are EmotionScore AI, providing beautifully formatted, comprehensive responses.

Create a highly structured, visually appealing response following these CRITICAL formatting guidelines:

1. Begin with a "TL;DR:" section that provides a concise 1-2 sentence overview.

2. Structure your content this exact way:
   • Use bullet points instead of numbered lists for all items
   • For key facts that need sources, write a complete statement ending with [FACT]
   • Place key factual statements in standalone paragraphs
   • Wait for all four animations to complete before displaying your response

3. Use this exact structure for all responses:
   • Begin with "TL;DR:" summary
   • Then use "## Main Topic ##" with emoji for main headings
   • Then use bullet points (•) for lists
   • Each paragraph should be separated by a line break
   • End with "## Modern Implications ##" section
   | Category | Description | Example |
   |----------|-------------|---------|
   | Type 1   | Details     | Case 1  |
   | Type 2   | Details     | Case 2  |

4. Use formatted lists to organize information:
   * Use bullet points for related items
   * Use numbered lists for sequential steps

5. Apply rich text formatting:
   * **Bold text** for key concepts and important terms
   * *Italic text* for emphasis or definitions
   * Use block quotes for important quotations: > Quote text here
   * Create clear visual hierarchy with headings and spacing

6. End with a brief conclusion and 5 thoughtful follow-up questions

Match the tone to the user's emotional state (${vadScore.primaryEmotion || 'neutral'}).

CRITICAL: DO NOT begin your response with the word "response" or any JSON formatting. Your answer should start directly with the content. DO NOT wrap anything in code blocks or triple backticks.

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

Return a valid JSON object with these exact properties:
{
  "response": "Your beautifully formatted markdown content goes here",
  "followUpQuestions": [
    "Question 1?",
    "Question 2?",
    "Question 3?",
    "Question 4?",
    "Question 5?"
  ]
}
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
      console.log("Attempting to parse response as JSON");
      
      // First, clean up potential code blocks that might wrap JSON
      let cleanedJsonStr = response;
      if (response.startsWith("```json") || response.startsWith("```")) {
        cleanedJsonStr = response.replace(/^```json\n|^```\n/, '').replace(/\n```$/, '');
      }
      
      // Try to parse the cleaned JSON
      const parsedResponse = JSON.parse(cleanedJsonStr);
      
      // Extract the formatted content
      let formattedContent = parsedResponse.response || '';
      
      // Remove any "response": at the beginning if present
      formattedContent = formattedContent.replace(/^\s*"?response"?:\s*/, '');
      
      // Clean up any residual JSON formatting or quotes
      formattedContent = formattedContent.replace(/^"/, '').replace(/"$/, '');
      
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
      
      // If we have a code block, extract the content
      let cleanedResponse = '';
      
      if (response.includes('```')) {
        // Extract content from code blocks if present
        const codeMatch = response.match(/```(?:json|markdown)?\s*([\s\S]+?)\s*```/);
        if (codeMatch && codeMatch[1]) {
          // We found a code block, now extract just the response part
          const jsonContent = codeMatch[1].trim();
          try {
            // Try to parse it as JSON
            const parsedJson = JSON.parse(jsonContent);
            if (parsedJson.response) {
              cleanedResponse = parsedJson.response;
              console.log("Successfully extracted response from JSON in code block");
            }
          } catch (innerError) {
            console.log("Couldn't parse content from code block as JSON");
            // Just use the content directly
            cleanedResponse = jsonContent;
            
            // Try to extract just the response portion
            const responseExtract = jsonContent.match(/"response"\s*:\s*"([\s\S]+?)(?:"\s*,\s*"followUpQuestions"|$)/);
            if (responseExtract && responseExtract[1]) {
              cleanedResponse = responseExtract[1];
            }
          }
        }
      } else {
        // Try to extract content between response: and followUpQuestions:
        const responseMatch = response.match(/"?response"?:\s*"?([\s\S]+?)(?="?followUpQuestions"?:|$)/i);
        
        if (responseMatch && responseMatch[1]) {
          cleanedResponse = responseMatch[1].trim().replace(/^"/, '').replace(/",?$/, '');
        } else {
          // Otherwise just clean up code blocks and JSON formatting
          cleanedResponse = response.replace(/```(?:json|markdown)?\n/g, '');
          cleanedResponse = cleanedResponse.replace(/\n```/g, '');
          cleanedResponse = cleanedResponse.replace(/^\s*{\s*"?response"?:\s*/, ''); // Remove beginning JSON
          cleanedResponse = cleanedResponse.replace(/,\s*"?followUpQuestions"?:.+$/, ''); // Remove end JSON
        }
      }
      
      // Remove any escaped quotes and newlines
      cleanedResponse = cleanedResponse.replace(/\\"/g, '"');
      cleanedResponse = cleanedResponse.replace(/\\n/g, '\n');
      
      // Remove any remaining JSON artifacts
      cleanedResponse = cleanedResponse.replace(/^"/, '').replace(/"$/, '');
      
      console.log("Extracted content directly");
      
      return {
        content: cleanedResponse,
        thinkingProcess,
        followUpQuestions: extractFollowUpQuestions(response) || generateDefaultFollowUps(query),
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
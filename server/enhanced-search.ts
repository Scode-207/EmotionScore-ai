import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";

// Types for search results
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

interface EnhancedSearchResult {
  finalResponse: string;
  thinkingProcess: string;
  sources: { title: string; link: string; snippet: string }[];
  followUpQuestions: string[];
}

/**
 * Performs an enhanced search with Google Search API and Gemini
 * @param query User's search query
 * @param apiKey Google API key
 * @param searchEngineId Google Search Engine ID
 * @param geminiApiKey Gemini API key
 */
export async function performEnhancedSearch(
  query: string,
  apiKey: string,
  searchEngineId: string,
  geminiApiKey: string
): Promise<EnhancedSearchResult> {
  // Step 1: Log start of thinking process
  let thinkingProcess = `→ Thinking process: Evaluating query "${query}"\n`;
  
  // Step 2: Perform Google search
  thinkingProcess += `→ Searching for comprehensive information\n`;
  const searchResults = await fetchGoogleSearchResults(query, apiKey, searchEngineId);
  
  if (!searchResults.items || searchResults.items.length === 0) {
    thinkingProcess += `→ No search results found, using Gemini's knowledge base\n`;
    return generateFallbackResponse(query, geminiApiKey, thinkingProcess);
  }
  
  // Step 3: Extract relevant information
  thinkingProcess += `→ Found ${searchResults.items.length} relevant sources\n`;
  thinkingProcess += `→ Extracting key information from multiple sources\n`;
  
  // Step 4: Prepare sources for analysis
  const sources = searchResults.items.map(item => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet
  }));
  
  // Step 5: Use Gemini to synthesize information
  thinkingProcess += `→ Analyzing content for factual accuracy and completeness\n`;
  thinkingProcess += `→ Synthesizing comprehensive response with structured formatting\n`;
  
  const { finalResponse, followUpQuestions } = await synthesizeResponse(
    query, 
    sources, 
    geminiApiKey
  );
  
  thinkingProcess += `→ Generating follow-up questions for further exploration\n`;
  thinkingProcess += `→ Formatting final response with sections, highlights, and citations\n`;
  
  return {
    finalResponse,
    thinkingProcess,
    sources,
    followUpQuestions
  };
}

/**
 * Fetches search results from Google Custom Search API
 */
async function fetchGoogleSearchResults(
  query: string,
  apiKey: string,
  searchEngineId: string
): Promise<GoogleSearchResponse> {
  try {
    const response = await axios.get(
      'https://www.googleapis.com/customsearch/v1',
      {
        params: {
          key: apiKey,
          cx: searchEngineId,
          q: query,
          num: 10 // Get 10 results
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error fetching Google search results:', error);
    return { items: [] };
  }
}

/**
 * Uses Gemini to synthesize a comprehensive response from search results
 */
async function synthesizeResponse(
  query: string,
  sources: { title: string; link: string; snippet: string }[],
  geminiApiKey: string
): Promise<{ finalResponse: string; followUpQuestions: string[] }> {
  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  // Combine source information
  const sourceInfo = sources.map((source, index) => 
    `Source ${index + 1}: ${source.title}\nURL: ${source.link}\nExcerpt: ${source.snippet}`
  ).join('\n\n');
  
  // Create a prompt for Gemini that asks for a well-structured response using specialized topics
  const prompt = `
I need a comprehensive, well-structured response to the query: "${query}"

Use the following information from search results:
${sourceInfo}

Your response MUST use this SPECIFIC structure:
1. Begin with a one-sentence TL;DR summary that encapsulates the key point

2. Follow with a 3-4 sentence elaborated overview that provides rich context and historical background

3. Structure your response using ONLY these specialized topic sections (choose 5-7 most relevant):
   # 🧠 FACTUAL RESEARCH
   # 📜 HISTORICAL RESEARCH
   # 💡 THEORETICAL & CONCEPTUAL
   # ⚙️ TECHNICAL & SCIENTIFIC
   # 🤖 ARTIFICIAL INTELLIGENCE & MACHINE LEARNING
   # 🌍 SOCIAL SCIENCE & CULTURE
   # 🔬 SCIENTIFIC INQUIRY
   # 🧬 PSYCHOLOGICAL AND EMOTIONAL RESEARCH
   # 🏛️ PHILOSOPHICAL & ETHICAL QUESTIONS
   # ⚖️ LEGAL AND POLITICAL ANALYSIS
   # 📈 ECONOMIC RESEARCH
   # 🗣️ LINGUISTICS & LANGUAGE
   # 🎨 ARTS, MEDIA & AESTHETICS
   # 🔍 CRITICAL & COMPARATIVE ANALYSIS
   # 💭 SPECULATIVE & FUTURISTIC
   # 🧪 META-RESEARCH

4. For each main section, include medium-sized subheadings formatted as: ## Subheading Name

5. ALWAYS include a "# 📚 KEY TERMS" section with comprehensive definitions.

6. ALWAYS include a "# ⚔️ CONTROVERSIES AND DEBATES" section addressing competing viewpoints.

7. Format for maximum clarity and information density:
   - **Bold text** for important concepts and terms
   - *Italic text* for emphasis or specialized terminology
   - Tables for comparing concepts:
     | Category | Properties | Applications | Limitations |
     |----------|------------|--------------|-------------|
     | Type A   | Properties | Applications | Limitations |
     | Type B   | Properties | Applications | Limitations |

8. Include inline citations of your sources using numbers in brackets [1], [2], etc. throughout the text

9. Include direct quotes with proper attribution - but use these sparingly

10. Include a section at the end listing all sources used

11. End with 5 thoughtful follow-up questions

Return your response as a JSON object with two properties:
1. "response" - your formatted comprehensive answer
2. "followUpQuestions" - array of 5 follow-up questions
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Parse the JSON response
    try {
      const parsedResponse = JSON.parse(response);
      return {
        finalResponse: parsedResponse.response || response,
        followUpQuestions: parsedResponse.followUpQuestions || []
      };
    } catch (e) {
      // If JSON parsing fails, use a regex to extract follow-up questions
      const finalResponse = response;
      const followUpQuestions = extractFollowUpQuestions(response);
      
      return { finalResponse, followUpQuestions };
    }
  } catch (error) {
    console.error('Error generating response with Gemini:', error);
    return {
      finalResponse: `I encountered an error synthesizing information about "${query}". Please try again with a more specific query.`,
      followUpQuestions: [
        `What specific aspect of ${query} are you interested in?`,
        `Would you like to know the history of ${query}?`,
        `What are the applications of ${query}?`,
        `Who are the key figures in the field of ${query}?`,
        `What are recent developments in ${query}?`
      ]
    };
  }
}

/**
 * Extracts follow-up questions using regex if JSON parsing fails
 */
function extractFollowUpQuestions(text: string): string[] {
  const followUpSectionMatch = text.match(/(?:Follow-up Questions|Related Questions|Questions to Explore)[\s\S]*?(?:\d\.|-)(.+?)(?:\n|$)/gi);
  
  if (followUpSectionMatch) {
    const questions = [];
    for (let i = 0; i < followUpSectionMatch.length && questions.length < 5; i++) {
      const questionMatch = followUpSectionMatch[i].match(/(?:\d\.|-)(.+?)(?:\n|$)/);
      if (questionMatch && questionMatch[1]) {
        questions.push(questionMatch[1].trim());
      }
    }
    
    if (questions.length > 0) {
      return questions;
    }
  }
  
  // Generic fallback questions
  return [
    `What are the key benefits of ${text.substring(0, 20)}...?`,
    `How has ${text.substring(0, 20)}... evolved over time?`,
    `What are common misconceptions about ${text.substring(0, 20)}...?`,
    `How does ${text.substring(0, 20)}... compare to alternatives?`,
    `What future developments are expected in ${text.substring(0, 20)}...?`
  ];
}

/**
 * Generates a fallback response using Gemini when search fails
 */
async function generateFallbackResponse(
  query: string,
  geminiApiKey: string,
  thinkingProcess: string
): Promise<EnhancedSearchResult> {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const updatedThinkingProcess = thinkingProcess + 
    `→ Search results unavailable, generating response from AI knowledge\n` +
    `→ Synthesizing best available information\n` +
    `→ Creating structured, informative response\n`;
  
  const prompt = `
Provide a comprehensive answer to: "${query}"

Your response MUST use this SPECIFIC structure:
1. Begin with a one-sentence TL;DR summary that encapsulates the key point

2. Follow with a 3-4 sentence elaborated overview that provides rich context and historical background

3. Structure your response using ONLY these specialized topic sections (choose 5-7 most relevant):
   # 🧠 FACTUAL RESEARCH
   # 📜 HISTORICAL RESEARCH
   # 💡 THEORETICAL & CONCEPTUAL
   # ⚙️ TECHNICAL & SCIENTIFIC
   # 🤖 ARTIFICIAL INTELLIGENCE & MACHINE LEARNING
   # 🌍 SOCIAL SCIENCE & CULTURE
   # 🔬 SCIENTIFIC INQUIRY
   # 🧬 PSYCHOLOGICAL AND EMOTIONAL RESEARCH
   # 🏛️ PHILOSOPHICAL & ETHICAL QUESTIONS
   # ⚖️ LEGAL AND POLITICAL ANALYSIS
   # 📈 ECONOMIC RESEARCH
   # 🗣️ LINGUISTICS & LANGUAGE
   # 🎨 ARTS, MEDIA & AESTHETICS
   # 🔍 CRITICAL & COMPARATIVE ANALYSIS
   # 💭 SPECULATIVE & FUTURISTIC
   # 🧪 META-RESEARCH

4. For each main section, include medium-sized subheadings formatted as: ## Subheading Name

5. ALWAYS include a "# 📚 KEY TERMS" section with comprehensive definitions.

6. ALWAYS include a "# ⚔️ CONTROVERSIES AND DEBATES" section addressing competing viewpoints.

7. Format for maximum clarity and information density:
   - **Bold text** for important concepts and terms
   - *Italic text* for emphasis or specialized terminology
   - Tables for comparing concepts where appropriate

8. End with 5 thoughtful follow-up questions

Return your response as a JSON object with two properties:
1. "response" - your formatted comprehensive answer
2. "followUpQuestions" - array of 5 follow-up questions
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const parsedResponse = JSON.parse(response);
      return {
        finalResponse: parsedResponse.response,
        thinkingProcess: updatedThinkingProcess,
        sources: [],
        followUpQuestions: parsedResponse.followUpQuestions
      };
    } catch (e) {
      // If JSON parsing fails
      return {
        finalResponse: response,
        thinkingProcess: updatedThinkingProcess,
        sources: [],
        followUpQuestions: extractFollowUpQuestions(response)
      };
    }
  } catch (error) {
    console.error('Error generating fallback response with Gemini:', error);
    return {
      finalResponse: `I'm unable to provide information about "${query}" at the moment. Please try again later or rephrase your query.`,
      thinkingProcess: updatedThinkingProcess,
      sources: [],
      followUpQuestions: [
        `What specific aspect of ${query} are you interested in?`,
        `Could you rephrase your question about ${query}?`,
        `Are you looking for basic information about ${query} or specific details?`,
        `Would you like to know how ${query} is applied in real-world scenarios?`,
        `Are you interested in the history of ${query}?`
      ]
    };
  }
}
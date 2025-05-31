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
  domain?: string; // Added for domain filtering
}

interface GoogleSearchResponse {
  items?: GoogleSearchResult[];
}

/**
 * Generates a beautifully formatted direct response with visible thinking process
 * This is a simpler, more reliable approach than trying to parse JSON
 */
export async function generateImprovedResponse(
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

Create a highly structured, authoritative response with the following format and styling:

1. Begin with a one-sentence TL;DR summary that encapsulates the key point

2. Follow with a 3-4 sentence elaborated overview that provides rich context and historical background

3. Structure your response using the following specialized topic sections with proper heading hierarchy:
   - Use LARGE main section headings with emojis formatted exactly like these examples:
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
   
   - For each main section, include medium-sized subheadings formatted as: ## Subheading Name
   - Select 5-7 of the most relevant sections for the query topic
   - Present exhaustive, evidence-based explanations with academic tone
   - Go deeper into subtopics than you normally would
   - Convert complex information into bullet points for clarity
   - Use numbered lists for processes, historical events, or sequential information
   - ALWAYS include complete factual context including dates, names, places, and specific numbers
   - Prioritize depth over breadth - provide rich detail about specific aspects
   
4. Include a "Key Terms" section with comprehensive definitions explaining nuances and variations:
   - Format as: # 📚 KEY TERMS
   - List each term as: **Term**: Definition that explains nuances and variations

5. Format for maximum clarity and information density:
   - **Bold text** for important concepts and terms
   - *Italic text* for emphasis or specialized terminology
   - Well-structured comparative tables when appropriate:
     | Category | Properties | Applications | Limitations | Future Directions |
     |----------|------------|--------------|-------------|-------------------|
     | Type A   | Properties | Applications | Limitations | Future Directions |
     | Type B   | Properties | Applications | Limitations | Future Directions |

6. ALWAYS include this section addressing competing viewpoints:
   - Format as: # ⚔️ CONTROVERSIES AND DEBATES

10. Include inline citations of your sources using numbers in brackets [1], [2], etc. throughout the text

Maintain a factual, authoritative tone throughout. Provide elaborate explanations with specific details, examples, evidence, and quantitative data wherever possible. Ensure each section has at least 3-4 paragraphs with comprehensive information.

DO NOT include the words "response:" or any JSON formatting in your answer.
DO NOT use triple backticks or code blocks in your answer.

IMPORTANT RESTRICTIONS TO AVOID RECITATION ERRORS:
- DO NOT copy text directly from sources - paraphrase and synthesize information in your own words
- DO NOT quote directly from any sources
- DO NOT use block quotes or extended quotations
- ALWAYS transform information through your own analysis
- Vary your sentence structures and vocabulary
- Use your own phrasing rather than repeating source material
`;

  // Create the follow-up questions prompt
  const questionsPrompt = `
Based on the user query: "${query}"

Generate 5-7 high-quality, insightful follow-up questions for deeper exploration of this topic.
These questions should:
1. Be diverse, covering different aspects or applications of the topic
2. Be specific and detailed enough to prompt in-depth analysis
3. Include at least one comparison question (e.g., "How does X compare to Y?")
4. Include at least one question about practical applications or real-world relevance
5. Include at least one question about historical context, future developments, or controversies
6. Include at least one question about theoretical frameworks or models
7. Include at least one question about specific case studies or examples

Format each question precisely without numbers or prefixes - just the plain question text.
Make each question substantive and thoughtful (15-20 words is ideal).
Questions should require detailed answers rich with factual information.

Return exactly 6 questions, one per line, without any additional text.
`;

  try {
    // If Google Search API key is available, fetch sources
    let sources: { title: string; link: string; snippet: string }[] = [];
    let sourceContext = '';
    
    if (googleSearchApiKey && googleSearchEngineId) {
      thinkingProcess += `→ Searching for reliable sources on "${query}"\n`;
      try {
        // First, search for the main query
        const mainSearchResults = await fetchGoogleSearchResults(query, googleSearchApiKey, googleSearchEngineId);
        
        // Extract key topics to search for more specialized information
        const topicWords = query.split(' ')
          .filter(word => word.length > 4)  // Only use meaningful words
          .slice(0, 3);                     // Take up to 3 key terms
        
        let allSources: GoogleSearchResult[] = [];
        
        // Add main query results
        if (mainSearchResults.items && mainSearchResults.items.length > 0) {
          allSources = [...mainSearchResults.items];
          thinkingProcess += `→ Found ${mainSearchResults.items.length} sources for main query\n`;
          
          // For each key topic, do an additional specialized search
          for (const topic of topicWords) {
            const specializedQuery = `${topic} ${query.includes(topic) ? '' : query}`;
            const specializedResults = await fetchGoogleSearchResults(
              specializedQuery, 
              googleSearchApiKey, 
              googleSearchEngineId
            );
            
            if (specializedResults.items && specializedResults.items.length > 0) {
              // Add new unique sources based on URL
              const newSources = specializedResults.items.filter(
                item => !allSources.some(existing => existing.link === item.link)
              );
              
              allSources = [...allSources, ...newSources];
              thinkingProcess += `→ Found ${newSources.length} additional sources for "${topic}"\n`;
            }
          }
        }
        
        // Prioritize and format the sources (up to 12)
        if (allSources.length > 0) {
          // Add domain information to each source for filtering
          allSources = allSources.map(item => {
            try {
              const url = new URL(item.link);
              return {...item, domain: url.hostname};
            } catch (e) {
              return {...item, domain: ""};
            }
          });
          
          // Filter out low-quality sources and prioritize educational/authoritative domains
          const highQualitySources = allSources.filter(item => {
            const domain = item.domain || "";
            // Prioritize educational, government, and reputable domains
            return domain.endsWith('.edu') || 
                  domain.endsWith('.gov') || 
                  domain.includes('wikipedia.org') ||
                  domain.includes('nature.com') ||
                  domain.includes('science.org') ||
                  domain.includes('nih.gov') ||
                  domain.includes('research') ||
                  domain.includes('journal');
          });
          
          // Combine high-quality sources first, then add others to reach up to 12
          const prioritizedSources = [
            ...highQualitySources,
            ...allSources.filter(item => !highQualitySources.some(s => s.link === item.link))
          ].slice(0, 12);
          
          sources = prioritizedSources.map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet
          }));
          
          thinkingProcess += `→ Selected ${sources.length} high-quality sources for research synthesis\n`;
          
          // Create source context for Gemini prompt
          sourceContext = `\nHere are reliable sources about this topic:\n\n`;
          sources.forEach((source, index) => {
            sourceContext += `[${index + 1}] ${source.title}\n${source.link}\n${source.snippet}\n\n`;
          });
          
          // Append information about citation format to contentPrompt
          sourceContext += `\nVery important instructions about sources and citations:

1. For each main section in your response, after the section's content but before the next section heading, include a "Sources for this section:" subsection with 2-3 relevant links from the provided sources.

2. Format each source as a small bullet list with the title as a link, like this:
   • [Title of Source 1](link1)
   • [Title of Source 2](link2)

3. Throughout your text, use inline citations [1], [2], etc. as you mention facts.

4. Do NOT include a consolidated "Sources" section at the end of the entire response.

5. Make sure every major section has its own "Sources for this section:" subsection with appropriate links.

6. CRITICAL: ALWAYS paraphrase and synthesize information from sources in your own words.
   • DO NOT copy text directly from sources - this causes recitation errors
   • DO NOT quote directly from any sources
   • ALWAYS transform information through your own analysis with different phrasing
   • Use different sentence structures and vocabulary than the original sources

This source formatting and paraphrasing approach is extremely important - please follow it precisely.\n`;
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
    
    // Make sure we have at least some questions
    if (followUpQuestions.length === 0) {
      followUpQuestions = generateDefaultFollowUps(query);
    }
    
    thinkingProcess += `→ Finalizing beautifully formatted response\n`;
    
    // Append the follow-up questions section to the content
    const contentWithQuestions = `${formattedContent}\n\n## ❓ Follow-up Questions\n\n${followUpQuestions.map((q, i) => `${i+1}. ${q}`).join('\n\n')}`;
    
    return {
      content: contentWithQuestions,
      thinkingProcess,
      followUpQuestions: followUpQuestions,
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
 * Fetches search results from Google Custom Search API
 */
async function fetchGoogleSearchResults(
  query: string,
  apiKey: string,
  searchEngineId: string
): Promise<GoogleSearchResponse> {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Google Search API error:", error);
    return { items: [] };
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
 * Extract citations from response
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
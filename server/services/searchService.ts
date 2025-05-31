import fetch from 'node-fetch';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface Citation {
  title: string;
  link: string;
}

/**
 * Creates a topic-specific search query based on the original query
 * @param query The original user query
 * @returns Enhanced search query for better results
 */
export function enhanceSearchQuery(query: string): string {
  // Convert query to lowercase for better matching
  const queryLower = query.toLowerCase();
  
  // Extract key phrases that are most likely the core topic
  // This helps ensure search results remain relevant to the actual query
  const keywords = extractCoreKeywords(queryLower);
  
  // Check if query is asking about current news or events
  const isCurrentNews = 
    queryLower.includes('current') || 
    queryLower.includes('latest') || 
    queryLower.includes('recent') ||
    queryLower.includes('today') ||
    queryLower.includes('news') ||
    queryLower.includes('happening now') ||
    queryLower.includes('this year') ||
    queryLower.includes('this month') ||
    queryLower.includes('this week') ||
    queryLower.includes('may 17') ||  // Add dates as news indicators
    queryLower.includes('may 18') ||
    queryLower.includes('2025');
  
  // If asking about current news, prioritize recency and relevance over scholarly sources
  if (isCurrentNews) {
    console.log("Current news query detected, optimizing for recency");
    
    // Define news sources to include to avoid academic/ML results
    const newsSources = "reuters CNN BBC bloomberg NYTimes washingtonpost AP news";
    
    // For dates specifically, ensure we get actual news
    if (queryLower.includes('may 17') || queryLower.includes('may 18') || queryLower.includes('2025')) {
      return `${keywords} ${getTimeframe(queryLower)} news headlines ${newsSources} -ML -MIT -IEEE -academic`;
    }
    
    return `${keywords} ${getTimeframe(queryLower)} news articles ${newsSources} -academia -research -ML`;
  }
  
  // Define topic detection patterns - more precise matching to avoid irrelevant categorization
  const topicPatterns: Record<string, string[]> = {
    politics: ['politic', 'government', 'election', 'democracy', 'parliament', 'president', 'minister'],
    international_relations: ['international', 'diplomatic', 'relations', 'foreign policy', 'sanctions'],
    conflict: ['conflict', 'war', 'tension', 'military', 'army', 'border', 'dispute', 'crisis'],
    history: ['history', 'historical', 'ancient', 'century', 'period', 'era', 'timeline'],
    technology: ['technology', 'tech', 'digital', 'computer', 'internet', 'ai', 'robot', 'software'],
    science: ['science', 'scientific', 'research', 'study', 'experiment', 'discovery'],
    health: ['health', 'medical', 'disease', 'medicine', 'doctor', 'hospital', 'patient'],
    environment: ['environment', 'climate', 'pollution', 'ecosystem', 'sustainable', 'green'],
    economics: ['economy', 'economic', 'finance', 'market', 'trade', 'business', 'inflation'],
    social: ['social', 'society', 'community', 'cultural', 'people', 'demographic'],
    education: ['education', 'school', 'university', 'learn', 'student', 'teach', 'academic'],
    sports: ['sport', 'game', 'player', 'team', 'championship', 'tournament', 'athlete'],
    entertainment: ['entertainment', 'movie', 'film', 'music', 'artist', 'celebrity', 'media'],
    india_pakistan: ['india', 'pakistan', 'kashmir', 'south asia', 'border', 'modi', 'partition']
  };
  
  // Detect countries or regions mentioned in query
  const countries = [
    'india', 'pakistan', 'china', 'united states', 'usa', 'russia', 'ukraine', 
    'europe', 'middle east', 'africa', 'asia', 'america', 'japan', 'korea',
    'australia', 'canada', 'brazil', 'mexico', 'france', 'germany', 'uk', 'britain'
  ];
  
  const mentionedCountries = countries.filter(country => 
    queryLower.includes(country)
  );
  
  // Detect topics in the query - only count as a match if the keyword is a substantial part of the query
  const detectedTopics: string[] = [];
  Object.entries(topicPatterns).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => isSubstantialKeyword(queryLower, keyword))) {
      detectedTopics.push(topic);
    }
  });
  
  console.log(`Detected topics: ${detectedTopics.join(', ')}`);
  console.log(`Mentioned countries: ${mentionedCountries.join(', ')}`);
  console.log(`Core keywords: ${keywords}`);
  
  // Special case for India-Pakistan relations
  if (
    (mentionedCountries.includes('india') && mentionedCountries.includes('pakistan')) ||
    queryLower.includes('kashmir')
  ) {
    if (detectedTopics.includes('conflict') || 
        queryLower.includes('conflict') || 
        queryLower.includes('tension') || 
        queryLower.includes('war')) {
      return `${keywords} india pakistan conflict border dispute analysis sources`;
    } else if (detectedTopics.includes('history') || queryLower.includes('history')) {
      return `${keywords} india pakistan partition history sources`;
    } else if (queryLower.includes('nuclear')) {
      return `${keywords} india pakistan nuclear weapons deterrence analysis`;
    } else {
      return `${keywords} india pakistan diplomatic relations analysis`;
    }
  }
  
  // Create enhanced queries for each topic type - only add minimal topic terms to preserve relevance
  if (detectedTopics.includes('conflict')) {
    return `${keywords} ${mentionedCountries.join(' ')} conflict analysis`;
  } else if (detectedTopics.includes('politics')) {
    return `${keywords} ${mentionedCountries.join(' ')} political analysis`;
  } else if (detectedTopics.includes('history')) {
    return `${keywords} ${mentionedCountries.join(' ')} historical analysis`;
  } else if (detectedTopics.includes('technology')) {
    return `${keywords} technology analysis`;
  } else if (detectedTopics.includes('science')) {
    return `${keywords} scientific research`;
  } else if (detectedTopics.includes('health')) {
    return `${keywords} medical journal`;
  } else if (detectedTopics.includes('economics')) {
    return `${keywords} economic analysis`;
  }
  
  // Default enhancement - stay close to original query for relevance
  if (mentionedCountries.length > 0) {
    return `${keywords} ${mentionedCountries.join(' ')} analysis`;
  }
  
  // Just add minimal terms to keep search results highly relevant to the query
  return `${keywords} analysis sources`;
}

/**
 * Extracts the core keywords from a query, focusing on meaningful terms
 * @param query The user query in lowercase
 * @returns String with core keywords
 */
function extractCoreKeywords(query: string): string {
  // Strip out common filler words and question words that don't add meaning
  const fillerWords = [
    'what', 'who', 'where', 'when', 'why', 'how', 'is', 'are', 'was', 'were',
    'the', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'of', 'by', 'with',
    'can', 'could', 'would', 'should', 'will', 'about', 'please', 'tell',
    'me', 'know', 'explain', 'describe', 'information', 'facts'
  ];
  
  // Split into words, filter out filler words, and rejoin
  let keywords = query
    .split(/\s+/)
    .filter(word => !fillerWords.includes(word) && word.length > 2)
    .join(' ');
  
  // If we filtered too much, just use the original query
  if (keywords.length < 5) {
    keywords = query;
  }
  
  return keywords;
}

/**
 * Checks if a keyword is a substantial part of the query, not just a passing mention
 * @param query The full query in lowercase
 * @param keyword The keyword to check
 * @returns Boolean indicating if keyword is substantial
 */
function isSubstantialKeyword(query: string, keyword: string): boolean {
  // Simple check - is the keyword a significant portion of the query
  // Either it's surrounded by spaces or punctuation, or it's at the start/end
  return query.includes(keyword) && (
    query.includes(` ${keyword} `) ||
    query.startsWith(`${keyword} `) || 
    query.endsWith(` ${keyword}`) ||
    query.includes(`. ${keyword}`) ||
    query.includes(`? ${keyword}`) ||
    query.includes(`! ${keyword}`) ||
    query.includes(`: ${keyword}`) ||
    query.includes(`; ${keyword}`)
  );
}

/**
 * Determines appropriate timeframe terms for news queries
 * @param query The user query in lowercase
 * @returns String with appropriate time-related terms
 */
function getTimeframe(query: string): string {
  if (query.includes('today') || query.includes('now')) {
    return 'today latest current';
  } else if (query.includes('this week')) {
    return 'this week latest';
  } else if (query.includes('this month')) {
    return 'this month recent';
  } else if (query.includes('this year')) {
    return 'this year';
  }
  return 'recent current';
}

/**
 * Performs a Google search using the Custom Search JSON API
 * Now with intelligent topic detection and query enhancement for relevant results
 * @param query The search query
 * @returns Array of search results with title, link, and snippet
 */
export async function performGoogleSearch(query: string): Promise<SearchResult[]> {
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  
  if (!searchEngineId || !apiKey) {
    console.error("Google Search API credentials not configured");
    return [];
  }
  
  // Enhance the query with topic-specific terms for better results
  const enhancedQuery = enhanceSearchQuery(query);
  console.log(`Enhanced search query: "${enhancedQuery}"`);
  
  // Set to maximum allowed by Google Custom Search API (10 results)
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(enhancedQuery)}&num=10`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.log("No search results found");
      return [];
    }
    
    const results = data.items.map((item: any) => ({
      title: item.title,
      link: item.link, 
      snippet: item.snippet || "No snippet available"
    }));
    
    console.log(`Found ${results.length} relevant sources for query: "${query}"`);
    return results;
  } catch (error) {
    console.error("Google Search API error:", error);
    return [];
  }
}

/**
 * Determines if a query is factual (knowledge-seeking) vs conversational/emotional
 * @param query The user query
 * @returns Boolean indicating if the query is factual
 */
export function isFactualQuery(query: string): boolean {
  // Simple heuristic approach
  const factualIndicators = [
    /^what is/i, /^how (do|does|to)/i, /^who is/i, /^where is/i, 
    /^when (did|was|is)/i, /^why (do|does|did)/i, /facts about/i,
    /history of/i, /definition of/i, /meaning of/i, /explain/i,
    /difference between/i, /compare/i, /examples of/i
  ];
  
  // Check if the query matches any factual indicator
  return factualIndicators.some(pattern => pattern.test(query));
}

/**
 * Formats a response with citations to search results
 * @param content The main content of the response
 * @param sources The search results used as sources
 * @returns Formatted response with citations
 */
export function formatResponseWithCitations(content: string, sources: SearchResult[]): string {
  // If no sources, return content as is
  if (!sources || sources.length === 0) {
    return content;
  }
  
  // Add sources section at the end
  let response = content;
  
  // Add a separator if the content doesn't end with one
  if (!response.endsWith("\n\n")) {
    response += "\n\n";
  }
  
  response += "Sources:\n";
  sources.slice(0, 3).forEach((source, index) => {
    response += `[${index + 1}] ${source.title} - ${source.link}\n`;
  });
  
  return response;
}

/**
 * Combines information from search results to create a comprehensive response
 * @param query The original user query
 * @param results The search results
 * @returns Synthesized information from search results
 */
export function synthesizeFromSearchResults(query: string, results: SearchResult[]): string {
  if (!results || results.length === 0) {
    return "I couldn't find relevant information about that topic.";
  }
  
  // Extract the most relevant snippets
  const relevantSnippets = results.slice(0, 3).map(result => result.snippet);
  
  // Combine snippets into a coherent response
  // In a real implementation, you might use a more sophisticated approach
  // but for simplicity, we'll just combine the snippets with some transitions
  let synthesizedResponse = `Based on search results, `;
  
  // Add first snippet
  synthesizedResponse += relevantSnippets[0];
  
  // Add additional snippets with transitions
  if (relevantSnippets.length > 1) {
    synthesizedResponse += `\n\nFurthermore, ${relevantSnippets[1]}`;
  }
  
  if (relevantSnippets.length > 2) {
    synthesizedResponse += `\n\nAdditionally, ${relevantSnippets[2]}`;
  }
  
  return synthesizedResponse;
}
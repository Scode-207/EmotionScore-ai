/**
 * Visualization utilities for generating ASCII art and text-based diagrams
 * These functions help EmotionScore AI create visual representations in the chat
 */

/**
 * Function to detect if a user's message is requesting a visualization or diagram
 * 
 * @param query User's message text
 * @returns boolean indicating if the user likely wants a visualization
 */
export function isVisualizationRequest(query: string): boolean {
  // Keywords that suggest the user wants a visualization
  const visualizationKeywords = [
    "visualize", "diagram", "chart", "graph", "map", "draw", "plot", 
    "flowchart", "architecture", "structure", "illustration", "visual", 
    "picture", "display", "show me", "sketch", "layout", "wireframe", 
    "blueprint", "mind map", "concept map", "visual representation",
    "ascii art", "text diagram", "schema", "mock", "ui", "interface"
  ];
  
  const lowerQuery = query.toLowerCase();
  return visualizationKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Generate visualization prompt enhancement based on the user's query
 * This helps guide the AI to create appropriate text-based visualizations
 * 
 * @param query User's message text
 * @returns A prompt enhancement to guide the AI in creating a visualization
 */
export function generateVisualizationPrompt(query: string): string {
  // Extract what the user wants to visualize
  const lowerQuery = query.toLowerCase();
  
  // Check for specific visualization types
  let visualizationType = "";
  
  if (lowerQuery.includes("flowchart") || lowerQuery.includes("flow chart") || lowerQuery.includes("process")) {
    visualizationType = "a flowchart showing process steps and decision points";
  } else if (lowerQuery.includes("architecture") || lowerQuery.includes("system design") || lowerQuery.includes("structure")) {
    visualizationType = "a system architecture diagram showing components and their relationships";
  } else if (lowerQuery.includes("mind map") || lowerQuery.includes("concept map") || lowerQuery.includes("idea map")) {
    visualizationType = "a concept map showing related ideas and their connections";
  } else if (lowerQuery.includes("hierarchy") || lowerQuery.includes("tree") || lowerQuery.includes("organization")) {
    visualizationType = "a hierarchical structure showing parent-child relationships";
  } else if (lowerQuery.includes("comparison") || lowerQuery.includes("versus") || lowerQuery.includes("vs")) {
    visualizationType = "a comparison diagram showing similarities and differences";
  } else if (lowerQuery.includes("timeline") || lowerQuery.includes("sequence") || lowerQuery.includes("steps")) {
    visualizationType = "a timeline or sequence diagram showing progression";
  } else if (lowerQuery.includes("ui") || lowerQuery.includes("interface") || lowerQuery.includes("screen")) {
    visualizationType = "a user interface wireframe showing layout and components";
  } else {
    // Generic visualization if no specific type detected
    visualizationType = "a visual representation using ASCII/text characters";
  }

  return `
I've detected that you're asking for a visualization. I'll create ${visualizationType} using ASCII/text characters.

To create the visualization, I'll use:
- Box-drawing characters (┌ ┐ └ ┘ ─ │ ┼) for structure
- Arrows (► ◄ ▼ ▲) to show flow and relationships  
- Symbols like ⬤ ■ ● ○ □ for nodes or elements

The visualization will be presented inside a code block for proper formatting.
`;
}
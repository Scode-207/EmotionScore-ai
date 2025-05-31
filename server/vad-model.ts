// VAD (Valence-Arousal-Dominance) Model for Emotion Analysis

/**
 * The VAD model represents emotions in three dimensions:
 * - Valence: positive vs. negative (pleasure-displeasure)
 * - Arousal: active vs. passive (intensity)
 * - Dominance: dominant vs. submissive (control)
 */

export interface VADScore {
  valence: number;  // Range: -1.0 (negative) to 1.0 (positive)
  arousal: number;  // Range: -1.0 (passive) to 1.0 (active)
  dominance: number; // Range: -1.0 (submissive) to 1.0 (dominant)
  primaryEmotion: string;
  secondaryEmotion?: string;
  confidence?: number; // 0.0 to 1.0 indicating confidence in analysis
}

// Define a map of primary emotions based on VAD values with expanded range overlaps
const emotionMap: {[key: string]: {vRange: [number, number], aRange: [number, number], dRange: [number, number], weight: number}} = {
  "joy": { vRange: [0.3, 1.0], aRange: [0.3, 1.0], dRange: [0.0, 1.0], weight: 1.0 },
  "excitement": { vRange: [0.3, 1.0], aRange: [0.6, 1.0], dRange: [0.4, 1.0], weight: 0.9 },
  "contentment": { vRange: [0.3, 1.0], aRange: [-0.3, 0.3], dRange: [0.0, 1.0], weight: 0.8 },
  "anger": { vRange: [-1.0, -0.3], aRange: [0.3, 1.0], dRange: [0.4, 1.0], weight: 1.0 },
  "fear": { vRange: [-1.0, -0.3], aRange: [0.3, 1.0], dRange: [-1.0, -0.3], weight: 0.9 },
  "sadness": { vRange: [-1.0, -0.3], aRange: [-1.0, -0.1], dRange: [-1.0, 0.0], weight: 1.0 },
  "disgust": { vRange: [-1.0, -0.5], aRange: [0.0, 0.5], dRange: [0.0, 0.5], weight: 0.8 },
  "surprise": { vRange: [-0.3, 0.3], aRange: [0.5, 1.0], dRange: [-0.3, 0.3], weight: 0.8 },
  "anxiety": { vRange: [-0.5, -0.1], aRange: [0.3, 0.8], dRange: [-0.5, 0.0], weight: 0.8 },
  "boredom": { vRange: [-0.4, 0.0], aRange: [-0.8, -0.3], dRange: [-0.3, 0.3], weight: 0.7 },
  "calm": { vRange: [0.1, 0.5], aRange: [-0.8, -0.3], dRange: [0.0, 0.5], weight: 0.8 },
  "confusion": { vRange: [-0.3, 0.1], aRange: [0.0, 0.5], dRange: [-0.5, 0.0], weight: 0.7 },
  "contemplation": { vRange: [-0.1, 0.3], aRange: [-0.5, 0.1], dRange: [0.0, 0.5], weight: 0.7 },
  "curiosity": { vRange: [0.1, 0.5], aRange: [0.1, 0.5], dRange: [0.1, 0.5], weight: 0.7 },
  "empathy": { vRange: [-0.1, 0.3], aRange: [-0.1, 0.3], dRange: [-0.1, 0.3], weight: 0.7 },
  "frustration": { vRange: [-0.7, -0.3], aRange: [0.3, 0.7], dRange: [-0.3, 0.5], weight: 0.8 },
  "gratitude": { vRange: [0.5, 0.9], aRange: [0.0, 0.4], dRange: [0.0, 0.5], weight: 0.8 },
  "hope": { vRange: [0.3, 0.8], aRange: [0.1, 0.5], dRange: [0.1, 0.6], weight: 0.7 },
  "interest": { vRange: [0.2, 0.7], aRange: [0.2, 0.7], dRange: [0.0, 0.5], weight: 0.7 },
  "pride": { vRange: [0.5, 0.9], aRange: [0.3, 0.7], dRange: [0.5, 1.0], weight: 0.8 },
  "regret": { vRange: [-0.7, -0.3], aRange: [-0.3, 0.2], dRange: [-0.6, -0.1], weight: 0.7 },
  "shame": { vRange: [-0.8, -0.4], aRange: [-0.2, 0.3], dRange: [-0.9, -0.4], weight: 0.8 },
};

// Simple linguistic patterns that indicate emotional content - improved patterns with context awareness
const emotionalPatterns: {[key: string]: {valence: number, arousal: number, dominance: number, weight: number}} = {
  // Positive high arousal
  "\\bexcit(ed|ing|ement)\\b": { valence: 0.8, arousal: 0.9, dominance: 0.7, weight: 0.9 },
  "\\bthrilled?\\b": { valence: 0.9, arousal: 0.9, dominance: 0.6, weight: 0.9 },
  "\\becstat(ic|ically)\\b": { valence: 1.0, arousal: 1.0, dominance: 0.7, weight: 1.0 },
  "\\blov(e|ing|ed)\\b": { valence: 0.9, arousal: 0.7, dominance: 0.5, weight: 0.9 },
  "\\bhapp(y|iness|ily)\\b": { valence: 0.8, arousal: 0.6, dominance: 0.6, weight: 0.9 },
  "\\bjoy(ful|ous|fully)?\\b": { valence: 0.9, arousal: 0.7, dominance: 0.6, weight: 0.9 },
  "\\bgreat\\b": { valence: 0.8, arousal: 0.6, dominance: 0.6, weight: 0.8 },
  "\\bamazing\\b": { valence: 0.9, arousal: 0.7, dominance: 0.6, weight: 0.9 },
  "\\bwonderful\\b": { valence: 0.9, arousal: 0.6, dominance: 0.5, weight: 0.9 },
  "\\bawesome\\b": { valence: 0.9, arousal: 0.8, dominance: 0.7, weight: 0.9 },
  "\\bfantastic\\b": { valence: 0.9, arousal: 0.7, dominance: 0.6, weight: 0.9 },
  "\\bdelighted?\\b": { valence: 0.8, arousal: 0.7, dominance: 0.6, weight: 0.8 },
  "\\bexcellent\\b": { valence: 0.8, arousal: 0.5, dominance: 0.6, weight: 0.8 },
  
  // Positive low arousal
  "\\bcalm(ly|ing|ed)?\\b": { valence: 0.6, arousal: -0.5, dominance: 0.4, weight: 0.8 },
  "\\brelax(ed|ing)?\\b": { valence: 0.7, arousal: -0.6, dominance: 0.5, weight: 0.8 },
  "\\bcontent(ed|ment)?\\b": { valence: 0.7, arousal: -0.3, dominance: 0.5, weight: 0.8 },
  "\\bsatisf(ied|ying|action)\\b": { valence: 0.7, arousal: 0.2, dominance: 0.6, weight: 0.8 },
  "\\bpeac(e|eful)\\b": { valence: 0.8, arousal: -0.7, dominance: 0.5, weight: 0.8 },
  "\\brelieved\\b": { valence: 0.6, arousal: -0.2, dominance: 0.4, weight: 0.7 },
  "\\bcomfortable\\b": { valence: 0.6, arousal: -0.3, dominance: 0.5, weight: 0.7 },
  "\\bserene\\b": { valence: 0.7, arousal: -0.7, dominance: 0.4, weight: 0.7 },
  
  // Negative high arousal
  "\\banger(ed|ing|ly)?\\b": { valence: -0.8, arousal: 0.9, dominance: 0.8, weight: 0.9 },
  "\\bangr(y|ily)\\b": { valence: -0.8, arousal: 0.8, dominance: 0.7, weight: 0.9 },
  "\\bfurious(ly)?\\b": { valence: -0.9, arousal: 0.9, dominance: 0.8, weight: 1.0 },
  "\\brage\\b": { valence: -1.0, arousal: 1.0, dominance: 0.9, weight: 1.0 },
  "\\bscar(ed|y|ing)\\b": { valence: -0.8, arousal: 0.8, dominance: -0.7, weight: 0.9 },
  "\\bterrif(ied|ying)\\b": { valence: -0.9, arousal: 0.9, dominance: -0.8, weight: 0.9 },
  "\\bafraid\\b": { valence: -0.7, arousal: 0.7, dominance: -0.6, weight: 0.8 },
  "\\bfear(ful|fully)?\\b": { valence: -0.8, arousal: 0.8, dominance: -0.7, weight: 0.9 },
  "\\banxious(ly)?\\b": { valence: -0.6, arousal: 0.7, dominance: -0.5, weight: 0.8 },
  "\\bpanic(k(y|ing|ed))?\\b": { valence: -0.9, arousal: 0.9, dominance: -0.8, weight: 0.9 },
  "\\bstress(ed|ful)?\\b": { valence: -0.7, arousal: 0.7, dominance: -0.5, weight: 0.8 },
  "\\bupset\\b": { valence: -0.7, arousal: 0.6, dominance: -0.4, weight: 0.8 },
  "\\birritated?\\b": { valence: -0.6, arousal: 0.6, dominance: 0.0, weight: 0.7 },
  "\\bdesperate\\b": { valence: -0.8, arousal: 0.7, dominance: -0.7, weight: 0.8 },
  "\\bhorri(ble|fied|fying)\\b": { valence: -0.9, arousal: 0.7, dominance: -0.6, weight: 0.9 },
  
  // Negative low arousal
  "\\bsad(ly|ness)?\\b": { valence: -0.7, arousal: -0.4, dominance: -0.4, weight: 0.9 },
  "\\bdepress(ed|ing|ion)\\b": { valence: -0.9, arousal: -0.7, dominance: -0.8, weight: 0.9 },
  "\\bdespair\\b": { valence: -0.9, arousal: -0.5, dominance: -0.8, weight: 0.9 },
  "\\bhopeless(ness)?\\b": { valence: -0.8, arousal: -0.6, dominance: -0.9, weight: 0.9 },
  "\\blonely\\b": { valence: -0.7, arousal: -0.5, dominance: -0.5, weight: 0.8 },
  "\\bmiserable\\b": { valence: -0.8, arousal: -0.4, dominance: -0.7, weight: 0.9 },
  "\\bbor(ed|ing|edom)\\b": { valence: -0.5, arousal: -0.7, dominance: -0.3, weight: 0.7 },
  "\\btir(ed|ing)\\b": { valence: -0.5, arousal: -0.8, dominance: -0.4, weight: 0.7 },
  "\\bexhaust(ed|ing|ion)\\b": { valence: -0.6, arousal: -0.8, dominance: -0.5, weight: 0.8 },
  "\\bdisappoint(ed|ing|ment)\\b": { valence: -0.7, arousal: -0.2, dominance: -0.4, weight: 0.8 },
  "\\bnumb\\b": { valence: -0.5, arousal: -0.7, dominance: -0.5, weight: 0.7 },
  "\\bguilty?\\b": { valence: -0.7, arousal: -0.1, dominance: -0.6, weight: 0.8 },
  
  // Confusion/uncertainty
  "\\bconfus(ed|ing|ion)\\b": { valence: -0.3, arousal: 0.3, dominance: -0.4, weight: 0.7 },
  "\\buncertain(ty)?\\b": { valence: -0.4, arousal: 0.2, dominance: -0.5, weight: 0.7 },
  "\\bpuzzl(ed|ing)\\b": { valence: -0.2, arousal: 0.3, dominance: -0.3, weight: 0.6 },
  "\\bdoubt(ful|ing)?\\b": { valence: -0.5, arousal: 0.1, dominance: -0.5, weight: 0.7 },
  "\\bconfused\\b": { valence: -0.3, arousal: 0.3, dominance: -0.4, weight: 0.7 },
  "\\bunsure\\b": { valence: -0.3, arousal: 0.2, dominance: -0.5, weight: 0.7 },
  "\\bdon'?t know\\b": { valence: -0.2, arousal: 0.1, dominance: -0.4, weight: 0.6 },
  "\\bnot sure\\b": { valence: -0.2, arousal: 0.1, dominance: -0.3, weight: 0.6 },
  
  // Interest/curiosity
  "\\binterest(ed|ing)?\\b": { valence: 0.6, arousal: 0.5, dominance: 0.3, weight: 0.7 },
  "\\bcurious\\b": { valence: 0.5, arousal: 0.5, dominance: 0.2, weight: 0.7 },
  "\\bfascinat(ed|ing)\\b": { valence: 0.7, arousal: 0.6, dominance: 0.3, weight: 0.8 },
  "\\bintrigu(ed|ing)\\b": { valence: 0.6, arousal: 0.5, dominance: 0.2, weight: 0.7 },
  "\\bcaptivated\\b": { valence: 0.7, arousal: 0.6, dominance: 0.3, weight: 0.7 },
  "\\bengaged\\b": { valence: 0.6, arousal: 0.5, dominance: 0.4, weight: 0.7 },
  
  // Additional sentiment indicators - context sensitive patterns
  "\\bwonderful_extra\\b": { valence: 0.9, arousal: 0.5, dominance: 0.5, weight: 0.9 },
  "\\bawful\\b": { valence: -0.8, arousal: 0.3, dominance: -0.4, weight: 0.9 },
  "\\bterrible_extra\\b": { valence: -0.8, arousal: 0.4, dominance: -0.5, weight: 0.9 },
  "\\bamazing_extra\\b": { valence: 0.9, arousal: 0.7, dominance: 0.6, weight: 0.9 },
  "\\bdisappointing\\b": { valence: -0.7, arousal: 0.1, dominance: -0.3, weight: 0.8 },
  "\\bgrateful\\b": { valence: 0.8, arousal: 0.2, dominance: 0.4, weight: 0.8 },
  "\\bthankful\\b": { valence: 0.8, arousal: 0.3, dominance: 0.4, weight: 0.8 },
  "\\bfrustrat(ed|ing)\\b": { valence: -0.7, arousal: 0.6, dominance: -0.2, weight: 0.8 },
  "\\bannoy(ed|ing)\\b": { valence: -0.6, arousal: 0.5, dominance: 0.1, weight: 0.7 },
  "\\bworried\\b": { valence: -0.6, arousal: 0.5, dominance: -0.3, weight: 0.7 },
  "\\bexcited_extra\\b": { valence: 0.8, arousal: 0.8, dominance: 0.5, weight: 0.9 },
  "\\bgood\\b": { valence: 0.7, arousal: 0.3, dominance: 0.5, weight: 0.7 },
  "\\bgreat_extra\\b": { valence: 0.8, arousal: 0.5, dominance: 0.6, weight: 0.8 },
  "\\bbad\\b": { valence: -0.7, arousal: 0.3, dominance: -0.2, weight: 0.7 },
  "\\bhorrible\\b": { valence: -0.9, arousal: 0.5, dominance: -0.6, weight: 0.9 },
  "\\bperfect\\b": { valence: 0.9, arousal: 0.5, dominance: 0.7, weight: 0.9 },
  "\\bpleasant\\b": { valence: 0.7, arousal: 0.2, dominance: 0.5, weight: 0.7 },
  
  // Common messages/greetings
  "\\bhello\\b": { valence: 0.5, arousal: 0.3, dominance: 0.4, weight: 0.6 },
  "\\bhi\\b": { valence: 0.5, arousal: 0.3, dominance: 0.4, weight: 0.6 },
  "\\bhey\\b": { valence: 0.5, arousal: 0.4, dominance: 0.4, weight: 0.6 },
  "\\bthanks?\\b": { valence: 0.7, arousal: 0.3, dominance: 0.4, weight: 0.7 },
  "\\bthank you\\b": { valence: 0.8, arousal: 0.3, dominance: 0.4, weight: 0.8 },
  "\\bsorry\\b": { valence: -0.3, arousal: 0.1, dominance: -0.3, weight: 0.6 },
  "\\bplease\\b": { valence: 0.3, arousal: 0.2, dominance: 0.0, weight: 0.5 },
  "\\bhow are you\\b": { valence: 0.3, arousal: 0.2, dominance: 0.1, weight: 0.5 },
  "\\bhelp\\b": { valence: -0.2, arousal: 0.3, dominance: -0.3, weight: 0.5 },
  
  // Modifiers and negations
  "\\bnot\\b": { valence: -1.0, arousal: 0.1, dominance: 0.1, weight: 0.2 }, // This is handled specially
  "\\bvery\\b": { valence: 0.2, arousal: 0.2, dominance: 0.1, weight: 0.2 },
  "\\breally\\b": { valence: 0.2, arousal: 0.2, dominance: 0.1, weight: 0.2 },
  "\\bextremely\\b": { valence: 0.3, arousal: 0.3, dominance: 0.2, weight: 0.3 },
  "\\bslightly\\b": { valence: -0.2, arousal: -0.2, dominance: -0.1, weight: 0.2 },
  "\\bsomewhat\\b": { valence: -0.1, arousal: -0.1, dominance: -0.1, weight: 0.1 },
  
  // Special punctuation patterns
  "!!+": { valence: 0.3, arousal: 0.8, dominance: 0.4, weight: 0.7 }, // Multiple exclamation marks
  "\\?\\?+": { valence: -0.1, arousal: 0.6, dominance: -0.3, weight: 0.6 }, // Multiple question marks
  "\\.\\.\\.": { valence: -0.2, arousal: -0.3, dominance: -0.2, weight: 0.4 }, // Ellipsis
};

// List of negations to check for
const negations = [
  "not", "no", "never", "neither", "nor", "nothing", "nobody", "nowhere", 
  "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "cannot", 
  "couldn't", "shouldn't", "isn't", "aren't", "wasn't", "weren't"
];

// Emojis and emoticons map
const emojiMap: {[key: string]: {valence: number, arousal: number, dominance: number, weight: number}} = {
  ":)": { valence: 0.7, arousal: 0.3, dominance: 0.4, weight: 0.7 },
  ":-)": { valence: 0.7, arousal: 0.3, dominance: 0.4, weight: 0.7 },
  ":D": { valence: 0.9, arousal: 0.6, dominance: 0.6, weight: 0.8 },
  ":-D": { valence: 0.9, arousal: 0.6, dominance: 0.6, weight: 0.8 },
  ":(": { valence: -0.7, arousal: 0.3, dominance: -0.4, weight: 0.7 },
  ":-(": { valence: -0.7, arousal: 0.3, dominance: -0.4, weight: 0.7 },
  ":p": { valence: 0.6, arousal: 0.4, dominance: 0.5, weight: 0.6 },
  ":-p": { valence: 0.6, arousal: 0.4, dominance: 0.5, weight: 0.6 },
  ";)": { valence: 0.7, arousal: 0.5, dominance: 0.6, weight: 0.7 },
  ";-)": { valence: 0.7, arousal: 0.5, dominance: 0.6, weight: 0.7 },
  ":/": { valence: -0.3, arousal: 0.1, dominance: -0.1, weight: 0.5 },
  ":-/": { valence: -0.3, arousal: 0.1, dominance: -0.1, weight: 0.5 },
  ":o": { valence: 0.1, arousal: 0.7, dominance: -0.1, weight: 0.6 },
  ":-o": { valence: 0.1, arousal: 0.7, dominance: -0.1, weight: 0.6 },
  "<3": { valence: 0.9, arousal: 0.6, dominance: 0.5, weight: 0.8 },
  "😊": { valence: 0.8, arousal: 0.4, dominance: 0.6, weight: 0.8 },
  "😃": { valence: 0.9, arousal: 0.7, dominance: 0.6, weight: 0.8 },
  "😢": { valence: -0.7, arousal: 0.3, dominance: -0.4, weight: 0.8 },
  "😔": { valence: -0.6, arousal: -0.1, dominance: -0.3, weight: 0.7 },
  "😍": { valence: 0.9, arousal: 0.8, dominance: 0.6, weight: 0.9 },
  "😂": { valence: 0.9, arousal: 0.7, dominance: 0.6, weight: 0.8 },
  "🙂": { valence: 0.6, arousal: 0.3, dominance: 0.4, weight: 0.7 },
  "😀": { valence: 0.8, arousal: 0.6, dominance: 0.5, weight: 0.8 },
  "😭": { valence: -0.7, arousal: 0.6, dominance: -0.5, weight: 0.8 },
  "😡": { valence: -0.8, arousal: 0.8, dominance: 0.4, weight: 0.9 },
  "😱": { valence: -0.7, arousal: 0.9, dominance: -0.6, weight: 0.9 },
  "👍": { valence: 0.7, arousal: 0.4, dominance: 0.5, weight: 0.7 },
  "👎": { valence: -0.7, arousal: 0.3, dominance: -0.3, weight: 0.7 },
  "❤️": { valence: 0.9, arousal: 0.6, dominance: 0.5, weight: 0.9 },
  "💔": { valence: -0.8, arousal: 0.5, dominance: -0.4, weight: 0.8 },
};

/**
 * Analyzes text using the improved VAD model to extract emotional dimensions.
 * @param text The text to analyze
 * @returns VAD scores and primary emotion
 */
export function analyzeTextWithVAD(text: string): VADScore {
  if (!text || text.trim().length === 0) {
    // Default for empty messages: neutral with slight positive bias
    return {
      valence: 0,
      arousal: 0,
      dominance: 0,
      primaryEmotion: "empathy" // Default for empty messages
    };
  }
  
  // Standard preprocessing
  const originalText = text;
  text = text.toLowerCase();
  
  // Split into words for contextual analysis
  const words = text.split(/\s+/);
  const wordCount = words.length;
  
  // Track cumulative VAD values with weights
  let valenceSum = 0;
  let arousalSum = 0;
  let dominanceSum = 0;
  let totalWeight = 0;
  
  // Flag for detecting if message is in ALL CAPS (indicates shouting/intensity)
  const isAllCaps = originalText.length > 3 && 
                   originalText === originalText.toUpperCase() && 
                   /[A-Z]/.test(originalText);
  
  if (isAllCaps) {
    arousalSum += 0.4 * 0.5; // Increase arousal for shouting
    dominanceSum += 0.2 * 0.5; // Slight increase in dominance
    totalWeight += 0.5;
  }
  
  // Check for punctuation patterns
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 0) {
    const multiplier = Math.min(exclamationCount, 3) / 3; // Cap at 3 for intensity
    valenceSum += 0.2 * multiplier * 0.7;
    arousalSum += 0.5 * multiplier * 0.7;
    dominanceSum += 0.3 * multiplier * 0.7;
    totalWeight += 0.7 * multiplier;
  }
  
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount > 0) {
    const multiplier = Math.min(questionCount, 3) / 3;
    arousalSum += 0.3 * multiplier * 0.6;
    dominanceSum -= 0.2 * multiplier * 0.6; // Questions often imply uncertainty
    totalWeight += 0.6 * multiplier;
  }
  
  // Check for ellipsis
  if (text.includes("...")) {
    valenceSum -= 0.1 * 0.4;
    arousalSum -= 0.3 * 0.4;
    dominanceSum -= 0.2 * 0.4;
    totalWeight += 0.4;
  }
  
  // Check for emojis and emoticons
  for (const [emoji, values] of Object.entries(emojiMap)) {
    if (text.includes(emoji)) {
      valenceSum += values.valence * values.weight;
      arousalSum += values.arousal * values.weight;
      dominanceSum += values.dominance * values.weight;
      totalWeight += values.weight;
    }
  }
  
  // Process for emotional patterns
  let negationActive = false;
  
  // First pass: search for broader patterns and consider negation context
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[.,!?;:]$/, ''); // Remove trailing punctuation
    
    // Check for negations
    if (negations.includes(word)) {
      negationActive = true;
      continue;
    }
    
    // If we're at the end of a sentence, reset negation
    if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
      negationActive = false;
    }
  }
  
  // Second pass: match complete regex patterns
  for (const [pattern, values] of Object.entries(emotionalPatterns)) {
    const regex = new RegExp(pattern, 'i');
    const matches = text.match(regex);
    
    if (matches) {
      // Apply negation if active (primarily affects valence)
      let valenceAdjustment = values.valence;
      
      if (negationActive && pattern !== "\\bnot\\b") {
        // Negate valence and slightly reduce arousal and dominance
        valenceAdjustment = -valenceAdjustment * 0.8; // Partial flip
        
        // Words like "not happy" aren't as sad as "sad"
        if (valenceAdjustment < 0) {
          valenceAdjustment *= 0.7; // Reduce intensity of negated positive
        }
      }
      
      valenceSum += valenceAdjustment * values.weight;
      arousalSum += values.arousal * values.weight;
      dominanceSum += values.dominance * values.weight;
      totalWeight += values.weight;
    }
  }
  
  // For very short texts with no matches, apply default interpretations
  if (totalWeight < 0.5 && wordCount <= 3) {
    // Common short messages
    if (text.match(/^(hi|hey|hello)(\s+there)?[.!]?$/i)) {
      valenceSum += 0.3 * 0.7;
      arousalSum += 0.2 * 0.7;
      dominanceSum += 0.1 * 0.7;
      totalWeight += 0.7;
    } 
    else if (text.match(/^(thanks|thank you|ty)[.!]?$/i)) {
      valenceSum += 0.7 * 0.8;
      arousalSum += 0.3 * 0.8;
      dominanceSum += 0.3 * 0.8;
      totalWeight += 0.8;
    }
    else if (text.match(/^(ok|okay|k)[.!]?$/i)) {
      valenceSum += 0.1 * 0.5;
      arousalSum -= 0.1 * 0.5;
      dominanceSum += 0.0 * 0.5;
      totalWeight += 0.5;
    }
    else if (text.match(/^(yes|yeah|yep|yup)[.!]?$/i)) {
      valenceSum += 0.4 * 0.6;
      arousalSum += 0.3 * 0.6;
      dominanceSum += 0.3 * 0.6;
      totalWeight += 0.6;
    }
    else if (text.match(/^(no|nope|nah)[.!]?$/i)) {
      valenceSum -= 0.3 * 0.6;
      arousalSum += 0.2 * 0.6;
      dominanceSum += 0.1 * 0.6;
      totalWeight += 0.6;
    }
    else if (text.match(/^(why|what|how|when|where)[?]?$/i)) {
      valenceSum += 0.0 * 0.5;
      arousalSum += 0.3 * 0.5;
      dominanceSum -= 0.2 * 0.5;
      totalWeight += 0.5;
    }
    // For any other short text with no matches, slight curiosity bias
    else if (totalWeight < 0.3) {
      valenceSum += 0.1 * 0.4;
      arousalSum += 0.2 * 0.4;
      dominanceSum += 0.0 * 0.4;
      totalWeight += 0.4;
    }
  }
  
  // Ensure we have some weight to prevent division by zero
  if (totalWeight <= 0) {
    totalWeight = 1;
  }
  
  // Calculate weighted average
  let valence = valenceSum / totalWeight;
  let arousal = arousalSum / totalWeight;
  let dominance = dominanceSum / totalWeight;
  
  // Clamp values to the range [-1, 1]
  valence = Math.max(-1, Math.min(1, valence));
  arousal = Math.max(-1, Math.min(1, arousal));
  dominance = Math.max(-1, Math.min(1, dominance));
  
  // Determine primary emotion based on VAD values
  const primaryEmotion = determineEmotion(valence, arousal, dominance);
  
  // Determine if we need a secondary emotion
  let secondaryEmotion: string | undefined;
  
  // If the VAD values are not clearly aligned with one emotion, look for secondary
  if (totalWeight >= 1.0) {
    // Find the second best emotion match
    secondaryEmotion = findSecondaryEmotion(valence, arousal, dominance, primaryEmotion);
  }
  
  // Calculate confidence based on the total weight and pattern matches
  const confidenceBase = Math.min(0.9, Math.max(0.4, totalWeight / 4));
  
  // Adjust confidence based on clarity of emotion
  const confidence = Math.min(0.95, confidenceBase + 
    // Clear primary emotion gives higher confidence
    (primaryEmotion !== "neutral" ? 0.1 : 0) + 
    // More words = higher confidence (up to a point)
    (wordCount > 5 ? 0.05 : 0) + 
    // Strong emotional signals
    (Math.abs(valence) > 0.7 ? 0.05 : 0)
  );
  
  return {
    valence,
    arousal,
    dominance,
    primaryEmotion,
    secondaryEmotion,
    confidence
  };
}

/**
 * Finds a potential secondary emotion based on VAD values.
 */
function findSecondaryEmotion(valence: number, arousal: number, dominance: number, primaryEmotion: string): string | undefined {
  const candidates: {emotion: string, distance: number}[] = [];
  
  for (const [emotion, ranges] of Object.entries(emotionMap)) {
    // Skip the primary emotion
    if (emotion === primaryEmotion) continue;
    
    // Check if VAD is in range
    const inVRange = valence >= ranges.vRange[0] && valence <= ranges.vRange[1];
    const inARange = arousal >= ranges.aRange[0] && arousal <= ranges.aRange[1];
    const inDRange = dominance >= ranges.dRange[0] && dominance <= ranges.dRange[1];
    
    // If in range for at least two dimensions
    if ((inVRange && inARange) || (inVRange && inDRange) || (inARange && inDRange)) {
      const vCenter = (ranges.vRange[0] + ranges.vRange[1]) / 2;
      const aCenter = (ranges.aRange[0] + ranges.aRange[1]) / 2;
      const dCenter = (ranges.dRange[0] + ranges.dRange[1]) / 2;
      
      // Calculate distance to center of range
      const distance = Math.sqrt(
        Math.pow(valence - vCenter, 2) +
        Math.pow(arousal - aCenter, 2) +
        Math.pow(dominance - dCenter, 2)
      );
      
      // Add to candidates if within reasonable distance
      if (distance < 0.8) {
        candidates.push({ emotion, distance });
      }
    }
  }
  
  // Sort by distance and return the closest candidate
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.length > 0 ? candidates[0].emotion : undefined;
}

/**
 * Determines the primary emotion based on VAD values.
 */
function determineEmotion(valence: number, arousal: number, dominance: number): string {
  let bestMatch = "neutral"; // Default to neutral if no strong match found
  let bestScore = 0;
  
  // Handle common special cases first
  if (Math.abs(valence) < 0.2 && Math.abs(arousal) < 0.2 && Math.abs(dominance) < 0.2) {
    return "neutral"; // Very centered values indicate neutrality
  }
  
  // Quick checks for common emotion patterns
  if (valence > 0.6 && arousal > 0.6) {
    return "excitement"; // High valence + high arousal = excitement
  }
  
  if (valence < -0.6 && arousal > 0.6 && dominance > 0.4) {
    return "anger"; // Negative valence + high arousal + high dominance = anger
  }
  
  if (valence < -0.6 && arousal > 0.4 && dominance < -0.3) {
    return "fear"; // Negative valence + high arousal + low dominance = fear
  }
  
  if (valence < -0.5 && arousal < -0.3) {
    return "sadness"; // Negative valence + low arousal = sadness
  }
  
  if (valence > 0.5 && arousal < -0.3) {
    return "calm"; // Positive valence + low arousal = calm/content
  }
  
  if (Math.abs(valence) < 0.3 && arousal > 0.3 && dominance < 0) {
    return "confusion"; // Neutral valence + some arousal + low dominance = confusion
  }
  
  if (valence > 0.3 && Math.abs(arousal) < 0.3 && dominance > 0.2) {
    return "hope"; // Positive valence + moderate arousal + some dominance = hope
  }
  
  if (valence > 0.2 && arousal > 0.2 && dominance > 0) {
    return "interest"; // Slight positive across all dimensions = interest
  }
  
  // For more nuanced cases, calculate detailed matches
  for (const [emotion, ranges] of Object.entries(emotionMap)) {
    // Check if VAD is clearly within range (more strict matching)
    const vInRange = valence >= ranges.vRange[0] && valence <= ranges.vRange[1];
    const aInRange = arousal >= ranges.aRange[0] && arousal <= ranges.aRange[1];
    const dInRange = dominance >= ranges.dRange[0] && dominance <= ranges.dRange[1];
    
    // For a match, we need at least 2 dimensions in range
    const dimensionsInRange = (vInRange ? 1 : 0) + (aInRange ? 1 : 0) + (dInRange ? 1 : 0);
    
    if (dimensionsInRange >= 2) {
      // Calculate how well this emotion matches our VAD values (distance from center)
      const vCenter = (ranges.vRange[0] + ranges.vRange[1]) / 2;
      const aCenter = (ranges.aRange[0] + ranges.aRange[1]) / 2;
      const dCenter = (ranges.dRange[0] + ranges.dRange[1]) / 2;
      
      // Calculate normalized distance from center of each range (0 = perfect match)
      const vDistance = Math.abs(valence - vCenter);
      const aDistance = Math.abs(arousal - aCenter);
      const dDistance = Math.abs(dominance - dCenter);
      
      // Convert distances to match scores (1 = perfect match)
      const vMatch = 1 - Math.min(1, vDistance / ((ranges.vRange[1] - ranges.vRange[0]) / 2));
      const aMatch = 1 - Math.min(1, aDistance / ((ranges.aRange[1] - ranges.aRange[0]) / 2));
      const dMatch = 1 - Math.min(1, dDistance / ((ranges.dRange[1] - ranges.dRange[0]) / 2));
      
      // Weight valence more heavily for emotions like joy, sadness
      // Weight arousal more for emotions like excitement, calm
      // Weight dominance more for emotions like anger, fear
      let vWeight = 0.4;
      let aWeight = 0.3;
      let dWeight = 0.3;
      
      // Adjust weights based on emotion category
      if (["joy", "sadness", "contentment", "disgust"].includes(emotion)) {
        vWeight = 0.5; // Valence is more important
        aWeight = 0.3;
        dWeight = 0.2;
      } else if (["excitement", "calm", "boredom"].includes(emotion)) {
        vWeight = 0.3;
        aWeight = 0.5; // Arousal is more important
        dWeight = 0.2;
      } else if (["anger", "fear", "pride", "shame"].includes(emotion)) {
        vWeight = 0.3;
        aWeight = 0.3;
        dWeight = 0.4; // Dominance is more important
      }
      
      // Calculate weighted match score
      const matchScore = (
        (vMatch * vWeight) + 
        (aMatch * aWeight) + 
        (dMatch * dWeight)
      ) * ranges.weight;
      
      // Apply bonus for having all 3 dimensions in range
      const allInRangeBonus = (dimensionsInRange === 3) ? 0.1 : 0;
      const adjustedScore = matchScore + allInRangeBonus;
      
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestMatch = emotion;
      }
    }
  }
  
  // If no strong matches found, default to some reasonable emotion based on valence
  if (bestScore < 0.3) {
    if (valence > 0.2) return "interest";
    if (valence < -0.2) return "confusion";
    return "neutral";
  }
  
  return bestMatch;
}

/**
 * Generates a description of the emotional state based on VAD scores.
 */
export function generateEmotionalInsight(vadScore: VADScore): string {
  const { valence, arousal, dominance, primaryEmotion, secondaryEmotion } = vadScore;
  
  // Valence description
  let valenceDesc = "neutral";
  if (valence > 0.7) valenceDesc = "very positive";
  else if (valence > 0.3) valenceDesc = "moderately positive";
  else if (valence < -0.7) valenceDesc = "very negative";
  else if (valence < -0.3) valenceDesc = "moderately negative";
  
  // Arousal description
  let arousalDesc = "balanced energy level";
  if (arousal > 0.7) arousalDesc = "high energy";
  else if (arousal > 0.3) arousalDesc = "moderate energy";
  else if (arousal < -0.7) arousalDesc = "very low energy";
  else if (arousal < -0.3) arousalDesc = "relaxed energy";
  
  // Dominance description
  let dominanceDesc = "balanced control";
  if (dominance > 0.7) dominanceDesc = "strong confidence";
  else if (dominance > 0.3) dominanceDesc = "moderate confidence";
  else if (dominance < -0.7) dominanceDesc = "significant uncertainty";
  else if (dominance < -0.3) dominanceDesc = "some uncertainty";
  
  // Format primary emotion with capitalization
  const formattedEmotion = primaryEmotion.charAt(0).toUpperCase() + primaryEmotion.slice(1);
  
  // Build the description
  let description = `${formattedEmotion} with ${valenceDesc} emotions, ${arousalDesc}, and ${dominanceDesc}`;
  
  // Add secondary emotion if present
  if (secondaryEmotion) {
    const formattedSecondary = secondaryEmotion.charAt(0).toUpperCase() + secondaryEmotion.slice(1);
    description += `, with elements of ${formattedSecondary}`;
  }
  
  return description;
}
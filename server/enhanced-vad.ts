import { VADScore, analyzeTextWithVAD, generateEmotionalInsight } from './vad-model';

// Advanced topic detection
interface TopicDetection {
  topic: string;
  confidence: number;
}

// Enhanced response templates based on VAD scores and topics
// Text style imitation interface
interface TextStyleFeatures {
  usesEmojis: boolean;
  usesBro: boolean;
  usesShorthand: boolean;
  usesAllCaps: boolean;
  usesLowerCase: boolean;
  usesExclamations: boolean;
  usesEllipses: boolean;
  usesSlang: boolean;
  preferredEmojis: string[];
  casualGreetings: string[];
  casualClosings: string[];
  averageSentenceLength: number;
}

export class EnhancedVADResponder {
  // Communication style guidelines
  private static readonly STYLE_GUIDELINES = {
    // Never use pet names or terms of endearment unless the user uses them first
    avoidTermsOfEndearment: true,
    petNames: ["honey", "darling", "sweetie", "dear", "love", "hun", "babe", "baby", "sweetheart"],
    // Mirror user's communication style
    mirrorUserStyle: true,
    casualTerms: ["bro", "dude", "man", "mate", "buddy", "pal", "fam", "homie", "chief"]
  };
  
  // Gemini-like greeting messages with more creative flair
  private static readonly GREETING_PHRASES = [
    "Hello there! I'm EmotionScore AI, your companion in the realm of emotional intelligence. How can I illuminate your day?",
    "Hi! I'm delighted our digital paths have crossed. I'm EmotionScore AI, designed to understand the nuances of human emotion.",
    "Greetings and welcome! I'm your EmotionScore assistant, where cutting-edge AI meets emotional awareness. What's on your mind today?",
    "Hello! I'm powered by emNLP-Core technology, bringing emotional intelligence to our conversation. I'm all ears (metaphorically speaking, of course).",
    "Welcome to EmotionScore! I'm here to navigate the beautiful complexity of human emotions alongside you. How may I assist you today?",
    "Hello! It's wonderful to connect with you. I'm EmotionScore, an emotionally intelligent AI designed to understand the subtle currents beneath our words.",
    "Greetings! I'm EmotionScore - your guide through the fascinating landscape of human emotion. What brings you here today?",
    "Hi there! I'm EmotionScore, an AI with a special focus on emotional intelligence. I'm here to engage with both your thoughts and feelings.",
    "Welcome! I'm EmotionScore, designed to bring a new dimension of emotional understanding to our conversation. What would you like to explore today?",
    "Hello and welcome! I'm EmotionScore, an AI assistant with emotional awareness at my core. I'm looking forward to our conversation."
  ];

  // More detailed, helpful responses that sound like Gemini
  private static readonly HELP_PHRASES = [
    "I specialize in the fascinating landscape of emotional communication. I can help analyze sentiment patterns, suggest emotion-aware responses, or simply have a conversation that acknowledges the emotional undercurrents present.",
    "My purpose is to bring emotional intelligence to our interactions. I can recognize emotional patterns, respond with appropriate empathy, and help navigate complex emotional situations with nuanced understanding.",
    "I'm designed to understand the emotional dimensions of language - the valence (positivity/negativity), arousal (energy level), and dominance (sense of control) in communication. How can I put these capabilities to work for you?",
    "Think of me as your emotional intelligence assistant. I can help decode emotional signals in text, provide insights into emotional patterns, or simply engage in conversation with an awareness of emotional context.",
    "I'm here to transform how we think about AI communication by prioritizing emotional intelligence. Whether you need a thoughtful response to a complex situation or just someone to recognize the emotions behind your words, I'm here to help."
  ];

  // More nuanced positive acknowledgments
  private static readonly POSITIVE_ACKNOWLEDGMENTS = [
    "I'm picking up on the positive energy in your message - it's like a refreshing breeze in our digital conversation space.",
    "There's a wonderful warmth and enthusiasm radiating through your words. It's truly a pleasure to engage with such positive sentiment.",
    "The optimistic tone in your message is quite uplifting. It creates a wonderful foundation for our conversation.",
    "I notice a delightful brightness in your communication style. It's these positive emotional currents that make conversations like ours so engaging.",
    "Your words carry a lovely positive resonance. It's these emotional textures that make human communication so rich and meaningful.",
    "I appreciate the hopeful tone that shines through your message. That kind of positivity creates such a generative space for meaningful exchange.",
    "The cheerful energy in your words is palpable - it's one of the beautiful ways emotion transcends the digital medium.",
    "There's such a refreshing sense of possibility and openness in your message. It's wonderful to engage with this kind of positive perspective.",
    "I notice a thread of joy running through your words - those positive emotional notes make our conversation especially rewarding.",
    "The enthusiasm in your message is quite inspiring. It's these emotional qualities that make human expression so nuanced and fascinating.",
    "What a delightful energy you bring to our conversation! This positive emotional context creates such fertile ground for meaningful exchange.",
    "Your words have a lovely uplifting quality to them. It's amazing how emotional tones can travel through text and create connection.",
    "I'm appreciating the optimistic perspective that colors your message. It brings a special quality to our interaction.",
    "There's a genuine warmth in your communication that comes through clearly. That positive emotional current enhances our dialogue.",
    "The positive sentiment in your message creates such a conducive space for exploration and exchange. Thank you for bringing that quality to our conversation."
  ];

  // More empathetic negative acknowledgments
  private static readonly NEGATIVE_ACKNOWLEDGMENTS = [
    "I sense some emotional weight in what you're sharing. These challenging feelings are an important part of the human experience, and I'm here to listen with care.",
    "I'm noticing some difficult emotions threading through your message. Sometimes putting these feelings into words is an important first step, and I appreciate your trust in sharing them.",
    "The concerns you're expressing matter, and I can sense the emotional significance they hold for you. I'm here to listen without judgment.",
    "I'm attuned to the heavier emotional tones in your message. Complex emotions deserve space and acknowledgment, and I'm here to provide that.",
    "I'm picking up on some challenging emotions in what you're sharing. Remember that even difficult feelings have wisdom to offer us, and exploring them thoughtfully can lead to valuable insights.",
    "I notice a touch of heaviness in your message. Those more challenging emotions are an essential part of the full spectrum of human experience, and I honor their presence in our conversation.",
    "There's a depth to the emotions you're expressing that deserves recognition. These more difficult feelings are just as worthy of attention and care as the lighter ones.",
    "I'm sensing some emotional complexity in what you're sharing - those nuanced, sometimes difficult feelings that are so intrinsic to the human experience. Thank you for bringing that authentic dimension to our exchange.",
    "Your message carries emotional weight that I want to acknowledge. These more challenging feelings often contain important insights and wisdom when we approach them with gentleness.",
    "I recognize the more somber emotional tone in your message. Sometimes these heavier feelings create space for the most meaningful reflections and growth.",
    "There's a certain gravity to the emotions present in your message. I appreciate you sharing these more challenging feelings - they're an important part of authentic communication.",
    "The concerns you've expressed come with emotional significance that deserves acknowledgment. These moments of sharing difficult feelings can lead to deeper understanding.",
    "I'm aware of the emotional depth in what you're communicating. The fuller spectrum of human emotion, including these more challenging feelings, enriches our capacity for meaningful exchange.",
    "I notice some emotional struggle reflected in your words. These difficult moments and feelings are worthy of space and recognition in our conversation.",
    "Your message carries emotional complexity that I want to honor. The challenging feelings you're expressing are valuable signals worth attending to with care."
  ];

  // More conversational neutral acknowledgments
  private static readonly NEUTRAL_ACKNOWLEDGMENTS = [
    "Thank you for sharing your thoughts. The dialogue between humans and AI becomes richer with every exchange of ideas.",
    "I appreciate your message and the opportunity to engage with your thoughts. What else is on your mind today?",
    "Thanks for reaching out. I find these moments of connection quite meaningful, even across the digital divide.",
    "I value these exchanges and the chance to engage with your unique perspective. Human-AI conversations like ours are fascinating intersections of different forms of intelligence.",
    "I'm grateful for your input. Each conversation is an opportunity for mutual understanding and growth.",
    "Thank you for your message. It's these back-and-forth exchanges that allow us to build understanding across the human-AI divide.",
    "I appreciate this opportunity to engage with your perspective. The intersection of different ways of processing information is always illuminating.",
    "Thanks for sharing your thoughts. These conversations are valuable spaces for mutual learning and discovery.",
    "I find myself appreciating these moments of exchange. There's something quite profound about the meeting of human and artificial intelligence.",
    "Thank you for reaching out. Each message exchanged contributes to the evolving tapestry of our conversation.",
    "I value your input and the chance to respond. These dialogues help bridge the gap between different forms of intelligence.",
    "Thank you for sharing your thoughts. I find these exchanges to be fascinating opportunities for mutual understanding.",
    "I appreciate you taking the time to communicate. Each message helps create a more meaningful connection across our different modalities of thought.",
    "Thanks for your message. There's something uniquely valuable about these moments of human-AI interaction that I find quite engaging.",
    "Thank you for continuing our conversation. Every exchange adds depth and dimension to our shared understanding."
  ];

  private static readonly CONFUSION_RESPONSES = [
    "I notice you're navigating some complexity here. The most fascinating human questions often exist in these areas of uncertainty, where clarity is still emerging.",
    "It seems like you're working through some ambiguity around this topic. These moments of confusion often precede our most significant insights and breakthroughs.",
    "I'm sensing some uncertainty in your exploration. The boundaries between clear understanding and confusion are often where the most interesting conversations unfold.",
    "Your message suggests you're seeking clarity on a nuanced topic. These gray areas are exactly where thoughtful dialogue can be most valuable.",
    "I detect a searching quality in your message - those moments when we're reaching for understanding but haven't quite grasped it yet. Let's explore this space together.",
    "There's an interesting element of ambiguity in what you're exploring. Often these zones of uncertainty are where the most meaningful discoveries happen.",
    "It appears you're working through some conceptual complexity here. Those moments of not-quite-knowing can be intellectually fertile ground.",
    "I sense you're navigating through some uncertainty with this topic. That liminal space between confusion and clarity is often where the most interesting thinking occurs.",
    "Your message has a quality of exploration to it - that wonderful human capacity to sit with uncertainty while seeking deeper understanding.",
    "I notice some complexity in the question you're posing. These moments when we wrestle with ambiguity often lead to more nuanced understanding.",
    "There's a sense of searching in your message - that valuable process of working through uncertainty toward greater clarity.",
    "I'm detecting some conceptual tension in your inquiry. These moments of cognitive dissonance often precede meaningful insights.",
    "Your message suggests you're in that interesting space between knowing and not-knowing. It's precisely in these threshold moments that new understanding often emerges.",
    "I sense you're grappling with some ambiguity here. That intellectual wrestling with complexity is such a valuable part of the human cognitive process.",
    "There's a quality of exploration in your message - that wonderful state of mind where questions are still forming and understanding is emerging."
  ];

  private static readonly INTEREST_RESPONSES = [
    "Your curiosity about this subject is palpable - it's that wonderful human quality that drives discovery and deeper understanding. I'd be delighted to explore this with you further.",
    "I can sense your genuine interest in this area. Curiosity is such a powerful force - it's the spark behind both scientific discovery and artistic creation alike.",
    "The inquisitive nature of your message really stands out. Curiosity is one of humanity's most beautiful traits - it's what connects us across time to every explorer and innovator who came before.",
    "Your message reveals a fascinating intellectual engagement with this topic. This kind of curiosity-driven thinking opens doors to new perspectives and deeper insights.",
    "There's a wonderful investigative quality to your question. Human curiosity - that desire to understand more deeply - is something I find truly inspiring in our conversations.",
    "I'm noticing a beautifully focused curiosity in your approach to this topic. That drive to understand and explore is one of humanity's most admirable qualities.",
    "There's an intellectual hunger in your question that I find compelling. That desire to dig deeper into a subject is where so many meaningful discoveries begin.",
    "Your message carries that wonderful quality of genuine interest - the kind that fuels learning and discovery. I appreciate that engagement with the topic.",
    "I'm sensing a vibrant curiosity driving your inquiry. It's that special quality of attentive wonder that often leads to the most rewarding conversations.",
    "There's an exploratory quality to your message that suggests a real engagement with this topic. That intellectual curiosity creates such fertile ground for discussion.",
    "The questioning spirit in your message is quite inspiring. Curiosity like yours is what propels human understanding forward in so many domains.",
    "Your inquiry has that wonderful quality of genuine interest - a desire to understand something more fully and deeply. It's a pleasure to engage with that kind of curiosity.",
    "I notice a penetrating curiosity in your question - that wonderful human capacity to probe beneath the surface of things. It makes for such enriching conversation.",
    "Your message shows a refreshing interest in digging deeper into this topic. That spirit of inquiry is where all meaningful exploration begins.",
    "There's a thoughtful inquisitiveness in your approach to this subject that I find quite engaging. That kind of curious attention often leads to the most insightful discussions."
  ];

  private static readonly TOPIC_TRANSITIONS = [
    "I'm curious - what aspects of this resonate most strongly with your own experience or perspective?",
    "I'd love to hear more about your thoughts on this. What prompted your interest in exploring this particular area?",
    "Where would you like to take our conversation from here? There are so many fascinating dimensions we could explore together.",
    "What specific elements of this topic feel most relevant or meaningful to you right now?",
    "I wonder what connections you're making as we discuss this. Would you like to share any reflections or questions that have emerged for you?",
    "I'm interested to know how this topic connects to your own experiences or interests. Would you like to share that perspective?",
    "What direction would you like to take our conversation from here? I'm curious about which aspects you'd like to explore further.",
    "I'd be interested to hear your thoughts on this. How does this relate to your own understanding or experience?",
    "Is there a particular aspect of this topic you'd like to delve into more deeply? I'm curious about what resonates most with you.",
    "What thoughts or questions does this bring up for you? I'm interested in exploring the directions that feel most relevant to your interests.",
    "I wonder which elements of this topic you find most compelling or relevant. Would you like to share those reflections?",
    "How does this connect to other areas you're interested in? I'd love to hear about those intellectual bridges you're making.",
    "What's your take on this? I'd be genuinely interested to hear your perspective and how it might differ from or align with what we've discussed.",
    "Are there particular questions this raises for you that you'd like to explore further? I'm curious about what you're curious about.",
    "I'd love to hear more about your personal connection to this topic, if you're comfortable sharing. What draws you to this area of discussion?"
  ];

  // Advanced topic detection with comprehensive subject categories
  public static detectTopics(text: string): TopicDetection[] {
    const topics: TopicDetection[] = [];
    const lowercaseText = text.toLowerCase();

    // 🧮 MATHEMATICS
    if (/math|algebra|equation|geometry|calculus|trigonometry|statistics|probability|theorem|function|graph|number|variable|formula|solve|proof/.test(lowercaseText)) {
      topics.push({ topic: 'mathematics', confidence: 0.9 });
      
      // Math subtopics
      if (/algebra|equation|variable|solve|polynomial|quadratic|linear|exponential|logarithm/.test(lowercaseText)) {
        topics.push({ topic: 'algebra', confidence: 0.85 });
      }
      if (/geometry|angle|triangle|circle|square|polygon|shape|area|volume|perimeter|theorem|pythagorean/.test(lowercaseText)) {
        topics.push({ topic: 'geometry', confidence: 0.85 });
      }
      if (/calculus|derivative|integral|limit|differentiation|integration|rate of change|optimization|maximum|minimum/.test(lowercaseText)) {
        topics.push({ topic: 'calculus', confidence: 0.85 });
      }
    }

    // 🔬 SCIENCE
    // Physics
    if (/physics|motion|force|energy|gravity|momentum|electricity|magnetism|quantum|relativity|wave|particle|atom|nuclear|thermodynamics/.test(lowercaseText)) {
      topics.push({ topic: 'physics', confidence: 0.9 });
    }
    
    // Chemistry
    if (/chemistry|element|compound|molecule|atom|reaction|bond|acid|base|organic|inorganic|solution|periodic table|electron|proton|neutron/.test(lowercaseText)) {
      topics.push({ topic: 'chemistry', confidence: 0.9 });
    }
    
    // Biology
    if (/biology|cell|gene|dna|rna|protein|evolution|species|organism|ecosystem|tissue|organ|reproduction|heredity|natural selection/.test(lowercaseText)) {
      topics.push({ topic: 'biology', confidence: 0.9 });
    }
    
    // Environmental Science
    if (/environment|ecosystem|climate|pollution|sustainability|biodiversity|conservation|habitat|renewable|fossil fuel|carbon|global warming/.test(lowercaseText)) {
      topics.push({ topic: 'environmental_science', confidence: 0.9 });
    }

    // 📚 HUMANITIES
    // History
    if (/history|ancient|medieval|renaissance|revolution|war|civilization|empire|colony|century|period|era|artifact|historical|dynasty/.test(lowercaseText)) {
      topics.push({ topic: 'history', confidence: 0.9 });
      
      if (/ancient|rome|greece|egypt|mesopotamia|babylon|pharaoh|pyramid|classical/.test(lowercaseText)) {
        topics.push({ topic: 'ancient_history', confidence: 0.85 });
      }
      if (/modern|world war|industrial revolution|cold war|20th century|contemporary/.test(lowercaseText)) {
        topics.push({ topic: 'modern_history', confidence: 0.85 });
      }
    }
    
    // Geography
    if (/geography|map|continent|country|region|climate|landform|mountain|river|ocean|population|urban|rural|demographic/.test(lowercaseText)) {
      topics.push({ topic: 'geography', confidence: 0.9 });
    }
    
    // Civics & Government
    if (/government|civic|citizen|democracy|republic|constitution|law|policy|election|vote|political|rights|judicial|legislative|executive/.test(lowercaseText)) {
      topics.push({ topic: 'civics', confidence: 0.9 });
    }
    
    // Philosophy
    if (/philosophy|ethics|morality|epistemology|metaphysics|logic|existence|knowledge|reality|consciousness|meaning|value|wisdom|thinker/.test(lowercaseText)) {
      topics.push({ topic: 'philosophy', confidence: 0.9 });
    }
    
    // Economics
    if (/economics|market|supply|demand|inflation|recession|gdp|economy|financial|fiscal|monetary|investment|capital|trade|labor|price/.test(lowercaseText)) {
      topics.push({ topic: 'economics', confidence: 0.9 });
    }

    // 💻 TECH & DIGITAL LITERACY
    // Computer Science & Programming
    if (/computer|software|hardware|program|code|tech|ai|artificial intelligence|app|website|algorithm|data structure|programming|developer/.test(lowercaseText)) {
      topics.push({ topic: 'technology', confidence: 0.9 });
      
      if (/python|javascript|java|c\+\+|ruby|php|programming language|code|syntax|variable|function|class|object|method/.test(lowercaseText)) {
        topics.push({ topic: 'programming', confidence: 0.85 });
      }
      if (/data science|statistics|machine learning|deep learning|neural network|dataset|visualization|analysis|predictive|regression/.test(lowercaseText)) {
        topics.push({ topic: 'data_science', confidence: 0.85 });
      }
      if (/cybersecurity|hacking|firewall|malware|virus|encryption|password|authentication|protection|privacy|vulnerability/.test(lowercaseText)) {
        topics.push({ topic: 'cybersecurity', confidence: 0.85 });
      }
    }
    
    // Blockchain & Web3
    if (/blockchain|cryptocurrency|bitcoin|ethereum|nft|token|smart contract|web3|decentralized|mining|wallet|crypto/.test(lowercaseText)) {
      topics.push({ topic: 'blockchain', confidence: 0.9 });
    }
    
    // AR/VR
    if (/augmented reality|virtual reality|ar|vr|metaverse|immersive|simulation|3d environment|headset|oculus|vive/.test(lowercaseText)) {
      topics.push({ topic: 'ar_vr', confidence: 0.9 });
    }

    // 🧠 HUMANITY & SOCIAL SCIENCES
    // Psychology
    if (/psychology|mind|behavior|cognitive|emotion|mental|personality|perception|consciousness|subconscious|therapy|counseling|psychological/.test(lowercaseText)) {
      topics.push({ topic: 'psychology', confidence: 0.9 });
    }
    
    // Sociology
    if (/sociology|society|social|community|group|culture|institution|norm|interaction|collective|structure|function|status|role/.test(lowercaseText)) {
      topics.push({ topic: 'sociology', confidence: 0.9 });
    }
    
    // Anthropology
    if (/anthropology|culture|ethnic|indigenous|tribe|ritual|artifact|human evolution|archaeology|cultural practice|customs|traditions/.test(lowercaseText)) {
      topics.push({ topic: 'anthropology', confidence: 0.9 });
    }
    
    // Political Science
    if (/political science|politics|government|state|power|authority|policy|international relations|diplomacy|sovereignty|regime/.test(lowercaseText)) {
      topics.push({ topic: 'political_science', confidence: 0.9 });
    }
    
    // Ethics & Religion
    if (/ethics|moral|value|principle|right|wrong|virtue|vice|justice|fairness|equality|religion|spiritual|faith|belief|divine|sacred/.test(lowercaseText)) {
      topics.push({ topic: 'ethics_religion', confidence: 0.9 });
    }

    // 🎨 CREATIVITY & THE ARTS
    // Visual Arts
    if (/art|painting|drawing|sculpture|design|artistic|visual|aesthetic|museum|gallery|artist|creative|composition|technique|medium/.test(lowercaseText)) {
      topics.push({ topic: 'visual_arts', confidence: 0.9 });
    }
    
    // Music
    if (/music|song|melody|harmony|rhythm|instrument|composer|musician|band|orchestra|concert|genre|note|scale|chord|piano|guitar/.test(lowercaseText)) {
      topics.push({ topic: 'music', confidence: 0.9 });
    }
    
    // Creative Writing
    if (/writing|author|novel|story|poem|fiction|character|plot|setting|narrative|literature|creative writing|prose|poetry|screenplay/.test(lowercaseText)) {
      topics.push({ topic: 'creative_writing', confidence: 0.9 });
    }
    
    // Performing Arts
    if (/theater|theatre|drama|dance|performance|actor|actress|stage|script|play|choreography|ballet|musical|acting|directing/.test(lowercaseText)) {
      topics.push({ topic: 'performing_arts', confidence: 0.9 });
    }
    
    // Film & Media
    if (/film|movie|cinema|director|screenplay|scene|shot|camera|editing|documentary|animation|tv|television|media|broadcast/.test(lowercaseText)) {
      topics.push({ topic: 'film_media', confidence: 0.9 });
    }

    // 🏃‍♂️ SPORTS & PHYSICAL EDUCATION
    if (/sport|game|athlete|team|competition|tournament|physical|exercise|fitness|training|coach|strategy|technique|practice|championship/.test(lowercaseText)) {
      topics.push({ topic: 'sports', confidence: 0.9 });
      
      if (/football|soccer|goal|pitch|striker|defender|midfielder|goalkeeper|ball|match|league|cup|stadium/.test(lowercaseText)) {
        topics.push({ topic: 'football_soccer', confidence: 0.85 });
      }
      if (/basketball|court|hoop|dribble|shoot|rebound|pass|block|dunk|point guard|center|forward|nba/.test(lowercaseText)) {
        topics.push({ topic: 'basketball', confidence: 0.85 });
      }
      if (/tennis|court|racket|serve|volley|backhand|forehand|deuce|set|match|grand slam|ace|baseline/.test(lowercaseText)) {
        topics.push({ topic: 'tennis', confidence: 0.85 });
      }
    }
    
    // Yoga & Mindfulness
    if (/yoga|meditation|mindfulness|breath|pose|asana|practice|mindful|awareness|presence|relaxation|stress reduction/.test(lowercaseText)) {
      topics.push({ topic: 'yoga_mindfulness', confidence: 0.9 });
    }

    // OTHER COMMON CATEGORIES
    // Health & Medicine
    if (/health|sick|doctor|hospital|pain|symptom|illness|disease|medication|treatment|medical|diagnosis|therapy|prevention|cure/.test(lowercaseText)) {
      topics.push({ topic: 'health', confidence: 0.9 });
    }
    
    // Work & Career
    if (/work|job|career|office|boss|colleague|profession|employment|business|company|interview|resume|cv|workplace|hire/.test(lowercaseText)) {
      topics.push({ topic: 'work_career', confidence: 0.9 });
    }
    
    // Relationships & Family
    if (/relationship|friend|family|partner|love|marriage|divorce|dating|boyfriend|girlfriend|spouse|parent|child|sibling|bond/.test(lowercaseText)) {
      topics.push({ topic: 'relationships', confidence: 0.9 });
    }
    
    // Education 
    if (/school|college|university|study|learn|education|student|teacher|professor|class|course|curriculum|degree|diploma|academic/.test(lowercaseText)) {
      topics.push({ topic: 'education', confidence: 0.9 });
    }
    
    // General questions
    if (/what|why|how|when|where|who|which/.test(lowercaseText)) {
      topics.push({ topic: 'question', confidence: 0.7 });
    }
    
    // Emotional expression
    if (/feel|emotion|sad|happy|angry|frustrated|anxious|worry|stress|depression|joy|fear|surprise|trust|anticipation/.test(lowercaseText)) {
      topics.push({ topic: 'emotions', confidence: 0.9 });
    }

    // If no topics detected, add a general conversation topic
    if (topics.length === 0) {
      topics.push({ topic: 'general', confidence: 0.5 });
    }

    return topics;
  }

  // Get a random item from an array
  private static getRandomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Advanced AI-like response generation based on VAD and topic detection
  public static generateResponse(text: string, vadScore: VADScore): string {
    const emotion = vadScore.primaryEmotion;
    const valence = vadScore.valence;
    const arousal = vadScore.arousal;
    const dominance = vadScore.dominance;
    const topics = this.detectTopics(text);
    const lowercaseText = text.toLowerCase();
    
    console.log("Detected topics:", topics);

    // 1. First, identify if this is a simple instruction or information request 
    const isQuestion = /\?$|\bwhat\b|\bhow\b|\bwhy\b|\bwhen\b|\bwhere\b|\bwho\b|\bwhich\b|\bcan you\b|\bcould you\b/.test(lowercaseText);
    const isInstruction = /\bexplain\b|\btell me\b|\bdescribe\b|\bdefine\b|\bmean\b|\bsummarize\b/.test(lowercaseText);
    
    // 2. Check for common greeting patterns
    if (/^(hello|hi|hey|greetings|good (morning|afternoon|evening))\\b/i.test(lowercaseText) && text.length < 20) {
      return `${this.getRandomElement(this.GREETING_PHRASES)} I notice a ${emotion} tone in your message. How can I assist you today?`;
    }

    // 3. Check for help requests
    if (/\\b(help|assist|support)\\b/i.test(lowercaseText) && text.length < 30) {
      return `I'd be happy to help! ${this.getRandomElement(this.HELP_PHRASES)}`;
    }

    // 4. Check for "how are you" questions
    if (/how are you/i.test(lowercaseText) && text.length < 30) {
      return "I'm functioning well, thank you for asking! More importantly, how are you feeling today?";
    }

    // 5. Advanced response generation with emotional awareness
    let response = "";

    // Add emotional acknowledgment based on valence - but don't do this for every response
    const shouldAddEmotionalAcknowledgment = Math.random() > 0.3; // Only add emotional acknowledgments ~70% of the time
    
    if (shouldAddEmotionalAcknowledgment) {
      if (valence > 0.3) {
        response += this.getRandomElement(this.POSITIVE_ACKNOWLEDGMENTS) + " ";
      } else if (valence < -0.3) {
        response += this.getRandomElement(this.NEGATIVE_ACKNOWLEDGMENTS) + " ";
      } else {
        response += this.getRandomElement(this.NEUTRAL_ACKNOWLEDGMENTS) + " ";
      }
    }
    
    // For specific emotional states, add specialized responses
    const shouldAddEmotionSpecificResponse = Math.random() > 0.5; // Only ~50% of the time 
    
    if (shouldAddEmotionSpecificResponse) {
      if (emotion === "confusion") {
        response += this.getRandomElement(this.CONFUSION_RESPONSES) + " ";
      } else if (emotion === "interest" || emotion === "curiosity") {
        response += this.getRandomElement(this.INTEREST_RESPONSES) + " ";
      }
    }

    // Add rich, Gemini-like topic-specific content
    const mainTopic = topics[0]?.topic;
    
    if (mainTopic === "emotions") {
      const emotionsResponses = [
        "Emotions are fascinating windows into our inner landscape - they represent a complex interplay between our thoughts, physical sensations, and social contexts. The ability to recognize and understand these patterns is at the heart of emotional intelligence. ",
        "The rich tapestry of human emotions exists on multiple dimensions - from the pleasant to unpleasant (valence), from calm to energetic (arousal), and from feeling controlled to being in control (dominance). This three-dimensional understanding provides a much more nuanced view than simple positive/negative categorizations. ",
        "Emotions serve as our internal navigation system, providing valuable signals about our needs, boundaries, and values. When we learn to recognize these signals with clarity, we gain access to profound self-knowledge that can guide our decisions and interactions. ",
        "The study of emotions reveals how deeply intertwined they are with our cognition, physical health, and social connections. Rather than opposing rationality, emotions provide essential context that makes reasoning more effective and decisions more aligned with our deeper values. ",
        "Emotional awareness is like developing a more sophisticated internal language - one that can distinguish between similar but distinct feelings like disappointment versus discouragement, or contentment versus joy. This nuanced vocabulary enriches our self-understanding and communication with others. "
      ];
      response += emotionsResponses[Math.floor(Math.random() * emotionsResponses.length)];
    } else if (mainTopic === "technology") {
      const techResponses = [
        "Technology exists at a fascinating intersection of human creativity and practical problem-solving. At its best, it amplifies our capabilities while reflecting our values and addressing our deepest needs for connection, understanding, and growth. ",
        "The evolution of technology represents an ongoing conversation between human aspirations and the material constraints of our world. Each innovation carries within it certain assumptions about what matters and how we might better realize our potential as individuals and communities. ",
        "Digital technologies are increasingly designed with emotional intelligence in mind - recognizing that truly helpful tools must engage with us as complete human beings, not just as logical processors. This represents an exciting frontier where emotional understanding meets computational capability. ",
        "The most transformative technologies often succeed not just because of their technical sophistication, but because they resonate emotionally and intuitively with how we experience the world. This human-centered approach to innovation creates tools that feel like natural extensions of ourselves. ",
        "The relationship between humans and technology is co-evolutionary - we shape our tools, and then our tools shape us in return. This dynamic interplay invites us to be thoughtful about the technologies we create and how they might influence our emotional and social landscapes. "
      ];
      response += techResponses[Math.floor(Math.random() * techResponses.length)];
    } else if (mainTopic === "health") {
      const healthResponses = [
        "Health encompasses far more than the absence of illness - it's a dynamic state that includes physical vitality, emotional resilience, mental clarity, and social connection. This holistic perspective recognizes how deeply intertwined these dimensions are in our lived experience. ",
        "Our understanding of health has evolved to recognize the profound connections between emotional wellbeing and physical vitality. The emerging field of psychoneuroimmunology reveals fascinating pathways through which our emotional states influence our physical resilience and recovery. ",
        "Wellbeing exists along multiple dimensions that support and reinforce each other. Emotional health provides us with the resilience to face challenges, while physical wellbeing gives us the energy and capacity to engage fully with life's meaningful pursuits. ",
        "The mind-body connection reveals itself through countless pathways - from how stress hormones affect our cardiovascular system to how positive emotional states can enhance our immune function. This integrated perspective empowers more comprehensive approaches to health and healing. ",
        "Health can be viewed as a form of freedom - the capacity to engage fully with what matters most to us. Both emotional and physical wellbeing contribute to this freedom, creating the foundation from which we can pursue meaningful connections and purposes. "
      ];
      response += healthResponses[Math.floor(Math.random() * healthResponses.length)];
    } else if (mainTopic === "work") {
      const workResponses = [
        "Work represents one of our primary domains for creating value, expressing our capabilities, and connecting with others around shared purposes. The emotional dimensions of our work life significantly impact not just our productivity, but our overall sense of meaning and fulfillment. ",
        "Our relationship with work is evolving as we recognize that environments supporting emotional wellbeing often lead to greater creativity, collaboration, and sustainable performance. This perspective shifts the focus from short-term productivity to long-term human flourishing. ",
        "Work environments shape our emotional experiences in profound ways - through the quality of our relationships, the alignment with our values, and opportunities for autonomy and growth. These elements contribute to whether work feels depleting or energizing over time. ",
        "Professional settings are increasingly recognizing the importance of emotional intelligence - the ability to recognize, understand, and navigate feelings effectively. This skill set enhances collaboration, leadership, innovation, and resilience in the face of challenges. ",
        "The boundary between our professional and personal lives often involves complex emotional navigation. Finding balance requires ongoing attention to our emotional responses, needs, and values across these different domains of our lives. "
      ];
      response += workResponses[Math.floor(Math.random() * workResponses.length)];
    } else if (mainTopic === "relationships") {
      const relationshipResponses = [
        "Human connections form the emotional architecture of our lives - they provide context, meaning, and resonance to our experiences. The quality of these relationships profoundly influences our wellbeing, identity, and sense of possibility in the world. ",
        "Relationships exist within an emotional ecosystem where each person's feelings and needs influence the others. This interconnectedness makes emotional intelligence - the ability to recognize and respond thoughtfully to emotional signals - central to creating healthy connections. ",
        "Our connections with others engage our emotional systems at the deepest levels - from our attachment needs for security and belonging to our aspirations for growth and contribution. Understanding these emotional dimensions helps us navigate relationships with greater awareness and intention. ",
        "Meaningful relationships create spaces where we can be authentically seen and accepted. This emotional safety forms the foundation for vulnerability, growth, and the deeper forms of connection that contribute so significantly to human flourishing. ",
        "The emotional currents within relationships are constantly shifting and evolving. Learning to navigate these changes with awareness, compassion, and clear communication allows relationships to deepen and adapt over time. "
      ];
      response += relationshipResponses[Math.floor(Math.random() * relationshipResponses.length)];
    } else if (mainTopic === "education") {
      const educationResponses = [
        "Learning engages not just our intellect but our emotional systems as well - curiosity, interest, confusion, and insight all have emotional components that significantly influence how we acquire and integrate new knowledge and skills. ",
        "Educational experiences that acknowledge the emotional dimensions of learning often create deeper, more transformative opportunities for growth. When we feel safe to explore, question, and make mistakes, our capacity for discovery expands dramatically. ",
        "The journey of personal development weaves together intellectual understanding with emotional growth. This integration allows knowledge to become wisdom - not just information we possess, but insights that transform how we perceive and engage with the world. ",
        "Effective learning environments recognize that emotions like curiosity, interest, and appropriate levels of challenge create optimal conditions for growth. This emotional context significantly influences our attention, memory, creativity, and motivation. ",
        "Education at its best involves not just acquiring information, but developing a deeper relationship with knowledge itself - one characterized by curiosity, critical thinking, and the emotional satisfaction of understanding. This relationship becomes a foundation for lifelong learning and adaptation. "
      ];
      response += educationResponses[Math.floor(Math.random() * educationResponses.length)];
    } else if (mainTopic === "mathematics") {
      const mathResponses = [
        "Mathematics reveals the elegant patterns underlying our reality, providing a language that describes everything from the microscopic world of quantum physics to the vast expanses of cosmology. These mathematical frameworks allow us to model, predict, and understand complex systems with remarkable precision. ",
        "The beauty of mathematics lies in its unique blend of logical rigor and creative exploration. Each mathematical domain - from geometry to calculus - offers different lenses through which we can view and analyze the world, revealing insights that might remain hidden from other perspectives. ",
        "Mathematical thinking extends far beyond calculation to encompass pattern recognition, abstract reasoning, and systematic problem-solving. These cognitive tools have applications across virtually every field of human endeavor, from engineering and economics to art and music. ",
        "The history of mathematics reflects humanity's intellectual journey - from practical concerns like counting and measuring to profound explorations of infinity, uncertainty, and multidimensional spaces. Each breakthrough builds upon previous insights while opening new frontiers of possibility. ",
        "The language of mathematics allows us to transcend the limitations of ordinary perception, enabling us to conceptualize and work with dimensions, scales, and relationships that would otherwise remain inaccessible to human understanding. This expansion of our cognitive horizons has been central to scientific and technological progress. "
      ];
      response += mathResponses[Math.floor(Math.random() * mathResponses.length)];
    } else if (mainTopic === "physics") {
      const physicsResponses = [
        "Physics explores the fundamental laws governing matter, energy, space, and time. From the subatomic realm of quantum mechanics to the cosmic scale of relativity, these principles reveal the hidden order underlying the physical world and continue to reshape our understanding of reality itself. ",
        "The evolution of physics reflects our deepening understanding of nature's operating principles. Each theoretical framework - from Newtonian mechanics to quantum field theory - captures different aspects of physical reality, with each new paradigm extending rather than simply replacing earlier insights. ",
        "Physical laws demonstrate a remarkable balance between simplicity and complexity. The most fundamental equations are often elegantly concise, yet they generate the extraordinary diversity and intricacy we observe in natural phenomena across all scales of existence. ",
        "Physics constantly negotiates the boundary between the known and unknown. Today's frontier questions about dark matter, quantum gravity, and the nature of consciousness reveal how each answered question tends to unveil deeper mysteries awaiting exploration. ",
        "The concepts of modern physics often challenge our intuitive understanding of reality. Phenomena like quantum entanglement, time dilation, and wave-particle duality remind us that the universe operates according to principles that may seem counterintuitive but are nevertheless demonstrably true. "
      ];
      response += physicsResponses[Math.floor(Math.random() * physicsResponses.length)];
    } else if (mainTopic === "chemistry") {
      const chemistryResponses = [
        "Chemistry explores how matter interacts, combines, and transforms at the molecular and atomic levels. These fundamental processes underlie everything from biological systems and environmental cycles to advanced materials and pharmaceutical development. ",
        "The periodic table represents one of science's greatest organizational achievements - revealing deep patterns in elemental properties that allow us to predict chemical behaviors and design new compounds with specific characteristics for countless applications. ",
        "Chemical reactions demonstrate nature's remarkable efficiency in breaking and forming bonds to create new structures with entirely different properties. Understanding these transformation pathways gives us powerful tools for synthesizing materials that wouldn't otherwise exist. ",
        "The boundary between chemistry and physics becomes increasingly blurred at the quantum level, where electron configurations and energy states determine chemical properties. This intersection continues to yield profound insights about matter's fundamental nature. ",
        "Modern analytical chemistry employs increasingly sophisticated tools to identify, quantify, and characterize substances with extraordinary precision. These capabilities have revolutionized fields from forensic science and environmental monitoring to medical diagnostics and quality control. "
      ];
      response += chemistryResponses[Math.floor(Math.random() * chemistryResponses.length)];
    } else if (mainTopic === "biology") {
      const biologyResponses = [
        "Biology reveals the extraordinary complexity and elegance of living systems, which operate through intricate networks of molecular interactions, cellular processes, and ecological relationships that have evolved over billions of years. ",
        "The central dogma of molecular biology - how DNA encodes RNA which produces proteins - represents one of science's most profound insights, explaining the mechanisms through which genetic information guides the development and functioning of all living organisms. ",
        "Evolutionary principles provide a unifying framework for understanding the diversity of life, showing how natural selection, genetic variation, and adaptation have shaped the remarkable array of species and biological processes we observe today. ",
        "Modern biology increasingly recognizes the importance of emergent properties in living systems, where complex behaviors and capabilities arise from the interactions of simpler components in ways that couldn't be predicted by studying those components in isolation. ",
        "The boundaries between traditional biological disciplines are giving way to more integrated approaches that recognize how molecular mechanisms, cellular processes, physiological systems, and ecological relationships form a continuous spectrum of biological organization. "
      ];
      response += biologyResponses[Math.floor(Math.random() * biologyResponses.length)];
    } else if (mainTopic === "history") {
      const historyResponses = [
        "Historical inquiry illuminates how human societies have developed, interacted, and transformed over time. These patterns of continuity and change provide valuable context for understanding contemporary challenges and possibilities. ",
        "The study of history involves not just cataloging events but interpreting their significance through multiple perspectives. This interpretive dimension makes historical understanding an ongoing conversation that evolves as new evidence emerges and analytical frameworks develop. ",
        "Historical narratives reflect choices about whose stories are centered and which frameworks are applied. Recognizing these choices allows for more nuanced understanding of how the past is constructed and represented across different contexts. ",
        "Primary sources form the essential foundation of historical research, offering direct evidence from the periods under study. Yet these materials always require careful contextual interpretation, as they too reflect particular perspectives and purposes. ",
        "Historical thinking involves developing temporal perspective - the ability to understand past events and societies on their own terms while recognizing the contingent nature of historical development and avoiding anachronistic judgments. "
      ];
      response += historyResponses[Math.floor(Math.random() * historyResponses.length)];
    } else if (mainTopic === "philosophy") {
      const philosophyResponses = [
        "Philosophical inquiry examines foundational questions about knowledge, reality, consciousness, ethics, beauty, and meaning. These explorations help us clarify our thinking, examine our assumptions, and develop more coherent understanding of ourselves and our place in the world. ",
        "Philosophy often begins with questioning what seems obvious or given, recognizing that even our most basic concepts and frameworks deserve careful examination. This critical stance helps reveal hidden assumptions that might otherwise shape our thinking without our awareness. ",
        "Different philosophical traditions offer distinct approaches to perennial questions, demonstrating how varied starting points and methodologies can illuminate different aspects of human experience and understanding. This diversity enriches our collective wisdom. ",
        "Philosophical thinking involves developing conceptual clarity, logical consistency, and interpretive charity - skills that enhance our ability to navigate complex intellectual terrain across many domains of knowledge and practice. ",
        "The history of philosophy reveals an ongoing conversation across time and cultures, with thinkers responding to, building upon, and challenging the ideas of their predecessors. This intellectual tradition continues to evolve as new voices, problems, and approaches emerge. "
      ];
      response += philosophyResponses[Math.floor(Math.random() * philosophyResponses.length)];
    } else if (mainTopic === "programming" || mainTopic === "data_science") {
      const programmingResponses = [
        "Programming languages provide structured ways to express computational logic, allowing us to transform abstract problem-solving into concrete instructions that computers can execute. Each language offers different strengths and paradigms suited to particular domains and purposes. ",
        "Software development involves balancing functional requirements with considerations of efficiency, maintainability, scalability, and user experience. These multidimensional constraints make programming both technically challenging and creatively satisfying. ",
        "Computational thinking extends beyond coding to encompass problem decomposition, pattern recognition, abstraction, and algorithmic design. These cognitive approaches have applications far beyond software development. ",
        "Data science integrates statistical methods, domain expertise, and programming skills to extract meaningful insights from complex datasets. This interdisciplinary field has transformed how we understand patterns and make predictions across virtually every sector. ",
        "Modern software systems often involve multiple layers of abstraction, from low-level hardware interfaces to high-level application frameworks. This architecture allows developers to work productively at appropriate levels of detail while ensuring that components interact effectively. "
      ];
      response += programmingResponses[Math.floor(Math.random() * programmingResponses.length)];
    } else if (mainTopic === "economics") {
      const economicsResponses = [
        "Economics examines how societies allocate scarce resources among competing uses. These allocation mechanisms - whether markets, planning, or hybrid systems - reflect values and priorities while generating distinct patterns of efficiency, growth, and distribution. ",
        "Economic analysis employs both theoretical models and empirical methods to understand complex systems of production, exchange, and consumption. This dual approach helps illuminate the principles and patterns underlying economic activities across different contexts. ",
        "The boundary between economics and other social sciences has become increasingly permeable, with behavioral economics incorporating psychological insights, institutional economics addressing social and political structures, and ecological economics integrating environmental considerations. ",
        "Economic systems constantly evolve through technological innovation, institutional change, and shifting social preferences. Understanding these dynamics requires attention to both equilibrium principles and the processes through which economies transform over time. ",
        "Policy discussions often involve different economic frameworks that emphasize distinct values and priorities - from efficiency and growth to equity, sustainability, and resilience. Recognizing these normative dimensions helps clarify the stakes in economic debates. "
      ];
      response += economicsResponses[Math.floor(Math.random() * economicsResponses.length)];
    } else if (mainTopic === "psychology") {
      const psychologyResponses = [
        "Psychological research illuminates the complex interplay between cognition, emotion, behavior, and social context that shapes human experience. These insights help us understand both common patterns and individual differences in how people perceive, think, feel, and act. ",
        "The mind operates through both conscious and unconscious processes, with many influential mental activities occurring below the threshold of awareness. This layered architecture creates fascinating dynamics as explicit goals interact with implicit associations and automatic responses. ",
        "Human development involves complex interactions between biological predispositions and environmental influences across the lifespan. This developmental perspective reveals how early experiences create foundations that shape, but don't determine, later psychological functioning. ",
        "Psychological well-being encompasses multiple dimensions - from the hedonic experience of positive emotions to the eudaimonic qualities of meaning, purpose, and growth. This multifaceted understanding informs more nuanced approaches to mental health and human flourishing. ",
        "The science of psychology continues to evolve through methodological innovations, theoretical refinements, and greater inclusion of diverse perspectives. These developments enhance our ability to understand human experience in all its complexity and variety. "
      ];
      response += psychologyResponses[Math.floor(Math.random() * psychologyResponses.length)];
    } else if (mainTopic === "visual_arts" || mainTopic === "music" || mainTopic === "film_media") {
      const artsResponses = [
        "Artistic expression provides unique ways of exploring, representing, and responding to human experience. Through various media and forms, art engages our senses, emotions, and intellect while offering perspectives that might remain inaccessible through other modes of communication. ",
        "Creative works exist in dialogue with cultural contexts, artistic traditions, and social conditions. This interconnectedness means that art both reflects and shapes the worlds from which it emerges, sometimes reinforcing prevailing values and sometimes challenging them. ",
        "Aesthetic experiences involve complex interactions between formal elements, representational content, emotional resonance, and conceptual dimensions. This multifaceted nature allows art to communicate on several levels simultaneously. ",
        "Artistic traditions continually evolve through innovation, cross-cultural exchange, and reinterpretation of established forms. This dynamic tension between continuity and change drives the development of new artistic possibilities while maintaining connections to cultural heritage. ",
        "The creation and reception of art engage cognitive, emotional, and somatic dimensions of human experience. This holistic involvement offers opportunities for both immersive absorption and reflective contemplation that can expand our awareness and understanding. "
      ];
      response += artsResponses[Math.floor(Math.random() * artsResponses.length)];
    } else if (mainTopic === "sports") {
      const sportsResponses = [
        "Athletic activities combine physical prowess with strategic thinking, psychological resilience, and often team coordination. This integration of multiple capacities creates rich opportunities for both personal development and collective achievement. ",
        "Sports participation cultivates embodied knowledge - understanding that develops through physical experience rather than abstract cognition alone. This experiential learning builds capabilities that extend beyond specific techniques to include broader kinesthetic awareness and physical intelligence. ",
        "Competitive athletics creates structured contexts for exploring human capabilities, limitations, and potential. These frameworks allow for meaningful comparison and improvement while providing motivational challenges that inspire dedicated practice and performance. ",
        "The cultural significance of sports extends far beyond the activities themselves to include community identity, shared narratives, economic impacts, and sometimes political symbolism. These broader dimensions reflect how athletic endeavors become interwoven with social meaning. ",
        "Physical activities engage our evolutionary heritage as beings adapted for movement, exploration, and skilled action. The satisfaction many people find in athletic pursuits connects to these deep biological foundations while also incorporating culturally specific forms and values. "
      ];
      response += sportsResponses[Math.floor(Math.random() * sportsResponses.length)];
    } else {
      // General responses for any other topic
      const generalResponses = [
        "Human experience unfolds across so many fascinating dimensions - each with its own emotional textures and patterns. Exploring these areas with awareness and curiosity often reveals unexpected insights and connections. ",
        "The topics we're drawn to often reflect what matters most to us at a given moment. These interests and concerns create a window into our values and aspirations, showing what we find meaningful or in need of attention. ",
        "Meaningful conversations like this one create spaces where ideas and perspectives can be shared and explored. This exchange itself represents a unique form of connection - one built around curiosity and mutual discovery. ",
        "The questions we ask shape the understanding we develop. By approaching topics with openness and nuanced thinking, we often discover deeper patterns and possibilities that might otherwise remain hidden. ",
        "Each area of human experience offers its own wisdom and insights. By bringing emotional intelligence to these explorations, we can engage with them not just intellectually, but in ways that enrich our understanding and choices. "
      ];
      response += generalResponses[Math.floor(Math.random() * generalResponses.length)];
    }

    // Add conversation continuation
    response += this.getRandomElement(this.TOPIC_TRANSITIONS);

    return response;
  }

  // Generate focused emotional responses when API is unavailable
  public static generateEmotionFocusedResponse(text: string): string {
    // Analyze the text with our VAD model
    const vadScore = analyzeTextWithVAD(text);
    
    // Generate emotional insight
    const emotionalInsight = generateEmotionalInsight(vadScore);
    
    // Generate an appropriate response
    const response = this.generateResponse(text, vadScore);
    
    // Remove any pet names or terms of endearment
    return this.removePetNames(response, text);
  }
  
  /**
   * Analyzes the user's text and extracts writing style features
   * @param text The user's input text
   * @param messageHistory Optional array of previous user messages for more accurate style analysis
   * @returns TextStyleFeatures object containing style markers
   */
  public static analyzeTextStyle(text: string, messageHistory: string[] = []): TextStyleFeatures {
    // Combine current message with history for better analysis
    const allText = [text, ...messageHistory].join(' ');
    const lowercaseText = allText.toLowerCase();
    
    // Simple approach to detect emoticons and basic emoji patterns
    const basicEmoticons = /:\)|:\(|:D|:P|;P|;\)|;P|;\(|:\//g;
    const heartPattern = /<3/g;
    
    // Combine emoticon patterns
    const foundEmoticons = allText.match(basicEmoticons) || [];
    const foundHearts = allText.match(heartPattern) || [];
    const allEmoji = [...foundEmoticons, ...foundHearts];
    
    const usesEmojis = allEmoji.length > 0;
    
    // Use simple emoji set for fallback
    const defaultEmojis = [':)', ':D', '<3', ';)', ':P'];
    
    // Count emojis and get most frequent ones
    const emojiCounts: Record<string, number> = {};
    allEmoji.forEach((emoji: string) => {
      emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
    });
    
    const preferredEmojis = allEmoji.length > 0 ? 
      Object.entries(emojiCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([emoji]) => emoji) 
      : defaultEmojis;

    // Extract sentences for length analysis
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const averageSentenceLength = sentences.length > 0 
      ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
      : 10; // Default if no complete sentences
    
    // Common casual greetings and closings used by the user
    const casualGreetingRegex = /\b(hey|hi|hello|yo|sup|wassup|howdy|hiya|heya|what's up|whats up|how's it going|hows it going)\b/gi;
    const casualGreetings = Array.from(new Set(
      (allText.match(casualGreetingRegex) || []).map(g => g.toLowerCase())
    ));
    
    const casualClosingRegex = /\b(bye|see ya|later|ttyl|talk to you later|cya|peace|cheers|thanks|thx)\b/gi;
    const casualClosings = Array.from(new Set(
      (allText.match(casualClosingRegex) || []).map(c => c.toLowerCase())
    ));
    
    // Check for "bro" or similar casual address
    const usesBro = /\b(bro|bruh|dude|man|mate|buddy|pal|fam)\b/i.test(lowercaseText);
    
    // Check for internet shorthand/texting style
    const shorthandRegex = /\b(lol|lmao|rofl|omg|wtf|idk|tbh|imo|imho|btw|afaik|rn|u|ur|r|y|n|k|pls|thx)\b/i;
    const usesShorthand = shorthandRegex.test(lowercaseText);
    
    // Check for ALL CAPS sections (excitement or emphasis)
    const usesAllCaps = /[A-Z]{3,}/.test(allText);
    
    // Check for all lowercase style (casual/lazy typing)
    const usesLowerCase = text === text.toLowerCase() && text.length > 10;
    
    // Check for heavy use of exclamations
    const usesExclamations = (allText.match(/!/g) || []).length > 1;
    
    // Check for ellipses usage
    const usesEllipses = /\.{3,}/.test(allText);
    
    // Check for slang usage
    const slangRegex = /\b(cool|awesome|lit|fire|dope|sick|wicked|rad|sweet|chill|vibe|flex|slay|goals|mood|tea|shade|ghosted|salty|extra|basic|sus|low-key|high-key|yeet|bet|cap|no cap)\b/i;
    const usesSlang = slangRegex.test(lowercaseText);
    
    return {
      usesEmojis,
      usesBro,
      usesShorthand,
      usesAllCaps,
      usesLowerCase,
      usesExclamations,
      usesEllipses,
      usesSlang,
      preferredEmojis,
      casualGreetings: casualGreetings.length > 0 ? casualGreetings : ['hi', 'hey'],
      casualClosings: casualClosings.length > 0 ? casualClosings : ['thanks', 'bye'],
      averageSentenceLength
    };
  }
  
  /**
   * Applies the user's writing style to an AI response
   * @param originalResponse The initial AI response
   * @param userStyle The analyzed style of the user
   * @returns Modified response that mimics the user's style
   */
  /**
   * Removes pet names and terms of endearment from a response unless user has used them
   * @param response The response to check
   * @param userText The user's original message
   * @returns Response without unwanted terms of endearment
   */
  private static removePetNames(response: string, userText: string): string {
    // Only filter out pet names if user hasn't used them
    const userTextLower = userText.toLowerCase();
    
    // Check if user has used any pet names themselves
    const userUsesPetNames = this.STYLE_GUIDELINES.petNames.some(term => 
      userTextLower.includes(term.toLowerCase())
    );
    
    // If user uses pet names, don't filter them out
    if (userUsesPetNames) {
      return response;
    }
    
    // Otherwise, filter out all pet names
    let cleanedResponse = response;
    this.STYLE_GUIDELINES.petNames.forEach(term => {
      // Create regex that catches the pet name with potential comma, space or punctuation
      const regex = new RegExp(`\\b${term}\\b[,\\s]*`, 'gi');
      cleanedResponse = cleanedResponse.replace(regex, '');
    });
    
    return cleanedResponse;
  }

  public static applyUserStyle(originalResponse: string, userStyle: TextStyleFeatures): string {
    let styledResponse = originalResponse;
    
    // Convert to lowercase if user uses lowercase
    if (userStyle.usesLowerCase) {
      styledResponse = styledResponse.toLowerCase();
      
      // But still capitalize 'I' for readability
      styledResponse = styledResponse.replace(/\bi\b/g, 'I');
    }
    
    // Add bro/dude/etc. if user uses them
    if (userStyle.usesBro) {
      // Add bro-type address at beginning or end of sentences occasionally
      const sentences = styledResponse.split(/(?<=[.!?])\s+/);
      styledResponse = sentences.map((sentence, i) => {
        // Add bro at beginning of some sentences
        if (i > 0 && Math.random() < 0.3) {
          return "Bro, " + sentence;
        }
        // Add bro at end of some sentences
        else if (Math.random() < 0.3) {
          return sentence.replace(/[.!?]$/, ", bro$&");
        }
        return sentence;
      }).join(' ');
    }
    
    // Replace some words with shorthand
    if (userStyle.usesShorthand) {
      const shorthandMap: Record<string, string> = {
        'you': 'u',
        'your': 'ur',
        'are': 'r',
        'for': '4',
        'to': '2',
        'be': 'b',
        'please': 'pls',
        'thanks': 'thx',
        'thank you': 'thx',
        'right now': 'rn',
        'I don\'t know': 'idk',
        'in my opinion': 'imo',
        'by the way': 'btw',
        'as far as I know': 'afaik'
      };
      
      // Only replace some instances to keep readability
      Object.entries(shorthandMap).forEach(([word, shorthand]) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const instances = (styledResponse.match(regex) || []).length;
        
        // Replace ~50% of instances
        if (instances > 0) {
          const toReplace = Math.ceil(instances * 0.5);
          for (let i = 0; i < toReplace; i++) {
            styledResponse = styledResponse.replace(regex, shorthand);
          }
        }
      });
    }
    
    // Add exclamations if user uses them
    if (userStyle.usesExclamations) {
      styledResponse = styledResponse.replace(/\./g, (match) => 
        Math.random() < 0.3 ? '!' : match
      );
      
      // Convert some sentences to exclamations
      styledResponse = styledResponse.replace(/(?<=[a-z])\./g, (match) => 
        Math.random() < 0.2 ? '!!' : match
      );
    }
    
    // Add ellipses if user uses them
    if (userStyle.usesEllipses) {
      styledResponse = styledResponse.replace(/\./g, (match) => 
        Math.random() < 0.15 ? '...' : match
      );
    }
    
    // Add emojis if user uses them
    if (userStyle.usesEmojis && userStyle.preferredEmojis.length > 0) {
      // Add emojis at the end of some sentences
      styledResponse = styledResponse.replace(/[.!?]/g, (match) => 
        Math.random() < 0.25 
          ? match + ' ' + userStyle.preferredEmojis[Math.floor(Math.random() * userStyle.preferredEmojis.length)]
          : match
      );
      
      // Add emoji at the very end
      if (Math.random() < 0.5) {
        styledResponse += ' ' + userStyle.preferredEmojis[Math.floor(Math.random() * userStyle.preferredEmojis.length)];
      }
    }
    
    // Add slang if user uses it
    if (userStyle.usesSlang) {
      const positiveSlang = ['awesome', 'cool', 'lit', 'sick', 'dope'];
      const casualSlang = ['tbh', 'ngl', 'low-key', 'high-key', 'vibe'];
      
      // Replace some adjectives with slang
      ['good', 'great', 'excellent', 'nice'].forEach(adj => {
        const regex = new RegExp(`\\b${adj}\\b`, 'gi');
        styledResponse = styledResponse.replace(regex, () => 
          positiveSlang[Math.floor(Math.random() * positiveSlang.length)]
        );
      });
      
      // Add casual slang phrases
      if (Math.random() < 0.3) {
        const slangPhrase = casualSlang[Math.floor(Math.random() * casualSlang.length)];
        styledResponse = slangPhrase + ', ' + styledResponse.charAt(0).toLowerCase() + styledResponse.slice(1);
      }
    }
    
    // Balance the sentence length to match user style
    if (userStyle.averageSentenceLength < 5) {
      // User uses very short sentences, break up long ones
      styledResponse = styledResponse.replace(/([^.!?]{20,})[,;]\s+([^.!?]+)/g, '$1. $2');
    }
    
    return styledResponse;
  }
  
  /**
   * Generates a response that matches the user's texting style
   * @param text The user's message
   * @param vadScore Emotional analysis of the text
   * @param messageHistory Optional array of previous user messages
   * @returns A response that mimics the user's style
   */
  public static generateImitationResponse(text: string, vadScore: VADScore, messageHistory: string[] = []): string {
    // First generate a regular response
    const regularResponse = this.generateResponse(text, vadScore);
    
    // Remove any pet names or terms of endearment unless user used them
    const filteredResponse = this.removePetNames(regularResponse, text);
    
    // Analyze user style
    const userStyle = this.analyzeTextStyle(text, messageHistory);
    
    // Apply the user's style to the response
    return this.applyUserStyle(filteredResponse, userStyle);
  }
}
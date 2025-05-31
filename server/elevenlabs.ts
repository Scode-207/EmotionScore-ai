interface ElevenLabsVoiceResponse {
  audio: Buffer;
  contentType: string;
}

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

/**
 * ElevenLabs Text-to-Speech Integration
 * Provides high-quality voice synthesis with emotional context awareness
 */
export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Convert text to speech with emotional context
   */
  async textToSpeech(
    text: string,
    voiceId: string = 'pNInz6obpgDQGcFmaJgB', // Adam voice - natural and clear
    emotionalContext?: { valence: number; arousal: number; dominance: number }
  ): Promise<ElevenLabsVoiceResponse> {
    try {
      // Adjust voice settings based on emotional context
      const voiceSettings = this.getEmotionalVoiceSettings(emotionalContext);

      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: voiceSettings
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      return {
        audio: audioBuffer,
        contentType: 'audio/mpeg'
      };
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      throw error;
    }
  }

  /**
   * Get available voices
   */
  async getVoices() {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ElevenLabs get voices error:', error);
      throw error;
    }
  }

  /**
   * Adjust voice parameters based on emotional context
   */
  private getEmotionalVoiceSettings(emotionalContext?: { valence: number; arousal: number; dominance: number }): VoiceSettings {
    if (!emotionalContext) {
      return {
        stability: 0.75,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      };
    }

    const { valence, arousal, dominance } = emotionalContext;

    // Adjust stability based on emotional state
    let stability = 0.75;
    let similarity_boost = 0.75;
    let style = 0.0;

    // High arousal = less stable, more expressive
    if (arousal > 0.6) {
      stability = Math.max(0.3, 0.75 - (arousal - 0.6) * 0.5);
      style = Math.min(0.3, arousal * 0.5);
    }

    // Negative valence = slightly more controlled
    if (valence < -0.3) {
      stability = Math.min(0.85, stability + 0.1);
      similarity_boost = Math.max(0.6, similarity_boost - 0.1);
    }

    // High dominance = more confident delivery
    if (dominance > 0.6) {
      similarity_boost = Math.min(0.9, similarity_boost + 0.15);
    }

    return {
      stability: Math.round(stability * 100) / 100,
      similarity_boost: Math.round(similarity_boost * 100) / 100,
      style: Math.round(style * 100) / 100,
      use_speaker_boost: true
    };
  }

  /**
   * Select appropriate voice based on emotional context and conversation tone
   */
  selectVoiceForContext(
    emotionalContext?: { valence: number; arousal: number; dominance: number; primaryEmotion?: string },
    conversationTone?: 'casual' | 'professional' | 'supportive' | 'energetic'
  ): string {
    // Default voices (you can expand this based on available ElevenLabs voices)
    const voices = {
      // Male voices
      adam: 'pNInz6obpgDQGcFmaJgB', // Natural, clear
      antoni: 'ErXwobaYiN019PkySvjV', // Well-rounded
      
      // Female voices  
      rachel: '21m00Tcm4TlvDq8ikWAM', // Calm, professional
      domi: 'AZnzlk1XvdvUeBnXmlld', // Strong, confident
      elli: 'MF3mGyEYCl7XYWbV9V6O', // Young, energetic
      
      // Character voices
      josh: 'TxGEqnHWrfWFTfGW9XjX', // Deep, warm
      arnold: 'VR6AewLTigWG4xSOukaG', // Distinctive
    };

    // Select voice based on context
    if (conversationTone === 'supportive' || (emotionalContext?.valence && emotionalContext.valence < -0.3)) {
      return voices.rachel; // Calm, supportive
    }
    
    if (conversationTone === 'energetic' || (emotionalContext?.arousal && emotionalContext.arousal > 0.7)) {
      return voices.elli; // Energetic
    }
    
    if (conversationTone === 'professional') {
      return voices.antoni; // Professional
    }

    // Default to Adam for general conversation
    return voices.adam;
  }
}

// Export a singleton instance
export const elevenLabsService = new ElevenLabsService(process.env.ELEVENLABS_API_KEY || '');
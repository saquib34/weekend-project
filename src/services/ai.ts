import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Activity, WeekendMood, PlanSuggestion } from '../types';

// Types for AI responses
export interface AIConversation {
  id: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }[];
  context: {
    mood: WeekendMood;
    budget?: number;
    location?: string;
    preferences?: string[];
  };
}

interface AIRecommendationRequest {
  mood: WeekendMood;
  budget?: { min: number; max: number };
  location?: string;
  timeAvailable?: string;
  groupSize?: number;
  preferences?: string[];
  existingActivities?: Activity[];
  weatherConditions?: string;
}

class WeekendAI {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private isInitialized = false;

  constructor() {
    this.initializeAI();
  }

  private async initializeAI() {
    try {
      // Only initialize if API key is available
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('Gemini API key not found. AI features will use fallback recommendations.');
        return;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Gemini AI:', error);
    }
  }

  async generateWeekendPlan(request: AIRecommendationRequest): Promise<PlanSuggestion> {
    if (!this.isInitialized || !this.model) {
      return this.getFallbackRecommendation(request);
    }

    try {
      const prompt = this.buildPlanningPrompt(request);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return this.parseAIResponse(response.text(), request);
    } catch (error) {
      console.error('AI generation failed:', error);
      return this.getFallbackRecommendation(request);
    }
  }

  async improveActivity(activity: Activity, userFeedback: string): Promise<string> {
    if (!this.isInitialized || !this.model) {
      return this.getFallbackActivityImprovement(activity, userFeedback);
    }

    try {
      const prompt = `
        Improve this weekend activity based on user feedback:
        
        Activity: ${activity.title}
        Description: ${activity.description}
        Category: ${activity.category}
        Mood: ${activity.mood.join(', ')}
        
        User Feedback: "${userFeedback}"
        
        Please suggest specific improvements to make this activity better match the user's preferences.
        Focus on practical, actionable suggestions.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return response.text();
    } catch (error) {
      console.error('Activity improvement failed:', error);
      return this.getFallbackActivityImprovement(activity, userFeedback);
    }
  }

  async explainRecommendation(activityId: string, context: any): Promise<string> {
    if (!this.isInitialized || !this.model) {
      return 'This activity was selected based on your mood and preferences.';
    }

    try {
      const prompt = `
        Explain why activity ${activityId} was recommended for a ${context.mood} weekend:
        
        Context: ${JSON.stringify(context, null, 2)}
        
        Provide a personalized, engaging explanation in 2-3 sentences.
        Focus on the emotional and practical benefits.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return response.text();
    } catch (error) {
      console.error('Explanation generation failed:', error);
      return 'This activity was selected based on your mood and preferences.';
    }
  }

  async generateConversationResponse(conversation: AIConversation, newMessage: string): Promise<string> {
    if (!this.isInitialized || !this.model) {
      return this.getFallbackConversationResponse(newMessage);
    }

    try {
      const conversationHistory = conversation.messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const prompt = `
        You are a helpful weekend planning assistant. Continue this conversation:
        
        ${conversationHistory}
        user: ${newMessage}
        
        Context: User wants a ${conversation.context.mood} weekend
        ${conversation.context.budget ? `Budget: $${conversation.context.budget}` : ''}
        ${conversation.context.location ? `Location: ${conversation.context.location}` : ''}
        
        Provide a helpful, friendly response that moves the conversation toward creating a great weekend plan.
        Ask clarifying questions if needed, or suggest specific activities.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return response.text();
    } catch (error) {
      console.error('Conversation response failed:', error);
      return this.getFallbackConversationResponse(newMessage);
    }
  }

  private buildPlanningPrompt(request: AIRecommendationRequest): string {
    return `
      Create a weekend plan with the following requirements:
      
      Mood: ${request.mood}
      ${request.budget ? `Budget: $${request.budget.min}-$${request.budget.max}` : ''}
      ${request.location ? `Location: ${request.location}` : ''}
      ${request.timeAvailable ? `Time Available: ${request.timeAvailable}` : ''}
      ${request.groupSize ? `Group Size: ${request.groupSize} people` : ''}
      ${request.preferences ? `Preferences: ${request.preferences.join(', ')}` : ''}
      ${request.weatherConditions ? `Weather: ${request.weatherConditions}` : ''}
      
      Please suggest 6-8 activities (3-4 for Saturday, 3-4 for Sunday) that would create an amazing weekend experience.
      
      Return a JSON response with this structure:
      {
        "title": "Weekend plan title",
        "description": "Brief description",
        "confidence": 0.8,
        "activities": {
          "saturday": [
            {
              "title": "Activity name",
              "timeSlot": "morning|afternoon|evening",
              "description": "Why this activity fits",
              "confidence": 0.9
            }
          ],
          "sunday": [...]
        },
        "estimatedBudget": 150,
        "reasoning": "Why this plan works for the user"
      }
    `;
  }

  private parseAIResponse(aiResponse: string, request: AIRecommendationRequest): PlanSuggestion {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          id: Date.now().toString(),
          title: parsed.title || 'AI-Generated Weekend Plan',
          description: parsed.description || 'A personalized weekend plan just for you',
          confidence: parsed.confidence || 0.8,
          activities: {
            saturday: parsed.activities?.saturday?.map((act: any) => ({
              activityId: `ai-${Date.now()}-${Math.random()}`,
              confidence: act.confidence || 0.8,
              reasoning: act.description || act.reasoning || 'Recommended by AI',
              alternatives: [],
              personalizedNotes: act.notes,
            })) || [],
            sunday: parsed.activities?.sunday?.map((act: any) => ({
              activityId: `ai-${Date.now()}-${Math.random()}`,
              confidence: act.confidence || 0.8,
              reasoning: act.description || act.reasoning || 'Recommended by AI',
              alternatives: [],
              personalizedNotes: act.notes,
            })) || [],
          },
          estimatedBudget: parsed.estimatedBudget || 100,
          mood: request.mood,
          reasoning: parsed.reasoning || 'This plan was created based on your preferences and mood.',
        };
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error);
    }

    return this.getFallbackRecommendation(request);
  }

  private getFallbackRecommendation(request: AIRecommendationRequest): PlanSuggestion {
    const fallbackActivities = {
      relaxed: ['spa-day', 'reading', 'movie-night', 'tea-ceremony'],
      energetic: ['hiking', 'rock-climbing', 'bike-ride', 'dance-class'],
      romantic: ['picnic', 'cooking-class', 'wine-tasting', 'sunset-walk'],
      social: ['game-night', 'trivia-night', 'barbecue', 'karaoke'],
      adventurous: ['escape-room', 'ghost-tour', 'kayaking', 'photography-walk'],
      productive: ['cooking-class', 'language-exchange', 'workshop', 'bookstore'],
      spontaneous: ['farmers-market', 'street-festival', 'art-walk', 'food-truck'],
      peaceful: ['garden-stroll', 'meditation', 'nature-walk', 'journaling'],
    };

    const moodActivities = fallbackActivities[request.mood] || fallbackActivities.relaxed;
    
    return {
      id: Date.now().toString(),
      title: `${request.mood.charAt(0).toUpperCase() + request.mood.slice(1)} Weekend`,
      description: `A carefully curated ${request.mood} weekend plan`,
      confidence: 0.7,
      activities: {
        saturday: moodActivities.slice(0, 2).map(id => ({
          activityId: id,
          confidence: 0.7,
          reasoning: `Perfect for a ${request.mood} Saturday`,
          alternatives: [],
        })),
        sunday: moodActivities.slice(2, 4).map(id => ({
          activityId: id,
          confidence: 0.7,
          reasoning: `Great way to spend a ${request.mood} Sunday`,
          alternatives: [],
        })),
      },
      estimatedBudget: request.budget?.max || 100,
      mood: request.mood,
      reasoning: `This plan focuses on ${request.mood} activities that match your preferences.`,
    };
  }

  private getFallbackActivityImprovement(activity: Activity, feedback: string): string {
    return `Based on your feedback about "${activity.title}", here are some suggestions:
    
    1. Consider adjusting the timing or duration to better fit your schedule
    2. Add companions who share similar interests to enhance the experience
    3. Look for variations of this activity in different locations
    4. Combine it with complementary activities that share the same mood
    
    Your feedback helps us understand that you'd like: ${feedback}`;
  }

  private getFallbackConversationResponse(message: string): string {
    console.log('Generating fallback response for:', message);
    const responses = [
      "That sounds great! What kind of mood are you going for this weekend?",
      "I'd love to help you plan something amazing! Tell me more about your preferences.",
      "Interesting! How much time do you have available for activities?",
      "That's a wonderful idea! Would you prefer indoor or outdoor activities?",
      "Perfect! Are you planning this weekend for yourself or with others?",
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }
}

// Singleton instance
export const weekendAI = new WeekendAI();

// Hook for easy use in components
export const useWeekendAI = () => {
  return {
    generatePlan: (request: AIRecommendationRequest) => weekendAI.generateWeekendPlan(request),
    improveActivity: (activity: Activity, feedback: string) => weekendAI.improveActivity(activity, feedback),
    explainRecommendation: (activityId: string, context: any) => weekendAI.explainRecommendation(activityId, context),
    chat: (conversation: AIConversation, message: string) => weekendAI.generateConversationResponse(conversation, message),
  };
};

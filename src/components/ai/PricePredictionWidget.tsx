import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWeekendPlanStore } from '../../stores/weekendPlanStore';
import { useActivityStore } from '../../stores/activityStore';
import { useWeekendAI } from '../../services/ai';
import { Button } from '../ui/Button';

interface PricePrediction {
  totalCost: number;
  breakdown: {
    category: string;
    amount: number;
    confidence: number;
  }[];
  tips: string[];
  budgetOptimization: string;
  priceFactors: {
    factor: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
  }[];
}

interface PricePredictionWidgetProps {
  className?: string;
}

export const PricePredictionWidget: React.FC<PricePredictionWidgetProps> = ({ 
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { currentPlan, getTotalEstimatedCost } = useWeekendPlanStore();
  const { getActivityById } = useActivityStore();
  const { chat } = useWeekendAI();

  const generatePricePrediction = async () => {
    if (!currentPlan) return;

    setIsLoading(true);
    setError(null);

    try {
      const activities = currentPlan.activities.map(scheduled => {
        const activity = getActivityById(scheduled.activityId);
        return activity ? {
          name: activity.title,
          category: activity.category,
          duration: activity.duration,
          cost: activity.estimatedCost?.min || 0,
          location: activity.location
        } : null;
      }).filter(Boolean);

      const prompt = `
        Analyze these weekend activities and provide a detailed price prediction:
        
        Current Plan: ${currentPlan.title}
        Mood: ${currentPlan.mood}
        Budget Target: $${currentPlan.budget?.target || 'not set'}
        Current Estimated: $${getTotalEstimatedCost()}
        
        Activities:
        ${activities.map(act => `- ${act?.name} (${act?.category}) - $${act?.cost} - ${act?.duration}min`).join('\n')}
        
        Please provide:
        1. Total predicted cost with confidence level
        2. Cost breakdown by category
        3. 3-5 money-saving tips
        4. Budget optimization suggestions
        5. Price impact factors (season, location, timing)
        
        Format as JSON with this structure:
        {
          "totalCost": number,
          "breakdown": [{"category": string, "amount": number, "confidence": number}],
          "tips": [string],
          "budgetOptimization": string,
          "priceFactors": [{"factor": string, "impact": "high|medium|low", "description": string}]
        }
      `;

      const conversation: any = {
        id: 'price-prediction',
        messages: [],
        context: { type: 'price-prediction' }
      };
      
      const response = await chat(conversation, prompt);
      
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const predictionData = JSON.parse(jsonMatch[0]);
        setPrediction(predictionData);
      } else {
        // Fallback if AI doesn't return proper JSON
        setPrediction({
          totalCost: getTotalEstimatedCost() * 1.15, // Add 15% contingency
          breakdown: [
            { category: 'Food & Dining', amount: getTotalEstimatedCost() * 0.4, confidence: 85 },
            { category: 'Entertainment', amount: getTotalEstimatedCost() * 0.3, confidence: 80 },
            { category: 'Transportation', amount: getTotalEstimatedCost() * 0.2, confidence: 90 },
            { category: 'Miscellaneous', amount: getTotalEstimatedCost() * 0.1, confidence: 70 }
          ],
          tips: [
            'Look for happy hour specials and early bird discounts',
            'Consider group deals and bundle packages',
            'Check for free community events as alternatives'
          ],
          budgetOptimization: 'Your current plan is well-balanced. Consider adjusting timing for better deals.',
          priceFactors: [
            { factor: 'Weekend Premium', impact: 'high', description: 'Weekend activities typically cost 20-30% more' },
            { factor: 'Seasonal Demand', impact: 'medium', description: 'Current season affects pricing' }
          ]
        });
      }
    } catch (err) {
      console.error('Price prediction error:', err);
      setError('Unable to generate price prediction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentPlan && isExpanded && !prediction) {
      generatePricePrediction();
    }
  }, [currentPlan, isExpanded]);

  if (!currentPlan) return null;

  const currentCost = getTotalEstimatedCost();
  const budgetTarget = currentPlan.budget?.target || 0;
  const budgetStatus = budgetTarget > 0 ? (currentCost / budgetTarget) : 0;

  return (
    <div className={`bg-white rounded-lg shadow-lg border ${className}`}>
      {/* Compact Header */}
      <motion.div
        className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
            <span className="text-lg text-green-600">💰</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Price Prediction</h3>
            <p className="text-sm text-gray-600">
              Current: ${currentCost.toFixed(2)}
              {budgetTarget > 0 && (
                <span className={`ml-2 ${budgetStatus > 1 ? 'text-red-600' : 'text-green-600'}`}>
                  ({((budgetStatus - 1) * 100).toFixed(0)}% {budgetStatus > 1 ? 'over' : 'under'} budget)
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {prediction && (
            <div className="text-right">
              <div className="font-semibold text-gray-900">
                ${prediction.totalCost.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">predicted</div>
            </div>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-lg">📈</span>
          </motion.div>
        </div>
      </motion.div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  <span className="ml-3 text-gray-600">Analyzing prices...</span>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-red-600">⚠️</span>
                    <span className="text-red-700">{error}</span>
                  </div>
                  <Button
                    onClick={generatePricePrediction}
                    size="sm"
                    variant="ghost"
                    className="mt-2 text-red-600 hover:bg-red-100"
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {prediction && !isLoading && (
                <div className="space-y-6 mt-4">
                  {/* Cost Breakdown */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Cost Breakdown</h4>
                    <div className="space-y-2">
                      {prediction.breakdown.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">{item.category}</span>
                            <span className="text-xs text-gray-500">({item.confidence}% confident)</span>
                          </div>
                          <span className="font-medium">${item.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price Factors */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Price Factors</h4>
                    <div className="space-y-2">
                      {prediction.priceFactors.map((factor, index) => (
                        <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            factor.impact === 'high' ? 'bg-red-500' :
                            factor.impact === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`} />
                          <div>
                            <div className="font-medium text-sm">{factor.factor}</div>
                            <div className="text-xs text-gray-600">{factor.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Money-Saving Tips */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Money-Saving Tips</h4>
                    <ul className="space-y-1">
                      {prediction.tips.map((tip, index) => (
                        <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-600 font-bold">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Budget Optimization */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 text-lg">💡</span>
                      <div>
                        <h4 className="font-medium text-blue-900 mb-1">Optimization Suggestion</h4>
                        <p className="text-sm text-blue-800">{prediction.budgetOptimization}</p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={generatePricePrediction}
                    size="sm"
                    variant="ghost"
                    className="w-full"
                  >
                    Refresh Prediction
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

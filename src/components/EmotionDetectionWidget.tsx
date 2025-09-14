import React, { useState, useEffect } from 'react';
import { useEmotionDetection, type DetectionResult } from '../hooks/useEmotionDetection';

interface EmotionDetectionWidgetProps {
  onEmotionChange?: (result: DetectionResult) => void;
  className?: string;
}

export const EmotionDetectionWidget: React.FC<EmotionDetectionWidgetProps> = ({ 
  onEmotionChange, 
  className 
}) => {
  const [enabled, setEnabled] = useState(true); // Auto-enable for smart detection
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false); // Hide by default

  const {
    videoRef,
    isLoading,
    isActive,
    lastDetection,
    hasCamera,
    startDetection,
    stopDetection,
  } = useEmotionDetection({
    enabled,
    interval: 2000, // Check every 2 seconds
    confidenceThreshold: 70,
    onDetection: onEmotionChange,
    onError: (error) => console.error('Emotion detection error:', error),
  });

  // Auto-start detection when component mounts
  useEffect(() => {
    if (enabled && !isActive) {
      setTimeout(() => startDetection(), 500);
    }
  }, [enabled, isActive, startDetection]);

  const handleEnableCameraDetection = () => {
    setShowPrivacyNotice(false);
    // Camera detection will be handled by the hook
  };

  const handleDisableDetection = () => {
    setEnabled(false);
    stopDetection();
  };

  if (showPrivacyNotice) {
    return (
      <div className={`p-4 bg-blue-50 rounded-lg border border-blue-200 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="text-2xl">📹</div>
          <div className="flex-1">
            <h3 className="font-medium text-blue-900 mb-2">
              Enable Camera Detection
            </h3>
            <p className="text-sm text-blue-700 mb-3">
              Upgrade to camera-based emotion detection for more accurate mood analysis.
            </p>
            <div className="text-xs text-blue-600 mb-3">
              <strong>Privacy First:</strong> All processing happens locally on your device. 
              No facial data is ever sent to servers or stored.
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEnableCameraDetection}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Enable Camera Detection
              </button>
              <button
                onClick={() => setShowPrivacyNotice(false)}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
              >
                Keep Smart Detection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main widget interface - always show when enabled
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Camera Feed (Hidden) */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="hidden"
        onLoadedData={() => {}}
      />

      {/* Emotion Status Panel */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="text-lg">😊</div>
            <h3 className="font-medium text-gray-900">Mood Detection</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isActive ? 'bg-green-500' : isLoading ? 'bg-yellow-500' : 'bg-gray-400'
            }`} />
            <span className="text-xs text-gray-500">
              {isActive ? 'Active' : isLoading ? 'Loading' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Current Mood Display */}
        {lastDetection && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Current Mood:</span>
              <div className="flex items-center gap-2">
                <span className="text-lg">{getMoodEmoji(lastDetection.dominantEmotion)}</span>
                <span className="font-medium text-gray-900 capitalize">
                  {lastDetection.dominantEmotion}
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round(lastDetection.confidence)}%
                </span>
              </div>
            </div>
            
            {/* Mood Confidence Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  getMoodColor(lastDetection.dominantEmotion)
                }`}
                style={{ width: `${lastDetection.confidence}%` }}
              />
            </div>
          </div>
        )}

        {/* No Detection State */}
        {!lastDetection && isActive && (
          <div className="text-center py-4">
            <div className="text-3xl mb-2">🤔</div>
            <p className="text-sm text-gray-600">
              Analyzing your mood...
            </p>
          </div>
        )}

        {/* Camera Permission / Error States */}
        {!hasCamera && (
          <div className="text-center py-4">
            <div className="text-2xl mb-2">📷</div>
            <p className="text-sm text-gray-600 mb-2">
              Camera access needed for emotion detection
            </p>
            <button
              onClick={startDetection}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Allow Camera Access
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            {hasCamera ? 'Using camera detection' : 'Smart detection active'}
          </div>
          <div className="flex gap-2">
            {!isActive && hasCamera && (
              <button
                onClick={startDetection}
                className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
              >
                Start
              </button>
            )}
            {isActive && (
              <button
                onClick={stopDetection}
                className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
              >
                Stop
              </button>
            )}
            <button
              onClick={handleDisableDetection}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              Disable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper functions for mood display
function getMoodEmoji(emotion: string): string {
  const moodEmojis: Record<string, string> = {
    happy: '😊',
    sad: '😢',
    angry: '😠',
    surprised: '😲',
    fearful: '😨',
    disgusted: '🤢',
    neutral: '😐',
    relaxed: '😌',
    excited: '🤩',
    focused: '🧐'
  };
  return moodEmojis[emotion] || '😊';
}

function getMoodColor(emotion: string): string {
  const moodColors: Record<string, string> = {
    happy: 'bg-green-500',
    relaxed: 'bg-blue-500',
    excited: 'bg-yellow-500',
    focused: 'bg-purple-500',
    sad: 'bg-blue-300',
    angry: 'bg-red-500',
    surprised: 'bg-orange-500',
    fearful: 'bg-gray-500',
    disgusted: 'bg-brown-500',
    neutral: 'bg-gray-400'
  };
  return moodColors[emotion] || 'bg-gray-400';
}

export default EmotionDetectionWidget;
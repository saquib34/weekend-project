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
    startCamera,
    stopCamera,
    triggerEmotion,
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

  // If disabled, show enable option
  if (!enabled) {
    return (
      <div className={`p-4 bg-gray-50 rounded-lg border border-gray-200 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-lg">😊</div>
            <h3 className="font-medium text-gray-900">Mood Detection</h3>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">Disabled</span>
          </div>
          <button
            onClick={() => setEnabled(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Enable
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Enable mood detection to get personalized activity recommendations based on your current emotional state.
        </p>
      </div>
    );
  }

  const handleEnableCameraDetection = () => {
    setShowPrivacyNotice(false);
    // Camera detection will be handled by the hook
  };

  const handleDisableDetection = () => {
    setEnabled(false);
    stopDetection();
    stopCamera();
  };

  const handleAllowCamera = async () => {
    try {
      await startCamera();
      // Start detection after camera is ready
      setTimeout(() => startDetection(), 500);
    } catch (error) {
      console.error('Failed to start camera:', error);
    }
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
              onClick={handleAllowCamera}
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
            {!isActive && enabled && (
              <button
                onClick={() => {
                  if (hasCamera) {
                    startDetection();
                  } else {
                    handleAllowCamera();
                  }
                }}
                className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
              >
                {hasCamera ? 'Start' : 'Start Camera'}
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

        {/* Emotion Test Buttons */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-2">Test Different Emotions:</div>
          <div className="flex flex-wrap gap-1">
            {[
              { emotion: 'happy', emoji: '😊', label: 'Happy' },
              { emotion: 'sad', emoji: '😢', label: 'Sad' },
              { emotion: 'angry', emoji: '😠', label: 'Angry' },
              { emotion: 'surprised', emoji: '😲', label: 'Surprised' },
              { emotion: 'fearful', emoji: '😨', label: 'Fearful' },
              { emotion: 'neutral', emoji: '😐', label: 'Neutral' },
            ].map(({ emotion, emoji, label }) => (
              <button
                key={emotion}
                onClick={() => triggerEmotion(emotion as any)}
                className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 flex items-center gap-1"
                title={`Test ${label} emotion`}
              >
                <span>{emoji}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
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
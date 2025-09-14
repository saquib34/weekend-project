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
        onLoadedData={() => console.log('Camera ready')}
      />

      {/* Status Display */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isActive ? 'bg-green-500' : isLoading ? 'bg-yellow-500' : 'bg-gray-400'
          }`} />
          <span className="text-sm text-gray-700">
            {isLoading ? 'Initializing...' : 
             isActive ? (hasCamera ? 'Camera Mode Active' : 'Smart Detection Active') : 
             'Mood Detection Inactive'}
          </span>
        </div>
        
        <div className="flex gap-2">
          {!hasCamera && !showPrivacyNotice && (
            <button
              onClick={() => setShowPrivacyNotice(true)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              📹 Upgrade
            </button>
          )}
          {enabled && (
            <button
              onClick={handleDisableDetection}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Disable
            </button>
          )}
        </div>
      </div>

      {/* Smart Detection Info */}
      {isActive && !hasCamera && (
        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
          ✨ Smart Detection uses time-based mood analysis to provide personalized recommendations
        </div>
      )}

      {/* Current Detection Results */}
      {isActive && (
        <div className="p-3 bg-white rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {lastDetection ? (
                <>
                  <span className="text-2xl">
                    {lastDetection.dominantEmotion === 'happy' ? '😊' :
                     lastDetection.dominantEmotion === 'sad' ? '😔' :
                     lastDetection.dominantEmotion === 'angry' ? '😠' :
                     lastDetection.dominantEmotion === 'surprised' ? '😲' :
                     lastDetection.dominantEmotion === 'fearful' ? '😰' :
                     lastDetection.dominantEmotion === 'disgusted' ? '🤢' :
                     '😐'}
                  </span>
                  Current Mood: {lastDetection.dominantEmotion}
                </>
              ) : (
                <>
                  <span className="text-2xl">🔄</span>
                  Analyzing mood...
                </>
              )}
            </span>
            {lastDetection && (
              <span className="text-xs text-gray-500">
                {lastDetection.confidence.toFixed(0)}% confidence
              </span>
            )}
          </div>
          
          {lastDetection && (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <span className="px-2 py-1 bg-blue-100 rounded text-blue-800">
                  Energy: {lastDetection.energyLevel}
                </span>
                {lastDetection.age && (
                  <span className="px-2 py-1 bg-green-100 rounded text-green-800">
                    Age: ~{lastDetection.age}
                  </span>
                )}
                {lastDetection.gender && (
                  <span className="px-2 py-1 bg-purple-100 rounded text-purple-800">
                    {lastDetection.gender}
                  </span>
                )}
              </div>
              
              {/* Emotion Breakdown */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-700 mb-2">Emotion Breakdown:</div>
                {Object.entries(lastDetection.emotions)
                  .sort(([,a], [,b]) => b - a) // Sort by value descending
                  .slice(0, 3) // Show top 3 emotions
                  .map(([emotion, value]) => (
                    <div key={emotion} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-gray-600">{emotion}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-300"
                            style={{ width: `${(value * 100).toFixed(0)}%` }}
                          />
                        </div>
                        <span className="text-gray-500 w-8 text-right">
                          {(value * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

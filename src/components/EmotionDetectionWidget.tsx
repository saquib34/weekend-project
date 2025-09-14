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
        onLoadedData={() => };


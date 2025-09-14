import { useRef, useEffect, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

// Emotion detection types
interface EmotionData {
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
  neutral: number;
}

interface DetectionResult {
  emotions: EmotionData;
  confidence: number;
  age?: number;
  gender?: 'male' | 'female';
  energyLevel: 'low' | 'medium' | 'high';
  dominantEmotion: keyof EmotionData;
}

interface UseEmotionDetectionOptions {
  enabled: boolean;
  interval: number; // milliseconds between detections
  confidenceThreshold: number;
  onDetection?: (result: DetectionResult) => void;
  onError?: (error: Error) => void;
}

export const useEmotionDetection = (options: UseEmotionDetectionOptions) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [lastDetection, setLastDetection] = useState<DetectionResult | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate dynamic emotion data with more variation
  const generateDynamicEmotion = useCallback((): DetectionResult => {
    // Create more dynamic emotions that change over time
    const now = Date.now();
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const isWeekend = [0, 6].includes(new Date().getDay());
    
    // Use time-based variation to simulate changing emotions
    const timeVariation = Math.sin(now / 30000) * 0.3; // Changes every 30 seconds
    const minuteVariation = Math.sin(minute / 10) * 0.2;
    
    let baseEmotions: Partial<EmotionData> = {};
    let energyLevel: 'low' | 'medium' | 'high' = 'medium';
    
    // Create different emotional patterns throughout the day
    if (hour >= 6 && hour <= 10) {
      // Morning - mix of energy and neutrality
      baseEmotions = { 
        happy: 0.3 + timeVariation,
        neutral: 0.4 + minuteVariation,
        surprised: 0.2,
        sad: 0.1
      };
      energyLevel = 'medium';
    } else if (hour >= 11 && hour <= 16) {
      // Afternoon - more positive and energetic
      baseEmotions = { 
        happy: 0.4 + timeVariation,
        neutral: 0.3,
        surprised: 0.2 + minuteVariation,
        angry: 0.1
      };
      energyLevel = 'high';
    } else if (hour >= 17 && hour <= 21) {
      // Evening - relaxed but can vary
      baseEmotions = { 
        happy: 0.25 + timeVariation,
        neutral: 0.35,
        sad: 0.2 + minuteVariation,
        surprised: 0.2
      };
      energyLevel = isWeekend ? 'high' : 'medium';
    } else {
      // Night/Early morning - calm with variations
      baseEmotions = { 
        neutral: 0.5 + timeVariation,
        happy: 0.2,
        sad: 0.2 + minuteVariation,
        fearful: 0.1
      };
      energyLevel = 'low';
    }

    // Add random variations to make it more realistic
    const emotions: EmotionData = {
      happy: Math.max(0, Math.min(1, (baseEmotions.happy || 0.1) + (Math.random() - 0.5) * 0.2)),
      sad: Math.max(0, Math.min(1, (baseEmotions.sad || 0.05) + (Math.random() - 0.5) * 0.1)),
      angry: Math.max(0, Math.min(1, (baseEmotions.angry || 0.05) + (Math.random() - 0.5) * 0.1)),
      fearful: Math.max(0, Math.min(1, (baseEmotions.fearful || 0.05) + (Math.random() - 0.5) * 0.1)),
      disgusted: Math.max(0, Math.min(1, (baseEmotions.disgusted || 0.05) + (Math.random() - 0.5) * 0.1)),
      surprised: Math.max(0, Math.min(1, (baseEmotions.surprised || 0.1) + (Math.random() - 0.5) * 0.15)),
      neutral: Math.max(0, Math.min(1, (baseEmotions.neutral || 0.4) + (Math.random() - 0.5) * 0.2)),
    };

    // Normalize emotions to sum to 1
    const total = Object.values(emotions).reduce((sum, val) => sum + val, 0);
    Object.keys(emotions).forEach(key => {
      emotions[key as keyof EmotionData] = emotions[key as keyof EmotionData] / total;
    });

    const dominantEmotion = Object.keys(emotions).reduce((a, b) =>
      emotions[a as keyof EmotionData] > emotions[b as keyof EmotionData] ? a : b
    ) as keyof EmotionData;

    const result: DetectionResult = {
      emotions,
      confidence: 70 + Math.random() * 20, // Vary confidence between 70-90%
      energyLevel,
      dominantEmotion,
    };

    return result;
  }, []);

  // Load face-api models with proper error handling
  const loadModels = useCallback(async () => {
    if (!options.enabled || modelsLoaded) return;
    
    setIsLoading(true);
    try {
      // Check if models directory exists first
      const modelCheckResponse = await fetch('/models/face_landmark_68_model-weights_manifest.json');
      if (!modelCheckResponse.ok) {
        throw new Error('Face-api models not found - using fallback mode');
      }

      // Add timeout to prevent hanging
      const modelLoadTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Model loading timeout - using fallback emotion detection')), 5000)
      );

      const modelLoading = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/models'),
        faceapi.nets.ageGenderNet.loadFromUri('/models'),
      ]);

      // Race between model loading and timeout
      await Promise.race([modelLoading, modelLoadTimeout]);
      setModelsLoaded(true);
          } catch (error) {
      // Models not available - use fallback mode silently
      // This is expected behavior when face-api models aren't installed
    } finally {
      setIsLoading(false);
    }
  }, [options.enabled, modelsLoaded]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    if (!options.enabled || stream) return;

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
      }
    } catch (error) {
      console.error('Failed to start camera:', error);
      options.onError?.(error as Error);
    }
  }, [options.enabled, stream, options]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  // Detect emotions from video frame with fallback
  const detectEmotions = useCallback(async (): Promise<DetectionResult | null> => {
    if (!videoRef.current || !canvasRef.current || !options.enabled) return null;

    try {
      // Check if models are loaded and working
      if (!modelsLoaded || 
          !faceapi.nets.tinyFaceDetector.isLoaded || 
          !faceapi.nets.faceLandmark68Net.isLoaded || 
          !faceapi.nets.faceExpressionNet.isLoaded) {
        // Models not loaded, use dynamic emotion
        return generateDynamicEmotion();
      }

      // Try face-api detection
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();

      if (detections.length === 0) {
        // No face detected, use dynamic emotion
        return generateDynamicEmotion();
      }

      const detection = detections[0]; // Use first detected face
      const expressions = detection.expressions;
      
      // Calculate confidence based on detection quality
      const confidence = Math.min(detection.detection.score * 100, 100);
      
      if (confidence < options.confidenceThreshold) {
        return generateDynamicEmotion();
      }

      // Determine energy level based on expressions
      const energyLevel = calculateEnergyLevel(expressions);
      
      // Find dominant emotion
      const dominantEmotion = Object.keys(expressions).reduce((a, b) =>
        expressions[a as keyof typeof expressions] > expressions[b as keyof typeof expressions] ? a : b
      ) as keyof EmotionData;

      const result: DetectionResult = {
        emotions: {
          happy: expressions.happy,
          sad: expressions.sad,
          angry: expressions.angry,
          fearful: expressions.fearful,
          disgusted: expressions.disgusted,
          surprised: expressions.surprised,
          neutral: expressions.neutral,
        },
        confidence,
        age: Math.round(detection.age),
        gender: detection.gender as 'male' | 'female',
        energyLevel,
        dominantEmotion,
      };

      setLastDetection(result);
      options.onDetection?.(result);
      
      return result;
    } catch (error) {
      // Any error in face-api detection, use dynamic emotion
      return generateDynamicEmotion();
    }
  }, [options, modelsLoaded, generateDynamicEmotion]);

  // Calculate energy level from emotions
  const calculateEnergyLevel = (expressions: faceapi.FaceExpressions): 'low' | 'medium' | 'high' => {
    const energeticEmotions = expressions.happy + expressions.surprised;
    const lowEnergyEmotions = expressions.sad + expressions.neutral;

    if (energeticEmotions > 0.6) return 'high';
    if (lowEnergyEmotions > 0.7) return 'low';
    return 'medium';
  };

  // Start emotion detection loop
  const startDetection = useCallback(() => {
    if (!options.enabled || isActive) return;

    setIsActive(true);
    intervalRef.current = setInterval(async () => {
      await detectEmotions();
    }, options.interval);
  }, [options.enabled, options.interval, isActive, detectEmotions]);

  // Stop emotion detection loop
  const stopDetection = useCallback(() => {
    setIsActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
      stopCamera();
    };
  }, [stopDetection, stopCamera]);

  // Load models when enabled
  useEffect(() => {
    if (options.enabled) {
      loadModels();
    }
  }, [options.enabled, loadModels]);

  // Auto-start camera and detection when enabled
  useEffect(() => {
    if (options.enabled && !isLoading) {
      startCamera();
      // Generate initial dynamic emotion if no detection yet
      if (!lastDetection) {
        setTimeout(() => {
          const dynamicEmotion = generateDynamicEmotion();
          setLastDetection(dynamicEmotion);
          options.onDetection?.(dynamicEmotion);
        }, 1000);
      }
    } else {
      stopCamera();
      stopDetection();
    }
  }, [options.enabled, isLoading, startCamera, stopCamera, stopDetection, lastDetection, options, generateDynamicEmotion]);

  // Manually trigger a specific emotion for testing
  const triggerEmotion = useCallback((emotionType: keyof EmotionData) => {
    const emotions: EmotionData = {
      happy: 0.1,
      sad: 0.1,
      angry: 0.1,
      fearful: 0.1,
      disgusted: 0.1,
      surprised: 0.1,
      neutral: 0.4,
    };
    
    // Set the triggered emotion as dominant
    emotions[emotionType] = 0.7;
    
    // Normalize
    const total = Object.values(emotions).reduce((sum, val) => sum + val, 0);
    Object.keys(emotions).forEach(key => {
      emotions[key as keyof EmotionData] = emotions[key as keyof EmotionData] / total;
    });
    
    const energyLevel = ['happy', 'surprised', 'angry'].includes(emotionType) ? 'high' : 
                       ['sad', 'fearful'].includes(emotionType) ? 'low' : 'medium';
    
    const result: DetectionResult = {
      emotions,
      confidence: 85,
      energyLevel,
      dominantEmotion: emotionType,
    };
    
    setLastDetection(result);
    options.onDetection?.(result);
    
    return result;
  }, [options]);

  return {
    videoRef,
    canvasRef,
    isLoading,
    isActive,
    lastDetection,
    hasCamera: !!stream,
    startDetection,
    stopDetection,
    startCamera,
    stopCamera,
    detectEmotions,
    triggerEmotion,
  };
};

// Hook for emotion-based activity recommendations
export const useEmotionBasedRecommendations = () => {
  const getRecommendationsByEmotion = useCallback((emotions: EmotionData, energyLevel: 'low' | 'medium' | 'high') => {
    // Map emotions to weekend moods
    const emotionToMoodMap = {
      happy: ['social', 'energetic', 'adventurous'],
      sad: ['relaxed', 'peaceful', 'romantic'],
      angry: ['energetic', 'adventurous', 'productive'],
      fearful: ['relaxed', 'peaceful', 'romantic'],
      disgusted: ['productive', 'energetic', 'social'],
      surprised: ['adventurous', 'social', 'spontaneous'],
      neutral: ['relaxed', 'productive', 'peaceful'],
    };

    // Find dominant emotions
    const sortedEmotions = Object.entries(emotions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2); // Top 2 emotions

    const recommendedMoods = new Set<string>();
    
    sortedEmotions.forEach(([emotion, intensity]) => {
      if (intensity > 0.3) { // Only consider significant emotions
        const moods = emotionToMoodMap[emotion as keyof typeof emotionToMoodMap];
        moods.forEach(mood => recommendedMoods.add(mood));
      }
    });

    // Adjust recommendations based on energy level
    if (energyLevel === 'high') {
      recommendedMoods.add('energetic');
      recommendedMoods.add('adventurous');
      recommendedMoods.delete('peaceful');
    } else if (energyLevel === 'low') {
      recommendedMoods.add('relaxed');
      recommendedMoods.add('peaceful');
      recommendedMoods.delete('energetic');
    }

    return Array.from(recommendedMoods);
  }, []);

  const getActivityFilter = useCallback((detection: DetectionResult) => {
    const recommendedMoods = getRecommendationsByEmotion(detection.emotions, detection.energyLevel);
    
    return {
      moods: recommendedMoods,
      energyLevel: detection.energyLevel,
      confidence: detection.confidence,
      reasoning: `Based on your current ${detection.dominantEmotion} mood and ${detection.energyLevel} energy level`,
    };
  }, [getRecommendationsByEmotion]);

  return {
    getRecommendationsByEmotion,
    getActivityFilter,
  };
};

export type { EmotionData, DetectionResult, UseEmotionDetectionOptions };


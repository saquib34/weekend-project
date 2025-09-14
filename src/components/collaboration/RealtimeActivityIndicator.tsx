import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { realtimeService } from '../../services/realtime';

interface ActivityIndicatorProps {
  activityId: string;
  className?: string;
}

export const RealtimeActivityIndicator: React.FC<ActivityIndicatorProps> = ({ 
  activityId, 
  className = '' 
}) => {
  const [isBeingEdited, setIsBeingEdited] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userColor, setUserColor] = useState<string>('#3B82F6');

  useEffect(() => {
    // Listen for real-time activity events
    const handleActivityAdded = (data: { activity: any; userId: string }) => {
      if (data.activity.id === activityId) {
        const collaborators = realtimeService.getCollaborators();
        const user = collaborators.find(c => c.id === data.userId);
        if (user) {
          setIsBeingEdited(true);
          setEditingUser(user.name);
          setUserColor(user.color);
          
          // Clear after 3 seconds
          setTimeout(() => {
            setIsBeingEdited(false);
            setEditingUser(null);
          }, 3000);
        }
      }
    };

    const handleActivityMoved = (data: { activityId: string; userId: string }) => {
      if (data.activityId === activityId) {
        const collaborators = realtimeService.getCollaborators();
        const user = collaborators.find(c => c.id === data.userId);
        if (user) {
          setIsBeingEdited(true);
          setEditingUser(user.name);
          setUserColor(user.color);
          
          // Clear after 2 seconds
          setTimeout(() => {
            setIsBeingEdited(false);
            setEditingUser(null);
          }, 2000);
        }
      }
    };

    const handleActivityRemoved = (data: { activityId: string; userId: string }) => {
      if (data.activityId === activityId) {
        const collaborators = realtimeService.getCollaborators();
        const user = collaborators.find(c => c.id === data.userId);
        if (user) {
          setIsBeingEdited(true);
          setEditingUser(user.name);
          setUserColor(user.color);
          
          // Clear after 2 seconds
          setTimeout(() => {
            setIsBeingEdited(false);
            setEditingUser(null);
          }, 2000);
        }
      }
    };

    realtimeService.on('activity_added', handleActivityAdded);
    realtimeService.on('activity_moved', handleActivityMoved);
    realtimeService.on('activity_removed', handleActivityRemoved);

    return () => {
      realtimeService.off('activity_added', handleActivityAdded);
      realtimeService.off('activity_moved', handleActivityMoved);
      realtimeService.off('activity_removed', handleActivityRemoved);
    };
  }, [activityId]);

  return (
    <AnimatePresence>
      {isBeingEdited && editingUser && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={`absolute -top-2 -right-2 z-10 ${className}`}
        >
          <div className="relative">
            {/* Pulsing Ring */}
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 rounded-full border-2"
              style={{ borderColor: userColor }}
            />
            
            {/* User Indicator */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
              style={{ backgroundColor: userColor }}
            >
              {editingUser.charAt(0).toUpperCase()}
            </div>
          </div>
          
          {/* Tooltip */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
          >
            <div
              className="px-2 py-1 rounded text-white text-xs font-medium shadow-lg"
              style={{ backgroundColor: userColor }}
            >
              {editingUser} is editing
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

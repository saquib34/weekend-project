import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { webrtcCollaboration } from '../../services/webrtcCollaboration';

interface CollaborationCursor {
  userId: string;
  userName: string;
  userColor: string;
  x: number;
  y: number;
  lastUpdate: Date;
}

interface CollaborationCursorsProps {
  className?: string;
}

export const CollaborationCursors: React.FC<CollaborationCursorsProps> = ({ className = '' }) => {
  const [cursors, setCursors] = useState<Map<string, CollaborationCursor>>(new Map());
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    // Listen for cursor movements from other users
    const handleCursorMove = (data: any) => {
      // Add comprehensive null checks
      if (!data || typeof data !== 'object') {
        console.warn('Invalid cursor data received:', data);
        return;
      }
      
      if (!data.userId || typeof data.userId !== 'string') {
        console.warn('Invalid userId in cursor data:', data);
        return;
      }
      
      if (!data.cursor || typeof data.cursor !== 'object') {
        console.warn('Invalid cursor object in data:', data);
        return;
      }
      
      if (typeof data.cursor.x !== 'number' || typeof data.cursor.y !== 'number') {
        console.warn('Invalid cursor coordinates:', data.cursor);
        return;
      }
      
      const collaborators = webrtcCollaboration.getCollaborators();
      const user = collaborators.find(c => c.id === data.userId);
      
      if (user) {
        setCursors(prev => {
          const newCursors = new Map(prev);
          newCursors.set(data.userId, {
            userId: data.userId,
            userName: user.name,
            userColor: user.color,
            x: data.cursor.x,
            y: data.cursor.y,
            lastUpdate: new Date(),
          });
          return newCursors;
        });
      }
    };

    // Clean up old cursors (older than 5 seconds)
    const cleanupInterval = setInterval(() => {
      setCursors(prev => {
        const newCursors = new Map(prev);
        const fiveSecondsAgo = new Date(Date.now() - 5000);
        
        for (const [userId, cursor] of newCursors) {
          if (cursor.lastUpdate < fiveSecondsAgo) {
            newCursors.delete(userId);
          }
        }
        
        return newCursors;
      });
    }, 1000);

    webrtcCollaboration.on('cursor_moved', handleCursorMove);

    return () => {
      webrtcCollaboration.off('cursor_moved', handleCursorMove);
      clearInterval(cleanupInterval);
    };
  }, []);

  useEffect(() => {
    // Track local mouse movements and send to other collaborators
    const handleMouseMove = (e: MouseEvent) => {
      if (isTracking && webrtcCollaboration.isInRoom()) {
        webrtcCollaboration.updateCursor(e.clientX, e.clientY);
      }
    };

    if (isTracking) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isTracking]);

  // Auto-enable cursor tracking when in a room
  useEffect(() => {
    const handleRoomChange = () => {
      setIsTracking(webrtcCollaboration.isInRoom());
    };

    webrtcCollaboration.on('room_created', handleRoomChange);
    webrtcCollaboration.on('room_joined', handleRoomChange);
    webrtcCollaboration.on('user_joined', handleRoomChange);

    // Check initial state
    setIsTracking(webrtcCollaboration.isInRoom());

    return () => {
      webrtcCollaboration.off('room_created', handleRoomChange);
      webrtcCollaboration.off('room_joined', handleRoomChange);
      webrtcCollaboration.off('user_joined', handleRoomChange);
    };
  }, []);

  return (
    <div className={`fixed inset-0 pointer-events-none z-40 ${className}`}>
      <AnimatePresence>
        {Array.from(cursors.values())
          .filter(cursor => cursor && typeof cursor.x === 'number' && typeof cursor.y === 'number')
          .map((cursor) => (
          <motion.div
            key={cursor.userId}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              x: cursor.x - 12,
              y: cursor.y - 12,
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ 
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
            className="absolute"
            style={{
              left: 0,
              top: 0,
            }}
          >
            {/* Cursor Arrow */}
            <div className="relative">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-md"
              >
                <path
                  d="M5.5 4.5L19 12L11.5 13.5L8.5 19L5.5 4.5Z"
                  fill={cursor.userColor}
                  stroke="white"
                  strokeWidth="1"
                />
              </svg>
              
              {/* User Name Label */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-6 left-6 whitespace-nowrap"
              >
                <div
                  className="px-2 py-1 rounded-md text-white text-xs font-medium shadow-lg"
                  style={{ backgroundColor: cursor.userColor }}
                >
                  {cursor.userName}
                </div>
              </motion.div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

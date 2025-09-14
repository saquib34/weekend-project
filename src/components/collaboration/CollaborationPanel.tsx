import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUsers, FaShare, FaCopy, FaSignOutAlt, FaPlus } from 'react-icons/fa';
import { webrtcCollaboration, type CollaborationUser, type ShareableRoom } from '../../services/webrtcCollaboration';
import { useWeekendPlanStore } from '../../stores/weekendPlanStore';
import { Button } from '../ui/Button';

interface CollaborationPanelProps {
  className?: string;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ className = '' }) => {
  const [collaborators, setCollaborators] = useState<CollaborationUser[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<ShareableRoom | null>(null);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [userName, setUserName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const { currentPlan } = useWeekendPlanStore();

  useEffect(() => {
    // Check if already in a room
    setIsInRoom(webrtcCollaboration.isInRoom());
    setCurrentRoom(webrtcCollaboration.getCurrentRoom());
    setCollaborators(webrtcCollaboration.getCollaborators());

    // Set up event listeners
    const handleRoomCreated = (data: any) => {
      setIsInRoom(true);
      setCurrentRoom(data.roomData || webrtcCollaboration.getCurrentRoom());
      setCollaborators(webrtcCollaboration.getCollaborators());
      setIsConnecting(false);
    };

    const handleRoomJoined = (data: any) => {
      setIsInRoom(true);
      setCurrentRoom(data.roomData);
      setCollaborators(webrtcCollaboration.getCollaborators());
      setIsConnecting(false);
    };

    const handleUserJoined = () => {
      setCollaborators(webrtcCollaboration.getCollaborators());
    };

    webrtcCollaboration.on('room_created', handleRoomCreated);
    webrtcCollaboration.on('room_joined', handleRoomJoined);
    webrtcCollaboration.on('user_joined', handleUserJoined);

    return () => {
      webrtcCollaboration.off('room_created', handleRoomCreated);
      webrtcCollaboration.off('room_joined', handleRoomJoined);
      webrtcCollaboration.off('user_joined', handleUserJoined);
    };
  }, []);

  const handleStartCollaboration = async () => {
    if (!userName.trim()) {
      setShowNameInput(true);
      return;
    }

    setIsConnecting(true);
    try {
      const roomId = await webrtcCollaboration.createRoom(userName.trim(), currentPlan?.title);
      console.log('Created collaboration room:', roomId);
    } catch (error) {
      console.error('Failed to start collaboration:', error);
      setIsConnecting(false);
    }
  };

  const handleShareRoom = () => {
    if (isInRoom) {
      const link = webrtcCollaboration.generateShareableLink();
      setShareLink(link);
      setShowShareOptions(true);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      console.log('Share link copied to clipboard');
      alert('Share link copied to clipboard!');
    });
  };

  const handleLeaveRoom = () => {
    webrtcCollaboration.leaveRoom();
    setIsInRoom(false);
    setCurrentRoom(null);
    setCollaborators([]);
    setShowShareOptions(false);
    setShareLink('');
  };

  const handleNameSubmit = () => {
    if (userName.trim()) {
      setShowNameInput(false);
      handleStartCollaboration();
    }
  };

  const onlineCount = collaborators.filter(user => user.isOnline).length;

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <FaUsers className="text-primary-500" />
        <h3 className="font-semibold text-gray-800">Collaboration</h3>
        {onlineCount > 0 && (
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
            {onlineCount} online
          </span>
        )}
      </div>

      {!isInRoom ? (
        <div className="space-y-3">
          {showNameInput ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Your Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleNameSubmit}
                  size="sm"
                  disabled={!userName.trim()}
                  className="flex-1"
                >
                  Start Room
                </Button>
                <Button
                  onClick={() => setShowNameInput(false)}
                  variant="ghost"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleStartCollaboration}
              disabled={isConnecting}
              className="w-full flex items-center gap-2"
            >
              <FaPlus className="w-3 h-3" />
              {isConnecting ? 'Starting...' : 'Start Collaboration'}
            </Button>
          )}

          <div className="text-sm text-gray-500 text-center">
            Create a room to collaborate on this weekend plan in real-time
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {currentRoom && (
            <div className="bg-blue-50 p-3 rounded-md">
              <div className="font-medium text-blue-900 text-sm">
                {currentRoom.name}
              </div>
              <div className="text-blue-700 text-xs">
                Room ID: {currentRoom.id.split('_')[1]}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleShareRoom}
              size="sm"
              variant="ghost"
              className="flex-1 flex items-center gap-2"
            >
              <FaShare className="w-3 h-3" />
              Share
            </Button>
            <Button
              onClick={handleLeaveRoom}
              size="sm"
              variant="ghost"
              className="flex items-center gap-2 text-red-600 hover:text-red-700"
            >
              <FaSignOutAlt className="w-3 h-3" />
              Leave
            </Button>
          </div>

          {collaborators.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                Collaborators ({collaborators.length})
              </div>
              <div className="space-y-1">
                {collaborators.map(user => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-md"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: user.color }}
                    />
                    <span className="text-sm text-gray-700 flex-1">
                      {user.name}
                    </span>
                    {user.isOnline && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Share Options Modal */}
      <AnimatePresence>
        {showShareOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowShareOptions(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Share Collaboration Room</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Share Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                    />
                    <Button
                      onClick={handleCopyLink}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <FaCopy className="w-3 h-3" />
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  Share this link with others to invite them to collaborate on your weekend plan.
                  They can join by clicking the link or entering the room ID.
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => setShowShareOptions(false)}
                    variant="ghost"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { 
  WhatsappShareButton, 
  TwitterShareButton, 
  FacebookShareButton,
  WhatsappIcon,
  TwitterIcon,
  FacebookIcon 
} from 'react-share';
import type { WeekendPlan, ScheduledActivity } from '../types';
import { useActivityStore } from '../stores/activityStore';
import { Button } from './ui/Button';

interface SocialSharingProps {
  plan: WeekendPlan;
  onClose: () => void;
  className?: string;
}

export const SocialSharingModal: React.FC<SocialSharingProps> = ({ 
  plan, 
  onClose, 
  className = '' 
}) => {
  const [shareType, setShareType] = useState<'link' | 'image' | 'qr'>('link');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const planPreviewRef = useRef<HTMLDivElement>(null);
  const { getActivityById } = useActivityStore();

  useEffect(() => {
    generateShareUrl();
  }, [plan]);

  const generateShareUrl = async () => {
    try {
      // Generate simple shareable URL without backend service
      const planData = encodeURIComponent(JSON.stringify({
        id: plan.id,
        title: plan.title,
        activities: plan.activities,
        createdAt: plan.createdAt,
      }));
      
      const url = `${window.location.origin}?shared=${planData}`;
      setShareUrl(url);
      
      // Generate QR code
      const qrCode = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrCode);
    } catch (error) {
      console.error('Failed to generate share URL:', error);
      // Fallback URL
      const fallbackUrl = `${window.location.origin}/plan/${plan.id}`;
      setShareUrl(fallbackUrl);
      
      const qrCode = await QRCode.toDataURL(fallbackUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrCode);
    }
  };

  const generatePlanImage = async () => {
    if (!planPreviewRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(planPreviewRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        width: 800,
        height: 600,
        useCORS: true,
      });
      
      const imageDataUrl = canvas.toDataURL('image/png', 0.9);
      setImageUrl(imageDataUrl);
    } catch (error) {
      console.error('Failed to generate plan image:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${plan.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_weekend_plan.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareText = `Check out my weekend plan: ${plan.title}! 🌟 Created with Weekendly ✨`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Share Your Plan
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Share Type Tabs */}
            <div className="flex gap-1 mt-4 p-1 bg-gray-100 rounded-lg">
              {[
                { key: 'link', label: 'Share Link', icon: '🔗' },
                { key: 'image', label: 'Generate Image', icon: '📸' },
                { key: 'qr', label: 'QR Code', icon: '📱' },
              ].map((type) => (
                <button
                  key={type.key}
                  onClick={() => setShareType(type.key as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    shareType === type.key
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {shareType === 'link' && (
              <div className="space-y-6">
                {/* Share URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shareable Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                    />
                    <Button
                      onClick={() => copyToClipboard(shareUrl)}
                      variant="outline"
                      size="sm"
                      className={`transition-colors ${copySuccess ? 'bg-green-50 text-green-600 border-green-300' : ''}`}
                    >
                      {copySuccess ? '✓ Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>

                {/* Social Media Buttons */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Share on Social Media
                  </label>
                  <div className="flex gap-3">
                    <WhatsappShareButton url={shareUrl} title={shareText}>
                      <WhatsappIcon size={48} round />
                    </WhatsappShareButton>
                    
                    <TwitterShareButton url={shareUrl} title={shareText}>
                      <TwitterIcon size={48} round />
                    </TwitterShareButton>
                    
                    <FacebookShareButton url={shareUrl} quote={shareText}>
                      <FacebookIcon size={48} round />
                    </FacebookShareButton>
                  </div>
                </div>

                {/* Custom Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Message
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      value={shareText}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm resize-none"
                      rows={3}
                    />
                    <Button
                      onClick={() => copyToClipboard(shareText)}
                      variant="outline"
                      size="sm"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {shareType === 'image' && (
              <div className="space-y-6">
                {/* Plan Preview */}
                <div
                  ref={planPreviewRef}
                  className="bg-gradient-to-br from-blue-50 to-purple-50 p-8 rounded-lg"
                  style={{ width: '800px', height: '600px', transform: 'scale(0.5)', transformOrigin: 'top left' }}
                >
                  <PlanImagePreview plan={plan} />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={generatePlanImage}
                    disabled={isGenerating}
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </div>
                    ) : (
                      'Generate Image'
                    )}
                  </Button>
                  
                  {imageUrl && (
                    <Button
                      onClick={downloadImage}
                      variant="outline"
                    >
                      Download
                    </Button>
                  )}
                </div>

                {/* Generated Image Preview */}
                {imageUrl && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <img 
                      src={imageUrl} 
                      alt="Generated plan image" 
                      className="max-w-full h-auto rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}

            {shareType === 'qr' && (
              <div className="text-center space-y-6">
                {/* QR Code */}
                {qrCodeUrl && (
                  <div className="flex justify-center">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border">
                      <img 
                        src={qrCodeUrl} 
                        alt="QR Code" 
                        className="w-64 h-64"
                      />
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">
                    📱 Scan to Share
                  </h3>
                  <p className="text-sm text-blue-700">
                    Others can scan this QR code with their phone camera to view your weekend plan.
                    The link will work for 7 days.
                  </p>
                </div>

                {/* Save QR Code */}
                <Button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = qrCodeUrl;
                    link.download = `${plan.title}_qr_code.png`;
                    link.click();
                  }}
                  variant="outline"
                  fullWidth
                >
                  Save QR Code
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Plan Image Preview Component
const PlanImagePreview: React.FC<{ plan: WeekendPlan }> = ({ plan }) => {
  const { getActivityById } = useActivityStore();

  const activities = plan.activities.map(sa => ({
    ...sa,
    activity: getActivityById(sa.activityId)!,
  }));

  const saturdayActivities = activities.filter(a => a.day === 'saturday');
  const sundayActivities = activities.filter(a => a.day === 'sunday');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{plan.title}</h1>
        <p className="text-xl text-gray-600 capitalize">
          {plan.mood} Weekend • {plan.activities.length} Activities
        </p>
        <div className="mt-4 flex justify-center">
          <div className="bg-white px-6 py-2 rounded-full shadow-sm border">
            <span className="text-sm font-medium text-gray-700">
              Created with Weekendly ✨
            </span>
          </div>
        </div>
      </div>

      {/* Days */}
      <div className="flex-1 grid grid-cols-2 gap-8">
        {/* Saturday */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
            Saturday
          </h2>
          <div className="space-y-3">
            {saturdayActivities.length > 0 ? (
              saturdayActivities.map((sa) => (
                <div
                  key={sa.id}
                  className="bg-white rounded-lg p-4 shadow-sm border"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{sa.activity.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{sa.activity.title}</h3>
                      <p className="text-sm text-gray-600 capitalize">{sa.timeSlot.replace('-', ' ')}</p>
                      <p className="text-xs text-gray-500 mt-1">{sa.activity.duration} • {sa.activity.category}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>No activities planned</p>
              </div>
            )}
          </div>
        </div>

        {/* Sunday */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
            Sunday
          </h2>
          <div className="space-y-3">
            {sundayActivities.length > 0 ? (
              sundayActivities.map((sa) => (
                <div
                  key={sa.id}
                  className="bg-white rounded-lg p-4 shadow-sm border"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{sa.activity.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{sa.activity.title}</h3>
                      <p className="text-sm text-gray-600 capitalize">{sa.timeSlot.replace('-', ' ')}</p>
                      <p className="text-xs text-gray-500 mt-1">{sa.activity.duration} • {sa.activity.category}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>No activities planned</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useState, useEffect } from 'react';

interface QueueJob {
  id: string;
  jobId?: string;
  text: string;
  platforms: string[];
  imageUrl?: string;
  scheduledTime: string;
  status: string;
  attempts?: number;
  lastAttempt?: string;
  createdAt: string;
}

const QueueViewer: React.FC = () => {
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Format date utility
  const formatDate = (dateValue: string | null | undefined, format: 'locale' | 'localedate' | 'localetime' = 'locale'): string => {
    if (!dateValue) return '—';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '—';
      
      switch (format) {
        case 'localedate':
          return date.toLocaleDateString();
        case 'localetime':
          return date.toLocaleTimeString();
        default:
          return date.toLocaleString();
      }
    } catch (error) {
      return '—';
    }
  };

  // Load queue jobs
  const loadQueueJobs = async () => {
    setQueueLoading(true);
    try {
      const response = await fetch('/api/social-media-queue');
      const data = await response.json();
      
      if (data.success) {
        setQueueJobs(data.jobs || []);
      } else {
        setMessage(`Error loading queue: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error loading queue. Please try again.');
    } finally {
      setQueueLoading(false);
    }
  };

  // Load jobs on component mount
  useEffect(() => {
    loadQueueJobs();
  }, []);

  // Delete job from queue
  const deleteQueueJob = async (jobId: string) => {
    try {
      const response = await fetch('/api/social-media-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      const result = await response.json();
      if (result.success) {
        setMessage('✅ Job removed from queue!');
        loadQueueJobs(); // Reload the queue
      } else {
        setMessage(`❌ Error removing job: ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ Error removing job. Please try again.');
    }
  };

  // Retry failed job
  const retryJob = async (jobId: string) => {
    try {
      const response = await fetch('/api/social-media-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, action: 'retry' }),
      });

      const result = await response.json();
      if (result.success) {
        setMessage('✅ Job scheduled for retry!');
        loadQueueJobs(); // Reload the queue
      } else {
        setMessage(`❌ Error retrying job: ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ Error retrying job. Please try again.');
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'text-yellow-400 bg-yellow-900/30';
      case 'processing': return 'text-blue-400 bg-blue-900/30';
      case 'completed': return 'text-green-400 bg-green-900/30';
      case 'failed': return 'text-red-400 bg-red-900/30';
      default: return 'text-gray-400 bg-gray-900/30';
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-orange-300">📋 Queue Manager</h3>
        <button
          onClick={loadQueueJobs}
          disabled={queueLoading}
          className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 flex items-center"
        >
          <span className="mr-1">🔄</span>
          {queueLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.includes('✅') ? 'bg-green-900/50 border-green-500 text-green-300' : 'bg-red-900/50 border-red-500 text-red-300'
        } border`}>
          {message}
        </div>
      )}

      {/* Queue Jobs */}
      {queueLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-300">Loading queue...</span>
        </div>
      ) : queueJobs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-4">📭</div>
          <p>Queue is empty</p>
          <p className="text-sm mt-2">Scheduled posts will appear here</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {queueJobs.map((job) => (
            <div key={job.id} className="bg-black/30 rounded-lg border border-gray-600 p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(job.status)}`}>
                      {job.status.toUpperCase()}
                    </span>
                    {job.jobId && (
                      <span className="px-2 py-1 rounded-full text-xs bg-blue-900/30 text-blue-400">
                        Job: {job.jobId}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-300 text-sm mb-2 line-clamp-2">
                    {job.text.length > 100 ? `${job.text.substring(0, 100)}...` : job.text}
                  </p>
                  
                  <div className="flex flex-wrap gap-1 mb-2">
                    {job.platforms.map((platform) => (
                      <span key={platform} className="px-2 py-1 bg-gray-700 text-xs rounded text-gray-300">
                        {platform}
                      </span>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>📅 Scheduled: {formatDate(job.scheduledTime)}</div>
                    <div>🕒 Created: {formatDate(job.createdAt)}</div>
                    {job.attempts && job.attempts > 0 && (
                      <div>🔄 Attempts: {job.attempts}</div>
                    )}
                    {job.lastAttempt && (
                      <div>⏰ Last attempt: {formatDate(job.lastAttempt)}</div>
                    )}
                  </div>
                </div>
                
                {job.imageUrl && (
                  <img 
                    src={job.imageUrl} 
                    alt="Post media" 
                    className="w-16 h-16 object-cover rounded ml-4"
                  />
                )}
              </div>
              
              <div className="flex space-x-2 pt-2 border-t border-gray-600">
                {job.status.toLowerCase() === 'failed' && (
                  <button
                    onClick={() => retryJob(job.id)}
                    className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                  >
                    🔄 Retry
                  </button>
                )}
                <button
                  onClick={() => deleteQueueJob(job.id)}
                  className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QueueViewer;

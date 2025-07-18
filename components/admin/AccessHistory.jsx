import React from 'react';
import { FiCheck, FiX, FiUser, FiClock } from 'react-icons/fi';

export default function AccessHistory({ accessHistory = [] }) {
  if (!accessHistory || accessHistory.length === 0) {
    return (
      <div className="text-center py-4">
        <FiClock className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">No access history available</p>
      </div>
    );
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'activated':
        return <FiCheck className="h-4 w-4 text-green-500" />;
      case 'deactivated':
        return <FiX className="h-4 w-4 text-red-500" />;
      case 'created':
        return <FiUser className="h-4 w-4 text-blue-500" />;
      default:
        return <FiClock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'activated':
        return 'bg-green-50 border-green-200';
      case 'deactivated':
        return 'bg-red-50 border-red-200';
      case 'created':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getActionText = (action, hasAccess) => {
    switch (action) {
      case 'activated':
        return 'Account activated';
      case 'deactivated':
        return 'Account deactivated';
      case 'created':
        return hasAccess ? 'Account created with access' : 'Account created without access';
      default:
        return hasAccess ? 'Access granted' : 'Access revoked';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Sort history by date (newest first)
  const sortedHistory = [...accessHistory].sort((a, b) => 
    new Date(b.changedAt) - new Date(a.changedAt)
  );

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-900 flex items-center">
        <FiClock className="h-4 w-4 mr-2" />
        Access History
      </h4>
      
      <div className="max-h-64 overflow-y-auto">
        <div className="space-y-2">
          {sortedHistory.map((entry, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getActionColor(entry.action)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getActionIcon(entry.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {getActionText(entry.action, entry.hasAccess)}
                    </p>
                    {entry.reason && (
                      <p className="text-xs text-gray-600 mt-1">
                        {entry.reason}
                      </p>
                    )}
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                      <span>
                        Changed by: {entry.changedBy || 'System'}
                      </span>
                      <span className="mx-2">•</span>
                      <span>
                        {formatDate(entry.changedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    entry.hasAccess 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {entry.hasAccess ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {sortedHistory.length > 5 && (
        <div className="text-center pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Showing {Math.min(5, sortedHistory.length)} of {sortedHistory.length} entries
          </p>
        </div>
      )}
    </div>
  );
}
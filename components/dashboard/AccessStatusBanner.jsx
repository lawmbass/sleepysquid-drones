import React from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

export default function AccessStatusBanner({ user }) {
  // Don't show banner if user has access or is admin
  if (user?.hasAccess || user?.email?.toLowerCase()?.endsWith('@sleepysquid.com')) {
    return null;
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <FiAlertTriangle className="h-5 w-5 text-orange-400" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-orange-800">
            Limited Access
          </h3>
          <div className="mt-2 text-sm text-orange-700">
            <p>
              Your account access is currently restricted. Some features may not be available.
              Please contact an administrator if you need full access to the platform.
            </p>
          </div>
          <div className="mt-3">
            <div className="flex items-center">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                <FiX className="h-3 w-3 mr-1" />
                Inactive
              </span>
              <span className="ml-3 text-xs text-orange-600">
                Contact: support@sleepysquid.com
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
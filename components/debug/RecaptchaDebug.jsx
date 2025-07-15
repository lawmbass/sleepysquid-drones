import React from 'react';

const RecaptchaDebug = () => {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const isConfigured = !!siteKey;

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded shadow-lg z-50 max-w-sm">
      <div className="font-bold text-sm">reCAPTCHA Debug Info:</div>
      <div className="text-xs mt-1">
        <div>Site Key: {isConfigured ? '✅ Configured' : '❌ Not Set'}</div>
        <div>Status: {isConfigured ? 'Active' : 'Disabled'}</div>
        {!isConfigured && (
          <div className="mt-2 text-red-600">
            Set NEXT_PUBLIC_RECAPTCHA_SITE_KEY in your .env file
          </div>
        )}
      </div>
    </div>
  );
};

export default RecaptchaDebug;
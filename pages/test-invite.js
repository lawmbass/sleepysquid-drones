import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';

export default function TestInvite() {
  const [testToken, setTestToken] = useState('');
  
  const generateTestToken = () => {
    const token = Math.random().toString(36).substring(2, 15) + 
                 Math.random().toString(36).substring(2, 15) +
                 Date.now().toString(36);
    setTestToken(token);
  };

  const testInviteLink = testToken ? `/invite?token=${testToken}` : '';

  return (
    <>
      <Head>
        <title>Test Invitation System</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Test Invitation System
          </h1>
          
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Step 1: Generate Test Token
            </h2>
            <button
              onClick={generateTestToken}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Generate Test Token
            </button>
            
            {testToken && (
              <div className="mt-4 p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600 mb-2">Test Token:</p>
                <code className="text-sm bg-gray-200 p-2 rounded block break-all">
                  {testToken}
                </code>
              </div>
            )}
          </div>
          
          {testInviteLink && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Step 2: Test Invitation Page
              </h2>
              <Link 
                href={testInviteLink}
                className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Test Invitation Link
              </Link>
              
              <div className="mt-4 p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600 mb-2">Test URL:</p>
                <code className="text-sm bg-gray-200 p-2 rounded block break-all">
                  {testInviteLink}
                </code>
              </div>
            </div>
          )}
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Debug Information
            </h2>
            <div className="space-y-2 text-sm">
              <p><strong>Current URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'Server-side'}</p>
              <p><strong>Test Token Generated:</strong> {testToken ? 'Yes' : 'No'}</p>
              <p><strong>Invitation Link:</strong> {testInviteLink || 'Not generated yet'}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FiHeart, FiInfo } from 'react-icons/fi';

export default function DefaultContent({ user }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('dashboard');

  // Update active section based on URL query
  useEffect(() => {
    const section = router.query.section || 'dashboard';
    setActiveSection(section);
  }, [router.query.section]);

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Welcome to SleepySquid Drones</h1>
              <p className="text-gray-600">Hi {user.name}, welcome to your dashboard. Explore our drone services and get started.</p>
            </div>
            
            {/* Welcome Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FiInfo className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <h3 className="text-lg font-medium text-gray-900">Getting Started</h3>
                      <p className="text-sm text-gray-500">Learn about our drone services and how to book them.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FiHeart className="h-6 w-6 text-red-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <h3 className="text-lg font-medium text-gray-900">Need Help?</h3>
                      <p className="text-sm text-gray-500">Contact our support team for assistance.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Services Overview */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Our Services</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border border-gray-200 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900">Aerial Photography</h3>
                    <p className="text-xs text-gray-500 mt-1">Professional drone photography services</p>
                  </div>
                  <div className="text-center p-4 border border-gray-200 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900">Videography</h3>
                    <p className="text-xs text-gray-500 mt-1">High-quality aerial video production</p>
                  </div>
                  <div className="text-center p-4 border border-gray-200 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900">Mapping & Surveying</h3>
                    <p className="text-xs text-gray-500 mt-1">Precision mapping and surveying solutions</p>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <button 
                    onClick={() => router.push('/#booking')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md"
                  >
                    Book a Service
                  </button>
                </div>
              </div>
            </div>

            {/* Account Status */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Account Status</h2>
              </div>
              <div className="p-6">
                <div className="text-center">
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                    Standard User
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Contact us to upgrade your account for additional features.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
              <p className="text-gray-600">Manage your account information and preferences.</p>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900">{user.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{user.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Account Type</label>
                      <p className="mt-1 text-sm text-gray-900 capitalize">{user.role}</p>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Need More Features?</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Contact us to learn about client or pilot accounts for additional features.
                  </p>
                  <button 
                    onClick={() => router.push('/#contact')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                  >
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Welcome to your dashboard.</p>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Section Not Found</h3>
                <p className="text-gray-500">The requested section could not be found.</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-full">
      {renderContent()}
    </div>
  );
}
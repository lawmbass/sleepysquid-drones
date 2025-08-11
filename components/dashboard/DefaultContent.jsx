import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FiHeart, FiInfo, FiCamera, FiVideo, FiMap } from 'react-icons/fi';
import AccessStatusBanner from './AccessStatusBanner';

export default function DefaultContent({ user }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('dashboard');

  // Update active section based on URL query
  useEffect(() => {
    const section = router.query.section || 'dashboard';
    setActiveSection(section);
  }, [router.query.section]);

  // Mobile compact dashboard component
  const MobileCompactDashboard = () => (
    <div className="md:hidden space-y-4">
      {/* Access Status Banner */}
      <AccessStatusBanner user={user} />
      
      {/* Welcome header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Welcome to SleepySquid Drones</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">Hi {user.name}, explore our drone services</p>
      </div>
      
      {/* Services grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Our Services</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-blue-50 rounded-lg">
            <FiCamera className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <div className="text-xs text-gray-600 dark:text-gray-300">Aerial Photography</div>
          </div>
          
          <div className="p-3 bg-purple-50 rounded-lg">
            <FiVideo className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <div className="text-xs text-gray-600 dark:text-gray-300">Videography</div>
          </div>
          
          <div className="p-3 bg-green-50 rounded-lg">
            <FiMap className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <div className="text-xs text-gray-600 dark:text-gray-300">Mapping</div>
          </div>
        </div>
      </div>
      
      {/* Quick actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Get Started</h3>
        <div className="space-y-2">
          <button 
            onClick={() => router.push('/#booking')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium"
          >
            Book a Service
          </button>
          <button 
            onClick={() => router.push('/#contact')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-md text-sm font-medium"
          >
            Contact Support
          </button>
        </div>
      </div>
      
      {/* Account status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Account Status</h3>
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
            Standard User
          </div>
          <button 
            onClick={() => router.push('/#contact')}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );

  // Desktop dashboard component
  const DesktopDashboard = () => (
    <div className="hidden md:block space-y-6">
      {/* Access Status Banner */}
      <AccessStatusBanner user={user} />
      
      <div className="mb-8">
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to SleepySquid Drones</h1>
        <p className="text-gray-600 dark:text-gray-300">Hi {user.name}, welcome to your dashboard. Explore our drone services and get started.</p>
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
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Our Services</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Aerial Photography</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Professional drone photography services</p>
            </div>
            <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Videography</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">High-quality aerial video production</p>
            </div>
            <div className="text-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Mapping & Surveying</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Precision mapping and surveying solutions</p>
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
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Account Status</h2>
        </div>
        <div className="p-6">
          <div className="text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
              Standard User
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Contact us to upgrade your account for additional features.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <MobileCompactDashboard />
            <DesktopDashboard />
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
              <p className="text-gray-600 dark:text-gray-300">Manage your account information and preferences.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Account Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{user.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{user.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Type</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">{user.role}</p>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Need More Features?</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-300">Welcome to your dashboard.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Section Not Found</h3>
                <p className="text-gray-500 dark:text-gray-400">The requested section could not be found.</p>
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
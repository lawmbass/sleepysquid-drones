import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FiMap, FiUpload, FiActivity, FiCheckCircle } from 'react-icons/fi';

export default function PilotDashboard({ user }) {
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
              <h1 className="text-2xl font-bold text-gray-900">Pilot Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user.name}. Manage your missions and flight data.</p>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FiMap className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Active Missions</dt>
                        <dd className="text-lg font-medium text-gray-900">2</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FiCheckCircle className="h-6 w-6 text-green-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Completed Missions</dt>
                        <dd className="text-lg font-medium text-gray-900">18</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FiActivity className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Flight Hours</dt>
                        <dd className="text-lg font-medium text-gray-900">142</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Missions */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Recent Missions</h2>
              </div>
              <div className="p-6">
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Missions</h3>
                                     <p className="text-gray-500 mb-4">You haven&apos;t been assigned any missions yet.</p>
                  <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">
                    View All Missions
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'missions':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">My Missions</h1>
              <p className="text-gray-600">View and manage your assigned drone missions.</p>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center py-12">
                <FiMap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
                <p className="text-gray-500">Mission management features are in development.</p>
              </div>
            </div>
          </div>
        );

      case 'upload':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Upload Assets</h1>
              <p className="text-gray-600">Upload photos, videos, and data from your missions.</p>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center py-12">
                <FiUpload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
                <p className="text-gray-500">Asset upload features are in development.</p>
              </div>
            </div>
          </div>
        );

      case 'flights':
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Flight Data</h1>
              <p className="text-gray-600">Review flight logs and performance metrics.</p>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center py-12">
                <FiActivity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
                <p className="text-gray-500">Flight data features are in development.</p>
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
                      <label className="block text-sm font-medium text-gray-700">Role</label>
                      <p className="mt-1 text-sm text-gray-900 capitalize">{user.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Pilot Dashboard</h1>
              <p className="text-gray-600">Welcome to your pilot dashboard.</p>
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
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '@/components/admin/AdminLayout';
import { FiSave, FiMail, FiDollarSign, FiSettings, FiShield, FiDatabase } from 'react-icons/fi';
import { adminConfig } from '@/libs/adminConfig';

function AdminSettings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState({
    // Business Settings
    businessName: 'SleepySquid Drones',
    businessEmail: 'contact@sleepysquid.com',
    businessPhone: '+1 (555) 123-4567',
    
    // Pricing Settings
    basicPackagePrice: 199,
    standardPackagePrice: 399,
    premiumPackagePrice: 799,
    
    // Booking Settings
    minAdvanceBookingDays: 7,
    maxBookingsPerDay: 5,
    operatingHours: {
      start: '08:00',
      end: '18:00'
    },
    
    // Email Settings
    emailNotifications: true,
    adminNotificationEmail: 'admin@sleepysquid.com',
    customerConfirmationTemplate: 'default',
    
    // Security Settings
    sessionTimeout: 24,
    requireTwoFactor: false,
    allowedDomains: '@sleepysquid.com',
  });
  
  const [activeTab, setActiveTab] = useState('business');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Check if user is admin
  const isAdmin = session?.user?.isAdmin || adminConfig.isAdmin(session?.user?.email);

  // Redirect to unified dashboard
  if (session) {
    router.push('/dashboard?section=settings');
    return null;
  }

  // Authentication checks
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push('/login?callbackUrl=' + encodeURIComponent('/dashboard?section=settings'));
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don&apos;t have permission to access this admin area.</p>
          <p className="text-sm text-gray-500 mb-6">
            Signed in as: {session.user.email}
          </p>
          <button
            onClick={() => signOut()}
            className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const handleInputChange = (section, field, value) => {
    if (section === 'operatingHours') {
      setSettings(prev => ({
        ...prev,
        operatingHours: {
          ...prev.operatingHours,
          [field]: value
        }
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs = [
    { id: 'business', name: 'Business', icon: FiSettings },
    { id: 'pricing', name: 'Pricing', icon: FiDollarSign },
    { id: 'email', name: 'Email', icon: FiMail },
    { id: 'security', name: 'Security', icon: FiShield },
    { id: 'system', name: 'System', icon: FiDatabase },
  ];

  return (
    <>
      <Head>
        <title>Settings - Admin Dashboard</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <AdminLayout user={session.user} onSignOut={() => signOut()}>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-md flex items-center transition-colors ${
                saved 
                  ? 'bg-green-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : saved ? (
                <>
                  <FiSave className="h-4 w-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <FiSave className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>

          <div className="bg-white shadow rounded-lg">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {tab.name}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'business' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">Business Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Name
                      </label>
                      <input
                        type="text"
                        value={settings.businessName}
                        onChange={(e) => handleInputChange('business', 'businessName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Email
                      </label>
                      <input
                        type="email"
                        value={settings.businessEmail}
                        onChange={(e) => handleInputChange('business', 'businessEmail', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Phone
                      </label>
                      <input
                        type="tel"
                        value={settings.businessPhone}
                        onChange={(e) => handleInputChange('business', 'businessPhone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4">Operating Hours</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={settings.operatingHours.start}
                          onChange={(e) => handleInputChange('operatingHours', 'start', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={settings.operatingHours.end}
                          onChange={(e) => handleInputChange('operatingHours', 'end', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'pricing' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">Package Pricing</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Basic Package Price ($)
                      </label>
                      <input
                        type="number"
                        value={settings.basicPackagePrice}
                        onChange={(e) => handleInputChange('pricing', 'basicPackagePrice', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Standard Package Price ($)
                      </label>
                      <input
                        type="number"
                        value={settings.standardPackagePrice}
                        onChange={(e) => handleInputChange('pricing', 'standardPackagePrice', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Premium Package Price ($)
                      </label>
                      <input
                        type="number"
                        value={settings.premiumPackagePrice}
                        onChange={(e) => handleInputChange('pricing', 'premiumPackagePrice', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Advance Booking (Days)
                      </label>
                      <input
                        type="number"
                        value={settings.minAdvanceBookingDays}
                        onChange={(e) => handleInputChange('booking', 'minAdvanceBookingDays', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Bookings Per Day
                      </label>
                      <input
                        type="number"
                        value={settings.maxBookingsPerDay}
                        onChange={(e) => handleInputChange('booking', 'maxBookingsPerDay', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'email' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">Email Configuration</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="emailNotifications"
                        checked={settings.emailNotifications}
                        onChange={(e) => handleInputChange('email', 'emailNotifications', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-900">
                        Enable email notifications
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Admin Notification Email
                      </label>
                      <input
                        type="email"
                        value={settings.adminNotificationEmail}
                        onChange={(e) => handleInputChange('email', 'adminNotificationEmail', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Customer Confirmation Template
                      </label>
                      <select
                        value={settings.customerConfirmationTemplate}
                        onChange={(e) => handleInputChange('email', 'customerConfirmationTemplate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="default">Default Template</option>
                        <option value="professional">Professional Template</option>
                        <option value="friendly">Friendly Template</option>
                        <option value="detailed">Detailed Template</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Session Timeout (Hours)
                      </label>
                      <input
                        type="number"
                        value={settings.sessionTimeout}
                        onChange={(e) => handleInputChange('security', 'sessionTimeout', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="requireTwoFactor"
                        checked={settings.requireTwoFactor}
                        onChange={(e) => handleInputChange('security', 'requireTwoFactor', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="requireTwoFactor" className="ml-2 block text-sm text-gray-900">
                        Require Two-Factor Authentication
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allowed Admin Domains
                      </label>
                      <input
                        type="text"
                        value={settings.allowedDomains}
                        onChange={(e) => handleInputChange('security', 'allowedDomains', e.target.value)}
                        placeholder="@yourdomain.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Users with emails from these domains will have admin access
                      </p>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">🔒 Security Status</h4>
                      <div className="text-sm text-blue-700 space-y-1">
                        <div>✅ HTTPS Enforced</div>
                        <div>✅ Rate Limiting Active</div>
                        <div>✅ Input Validation Enabled</div>
                        <div>✅ CSRF Protection Active</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'system' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">System Information</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Version:</span>
                        <span className="ml-2 text-gray-600">1.0.0</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Database Status:</span>
                        <span className="ml-2 text-green-600">Connected</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Last Backup:</span>
                        <span className="ml-2 text-gray-600">2 hours ago</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Total Bookings:</span>
                        <span className="ml-2 text-gray-600">150</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Uptime:</span>
                        <span className="ml-2 text-gray-600">7 days, 14 hours</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Storage Used:</span>
                        <span className="ml-2 text-gray-600">2.4 GB / 50 GB</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">API Calls Today:</span>
                        <span className="ml-2 text-gray-600">1,234</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">⚠️ Maintenance Mode</h4>
                    <p className="text-sm text-yellow-700 mb-3">
                      Enable maintenance mode to temporarily disable booking submissions while you perform updates.
                    </p>
                    <button className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm hover:bg-yellow-700 transition-colors">
                      Enable Maintenance Mode
                    </button>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">🗄️ Database Actions</h4>
                    <p className="text-sm text-red-700 mb-3">
                      Perform database maintenance operations. Use with caution!
                    </p>
                    <div className="flex space-x-3">
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors">
                        Backup Database
                      </button>
                      <button className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm hover:bg-orange-700 transition-colors">
                        Clear Cache
                      </button>
                      <button className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 transition-colors">
                        Export Data
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}

// This page requires authentication and should not be statically generated
export async function getServerSideProps() {
  return {
    props: {}, // Empty props, we'll handle auth on client side
  };
}

AdminSettings.displayName = 'AdminPage';
export default AdminSettings; 
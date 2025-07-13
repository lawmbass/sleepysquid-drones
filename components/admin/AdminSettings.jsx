import { useState } from 'react';

export default function AdminSettings({ user }) {
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
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'business', name: 'Business' },
    { id: 'pricing', name: 'Pricing' },
    { id: 'booking', name: 'Booking' },
    { id: 'email', name: 'Email' },
    { id: 'security', name: 'Security' }
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          {/* Business Settings */}
          {activeTab === 'business' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Business Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Business Name</label>
                  <input
                    type="text"
                    value={settings.businessName}
                    onChange={(e) => handleInputChange('business', 'businessName', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Business Email</label>
                  <input
                    type="email"
                    value={settings.businessEmail}
                    onChange={(e) => handleInputChange('business', 'businessEmail', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Business Phone</label>
                  <input
                    type="tel"
                    value={settings.businessPhone}
                    onChange={(e) => handleInputChange('business', 'businessPhone', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pricing Settings */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Package Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Basic Package</label>
                  <input
                    type="number"
                    value={settings.basicPackagePrice}
                    onChange={(e) => handleInputChange('pricing', 'basicPackagePrice', parseInt(e.target.value))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Standard Package</label>
                  <input
                    type="number"
                    value={settings.standardPackagePrice}
                    onChange={(e) => handleInputChange('pricing', 'standardPackagePrice', parseInt(e.target.value))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Premium Package</label>
                  <input
                    type="number"
                    value={settings.premiumPackagePrice}
                    onChange={(e) => handleInputChange('pricing', 'premiumPackagePrice', parseInt(e.target.value))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Booking Settings */}
          {activeTab === 'booking' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Booking Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Minimum Advance Booking (days)</label>
                  <input
                    type="number"
                    value={settings.minAdvanceBookingDays}
                    onChange={(e) => handleInputChange('booking', 'minAdvanceBookingDays', parseInt(e.target.value))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Bookings Per Day</label>
                  <input
                    type="number"
                    value={settings.maxBookingsPerDay}
                    onChange={(e) => handleInputChange('booking', 'maxBookingsPerDay', parseInt(e.target.value))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Operating Hours Start</label>
                  <input
                    type="time"
                    value={settings.operatingHours.start}
                    onChange={(e) => handleInputChange('operatingHours', 'start', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Operating Hours End</label>
                  <input
                    type="time"
                    value={settings.operatingHours.end}
                    onChange={(e) => handleInputChange('operatingHours', 'end', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Email Configuration</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => handleInputChange('email', 'emailNotifications', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">Enable Email Notifications</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Admin Notification Email</label>
                  <input
                    type="email"
                    value={settings.adminNotificationEmail}
                    onChange={(e) => handleInputChange('email', 'adminNotificationEmail', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Security Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Session Timeout (hours)</label>
                  <input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => handleInputChange('security', 'sessionTimeout', parseInt(e.target.value))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.requireTwoFactor}
                    onChange={(e) => handleInputChange('security', 'requireTwoFactor', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">Require Two-Factor Authentication</label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              saving
                ? 'bg-gray-400 cursor-not-allowed'
                : saved
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
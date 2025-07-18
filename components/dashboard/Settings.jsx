import { useState, useEffect } from 'react';
import { 
  FiUser, 
  FiSettings, 
  FiBell, 
  FiShield, 
  FiSave, 
  FiEye, 
  FiEyeOff,
  FiCheck,
  FiX
} from 'react-icons/fi';

export default function Settings({ user, onUpdate }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // Profile settings state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    company: '',
    bio: '',
    location: '',
    website: ''
  });

  // System preferences state
  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD'
  });

  // Notification settings state
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    bookingUpdates: true,
    marketingEmails: false,
    weeklyReports: true,
    securityAlerts: true
  });

  // Security settings state
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false
  });

  const tabs = [
    { id: 'profile', name: 'Profile', icon: FiUser },
    { id: 'preferences', name: 'Preferences', icon: FiSettings },
    { id: 'notifications', name: 'Notifications', icon: FiBell },
    { id: 'security', name: 'Security', icon: FiShield }
  ];

  // Load settings data on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/user/settings');
        if (response.ok) {
          const data = await response.json();
          
          // Update state with loaded data
          setProfileData(data.profile);
          setPreferences(data.preferences);
          setNotifications(data.notifications);
          setSecurity(prev => ({ 
            ...prev, 
            twoFactorEnabled: data.security.twoFactorEnabled 
          }));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        setMessage({ type: 'error', text: 'Failed to load settings' });
      } finally {
        setInitialLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async (section) => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      let dataToSave = {};
      
      switch (section) {
        case 'profile':
          dataToSave = profileData;
          break;
        case 'preferences':
          dataToSave = preferences;
          break;
        case 'notifications':
          dataToSave = notifications;
          break;
        case 'security':
          if (security.newPassword !== security.confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            setLoading(false);
            return;
          }
          dataToSave = {
            currentPassword: security.currentPassword,
            newPassword: security.newPassword,
            twoFactorEnabled: security.twoFactorEnabled
          };
          break;
      }

      // Simulate API call - replace with actual API endpoint
      const response = await fetch(`/api/user/settings/${section}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSave),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings updated successfully!' });
        if (section === 'profile' && onUpdate) {
          onUpdate({ ...user, ...profileData });
        }
        if (section === 'security') {
          setSecurity(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        }
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to update settings' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={profileData.name}
            onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter your full name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={profileData.email}
            onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter your email"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={profileData.phone}
            onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter your phone number"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company
          </label>
          <input
            type="text"
            value={profileData.company}
            onChange={(e) => setProfileData(prev => ({ ...prev, company: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter your company name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location
          </label>
          <input
            type="text"
            value={profileData.location}
            onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter your location"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Website
          </label>
          <input
            type="url"
            value={profileData.website}
            onChange={(e) => setProfileData(prev => ({ ...prev, website: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter your website URL"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Bio
        </label>
        <textarea
          value={profileData.bio}
          onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="Tell us about yourself..."
        />
      </div>
      
      <div className="flex justify-end pt-4">
        <button
          onClick={() => handleSave('profile')}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          <FiSave className="mr-2 h-4 w-4" />
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );

  const renderPreferences = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Theme
          </label>
          <select
            value={preferences.theme}
            onChange={(e) => setPreferences(prev => ({ ...prev, theme: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Language
          </label>
          <select
            value={preferences.language}
            onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <select
            value={preferences.timezone}
            onChange={(e) => setPreferences(prev => ({ ...prev, timezone: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Format
          </label>
          <select
            value={preferences.dateFormat}
            onChange={(e) => setPreferences(prev => ({ ...prev, dateFormat: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Currency
          </label>
          <select
            value={preferences.currency}
            onChange={(e) => setPreferences(prev => ({ ...prev, currency: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CAD">CAD ($)</option>
          </select>
        </div>
      </div>
      
      <div className="flex justify-end pt-4">
        <button
          onClick={() => handleSave('preferences')}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          <FiSave className="mr-2 h-4 w-4" />
          {loading ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        {Object.entries(notifications).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
            <div className="flex-1 pr-4">
              <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {getNotificationDescription(key)}
              </p>
            </div>
            <button
              onClick={() => setNotifications(prev => ({ ...prev, [key]: !value }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                value ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  value ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
      
      <div className="flex justify-end pt-4">
        <button
          onClick={() => handleSave('notifications')}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          <FiSave className="mr-2 h-4 w-4" />
          {loading ? 'Saving...' : 'Save Notifications'}
        </button>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={security.currentPassword}
              onChange={(e) => setSecurity(prev => ({ ...prev, currentPassword: e.target.value }))}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Password
          </label>
          <input
            type="password"
            value={security.newPassword}
            onChange={(e) => setSecurity(prev => ({ ...prev, newPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter new password"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm New Password
          </label>
          <input
            type="password"
            value={security.confirmPassword}
            onChange={(e) => setSecurity(prev => ({ ...prev, confirmPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Confirm new password"
          />
        </div>
        
        <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
          <div className="flex-1 pr-4">
            <h4 className="font-medium text-gray-900 text-sm sm:text-base">Two-Factor Authentication</h4>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Add an extra layer of security to your account
            </p>
          </div>
          <button
            onClick={() => setSecurity(prev => ({ ...prev, twoFactorEnabled: !prev.twoFactorEnabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
              security.twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                security.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
      
      <div className="flex justify-end pt-4">
        <button
          onClick={() => handleSave('security')}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          <FiSave className="mr-2 h-4 w-4" />
          {loading ? 'Saving...' : 'Update Security'}
        </button>
      </div>
    </div>
  );

  const getNotificationDescription = (key) => {
    const descriptions = {
      emailNotifications: 'Receive email notifications for important updates',
      pushNotifications: 'Get push notifications on your device',
      bookingUpdates: 'Get notified about booking status changes',
      marketingEmails: 'Receive promotional emails and offers',
      weeklyReports: 'Get weekly summary reports',
      securityAlerts: 'Receive alerts about account security'
    };
    return descriptions[key] || '';
  };

  if (initialLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm sm:text-base text-gray-600">Configure your account settings and preferences.</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4 sm:p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500 text-sm">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm sm:text-base text-gray-600">Configure your account settings and preferences.</p>
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`p-3 sm:p-4 rounded-md flex items-center text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <FiCheck className="mr-2 h-4 w-4 flex-shrink-0" />
          ) : (
            <FiX className="mr-2 h-4 w-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex overflow-x-auto scrollbar-hide">
          <div className="flex space-x-1 sm:space-x-4 md:space-x-8 min-w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        {activeTab === 'profile' && renderProfileSettings()}
        {activeTab === 'preferences' && renderPreferences()}
        {activeTab === 'notifications' && renderNotifications()}
        {activeTab === 'security' && renderSecurity()}
      </div>
    </div>
  );
}
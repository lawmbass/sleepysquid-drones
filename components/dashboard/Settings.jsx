import { useState, useEffect, useCallback } from 'react';
import { 
  FiUser, 
  FiSettings, 
  FiBell, 
  FiShield, 
  FiSave, 
  FiEye, 
  FiEyeOff,
  FiCheck,
  FiX,
  FiMail,
  FiAlertCircle
} from 'react-icons/fi';

export default function Settings({ user, onUpdate }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);

  // Password validation function
  const validatePasswordStrength = (password) => {
    const errors = [];
    
    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors };
    }
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };
  
  // Profile settings state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    company: '',
    bio: '',
    location: '',
    website: '',
    emailVerified: false,
    pendingEmail: null
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
    bookingConfirmations: true,
    statusUpdates: true,
    marketingEmails: false,
    weeklyReports: true,
    securityAlerts: true
  });

  // Security settings state
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false,
    hasPassword: false,
    isOAuthUser: false
  });

  // Email verification states
  const [emailChangeData, setEmailChangeData] = useState({
    newEmail: '',
    isChanging: false
  });
  const [emailActions, setEmailActions] = useState({
    sendingVerification: false,
    changingEmail: false
  });

  const tabs = [
    { id: 'profile', name: 'Profile', icon: FiUser },
    { id: 'preferences', name: 'Preferences', icon: FiSettings },
    { id: 'notifications', name: 'Notifications', icon: FiBell },
    { id: 'security', name: 'Security', icon: FiShield }
  ];

  // Load settings data function
  const loadSettings = useCallback(async () => {
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
          twoFactorEnabled: data.security.twoFactorEnabled,
          hasPassword: data.security.hasPassword,
          isOAuthUser: data.security.isOAuthUser
        }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setInitialLoading(false);
    }
  }, []);

  // Load settings data on component mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSendVerification = async () => {
    setEmailActions(prev => ({ ...prev, sendingVerification: true }));
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/user/email/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
      } else {
        if (data.isVerified) {
          // Email is already verified, refresh the settings
          setMessage({ type: 'success', text: 'Email is already verified!' });
          setTimeout(() => {
            loadSettings();
          }, 1000);
        } else {
          setMessage({ type: 'error', text: data.message || 'Failed to send verification email' });
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send verification email' });
    } finally {
      setEmailActions(prev => ({ ...prev, sendingVerification: false }));
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  const handleEmailChange = async () => {
    if (!emailChangeData.newEmail) {
      setMessage({ type: 'error', text: 'Please enter a new email address' });
      return;
    }

    setEmailActions(prev => ({ ...prev, changingEmail: true }));
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/user/email/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newEmail: emailChangeData.newEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        setEmailChangeData({ newEmail: '', isChanging: false });
        // Reload settings to show pending email
        setTimeout(() => {
          loadSettings();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to initiate email change' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to initiate email change' });
    } finally {
      setEmailActions(prev => ({ ...prev, changingEmail: false }));
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

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
          // Check if OAuth user is trying to set up a password
          if (security.isOAuthUser && !security.newPassword) {
            // OAuth users can only update if they're setting up a password
            setMessage({ type: 'info', text: 'Add a password to enable additional sign-in options' });
            setLoading(false);
            return;
          }
          
          // Validate password fields if provided
          if (security.newPassword) {
            if (security.newPassword !== security.confirmPassword) {
              setMessage({ type: 'error', text: 'Passwords do not match' });
              setLoading(false);
              return;
            }
            
            // Validate password strength
            const passwordValidation = validatePasswordStrength(security.newPassword);
            if (!passwordValidation.isValid) {
              setMessage({ type: 'error', text: passwordValidation.errors[0] });
              setLoading(false);
              return;
            }
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
        const data = await response.json();
        setMessage({ type: 'success', text: data.message || 'Settings updated successfully!' });
        
        if (section === 'profile' && onUpdate) {
          onUpdate({ ...user, ...profileData });
        }
        
        if (section === 'security') {
          setSecurity(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
          
          // If this was an initial password setup, refresh the settings to update isOAuthUser status
          if (data.initialPasswordSetup) {
            await loadSettings();
          }
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
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <div className="p-2 bg-blue-100 rounded-lg">
          <FiUser className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
          <p className="text-sm text-gray-600">Update your personal details and contact information</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
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
          <div className="space-y-2">
            <div className="relative">
              <input
                type="email"
                value={profileData.email}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 text-sm"
                placeholder="Enter your email"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {profileData.emailVerified ? (
                  <div className="flex items-center space-x-1 text-green-600">
                    <FiCheck className="h-4 w-4" />
                    <span className="text-xs font-medium">Verified</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 text-amber-600">
                    <FiAlertCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Unverified</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Verification Actions */}
            {!profileData.emailVerified && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <FiMail className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">Email not verified</span>
                </div>
                <button
                  onClick={handleSendVerification}
                  disabled={emailActions.sendingVerification}
                  className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {emailActions.sendingVerification ? 'Sending...' : 'Send Verification'}
                </button>
              </div>
            )}

            {/* Pending Email Change */}
            {profileData.pendingEmail && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center space-x-2 mb-2">
                  <FiMail className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Email Change Pending</span>
                </div>
                <p className="text-xs text-blue-600">
                  Verification email sent to: <strong>{profileData.pendingEmail}</strong>
                </p>
                <p className="text-xs text-blue-500 mt-1">
                  Check your email and click the verification link to complete the change.
                </p>
              </div>
            )}

            {/* Email Change Form */}
            {!emailChangeData.isChanging ? (
              <button
                onClick={() => setEmailChangeData(prev => ({ ...prev, isChanging: true }))}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Change Email Address
              </button>
            ) : (
              <div className="space-y-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <label className="block text-xs font-medium text-gray-700">
                  New Email Address
                </label>
                <div className="space-y-2 sm:space-y-0 sm:flex sm:space-x-2">
                  <input
                    type="email"
                    value={emailChangeData.newEmail}
                    onChange={(e) => setEmailChangeData(prev => ({ ...prev, newEmail: e.target.value }))}
                    className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Enter new email address"
                  />
                  <div className="flex space-x-2 sm:space-x-0 sm:space-x-2">
                    <button
                      onClick={handleEmailChange}
                      disabled={emailActions.changingEmail || !emailChangeData.newEmail}
                      className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {emailActions.changingEmail ? 'Sending...' : 'Change'}
                    </button>
                    <button
                      onClick={() => setEmailChangeData({ newEmail: '', isChanging: false })}
                      className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  A verification email will be sent to your new email address.
                </p>
              </div>
            )}
          </div>
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
      
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <button
          onClick={() => handleSave('profile')}
          disabled={loading}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm transition-colors duration-200 shadow-sm hover:shadow-md"
        >
          <FiSave className="mr-3 h-5 w-5" />
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );

  const renderPreferences = () => (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <div className="p-2 bg-purple-100 rounded-lg">
          <FiSettings className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">System Preferences</h3>
          <p className="text-sm text-gray-600">Customize your application settings and display options</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
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
      
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <button
          onClick={() => handleSave('preferences')}
          disabled={loading}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm transition-colors duration-200 shadow-sm hover:shadow-md"
        >
          <FiSave className="mr-3 h-5 w-5" />
          {loading ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <div className="p-2 bg-green-100 rounded-lg">
          <FiBell className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Notification Settings</h3>
          <p className="text-sm text-gray-600">Control how and when you receive notifications</p>
        </div>
      </div>
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
      
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <button
          onClick={() => handleSave('notifications')}
          disabled={loading}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm transition-colors duration-200 shadow-sm hover:shadow-md"
        >
          <FiSave className="mr-3 h-5 w-5" />
          {loading ? 'Saving...' : 'Save Notifications'}
        </button>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      {security.isOAuthUser ? (
        // OAuth users (Google sign-in) - simplified security settings
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-blue-900">Google Account Security</h4>
                <p className="text-sm text-blue-700 mt-1">
                  You signed in with Google. Your account security is managed by Google, but you can also add a password for additional sign-in options.
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Security Features</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <FiCheck className="h-4 w-4 text-green-600 mr-2" />
                Email verification handled by Google
              </li>
              <li className="flex items-center">
                <FiCheck className="h-4 w-4 text-green-600 mr-2" />
                Password security managed by Google
              </li>
              <li className="flex items-center">
                <FiCheck className="h-4 w-4 text-green-600 mr-2" />
                Two-factor authentication available through Google
              </li>
            </ul>
            <div className="mt-3">
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Manage Google Account Security
                <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>

          {/* Password Setup Section */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Add Password</h4>
              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border">Optional</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Set up a password to sign in with either Google or your email and password.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={security.newPassword}
                  onChange={(e) => setSecurity(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Create a password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={security.confirmPassword}
                  onChange={(e) => setSecurity(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Confirm your password"
                />
              </div>

              {/* Password Requirements */}
              {security.newPassword && (
                <div className="p-3 bg-white border border-gray-200 rounded-md">
                  <p className="text-sm font-medium text-gray-700 mb-2">Password Requirements:</p>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    <div className={`flex items-center ${security.newPassword.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}>
                      <FiCheck className={`h-3 w-3 mr-1 ${security.newPassword.length >= 8 ? 'text-green-600' : 'text-gray-300'}`} />
                      At least 8 characters
                    </div>
                    <div className={`flex items-center ${/[A-Z]/.test(security.newPassword) ? 'text-green-600' : 'text-gray-400'}`}>
                      <FiCheck className={`h-3 w-3 mr-1 ${/[A-Z]/.test(security.newPassword) ? 'text-green-600' : 'text-gray-300'}`} />
                      One uppercase letter
                    </div>
                    <div className={`flex items-center ${/[a-z]/.test(security.newPassword) ? 'text-green-600' : 'text-gray-400'}`}>
                      <FiCheck className={`h-3 w-3 mr-1 ${/[a-z]/.test(security.newPassword) ? 'text-green-600' : 'text-gray-300'}`} />
                      One lowercase letter
                    </div>
                    <div className={`flex items-center ${/\d/.test(security.newPassword) ? 'text-green-600' : 'text-gray-400'}`}>
                      <FiCheck className={`h-3 w-3 mr-1 ${/\d/.test(security.newPassword) ? 'text-green-600' : 'text-gray-300'}`} />
                      One number
                    </div>
                    <div className={`flex items-center ${/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(security.newPassword) ? 'text-green-600' : 'text-gray-400'}`}>
                      <FiCheck className={`h-3 w-3 mr-1 ${/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(security.newPassword) ? 'text-green-600' : 'text-gray-300'}`} />
                      One special character
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Regular users with password - full security settings
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
      )}
      
      {!security.isOAuthUser && (
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
      )}
    </div>
  );

  const getNotificationDescription = (key) => {
    const descriptions = {
      emailNotifications: 'Receive email notifications for important updates',
      pushNotifications: 'Get push notifications on your device',
      bookingUpdates: 'Get notified about booking status changes',
      bookingConfirmations: 'Receive confirmation emails when you submit new bookings',
      statusUpdates: 'Get notified when your booking status changes',
      marketingEmails: 'Receive promotional emails and offers',
      weeklyReports: 'Get weekly summary reports',
      securityAlerts: 'Receive alerts about account security'
    };
    return descriptions[key] || '';
  };

  if (initialLoading) {
    return (
      <div className="space-y-6 min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 -m-6 sm:-m-8 p-6 sm:p-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-base text-gray-600">Configure your account settings and preferences</p>
        </div>
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-3 border-blue-600 mx-auto"></div>
            <p className="mt-6 text-gray-600 font-medium">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 -m-6 sm:-m-8 p-6 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-base text-gray-600">Configure your account settings and preferences</p>
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`p-4 rounded-lg flex items-center text-sm shadow-sm border ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border-green-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message.type === 'success' ? (
            <FiCheck className="mr-3 h-5 w-5 flex-shrink-0" />
          ) : (
            <FiX className="mr-3 h-5 w-5 flex-shrink-0" />
          )}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white rounded-t-lg shadow-sm">
        <nav className="flex overflow-x-auto scrollbar-hide">
          <div className="flex space-x-1 sm:space-x-2 md:space-x-4 min-w-full px-2 sm:px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col sm:flex-row items-center justify-center py-3 sm:py-4 px-3 sm:px-4 border-b-3 font-medium text-xs sm:text-sm whitespace-nowrap transition-all duration-200 min-w-[80px] sm:min-w-[120px] ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-6 w-6 sm:h-5 sm:w-5 mb-1 sm:mb-0 sm:mr-2 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow-lg rounded-b-lg rounded-t-none p-6 sm:p-8">
        {activeTab === 'profile' && renderProfileSettings()}
        {activeTab === 'preferences' && renderPreferences()}
        {activeTab === 'notifications' && renderNotifications()}
        {activeTab === 'security' && renderSecurity()}
      </div>
    </div>
  );
}
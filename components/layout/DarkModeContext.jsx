import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

const DarkModeContext = createContext();

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};

export const DarkModeProvider = ({ children }) => {
  const { data: session } = useSession();
  const [theme, setTheme] = useState('light'); // 'light', 'dark', or 'auto'
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Set initial theme from localStorage to prevent flash
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
  }, []);

  // Load user preferences from database
  const loadUserPreferences = async () => {
    if (!session?.user?.email) {
      // No session, use localStorage fallback
      const savedTheme = localStorage.getItem('theme') || 'light';
      setTheme(savedTheme);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        const userTheme = data.preferences?.theme || 'light';
        setTheme(userTheme);
        localStorage.setItem('theme', userTheme); // Sync with localStorage
      } else {
        // Fallback to localStorage
        const savedTheme = localStorage.getItem('theme') || 'light';
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      // Fallback to localStorage
      const savedTheme = localStorage.getItem('theme') || 'light';
      setTheme(savedTheme);
    } finally {
      setIsLoading(false);
    }
  };

  // Update theme in database
  const updateThemeInDatabase = async (newTheme) => {
    if (!session?.user?.email) return;

    try {
      await fetch('/api/user/settings/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (error) {
      console.error('Failed to update theme in database:', error);
    }
  };

  // Load preferences when session changes
  useEffect(() => {
    loadUserPreferences();
  }, [session]);

  // Determine if dark mode should be active based on theme setting
  useEffect(() => {
    let shouldBeDark = false;

    if (theme === 'dark') {
      shouldBeDark = true;
    } else if (theme === 'auto') {
      // Check time of day (dark mode from 6 PM to 6 AM)
      const now = new Date();
      const hour = now.getHours();
      shouldBeDark = hour >= 18 || hour < 6; // 6 PM to 6 AM
    } else {
      // 'light' theme
      shouldBeDark = false;
    }

    setIsDarkMode(shouldBeDark);
  }, [theme]);

  // For auto mode, check time every minute to update theme
  useEffect(() => {
    if (theme !== 'auto') return;

    const checkTimeAndUpdate = () => {
      const now = new Date();
      const hour = now.getHours();
      const shouldBeDark = hour >= 18 || hour < 6; // 6 PM to 6 AM
      setIsDarkMode(shouldBeDark);
    };

    // Check immediately
    checkTimeAndUpdate();

    // Set up interval to check every minute
    const interval = setInterval(checkTimeAndUpdate, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [theme]);

  // Apply dark mode class to document
  useEffect(() => {
    if (!isLoading) {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode, isLoading]);

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setThemeAndSync = async (newTheme) => {
    setTheme(newTheme);
    await updateThemeInDatabase(newTheme);
  };

  const toggleDarkMode = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setThemeAndSync(newTheme);
  };

  return (
    <DarkModeContext.Provider value={{ 
      theme, 
      isDarkMode, 
      toggleDarkMode, 
      setTheme: setThemeAndSync,
      isLoading 
    }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export default DarkModeContext; 
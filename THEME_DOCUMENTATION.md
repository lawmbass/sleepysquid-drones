# Theme System Documentation

## Overview

The application now supports a comprehensive theme system with three modes:
- **Light**: Always uses light theme
- **Dark**: Always uses dark theme  
- **Auto**: Automatically follows the system's light/dark mode preference

## Features

### ✅ Implemented Features

1. **Database Integration**: User theme preferences are stored in the database and persist across sessions
2. **System Theme Detection**: Auto mode uses `prefers-color-scheme` media query to detect system theme
3. **Real-time Updates**: Theme changes are applied immediately and saved to the database
4. **Settings Integration**: Theme can be changed from the Settings page in the Preferences tab
5. **Fallback Support**: Uses localStorage when user is not logged in
6. **No Flash**: Prevents theme flashing during initial load
7. **Tailwind CSS Support**: Full dark mode support with `dark:` prefix classes

### 🔧 Technical Implementation

#### DarkModeContext (`components/layout/DarkModeContext.jsx`)

The main theme management system that:
- Loads user preferences from database on login
- Syncs with localStorage for offline support
- Handles system theme changes for auto mode
- Provides theme state to all components

#### API Integration

- **GET `/api/user/settings`**: Loads user preferences including theme
- **PUT `/api/user/settings/preferences`**: Updates theme preference in database

#### Database Schema

The User model includes theme preferences:
```javascript
preferences: {
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'light',
  },
  // ... other preferences
}
```

## Usage

### For Users

1. **Change Theme**: Go to Settings → Preferences → Theme dropdown
2. **Auto Mode**: Select "Auto (System)" to follow your system's theme preference
3. **Manual Mode**: Select "Light" or "Dark" for fixed themes

### For Developers

#### Using the Theme Context

```javascript
import { useDarkMode } from '@/components/layout/DarkModeContext';

function MyComponent() {
  const { theme, isDarkMode, setTheme } = useDarkMode();
  
  return (
    <div className="bg-white dark:bg-gray-900">
      <p className="text-gray-900 dark:text-white">
        Current theme: {theme}
      </p>
      <button onClick={() => setTheme('dark')}>
        Switch to Dark
      </button>
    </div>
  );
}
```

#### Adding Dark Mode Styles

Use Tailwind's `dark:` prefix for dark mode variants:

```javascript
className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
```

#### Theme Toggle Component

```javascript
import DarkModeToggle from '@/components/layout/DarkModeToggle';

<DarkModeToggle />
```

## Testing

Visit `/theme-test` to see a comprehensive demonstration of the theme functionality, including:
- Theme controls and current state
- Visual examples of components in both themes
- Technical information about the implementation

## Browser Support

- **System Theme Detection**: Modern browsers with `prefers-color-scheme` support
- **Fallback**: Uses localStorage for older browsers or when system detection fails
- **Tailwind CSS**: All modern browsers with CSS custom properties support

## Migration Notes

The theme system is backward compatible:
- Existing users will default to 'light' theme
- Previous localStorage theme preferences are preserved
- No database migration required

## Future Enhancements

Potential improvements:
- Theme-specific color palettes
- Custom theme creation
- Theme scheduling (auto-switch at certain times)
- High contrast mode support
- Reduced motion preferences integration
import { useState, useEffect } from 'react';
// Link removed as we're using router.push instead
import { useRouter } from 'next/router';
import { FiMenu, FiX, FiHome, FiBarChart, FiSettings, FiLogOut, FiUser, FiCalendar, FiMap, FiUsers, FiFileText, FiPlus, FiFolder, FiUpload, FiActivity } from 'react-icons/fi';
import { userRoles } from '@/libs/userRoles';

// Icon mapping for dynamic navigation
const iconMap = {
  FiHome,
  FiBarChart,
  FiSettings,
  FiCalendar,
  FiMap,
  FiUsers,
  FiFileText,
  FiPlus,
  FiFolder,
  FiUser,
  FiUpload,
  FiActivity
};

export default function DashboardLayout({ children, user, onSignOut, userRole }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navigation, setNavigation] = useState([]);
  const router = useRouter();

  useEffect(() => {
    // Get navigation based on user role
    if (userRole) {
      const roleNav = userRoles.getNavigationForRole(userRole);
      const navigationWithIcons = roleNav.map(item => {
        // Only transform href for dashboard-specific routes
        let href = item.href;
        let current = false;
        
        if (item.href === '/dashboard' || item.href.startsWith('/dashboard?')) {
          // Dashboard routes use hash-based navigation
          const section = item.href.includes('?section=') 
            ? item.href.split('?section=')[1] 
            : 'dashboard';
          href = `#${section}`;
          current = router.query.section === section || (section === 'dashboard' && !router.query.section);
        } else {
          // Non-dashboard routes remain unchanged
          current = router.asPath === item.href;
        }
        
        return {
          ...item,
          icon: iconMap[item.icon] || FiHome,
          href,
          current
        };
      });
      setNavigation(navigationWithIcons);
    }
  }, [userRole, router.asPath, router.query.section]);

  // Get dashboard title based on role
  const getDashboardTitle = () => {
    switch (userRole) {
      case 'admin':
        return 'Admin Dashboard';
      case 'client':
        return 'Client Portal';
      case 'pilot':
        return 'Pilot Dashboard';
      default:
        return 'Dashboard';
    }
  };

  // Handle navigation clicks
  const handleNavigationClick = (href) => {
    setSidebarOpen(false);
    
    // If it's a hash link, update the URL query parameter
    if (href.startsWith('#')) {
      const section = href.substring(1);
      router.push(`/dashboard?section=${section}`, undefined, { shallow: true });
    } else {
      // External link or absolute path
      router.push(href);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu */}
      <div className={`fixed inset-0 z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <FiX className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <h1 className="text-xl font-bold text-gray-900">{getDashboardTitle()}</h1>
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigationClick(item.href)}
                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md w-full text-left ${
                      item.current
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-4 h-6 w-6" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="ml-3">
                <p className="text-base font-medium text-gray-700">{user?.name}</p>
                <p className="text-sm font-medium text-gray-500">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <h1 className="text-xl font-bold text-gray-900">{getDashboardTitle()}</h1>
            </div>
            <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigationClick(item.href)}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left ${
                      item.current
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center w-full">
              <div className="flex-shrink-0">
                {user?.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="h-8 w-8 rounded-full" src={user.image} alt="" />
                  </>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <FiUser className="h-4 w-4 text-gray-600" />
                  </div>
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                <p className="text-xs font-medium text-gray-500">{user?.email}</p>
                <p className="text-xs font-medium text-blue-600 capitalize">{userRole}</p>
              </div>
              <button
                onClick={onSignOut}
                className="ml-3 flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                title="Sign out"
              >
                <FiLogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-50">
          <button
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
          >
            <FiMenu className="h-6 w-6" />
          </button>
        </div>
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
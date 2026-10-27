import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { FiUsers, FiPlus, FiRefreshCw } from 'react-icons/fi';
import UsersList from './UsersList';
import UserModal from './UserModal';
import UserFilters from './UserFilters';
import UserStats from './UserStats';
import { useAiClients } from './AiClientControls';

export default function UserManagement() {
  const { data: session } = useSession();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    hasAccess: '',
    page: 1,
    limit: 20,
    sort: '-createdAt'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeletedAi, setShowDeletedAi] = useState(false);
  
  // Check if current user is SleepySquid admin
  const isCurrentUserAdmin = Boolean(session?.user?.isAdmin) || session?.user?.email?.toLowerCase()?.endsWith('@sleepysquid.com') || false;

  const [ai, reloadAi] = useAiClients(isCurrentUserAdmin, showDeletedAi);
  // Once the clients merge is applied, clients (incl. AI-only ones) live on the Clients page.
  const [clientsMigrated, setClientsMigrated] = useState(false);
  useEffect(() => {
    if (!isCurrentUserAdmin) return;
    fetch('/api/admin/clients').then((r) => (r.ok ? r.json() : null)).then((b) => setClientsMigrated(Boolean(b?.data?.migrated))).catch(() => {});
  }, [isCurrentUserAdmin]);
  // One row per person: an AI client whose login email matches a user account is shown on that
  // user's row; AI clients with no account get their own row. Matching is by email, case-insensitive.
  const aiClients = [...ai.clients, ...ai.deleted];
  const aiByEmail = {};
  for (const c of aiClients) for (const e of c.emails) (aiByEmail[e.toLowerCase()] ||= []).push(c);
  const shownEmails = new Set(users.map((u) => (u.email || '').toLowerCase()));
  const term = filters.search.trim().toLowerCase();
  // Shown on every page (they're not part of the paged user list). Role filter: they count as clients.
  // Access filter: active AI clients have access, deleted ones don't.
  const roleOk = !filters.role || filters.role === 'client';
  const accessOk = (c) => filters.hasAccess === '' || String(!c.deleted_at) === String(filters.hasAccess);
  const aiOnly = (!roleOk || clientsMigrated) ? [] : aiClients.filter((c) => !c.account && accessOk(c)
    && !c.emails.some((e) => shownEmails.has(e.toLowerCase()))
    && (!term || [c.name, ...c.emails].some((v) => v.toLowerCase().includes(term))));

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`/api/admin/users?${queryParams}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      const data = responseData.data || responseData;
      
      setUsers(data.users || []);
      setStats(data.stats || {});
      setPagination(data.pagination || {});
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowModal(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
  };

  const handleUserSaved = () => {
    setShowModal(false);
    setSelectedUser(null);
    fetchUsers();
    reloadAi();
  };



  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUsers(), reloadAi()]);
    setRefreshing(false);
  };

  const updateUser = async (userId, updates) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      fetchUsers();
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Failed to update user. Please try again.');
      return false;
    }
  };

  const deleteUser = async (userId, isPendingInvitation = false) => {
    try {
      // Use different endpoint for invitations vs users
      const endpoint = isPendingInvitation 
        ? `/api/admin/invitations/${userId}`
        : `/api/admin/users/${userId}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `HTTP error! status: ${response.status}`);
      }

      fetchUsers();
      return true;
    } catch (error) {
      console.error('Error deleting user/invitation:', error);
      setError(error.message || `Failed to ${isPendingInvitation ? 'cancel invitation' : 'delete user'}. Please try again.`);
      return false;
    }
  };

  const resendInvitation = async (invitationId) => {
    try {
      setError('');
      setSuccess('');
      
      const response = await fetch(`/api/admin/invitations/${invitationId}/resend`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();
      setSuccess('Invitation resent successfully!');
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
      
      fetchUsers();
      return true;
    } catch (error) {
      console.error('Error resending invitation:', error);
      setError('Failed to resend invitation. Please try again.');
      return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <FiUsers className="mr-3 text-blue-600 dark:text-blue-400" />
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="flex flex-row gap-2 sm:flex-shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex flex-1 sm:flex-none items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800 disabled:opacity-50"
          >
            <FiRefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {isCurrentUserAdmin && (
            <button
              onClick={handleCreateUser}
              className="inline-flex flex-1 sm:flex-none items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FiPlus className="mr-2 h-4 w-4" />
              Add user
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 dark:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400 dark:text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-400">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Access Notice */}
      {!isCurrentUserAdmin && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400 dark:text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400">
                Limited Access Mode
              </h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                You have read-only access to the user management system. Only SleepySquid administrators can create, edit, or delete users and manage roles.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <UserStats stats={stats} />

      {/* Filters */}
      <UserFilters 
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {isCurrentUserAdmin && clientsMigrated && (
        <p className="text-sm text-gray-600 dark:text-gray-300" data-testid="clients-moved">
          Clients (drones, AI and web) are managed on the <Link className="text-blue-600 dark:text-blue-400 hover:underline" href="/dashboard?section=clients">Clients page</Link>.
        </p>
      )}
      {isCurrentUserAdmin && !clientsMigrated && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="ai-bar">
          <span className="text-gray-600 dark:text-gray-300">
            {ai.clients.length} AI client{ai.clients.length === 1 ? '' : 's'}. Rows tagged &quot;AI client&quot; can sign in at sleepysquid.com/login to see their AI report.
          </span>
          <button type="button" className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => setShowDeletedAi(!showDeletedAi)} data-testid="ai-show-deleted">
            {showDeletedAi ? 'Hide deleted AI clients' : 'Show deleted AI clients'}
          </button>
        </div>
      )}
      {ai.error && <p className="text-sm text-red-700">{ai.error}</p>}

      {/* Users List */}
                <UsersList
            users={users}
            pagination={pagination}
            onUpdateUser={updateUser}
            onDeleteUser={deleteUser}
            onEditUser={handleEditUser}
            onResendInvitation={resendInvitation}
            onPageChange={handlePageChange}
            aiByEmail={aiByEmail}
            aiOnly={aiOnly}
            onAiChanged={reloadAi}
            loading={loading}
            error={error}
          />

      {/* User Modal */}
      {showModal && (
        <UserModal
          user={selectedUser}
          onClose={handleCloseModal}
          onSaved={handleUserSaved}
          aiClient={selectedUser ? (aiByEmail[(selectedUser.email || '').toLowerCase()] || [])[0] || null : null}
          aiDefaultRate={ai.defaultRate}
        />
      )}
    </div>
  );
}
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { FiEdit2, FiTrash2, FiCheck, FiX, FiShield, FiUser, FiTruck, FiSettings, FiMail, FiPhone, FiBuilding } from 'react-icons/fi';
import ConfirmationDialog from './ConfirmationDialog';

export default function UsersList({ 
  users, 
  pagination, 
  onUpdateUser, 
  onDeleteUser, 
  onEditUser,
  onResendInvitation,
  onPageChange,
  loading,
  error 
}) {
  const { data: session } = useSession();
  const [deletingUser, setDeletingUser] = useState(null);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [resendingInvitation, setResendingInvitation] = useState(null);
  
  // Check if current user is SleepySquid admin
  const isCurrentUserAdmin = session?.user?.email?.toLowerCase()?.endsWith('@sleepysquid.com') || false;

  const handleToggleAccess = async (user) => {
    setUpdatingUser(user._id);
    const success = await onUpdateUser(user._id, { hasAccess: !user.hasAccess });
    setUpdatingUser(null);
  };

  const handleDeleteUser = async (user) => {
    setDeletingUser(user._id);
    const success = await onDeleteUser(user._id, user.isPendingInvitation);
    if (success) {
      setDeletingUser(null);
    }
  };

  const handleResendInvitation = async (user) => {
    setResendingInvitation(user._id);
    const success = await onResendInvitation(user._id);
    if (success) {
      setResendingInvitation(null);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return FiShield;
      case 'client': return FiUser;
      case 'pilot': return FiTruck;
      default: return FiSettings;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'client': return 'bg-blue-100 text-blue-800';
      case 'pilot': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Users</h3>
        </div>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Users</h3>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Users</h3>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <FiUser className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No users match your current filters.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Users ({pagination.totalCount || 0})
          </h3>
          <div className="text-sm text-gray-500">
            Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)} of {pagination.totalCount} users
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => {
              const RoleIcon = getRoleIcon(user.role);
              const isPendingInvitation = user.isPendingInvitation;
              
              return (
                <tr key={user._id} className={`hover:bg-gray-50 ${isPendingInvitation ? 'bg-yellow-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {user.image ? (
                          <img className="h-10 w-10 rounded-full" src={user.image} alt={user.name} />
                        ) : (
                          <div className={`h-10 w-10 rounded-full ${isPendingInvitation ? 'bg-yellow-200' : 'bg-gray-200'} flex items-center justify-center`}>
                            <FiUser className={`h-5 w-5 ${isPendingInvitation ? 'text-yellow-600' : 'text-gray-500'}`} />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 flex items-center">
                          {user.name}
                          {isPendingInvitation && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending Invitation
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <FiMail className="h-3 w-3 mr-1" />
                          {user.email}
                        </div>
                        {user.company && (
                          <div className="text-sm text-gray-500 flex items-center">
                            <FiBuilding className="h-3 w-3 mr-1" />
                            {user.company}
                          </div>
                        )}
                        {user.phone && (
                          <div className="text-sm text-gray-500 flex items-center">
                            <FiPhone className="h-3 w-3 mr-1" />
                            {user.phone}
                          </div>
                        )}
                        {isPendingInvitation && (
                          <div className="text-xs text-gray-500 mt-1">
                            Invited by {user.invitedBy} • Expires {new Date(user.expiresAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isCurrentUserAdmin ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <FiUser className="h-3 w-3 mr-1" />
                        User
                      </span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isCurrentUserAdmin ? (
                      <button
                        onClick={() => handleToggleAccess(user)}
                        disabled={updatingUser === user._id}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.hasAccess
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        } ${updatingUser === user._id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title="Toggle user access"
                      >
                        {user.hasAccess ? (
                          <>
                            <FiCheck className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <FiX className="h-3 w-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </button>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.hasAccess
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.hasAccess ? (
                          <>
                            <FiCheck className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <FiX className="h-3 w-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.createdAt)}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {isCurrentUserAdmin ? (
                        <>
                          {isPendingInvitation ? (
                            <>
                              <button
                                onClick={() => handleResendInvitation(user)}
                                disabled={resendingInvitation === user._id}
                                className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                title="Resend invitation email"
                              >
                                {resendingInvitation === user._id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                ) : (
                                  <FiMail className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                disabled={deletingUser === user._id}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                title="Cancel invitation"
                              >
                                <FiX className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => onEditUser(user)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit user"
                              >
                                <FiEdit2 className="h-4 w-4" />
                              </button>
                              {user.role !== 'admin' && (
                                <button
                                  onClick={() => handleDeleteUser(user)}
                                  disabled={deletingUser === user._id}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                  title="Delete user"
                                >
                                  <FiTrash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          Admin Only
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-700">
              Page {pagination.currentPage} of {pagination.totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onPageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPrevPage}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { FiEdit2, FiTrash2, FiCheck, FiX, FiShield, FiUser, FiTruck, FiSettings, FiMail, FiPhone, FiMoreVertical } from 'react-icons/fi';
import { HiOfficeBuilding } from 'react-icons/hi';
import ConfirmationDialog from './ConfirmationDialog';
import OptimizedImage from '../common/OptimizedImage';

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
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, user: null });
  const [expandedCard, setExpandedCard] = useState(null);
  
  // Check if current user is SleepySquid admin
  const isCurrentUserAdmin = session?.user?.email?.toLowerCase()?.endsWith('@sleepysquid.com') || false;

  const handleToggleAccess = async (user) => {
    setUpdatingUser(user._id);
    await onUpdateUser(user._id, { hasAccess: !user.hasAccess });
    setUpdatingUser(null);
  };

  const handleDeleteUser = (user) => {
    setConfirmDialog({ isOpen: true, user });
  };

  const handleConfirmDelete = async () => {
    const user = confirmDialog.user;
    const isPendingInvitation = user.isPendingInvitation;
    
    setDeletingUser(user._id);
    await onDeleteUser(user._id, isPendingInvitation);
    setDeletingUser(null);
    setConfirmDialog({ isOpen: false, user: null });
  };

  const handleCancelDelete = () => {
    setConfirmDialog({ isOpen: false, user: null });
  };

  const handleResendInvitation = async (user) => {
    setResendingInvitation(user._id);
    const success = await onResendInvitation(user._id);
    if (success) {
      setResendingInvitation(null);
    }
  };

  const toggleCardExpansion = (userId) => {
    setExpandedCard(expandedCard === userId ? null : userId);
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

  // Mobile Card Component
  const UserCard = ({ user }) => {
    const RoleIcon = getRoleIcon(user.role);
    const isPendingInvitation = user.isPendingInvitation;
    const isExpanded = expandedCard === user._id;
    
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-4 ${isPendingInvitation ? 'border-yellow-300 bg-yellow-50' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="flex-shrink-0">
              <OptimizedImage 
                src={user.image} 
                alt={user.name} 
                width={48} 
                height={48} 
                className="h-12 w-12 rounded-full"
                fallback={
                  <div className={`h-12 w-12 rounded-full ${isPendingInvitation ? 'bg-yellow-200' : 'bg-gray-200'} flex items-center justify-center`}>
                    <FiUser className={`h-6 w-6 ${isPendingInvitation ? 'text-yellow-600' : 'text-gray-500'}`} />
                  </div>
                }
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-medium text-gray-900 truncate">{user.name}</h3>
                {isPendingInvitation && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => toggleCardExpansion(user._id)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <FiMoreVertical className="h-5 w-5" />
          </button>
        </div>

        {/* Status and Role Row */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-3">
            {/* Role */}
            {isCurrentUserAdmin ? (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(user.role)}`}>
                <RoleIcon className="h-4 w-4 mr-1" />
                {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                <FiUser className="h-4 w-4 mr-1" />
                User
              </span>
            )}

            {/* Status */}
            {isCurrentUserAdmin ? (
              <button
                onClick={() => handleToggleAccess(user)}
                disabled={updatingUser === user._id || user.email === session?.user?.email}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  user.hasAccess
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                } ${updatingUser === user._id || user.email === session?.user?.email ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={user.email === session?.user?.email ? "Cannot modify your own access status" : "Toggle user access"}
              >
                {updatingUser === user._id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-1"></div>
                ) : (
                  <>
                    {user.hasAccess ? (
                      <FiCheck className="h-4 w-4 mr-1" />
                    ) : (
                      <FiX className="h-4 w-4 mr-1" />
                    )}
                  </>
                )}
                {user.hasAccess ? 'Active' : 'Inactive'}
              </button>
            ) : (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                user.hasAccess
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {user.hasAccess ? (
                  <>
                    <FiCheck className="h-4 w-4 mr-1" />
                    Active
                  </>
                ) : (
                  <>
                    <FiX className="h-4 w-4 mr-1" />
                    Inactive
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="space-y-3">
              {user.company && (
                <div className="flex items-center text-sm text-gray-600">
                  <HiOfficeBuilding className="h-4 w-4 mr-2 text-gray-400" />
                  {user.company}
                </div>
              )}
              {user.phone && (
                <div className="flex items-center text-sm text-gray-600">
                  <FiPhone className="h-4 w-4 mr-2 text-gray-400" />
                  {user.phone}
                </div>
              )}
              <div className="flex items-center text-sm text-gray-600">
                <span className="font-medium mr-2">Joined:</span>
                {formatDate(user.createdAt)}
              </div>
              {isPendingInvitation && (
                <div className="text-sm text-gray-600">
                  <div>Invited by: {user.invitedBy}</div>
                  <div>Expires: {new Date(user.expiresAt).toLocaleDateString()}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            {isCurrentUserAdmin && (
              <div className="flex space-x-2 mt-4">
                {isPendingInvitation ? (
                  <>
                    <button
                      onClick={() => handleResendInvitation(user)}
                      disabled={resendingInvitation === user._id}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {resendingInvitation === user._id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      ) : (
                        <FiMail className="h-4 w-4 mr-2" />
                      )}
                      Resend Invitation
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={deletingUser === user._id}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      <FiX className="h-4 w-4 mr-2" />
                      Cancel Invitation
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onEditUser(user)}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <FiEdit2 className="h-4 w-4 mr-2" />
                      Edit User
                    </button>
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={deletingUser === user._id}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                      >
                        <FiTrash2 className="h-4 w-4 mr-2" />
                        Delete User
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Users</h3>
        </div>
        <div className="p-4 sm:p-6">
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
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Users</h3>
        </div>
        <div className="p-4 sm:p-6">
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
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Users</h3>
        </div>
        <div className="p-4 sm:p-6">
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
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2 sm:mb-0">
            Users ({pagination.totalCount || 0})
          </h3>
          <div className="text-sm text-gray-500">
            Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)} of {pagination.totalCount} users
          </div>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="block lg:hidden">
        <div className="divide-y divide-gray-200">
          {users.map((user) => (
            <div key={user._id} className="p-4">
              <UserCard user={user} />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden lg:block">
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
                          <OptimizedImage 
                            src={user.image} 
                            alt={user.name} 
                            width={40} 
                            height={40} 
                            className="h-10 w-10 rounded-full"
                            fallback={
                              <div className={`h-10 w-10 rounded-full ${isPendingInvitation ? 'bg-yellow-200' : 'bg-gray-200'} flex items-center justify-center`}>
                                <FiUser className={`h-5 w-5 ${isPendingInvitation ? 'text-yellow-600' : 'text-gray-500'}`} />
                              </div>
                            }
                          />
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
                               <HiOfficeBuilding className="h-3 w-3 mr-1" />
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
                          disabled={updatingUser === user._id || user.email === session?.user?.email}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.hasAccess
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          } ${updatingUser === user._id || user.email === session?.user?.email ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          title={user.email === session?.user?.email ? "Cannot modify your own access status" : "Toggle user access"}
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
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <div className="text-sm text-gray-700 mb-2 sm:mb-0">
              Page {pagination.currentPage} of {pagination.totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onPageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPrevPage}
                className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title={confirmDialog.user?.isPendingInvitation ? 'Cancel Invitation' : 'Delete User'}
        message={confirmDialog.user?.isPendingInvitation 
          ? `Are you sure you want to cancel the invitation for ${confirmDialog.user?.name} (${confirmDialog.user?.email})?`
          : `Are you sure you want to delete ${confirmDialog.user?.name} (${confirmDialog.user?.email})? This action cannot be undone.`
        }
        confirmText={confirmDialog.user?.isPendingInvitation ? 'Cancel Invitation' : 'Delete User'}
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        isLoading={deletingUser === confirmDialog.user?._id}
      />
    </div>
  );
}
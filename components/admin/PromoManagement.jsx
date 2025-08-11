import { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiCalendar, FiPercent, FiClock, FiCheck, FiX, FiMoreVertical } from 'react-icons/fi';
import ConfirmationDialog from './ConfirmationDialog';

export default function PromoManagement() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discountPercentage: 10,
    startDate: '',
    endDate: ''
  });
  const [expandedCard, setExpandedCard] = useState(null);

  useEffect(() => {
    fetchPromos();
  }, []);

  const fetchPromos = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/admin/promos', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPromos(data.data.promos || []);
    } catch (error) {
      console.error('Error fetching promos:', error);
      setError('Failed to load promos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingPromo 
        ? `/api/admin/promos/${editingPromo.id}` 
        : '/api/admin/promos';
      
      const method = editingPromo ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save promo');
      }

      // Reset form and refresh data
      resetForm();
      fetchPromos();
    } catch (error) {
      console.error('Error saving promo:', error);
      setError(error.message);
    }
  };

  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, promo: null });
  const [deletingPromoId, setDeletingPromoId] = useState(null);

  const handleDelete = (promo) => {
    setConfirmDialog({ isOpen: true, promo });
  };

  const handleConfirmDelete = async () => {
    const promo = confirmDialog.promo;
    setDeletingPromoId(promo.id);
    
    try {
      const response = await fetch(`/api/admin/promos/${promo.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete promo');
      }

      fetchPromos();
    } catch (error) {
      console.error('Error deleting promo:', error);
      setError('Failed to delete promo. Please try again.');
    } finally {
      setDeletingPromoId(null);
      setConfirmDialog({ isOpen: false, promo: null });
    }
  };

  const handleCancelDelete = () => {
    setConfirmDialog({ isOpen: false, promo: null });
  };

  const handleEdit = (promo) => {
    setEditingPromo(promo);
    setFormData({
      name: promo.name,
      description: promo.description,
      discountPercentage: promo.discountPercentage,
      startDate: new Date(promo.startDate).toISOString().split('T')[0],
      endDate: new Date(promo.endDate).toISOString().split('T')[0]
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      discountPercentage: 10,
      startDate: '',
      endDate: ''
    });
    setEditingPromo(null);
    setShowCreateForm(false);
    setError('');
  };

  const getPromoStatus = (promo) => {
    const now = new Date();
    const startDate = new Date(promo.startDate);
    const endDate = new Date(promo.endDate);

    if (!promo.isActive) {
      return { status: 'inactive', label: 'Inactive', color: 'gray' };
    }

    if (now < startDate) {
      return { status: 'upcoming', label: 'Upcoming', color: 'blue' };
    }

    if (now > endDate) {
      return { status: 'expired', label: 'Expired', color: 'red' };
    }

    return { status: 'active', label: 'Active', color: 'green' };
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const toggleCardExpansion = (promoId) => {
    setExpandedCard(expandedCard === promoId ? null : promoId);
  };

  // Mobile Card Component
  const PromoCard = ({ promo }) => {
    const status = getPromoStatus(promo);
    const isExpanded = expandedCard === promo.id;
    
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">{promo.name}</h3>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                status.color === 'green' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                status.color === 'red' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' :
                status.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' :
                'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
              }`}>
                <FiCheck className="mr-1 h-3 w-3" />
                {status.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">{promo.description}</p>
          </div>
          <button
            onClick={() => toggleCardExpansion(promo.id)}
            className="flex-shrink-0 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <FiMoreVertical className="h-5 w-5" />
          </button>
        </div>

        {/* Discount and Duration Row */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
              <FiPercent className="h-4 w-4 mr-1" />
              {promo.discountPercentage}% off
            </span>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <FiCalendar className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                <span className="font-medium mr-2">Start:</span>
                {formatDate(promo.startDate)}
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <FiCalendar className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                <span className="font-medium mr-2">End:</span>
                {formatDate(promo.endDate)}
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium mr-2">Created:</span>
                {formatDate(promo.createdAt)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => handleEdit(promo)}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-blue-300 dark:border-blue-700 rounded-md shadow-sm text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800"
              >
                <FiEdit className="h-4 w-4 mr-2" />
                Edit Promo
              </button>
              <button
                onClick={() => handleDelete(promo)}
                disabled={deletingPromoId === promo.id}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-red-300 dark:border-red-700 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-red-400 dark:focus:ring-offset-gray-800 disabled:opacity-50"
              >
                <FiTrash2 className="h-4 w-4 mr-2" />
                Delete Promo
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Promo Management</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage promotional discounts for all packages</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800"
        >
          <FiPlus className="mr-2 h-4 w-4" />
          Create Promo
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <FiX className="h-5 w-5 text-red-400 dark:text-red-500" />
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {editingPromo ? 'Edit Promo' : 'Create New Promo'}
            </h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Promo Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Summer Sale 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Discount Percentage
                </label>
                <div className="mt-1 relative">
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData({ ...formData, discountPercentage: parseInt(e.target.value) })}
                    className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 pr-8 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="10"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <FiPercent className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Describe the promotion and what customers can expect..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800"
              >
                {editingPromo ? 'Update Promo' : 'Create Promo'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Current Promos</h3>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading promos...</p>
          </div>
        ) : promos.length === 0 ? (
          <div className="p-6 text-center">
            <FiClock className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No promos</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating a new promotional discount.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="block lg:hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {promos.map((promo) => (
                  <div key={promo.id} className="p-4">
                    <PromoCard promo={promo} />
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden lg:block">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Promo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Discount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {promos.map((promo) => {
                      const status = getPromoStatus(promo);
                      return (
                        <tr key={promo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {promo.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {promo.description}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {promo.discountPercentage}% off
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              <div className="flex items-center">
                                <FiCalendar className="mr-1 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                {formatDate(promo.startDate)}
                              </div>
                              <div className="flex items-center">
                                <FiCalendar className="mr-1 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                {formatDate(promo.endDate)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              status.color === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                              status.color === 'red' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                              status.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                            }`}>
                              <FiCheck className="mr-1 h-3 w-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(promo.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleEdit(promo)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                              >
                                <FiEdit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(promo)}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                              >
                                <FiTrash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title="Delete Promo"
        message={confirmDialog.promo ? `Are you sure you want to delete the promo "${confirmDialog.promo.name}"? This action cannot be undone.` : ''}
        confirmText="Delete Promo"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
        isLoading={deletingPromoId === confirmDialog.promo?.id}
      />
    </div>
  );
}
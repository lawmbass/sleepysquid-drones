import { createPortal } from 'react-dom';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

export default function ConfirmationDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger" // danger, warning, info
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const typeStyles = {
    danger: {
      icon: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      border: 'border-red-200'
    },
    warning: {
      icon: 'text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
      border: 'border-yellow-200'
    },
    info: {
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      border: 'border-blue-200'
    }
  };

  const currentStyle = typeStyles[type] || typeStyles.danger;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 min-h-screen"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <FiAlertTriangle className={`h-6 w-6 mr-3 ${currentStyle.icon}`} />
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${currentStyle.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal outside of any container
  if (typeof window === 'undefined') return null;
  return createPortal(modalContent, document.body);
} 
import { AlertTriangle, X } from 'lucide-react';
import React from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold flex items-center">
            {isDestructive && (
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            )}
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-6">{message}</p>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={
                isDestructive
                  ? 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700'
                  : 'px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90'
              }
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;

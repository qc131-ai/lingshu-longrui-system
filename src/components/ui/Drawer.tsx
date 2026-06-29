import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function Drawer({ isOpen, onClose, title, children, width = 'md:w-[600px]' }: DrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-gray-900/30 z-40 transition-opacity"
        onClick={onClose}
      />
      <div className={`fixed inset-y-0 right-0 w-full ${width} bg-gray-50 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col overflow-hidden`}>
        <div className="px-6 py-4 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}

"use client";

import * as React from 'react';

type ToastVariant = 'default' | 'destructive';

type ToastProps = {
  title: string;
  description: string;
  variant?: ToastVariant;
  duration?: number;
};

interface ToastContextType {
  toast: (props: ToastProps) => void;
  toasts: ToastProps[];
  dismissToast: (index: number) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);
  const [mounted, setMounted] = React.useState(false);

  // Only run on client-side
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toast = (props: ToastProps) => {
    const newToast = {
      title: props.title,
      description: props.description,
      variant: props.variant || 'default',
      duration: props.duration || 3000,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const dismissToast = (index: number) => {
    setToasts((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <ToastContext.Provider value={{ toast, toasts, dismissToast }}>
      {children}
      {mounted && <ToastContainer />}
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const context = React.useContext(ToastContext);
  
  if (!context) {
    return null;
  }
  
  const { toasts, dismissToast } = context;

  return (
    <div className="fixed bottom-0 right-0 z-50 p-4 space-y-4 max-w-md w-full">
      {toasts.map((toast, index) => (
        <Toast 
          key={index} 
          {...toast} 
          dismiss={() => dismissToast(index)} 
        />
      ))}
    </div>
  );
}

function Toast({ 
  title, 
  description, 
  variant = 'default', 
  duration = 3000,
  dismiss 
}: ToastProps & { dismiss: () => void }) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [dismiss, duration]);

  return (
    <div 
      className={`
        rounded-md border p-4 shadow-md transition-all 
        ${variant === 'destructive' 
          ? 'bg-red-50 border-red-200 text-red-800' 
          : 'bg-white border-gray-200'
        }
      `}
      role="alert"
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
        <button 
          onClick={dismiss}
          className="rounded-full p-1 text-foreground/50 hover:text-foreground"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
}

// Export the toast function directly for easier imports
export const toast = (props: ToastProps) => {
  // When used outside the context, log to console as fallback
  console.log(`${props.variant === 'destructive' ? '❌' : '✅'} ${props.title}: ${props.description}`);
}; 
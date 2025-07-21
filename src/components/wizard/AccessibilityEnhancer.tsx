// Accessibility Enhancement Component for WCAG 2.1 AA Compliance
// Task 2.1: Implement WCAG 2.1 AA accessibility standards

import React, { useEffect, useRef } from 'react';

interface AccessibilityEnhancerProps {
  children: React.ReactNode;
  announceChanges?: boolean;
  focusManagement?: boolean;
  className?: string;
}

export const AccessibilityEnhancer: React.FC<AccessibilityEnhancerProps> = ({
  children,
  announceChanges = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      ref={containerRef}
      className={`accessibility-enhanced ${className}`}
      role="main"
      aria-live="polite"
    >
      {children}
      
      {/* Screen Reader Announcements */}
      {announceChanges && (
        <div
          ref={announcementRef}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />
      )}
    </div>
  );
};

// Focus Management Hook
export const useFocusManagement = (isVisible: boolean, autoFocus = true) => {
  const elementRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isVisible && autoFocus) {
      // Store the currently focused element
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      
      // Focus the element
      if (elementRef.current) {
        elementRef.current.focus();
      }
    }

    return () => {
      // Restore focus when component unmounts or becomes invisible
      if (!isVisible && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isVisible, autoFocus]);

  return elementRef;
};

// Screen Reader Announcer Hook
export const useScreenReaderAnnouncer = () => {
  const announcerRef = useRef<HTMLDivElement>(null);

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      announcerRef.current.setAttribute('aria-live', priority);
      announcerRef.current.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = '';
        }
      }, 1000);
    }
  };

  const Announcer = () => (
    <div
      ref={announcerRef}
      className="sr-only"
      aria-live="polite"
      aria-atomic="true"
    />
  );

  return { announce, Announcer };
};

// Skip Link Component
interface SkipLinkProps {
  targetId: string;
  children: React.ReactNode;
  className?: string;
}

export const SkipLink: React.FC<SkipLinkProps> = ({
  targetId,
  children,
  className = '',
}) => {
  return (
    <a
      href={`#${targetId}`}
      className={`
        sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
        focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white 
        focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 
        focus:ring-blue-500 focus:ring-offset-2
        ${className}
      `}
      onClick={(e) => {
        e.preventDefault();
        const target = document.getElementById(targetId);
        if (target) {
          target.focus();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }}
    >
      {children}
    </a>
  );
};

// Enhanced Form Field Component with Accessibility
interface AccessibleFormFieldProps {
  id: string;
  label: string;
  children: React.ReactNode;
  error?: string;
  helpText?: string;
  required?: boolean;
  className?: string;
}

export const AccessibleFormField: React.FC<AccessibleFormFieldProps> = ({
  id,
  label,
  children,
  error,
  helpText,
  required = false,
  className = '',
}) => {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const labelId = `${id}-label`;

  return (
    <div className={`space-y-2 ${className}`}>
      <label 
        id={labelId}
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      {helpText && (
        <p 
          id={helpId}
          className="text-sm text-gray-600"
        >
          {helpText}
        </p>
      )}
      
      <div>
        {React.cloneElement(children as React.ReactElement, {
          id,
          'aria-labelledby': labelId,
          'aria-describedby': [
            helpText ? helpId : null,
            error ? errorId : null
          ].filter(Boolean).join(' ') || undefined,
          'aria-invalid': Boolean(error),
          'aria-required': required,
        })}
      </div>
      
      {error && (
        <p 
          id={errorId}
          className="text-sm text-red-600"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
};

// Accessible Button Component
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Loading...',
  disabled,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center font-medium rounded-md
    transition-colors duration-200 focus:outline-none focus:ring-2 
    focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
    touch-manipulation
  `;

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    ghost: 'text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-sm min-h-[40px]',
    lg: 'px-6 py-3 text-base min-h-[44px]',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-describedby={loading ? 'loading-description' : undefined}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {loading ? loadingText : children}
      
      {loading && (
        <span id="loading-description" className="sr-only">
          Loading, please wait
        </span>
      )}
    </button>
  );
};

// Landmark Navigation Component
export const LandmarkNavigation: React.FC = () => {
  return (
    <nav aria-label="Skip links" className="sr-only focus-within:not-sr-only">
      <SkipLink targetId="main-content">
        Skip to main content
      </SkipLink>
      <SkipLink targetId="wizard-form">
        Skip to wizard form
      </SkipLink>
      <SkipLink targetId="score-preview">
        Skip to score preview
      </SkipLink>
      <SkipLink targetId="navigation">
        Skip to navigation
      </SkipLink>
    </nav>
  );
};

// Keyboard Navigation Helper
export const useKeyboardNavigation = (
  items: React.RefObject<HTMLElement>[],
  orientation: 'horizontal' | 'vertical' = 'horizontal'
) => {
  const currentIndex = useRef(0);

  const handleKeyDown = (event: KeyboardEvent) => {
    const { key } = event;
    const isHorizontal = orientation === 'horizontal';
    
    let newIndex = currentIndex.current;

    switch (key) {
      case isHorizontal ? 'ArrowRight' : 'ArrowDown':
        event.preventDefault();
        newIndex = (currentIndex.current + 1) % items.length;
        break;
      
      case isHorizontal ? 'ArrowLeft' : 'ArrowUp':
        event.preventDefault();
        newIndex = currentIndex.current === 0 ? items.length - 1 : currentIndex.current - 1;
        break;
      
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      
      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;
      
      default:
        return;
    }

    currentIndex.current = newIndex;
    items[newIndex]?.current?.focus();
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items]);

  return { currentIndex: currentIndex.current };
};

// Color Contrast Checker (development helper)
export const ColorContrastChecker: React.FC<{ 
  foreground: string; 
  background: string; 
  level?: 'AA' | 'AAA' 
}> = ({ foreground, background, level = 'AA' }) => {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // This would integrate with a color contrast calculation library
  // For now, just a placeholder for development awareness
  return (
    <div className="fixed bottom-4 right-4 p-2 bg-gray-800 text-white text-xs rounded opacity-75">
      Contrast: {foreground} on {background} (WCAG {level})
    </div>
  );
};
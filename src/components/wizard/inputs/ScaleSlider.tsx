import React, { useState, useRef, useEffect } from 'react';

interface ScaleSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  labels?: string[];
  showValue?: boolean;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  tooltips?: string[];
}

export const ScaleSlider: React.FC<ScaleSliderProps> = ({
  min = 1,
  max = 10,
  value,
  onChange,
  step = 1,
  labels = [],
  showValue = true,
  disabled = false,
  error = false,
  className = '',
  orientation = 'horizontal',
  tooltips = [],
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const percentage = ((value - min) / (max - min)) * 100;
  const currentTooltip = tooltips[Math.round(value) - min];

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!isDragging || !sliderRef.current || disabled) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const percentage = orientation === 'horizontal'
        ? Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
        : Math.max(0, Math.min(100, ((rect.bottom - clientY) / rect.height) * 100));
      
      const newValue = Math.round((percentage / 100) * (max - min) + min);
      const steppedValue = Math.round(newValue / step) * step;
      const clampedValue = Math.max(min, Math.min(max, steppedValue));
      
      onChange(clampedValue);
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Prevent scrolling
      const touch = e.touches[0];
      if (touch) {
        handleMove(touch.clientX, touch.clientY);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      setShowTooltip(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, min, max, step, onChange, disabled, orientation]);

  const handleStart = (clientX: number, clientY: number) => {
    if (disabled) return;
    
    setIsDragging(true);
    setShowTooltip(true);

    // Handle immediate click/touch
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect();
      const percentage = orientation === 'horizontal'
        ? ((clientX - rect.left) / rect.width) * 100
        : ((rect.bottom - clientY) / rect.height) * 100;
      
      const newValue = Math.round((percentage / 100) * (max - min) + min);
      const steppedValue = Math.round(newValue / step) * step;
      const clampedValue = Math.max(min, Math.min(max, steppedValue));
      
      onChange(clampedValue);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      handleStart(touch.clientX, touch.clientY);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    let newValue = value;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        newValue = Math.min(max, value + step);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        newValue = Math.max(min, value - step);
        break;
      case 'Home':
        e.preventDefault();
        newValue = min;
        break;
      case 'End':
        e.preventDefault();
        newValue = max;
        break;
      case 'PageUp':
        e.preventDefault();
        newValue = Math.min(max, value + step * 5);
        break;
      case 'PageDown':
        e.preventDefault();
        newValue = Math.max(min, value - step * 5);
        break;
      default:
        return;
    }
    onChange(newValue);
  };

  const generateTicks = () => {
    const ticks = [];
    const tickCount = Math.min(max - min + 1, 11); // Max 11 ticks
    const tickStep = (max - min) / (tickCount - 1);
    
    for (let i = 0; i < tickCount; i++) {
      const tickValue = min + (i * tickStep);
      const tickPercentage = ((tickValue - min) / (max - min)) * 100;
      
      ticks.push({
        value: Math.round(tickValue),
        percentage: tickPercentage,
        label: labels[i] || Math.round(tickValue).toString(),
      });
    }
    
    return ticks;
  };

  const ticks = generateTicks();

  return (
    <div className={`scale-slider ${className}`}>
      {/* Value Display */}
      {showValue && (
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-medium text-gray-700">
            Rating: {value}
          </span>
          {currentTooltip && (
            <span className="text-sm text-gray-500 italic">
              {currentTooltip}
            </span>
          )}
        </div>
      )}

      {/* Slider Container */}
      <div 
        className={`
          relative w-full h-6 flex items-center cursor-pointer touch-none
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        `}
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-orientation={orientation}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
      >
        {/* Track */}
        <div className={`
          absolute w-full h-2 rounded-full
          ${error ? 'bg-red-200' : 'bg-gray-200'}
        `} />
        
        {/* Filled Track */}
        <div 
          className={`
            absolute h-2 rounded-full transition-all duration-200
            ${error ? 'bg-red-500' : 'bg-blue-500'}
            ${isDragging ? 'shadow-lg' : ''}
          `}
          style={{ width: `${percentage}%` }}
        />

        {/* Tick Marks */}
        {ticks.map((tick) => (
          <div
            key={tick.value}
            className="absolute w-1 h-1 bg-gray-400 rounded-full transform -translate-x-0.5"
            style={{ left: `${tick.percentage}%` }}
          />
        ))}

        {/* Thumb */}
        <div
          ref={thumbRef}
          className={`
            absolute w-8 h-8 sm:w-6 sm:h-6 bg-white border-2 rounded-full shadow-md
            transform -translate-x-4 sm:-translate-x-3 transition-all duration-200
            ${error ? 'border-red-500' : 'border-blue-500'}
            ${isDragging ? 'scale-110 shadow-lg ring-4 ring-blue-200' : 'hover:scale-105'}
            ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}
            touch-manipulation
          `}
          style={{ left: `${percentage}%` }}
          onMouseEnter={() => !disabled && setShowTooltip(true)}
          onMouseLeave={() => !isDragging && setShowTooltip(false)}
        />

        {/* Tooltip */}
        {showTooltip && currentTooltip && (
          <div
            className="absolute -top-12 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10"
            style={{ left: `${percentage}%` }}
          >
            {currentTooltip}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-3 text-xs text-gray-500">
        {ticks.map((tick) => (
          <span 
            key={tick.value}
            className={`
              ${tick.value === value ? 'font-semibold text-blue-600' : ''}
            `}
          >
            {tick.label}
          </span>
        ))}
      </div>

      {/* Range Info */}
      <div className="flex justify-between mt-2 text-xs text-gray-400">
        <span>{labels[0] || `Min: ${min}`}</span>
        <span>{labels[labels.length - 1] || `Max: ${max}`}</span>
      </div>
    </div>
  );
};
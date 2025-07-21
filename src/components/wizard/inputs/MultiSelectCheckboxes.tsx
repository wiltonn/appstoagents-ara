import React, { useState } from 'react';
import type { QuestionOption } from '../../../types/wizard';

interface MultiSelectCheckboxesProps {
  options: QuestionOption[];
  value: any[];
  onChange: (value: any[]) => void;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  layout?: 'grid' | 'list';
  searchable?: boolean;
}

export const MultiSelectCheckboxes: React.FC<MultiSelectCheckboxesProps> = ({
  options,
  value = [],
  onChange,
  error = false,
  disabled = false,
  className = '',
  layout = 'list',
  searchable = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = searchable 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const handleOptionToggle = (optionValue: any) => {
    if (disabled) return;

    const currentValues = Array.isArray(value) ? value : [];
    const isSelected = currentValues.includes(optionValue);
    
    if (isSelected) {
      onChange(currentValues.filter(v => v !== optionValue));
    } else {
      onChange([...currentValues, optionValue]);
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;
    
    if (value.length === filteredOptions.length) {
      // Deselect all
      onChange([]);
    } else {
      // Select all filtered options
      const allValues = filteredOptions.map(opt => opt.value);
      onChange(allValues);
    }
  };

  const selectedCount = value.length;
  const isAllSelected = filteredOptions.length > 0 && selectedCount === filteredOptions.length;
  const isPartiallySelected = selectedCount > 0 && selectedCount < filteredOptions.length;

  return (
    <div className={`multi-select-checkboxes ${className}`}>
      {/* Search Input */}
      {searchable && (
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`
                w-full pl-10 pr-4 py-2 border rounded-lg shadow-sm
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${error ? 'border-red-300' : 'border-gray-300'}
                ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
              `}
              disabled={disabled}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Select All Option */}
      {filteredOptions.length > 3 && (
        <div className="mb-4 pb-3 border-b border-gray-200">
          <label className="flex items-center space-x-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(input) => {
                  if (input) input.indeterminate = isPartiallySelected;
                }}
                onChange={handleSelectAll}
                disabled={disabled}
                className={`
                  h-4 w-4 rounded border-gray-300 text-blue-600 
                  focus:ring-blue-500 focus:ring-2
                  ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                `}
              />
            </div>
            <span className={`font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
              Select All ({filteredOptions.length} options)
            </span>
          </label>
        </div>
      )}

      {/* Selected Count */}
      {selectedCount > 0 && (
        <div className="mb-3 text-sm text-blue-600">
          {selectedCount} option{selectedCount !== 1 ? 's' : ''} selected
        </div>
      )}

      {/* Options List */}
      <div className={`
        space-y-3
        ${layout === 'grid' 
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 space-y-0' 
          : ''
        }
      `}>
        {filteredOptions.map((option) => {
          const isSelected = value.includes(option.value);
          
          return (
            <label
              key={option.id}
              className={`
                flex items-start space-x-3 p-4 sm:p-3 rounded-lg border transition-all duration-200
                touch-manipulation select-none
                ${isSelected 
                  ? 'bg-blue-50 border-blue-200 shadow-sm' 
                  : 'bg-white border-gray-200 hover:border-gray-300'
                }
                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:shadow-sm active:scale-95'}
                ${error && !isSelected ? 'border-red-200' : ''}
              `}
            >
              <div className="flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleOptionToggle(option.value)}
                  disabled={disabled}
                  className={`
                    h-5 w-5 sm:h-4 sm:w-4 rounded border-gray-300 text-blue-600 
                    focus:ring-blue-500 focus:ring-2 focus:ring-offset-2
                    ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                    touch-manipulation
                  `}
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <span className={`
                  block font-medium text-sm
                  ${isSelected ? 'text-blue-900' : 'text-gray-900'}
                  ${disabled ? 'text-gray-400' : ''}
                `}>
                  {option.label}
                </span>
                
                {option.description && (
                  <p className={`
                    text-xs mt-1 leading-relaxed
                    ${isSelected ? 'text-blue-700' : 'text-gray-500'}
                    ${disabled ? 'text-gray-400' : ''}
                  `}>
                    {option.description}
                  </p>
                )}
                
                {/* Weight indicator for scoring */}
                {option.weight !== undefined && (
                  <div className={`
                    mt-2 text-xs px-2 py-1 rounded-full inline-block
                    ${isSelected 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-600'
                    }
                  `}>
                    Impact: {option.weight > 0.8 ? 'High' : option.weight > 0.5 ? 'Medium' : 'Low'}
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {/* No options message */}
      {filteredOptions.length === 0 && searchable && searchTerm && (
        <div className="text-center py-8 text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="mt-2">No options found for "{searchTerm}"</p>
          <button
            onClick={() => setSearchTerm('')}
            className="mt-2 text-blue-600 hover:text-blue-500 text-sm"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
};
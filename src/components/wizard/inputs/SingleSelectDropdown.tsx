import React, { useState, useRef, useEffect } from 'react';
import type { QuestionOption } from '../../../types/wizard';

interface SingleSelectDropdownProps {
  options: QuestionOption[];
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
}

export const SingleSelectDropdown: React.FC<SingleSelectDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  error = false,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value || opt.id === value);
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleOptionSelect = (option: QuestionOption) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (filteredOptions.length === 1) {
          handleOptionSelect(filteredOptions[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        break;
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className={`
          relative w-full cursor-pointer rounded-lg border bg-white px-4 py-3
          text-left shadow-sm transition-colors duration-200
          ${error 
            ? 'border-red-300 focus-within:border-red-500 focus-within:ring-red-500' 
            : 'border-gray-300 focus-within:border-blue-500 focus-within:ring-blue-500'
          }
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'hover:border-gray-400'}
          focus-within:ring-1 focus-within:outline-none
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <input
          ref={inputRef}
          type="text"
          className="w-full border-0 p-0 bg-transparent focus:ring-0 focus:outline-none"
          placeholder={selectedOption ? selectedOption.label : placeholder}
          value={isOpen ? searchTerm : (selectedOption?.label || '')}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          readOnly={!isOpen}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
        />
        
        <button
          type="button"
          className={`
            absolute inset-y-0 right-0 flex items-center pr-3
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) {
              setIsOpen(!isOpen);
            }
          }}
          disabled={disabled}
          aria-label="Toggle dropdown"
        >
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-2 w-full rounded-lg bg-white shadow-lg border border-gray-200 max-h-60 overflow-auto">
          {filteredOptions.length > 0 ? (
            <ul className="py-1" role="listbox">
              {filteredOptions.map((option) => (
                <li
                  key={option.id}
                  className={`
                    relative cursor-pointer select-none px-4 py-3 hover:bg-blue-50
                    transition-colors duration-150
                    ${selectedOption?.id === option.id ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}
                  `}
                  onClick={() => handleOptionSelect(option)}
                  role="option"
                  aria-selected={selectedOption?.id === option.id}
                >
                  <div className="flex flex-col">
                    <span className={`block truncate ${
                      selectedOption?.id === option.id ? 'font-medium' : 'font-normal'
                    }`}>
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="text-sm text-gray-500 mt-1">
                        {option.description}
                      </span>
                    )}
                  </div>
                  
                  {selectedOption?.id === option.id && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-gray-500 text-sm">
              No options found
            </div>
          )}
        </div>
      )}
    </div>
  );
};
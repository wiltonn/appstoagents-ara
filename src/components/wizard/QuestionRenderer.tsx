import React from 'react';
import type { Question } from '../../types/wizard';

interface QuestionRendererProps {
  question: Question;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  error,
}) => {
  const handleInputChange = (newValue: any) => {
    onChange(newValue);
  };

  const renderQuestionInput = () => {
    switch (question.type) {
      case 'single_select':
        return (
          <div className="space-y-3">
            {question.options?.map((option) => (
              <label key={option.id} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => handleInputChange(option.value)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="flex-1">
                  <span className="text-gray-900 font-medium">{option.label}</span>
                  {option.description && (
                    <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        );

      case 'multi_select':
        return (
          <div className="space-y-3">
            {question.options?.map((option) => (
              <label key={option.id} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      handleInputChange([...currentValues, option.value]);
                    } else {
                      handleInputChange(currentValues.filter(v => v !== option.value));
                    }
                  }}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <span className="text-gray-900 font-medium">{option.label}</span>
                  {option.description && (
                    <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        );

      case 'text_input':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleInputChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder={question.description}
          />
        );

      case 'number_input':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleInputChange(Number(e.target.value))}
            min={question.validation?.min}
            max={question.validation?.max}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder={question.description}
          />
        );

      case 'scale_rating':
        const min = question.validation?.min || 1;
        const max = question.validation?.max || 10;
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-500">
              <span>{min}</span>
              <span>{max}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              value={value || min}
              onChange={(e) => handleInputChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="text-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {value || min}
              </span>
            </div>
          </div>
        );

      case 'yes_no':
        return (
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                checked={value === true}
                onChange={() => handleInputChange(true)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="text-gray-900">Yes</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                checked={value === false}
                onChange={() => handleInputChange(false)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="text-gray-900">No</span>
            </label>
          </div>
        );

      case 'percentage':
        return (
          <div className="space-y-2">
            <input
              type="number"
              value={value || ''}
              onChange={(e) => handleInputChange(Number(e.target.value))}
              min={0}
              max={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter percentage (0-100)"
            />
            <div className="text-sm text-gray-500">Enter a value between 0 and 100</div>
          </div>
        );

      default:
        return (
          <div className="text-red-500">
            Unsupported question type: {question.type}
          </div>
        );
    }
  };

  return (
    <div className="question-renderer">
      {/* Question Header */}
      <div className="mb-4">
        <label className="block text-lg font-medium text-gray-900 mb-2">
          {question.title}
          {question.required && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
        {question.description && (
          <p className="text-sm text-gray-600 mb-3">
            {question.description}
          </p>
        )}
      </div>

      {/* Question Input */}
      <div className="mb-2">
        {renderQuestionInput()}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Validation Message */}
      {question.validation?.message && !error && (
        <div className="mt-2 text-sm text-gray-500">
          {question.validation.message}
        </div>
      )}
    </div>
  );
};
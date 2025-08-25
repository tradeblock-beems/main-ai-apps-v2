'use client';

/**
 * Date Range Toggle Component
 * 
 * Clean button group for selecting predefined date ranges
 * Supports Last 7, 14, 30, 60, 90 days with active state styling
 */

import React from 'react';

interface DateRangeOption {
  label: string;
  days: number;
}

interface DateRangeToggleProps {
  selectedDays: number;
  onRangeChange: (days: number) => void;
  className?: string;
}

const dateRangeOptions: DateRangeOption[] = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '60D', days: 60 },
  { label: '90D', days: 90 },
];

export default function DateRangeToggle({ 
  selectedDays, 
  onRangeChange, 
  className = "" 
}: DateRangeToggleProps) {
  return (
    <div className={`inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 ${className}`}>
      {dateRangeOptions.map((option) => {
        const isActive = selectedDays === option.days;
        
        return (
          <button
            key={option.days}
            onClick={() => onRangeChange(option.days)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
              ${isActive 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }
            `}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

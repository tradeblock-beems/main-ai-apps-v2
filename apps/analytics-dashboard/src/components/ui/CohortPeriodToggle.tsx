'use client';

/**
 * Cohort Period Toggle Component - Phase 6.5
 * 
 * Toggle between monthly and weekly cohort analysis views.
 * Consistent styling with existing DateRangeToggle component.
 */

import React from 'react';
import type { CohortPeriodType } from '@/types/analytics';

interface CohortPeriodOption {
  label: string;
  value: CohortPeriodType;
  description: string;
}

interface CohortPeriodToggleProps {
  selectedPeriod: CohortPeriodType;
  onPeriodChange: (period: CohortPeriodType) => void;
  className?: string;
}

const cohortPeriodOptions: CohortPeriodOption[] = [
  { 
    label: 'Monthly', 
    value: 'monthly',
    description: 'Group users by month joined'
  },
  { 
    label: 'Weekly', 
    value: 'weekly',
    description: 'Group users by week joined'
  },
];

export default function CohortPeriodToggle({ 
  selectedPeriod, 
  onPeriodChange, 
  className = "" 
}: CohortPeriodToggleProps) {
  return (
    <div className={`inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 ${className}`}>
      {cohortPeriodOptions.map((option) => {
        const isActive = selectedPeriod === option.value;
        
        return (
          <button
            key={option.value}
            onClick={() => onPeriodChange(option.value)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
              ${isActive 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }
            `}
            type="button"
            title={option.description}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

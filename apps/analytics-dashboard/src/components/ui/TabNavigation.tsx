/**
 * Tab Navigation Component
 * 
 * Manages switching between analytics dashboard tabs with active state styling.
 * Supports both controlled and uncontrolled usage patterns.
 */

'use client';

import React from 'react';
import type { TabType, TabConfig } from '@/types/analytics';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  className?: string;
}

const tabs: TabConfig[] = [
  {
    id: 'new-users',
    label: 'New Users',
    description: 'User registration and engagement analysis',
  },
  {
    id: 'offer-creation', 
    label: 'Offer Creation',
    description: 'Offer activity and creator conversion metrics',
  },
];

export default function TabNavigation({ 
  activeTab, 
  onTabChange,
  className = '',
}: TabNavigationProps) {
  return (
    <div className={`border-b border-slate-200 ${className}`}>
      <nav className="-mb-px flex space-x-8" aria-label="Analytics Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                group inline-flex items-center px-1 py-4 border-b-2 font-medium text-sm
                transition-colors duration-200
                ${isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
              type="button"
            >
              <span className="flex flex-col items-start">
                <span className="font-medium">{tab.label}</span>
                {tab.description && (
                  <span className={`
                    text-xs mt-0.5 font-normal
                    ${isActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-500'}
                  `}>
                    {tab.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

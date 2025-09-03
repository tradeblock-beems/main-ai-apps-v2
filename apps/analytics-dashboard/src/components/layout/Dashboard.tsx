'use client';

/**
 * Dashboard Layout Component
 * 
 * Main dashboard layout with tab navigation and page components.
 * Manages tab state and renders appropriate analytics pages.
 */

import React, { useState } from 'react';
import TabNavigation from '@/components/ui/TabNavigation';
import NewUsersPage from '@/components/layout/NewUsersPage';
import OfferCreationPage from '@/components/layout/OfferCreationPage';
import type { TabType } from '@/types/analytics';

interface DashboardProps {
  className?: string;
}

export default function Dashboard({ className = "" }: DashboardProps) {
  // Tab navigation state
  const [activeTab, setActiveTab] = useState<TabType>('new-users');

  // Handle tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Render the active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'new-users':
        return <NewUsersPage />;
      case 'offer-creation':
        return <OfferCreationPage />;
      default:
        return <NewUsersPage />;
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 ${className}`}>
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-red-600">🔴 DEBUG MODE - Analytics Dashboard</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Real-time analytics and user engagement metrics
                </p>
              </div>
              
              <div className="mt-4 sm:mt-0 flex items-center space-x-3">
                <div className="text-sm text-slate-500">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <TabNavigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </div>
    </div>
  );
}
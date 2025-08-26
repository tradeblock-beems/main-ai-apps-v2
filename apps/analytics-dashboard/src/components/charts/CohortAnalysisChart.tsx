'use client';

/**
 * Cohort Analysis Chart Component - Phase 6.5
 * 
 * D3.js grouped bar chart showing 72-hour completion rates for new user actions
 * across cohorts. Displays 4 action types: closet add, wishlist add, create offer, all actions.
 */

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { CohortData, CohortPeriodType } from '@/types/analytics';

interface CohortAnalysisChartProps {
  data: CohortData[];
  isLoading?: boolean;
  periodType: CohortPeriodType;
  width?: number;
  height?: number;
  className?: string;
}

// Color scheme for different action types
const ACTION_COLORS = {
  closetAdd: '#3B82F6',    // Blue-500
  wishlistAdd: '#10B981',  // Green-500  
  createOffer: '#F59E0B',  // Orange-500
  allActions: '#8B5CF6'    // Purple-500
};

const ACTION_LABELS = {
  closetAdd: 'Closet Add',
  wishlistAdd: 'Wishlist Add',
  createOffer: 'Create Offer',
  allActions: 'All Actions'
};

export default function CohortAnalysisChart({ 
  data, 
  isLoading = false,
  periodType,
  width = 900, 
  height = 450,
  className = "" 
}: CohortAnalysisChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isClient, setIsClient] = useState(false);

  // Client-side rendering guard
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !data || data.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const margin = { top: 20, right: 120, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous render
    svg.selectAll("*").remove();

    // Create main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare data for action-grouped bars (user wanted action groups, not cohort groups)
    const actionTypes = ['closetAdd', 'wishlistAdd', 'createOffer', 'allActions'] as const;
    
    // Transform data for D3 grouped bar chart - Group by ACTION, bars show COHORTS
    interface CohortDataPoint {
      cohort: string;
      percentage: number;
      count: number;
      totalUsers: number;
    }

    interface ActionGroupData {
      action: string;
      actionLabel: string;
      color: string;
      cohorts: CohortDataPoint[];
    }

    // Create single color gradient for cohorts (lighter = earlier, darker = recent)
    const cohortColorScale = d3.scaleSequential()
      .domain([0, data.length - 1])
      .interpolator(d3.interpolateBlues);

    // Create a mapping function for cohort periods to color indices
    const cohortIndexMap = new Map(data.map((d, i) => [d.cohortPeriod, i]));

    // Group data by action type, with cohorts as bars within each action
    const chartData: ActionGroupData[] = actionTypes.map(actionType => ({
      action: actionType,
      actionLabel: ACTION_LABELS[actionType],
      color: ACTION_COLORS[actionType], // Keep for reference, but bars will use cohort colors
      cohorts: data.map(cohort => ({
        cohort: cohort.cohortPeriod,
        percentage: cohort.actions[actionType].percentage,
        count: cohort.actions[actionType].count,
        totalUsers: cohort.totalUsers
      }))
    }));

    // Scales - Now grouping by ACTION, with cohorts as bars within each action
    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.actionLabel))
      .range([0, innerWidth])
      .padding(0.1);

    const xSubScale = d3.scaleBand()
      .domain(data.map(d => d.cohortPeriod))
      .range([0, xScale.bandwidth()])
      .padding(0.05);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d3.max(d.cohorts, c => c.percentage)) || 100])
      .nice()
      .range([innerHeight, 0]);

    // X Axis - Now showing action labels
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#64748b");

    // Y Axis
    g.append("g")
      .call(d3.axisLeft(yScale)
        .tickFormat(d => `${d}%`)
        .tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#64748b");

    // Axis labels
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (innerHeight / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#64748b")
      .text("Completion Rate (%)");

    g.append("text")
      .attr("transform", `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 10})`)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#64748b")
      .text("Action Type");

    // Tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("text-align", "left")
      .style("padding", "12px")
      .style("font-size", "12px")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("border-radius", "6px")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("box-shadow", "0 4px 6px -1px rgb(0 0 0 / 0.1)");

    // Create grouped bars - Now grouping by ACTION
    const actionGroups = g.selectAll(".action-group")
      .data(chartData)
      .enter().append("g")
      .attr("class", "action-group")
      .attr("transform", d => `translate(${xScale(d.actionLabel)}, 0)`);

    // Add bars for each cohort within action groups
    actionGroups.selectAll(".bar")
      .data((d: ActionGroupData) => d.cohorts.map(cohort => ({ ...cohort, action: d.action, actionLabel: d.actionLabel })))
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", (d: CohortDataPoint & { action: string; actionLabel: string }) => xSubScale(d.cohort) || 0)
      .attr("width", xSubScale.bandwidth())
      .attr("y", innerHeight) // Start from bottom for animation
      .attr("height", 0) // Start with height 0 for animation
      .attr("fill", (d: CohortDataPoint & { action: string; actionLabel: string }) => cohortColorScale(cohortIndexMap.get(d.cohort) || 0) as string)
      .style("cursor", "pointer");

    // Animate bars
    actionGroups.selectAll(".bar")
      .transition()
      .duration(1000)
      .delay((_, i: number) => i * 50) // Staggered animation
      .ease(d3.easeQuadOut)
      .attr("y", (d: unknown) => yScale((d as CohortDataPoint & { action: string; actionLabel: string }).percentage))
      .attr("height", (d: unknown) => innerHeight - yScale((d as CohortDataPoint & { action: string; actionLabel: string }).percentage));

    // Add hover effects
    actionGroups.selectAll(".bar")
      .on("mouseover", function(event, d: unknown) {
        const barData = d as CohortDataPoint & { action: string; actionLabel: string };
        
        d3.select(this)
          .transition()
          .duration(200)
          .attr("opacity", 0.8);

        tooltip.transition()
          .duration(200)
          .style("opacity", 1);
        
        tooltip.html(`
          <div style="font-weight: bold; margin-bottom: 8px;">
            ${barData.actionLabel}
          </div>
          <div style="margin-bottom: 4px;">
            <strong>${barData.cohort} Cohort:</strong>
          </div>
          <div style="margin-bottom: 2px;">
            ${barData.count} users (${barData.percentage.toFixed(1)}%)
          </div>
          <div style="color: #94a3b8; font-size: 11px;">
            out of ${barData.totalUsers} total users
          </div>
        `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("opacity", 1);

        tooltip.transition()
          .duration(300)
          .style("opacity", 0);
      });

    // Legend - Show cohort periods with colors
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

    const legendItems = legend.selectAll(".legend-item")
      .data(data.map(d => d.cohortPeriod))
      .enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 25})`);

    legendItems.append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("fill", d => cohortColorScale(cohortIndexMap.get(d) || 0) as string)
      .attr("rx", 2);

    legendItems.append("text")
      .attr("x", 24)
      .attr("y", 8)
      .attr("dy", "0.35em")
      .style("font-size", "12px")
      .style("fill", "#374151")
      .text(d => d);

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".tooltip").remove();
    };

  }, [data, periodType, width, height, isClient]);

  // Loading state
  if (!isClient) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // No data state
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 rounded-lg ${className}`} style={{ width, height }}>
        <div className="text-center">
          <div className="text-slate-400 text-lg mb-2">📊</div>
          <p className="text-slate-600">No cohort data available</p>
          <p className="text-slate-500 text-sm mt-1">
            Try switching between monthly and weekly views
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-slate-200 p-4 ${className}`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full h-auto"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
}

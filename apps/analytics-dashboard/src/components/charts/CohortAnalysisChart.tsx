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

    // Prepare data for grouped bars
    const actionTypes = ['closetAdd', 'wishlistAdd', 'createOffer', 'allActions'] as const;
    
    // Transform data for D3 grouped bar chart
    interface ActionData {
      action: string;
      percentage: number;
      count: number;
      color: string;
    }

    interface ChartDataItem {
      cohort: string;
      totalUsers: number;
      actions: ActionData[];
    }

    const chartData: ChartDataItem[] = data.map(cohort => ({
      cohort: cohort.cohortPeriod,
      totalUsers: cohort.totalUsers,
      actions: actionTypes.map(actionType => ({
        action: actionType,
        percentage: cohort.actions[actionType].percentage,
        count: cohort.actions[actionType].count,
        color: ACTION_COLORS[actionType]
      }))
    }));

    // Scales
    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.cohort))
      .range([0, innerWidth])
      .padding(0.1);

    const xSubScale = d3.scaleBand()
      .domain(actionTypes)
      .range([0, xScale.bandwidth()])
      .padding(0.05);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d3.max(d.actions, a => a.percentage)) || 100])
      .nice()
      .range([innerHeight, 0]);

    // X Axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat(d => {
          // Format axis labels based on period type
          if (periodType === 'monthly') {
            return d.slice(-2); // Show just "01", "02", etc for months
          } else {
            return d.split('-W')[1]; // Show just week number for weekly
          }
        })
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
      .text(periodType === 'monthly' ? 'Month' : 'Week');

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

    // Create grouped bars
    const cohortGroups = g.selectAll(".cohort-group")
      .data(chartData)
      .enter().append("g")
      .attr("class", "cohort-group")
      .attr("transform", d => `translate(${xScale(d.cohort)}, 0)`);

    // Add bars for each action type
    cohortGroups.selectAll(".bar")
      .data((d: ChartDataItem) => d.actions.map(action => ({ ...action, cohort: d.cohort, totalUsers: d.totalUsers })))
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", (d: ActionData & { cohort: string; totalUsers: number }) => xSubScale(d.action) || 0)
      .attr("width", xSubScale.bandwidth())
      .attr("y", innerHeight) // Start from bottom for animation
      .attr("height", 0) // Start with height 0 for animation
      .attr("fill", (d: ActionData & { cohort: string; totalUsers: number }) => d.color)
      .style("cursor", "pointer");

    // Animate bars
    cohortGroups.selectAll(".bar")
      .transition()
      .duration(1000)
      .delay((_, i: number) => i * 50) // Staggered animation
      .ease(d3.easeQuadOut)
      .attr("y", (d: unknown) => yScale((d as ActionData & { cohort: string; totalUsers: number }).percentage))
      .attr("height", (d: unknown) => innerHeight - yScale((d as ActionData & { cohort: string; totalUsers: number }).percentage));

    // Add hover effects
    cohortGroups.selectAll(".bar")
      .on("mouseover", function(event, d: unknown) {
        const barData = d as ActionData & { cohort: string; totalUsers: number };
        
        d3.select(this)
          .transition()
          .duration(200)
          .attr("opacity", 0.8);

        tooltip.transition()
          .duration(200)
          .style("opacity", 1);
        
        tooltip.html(`
          <div style="font-weight: bold; margin-bottom: 8px;">
            ${barData.cohort} Cohort
          </div>
          <div style="margin-bottom: 4px;">
            <strong>${ACTION_LABELS[barData.action as keyof typeof ACTION_LABELS]}:</strong>
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

    // Legend
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

    const legendItems = legend.selectAll(".legend-item")
      .data(actionTypes)
      .enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 25})`);

    legendItems.append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("fill", d => ACTION_COLORS[d])
      .attr("rx", 2);

    legendItems.append("text")
      .attr("x", 24)
      .attr("y", 8)
      .attr("dy", "0.35em")
      .style("font-size", "12px")
      .style("fill", "#374151")
      .text(d => ACTION_LABELS[d]);

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

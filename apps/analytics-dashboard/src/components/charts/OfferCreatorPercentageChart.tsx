'use client';

/**
 * Offer Creator Percentage Chart Component
 * 
 * D3.js horizontal bar chart showing percentage of active users who created offers
 * across multiple time windows (24h, 72h, 7d, 30d, 90d).
 */

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { OfferCreatorMetrics } from '@/types/analytics';

interface OfferCreatorPercentageChartProps {
  data: OfferCreatorMetrics[];
  isLoading?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

// Color scheme for percentage bars
const PERCENTAGE_COLOR = '#8B5CF6'; // Purple-500

// Time window display labels
const TIME_WINDOW_LABELS = {
  '24h': '24 Hours',
  '72h': '72 Hours', 
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days'
};

export default function OfferCreatorPercentageChart({ 
  data, 
  isLoading = false,
  width = 600, 
  height = 350,
  className = "" 
}: OfferCreatorPercentageChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isClient, setIsClient] = useState(false);

  // Client-side rendering guard
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !data.length || isLoading) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Set up dimensions and margins
    const margin = { top: 20, right: 80, bottom: 40, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    const yScale = d3.scaleBand()
      .domain(data.map(d => d.timeWindow))
      .range([0, innerHeight])
      .padding(0.2);

    const xScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.percentage) || 0])
      .range([0, innerWidth])
      .nice();

    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d => d + "%")
      .tickSizeOuter(0);

    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d => TIME_WINDOW_LABELS[d as keyof typeof TIME_WINDOW_LABELS] || d)
      .tickSizeOuter(0);

    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#64748b"); // slate-500

    // Add Y axis
    g.append("g")
      .call(yAxis)
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#64748b"); // slate-500

    // Add axis labels
    g.append("text")
      .attr("transform", `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 5})`)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#475569") // slate-600
      .text("Percentage of Active Users");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (innerHeight / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#475569") // slate-600
      .text("Time Window");

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "percentage-chart-tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000");

    // Draw bars
    g.selectAll(".percentage-bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "percentage-bar")
      .attr("x", 0)
      .attr("y", d => yScale(d.timeWindow)!)
      .attr("width", 0) // Start with 0 width for animation
      .attr("height", yScale.bandwidth())
      .attr("fill", PERCENTAGE_COLOR)
      .style("opacity", 0.8)
      .on("mouseover", function(event, d) {
        tooltip.transition()
          .duration(200)
          .style("opacity", 1);
        
        tooltip.html(`
          <div style="font-weight: bold; margin-bottom: 8px;">
            ${TIME_WINDOW_LABELS[d.timeWindow as keyof typeof TIME_WINDOW_LABELS]}
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: ${PERCENTAGE_COLOR};">●</span>
            Offer Creators: <strong>${d.offerCreators.toLocaleString()}</strong>
          </div>
          <div style="margin-bottom: 4px;">
            Active Users: <strong>${d.activeUsers.toLocaleString()}</strong>
          </div>
          <div style="margin-bottom: 4px;">
            Conversion Rate: <strong>${d.percentage}%</strong>
          </div>
          <div style="font-size: 11px; color: #ccc;">
            ${d.offerCreators} out of ${d.activeUsers} active users created offers
          </div>
        `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");

        // Highlight effect
        d3.select(this)
          .style("opacity", 1)
          .style("stroke", "#fff")
          .style("stroke-width", "1px");
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);

        // Remove highlight
        d3.select(this)
          .style("opacity", 0.8)
          .style("stroke", "none");
      })
      .transition()
      .duration(800)
      .delay((d, i) => i * 100) // Staggered animation
      .ease(d3.easeQuadOut)
      .attr("width", d => xScale(d.percentage));

    // Add percentage labels on bars
    g.selectAll(".percentage-label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "percentage-label")
      .attr("x", d => xScale(d.percentage) + 8)
      .attr("y", d => yScale(d.timeWindow)! + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("fill", "#374151") // gray-700
      .style("opacity", 0)
      .text(d => `${d.percentage}%`)
      .transition()
      .duration(800)
      .delay((d, i) => i * 100 + 400) // Start after bars
      .ease(d3.easeQuadOut)
      .style("opacity", 1);

    // Add user count labels inside bars (if bars are wide enough)
    g.selectAll(".user-count-label")
      .data(data.filter(d => xScale(d.percentage) > 100)) // Only show if bar is wide enough
      .enter()
      .append("text")
      .attr("class", "user-count-label")
      .attr("x", d => xScale(d.percentage) / 2)
      .attr("y", d => yScale(d.timeWindow)! + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .style("font-size", "11px")
      .style("font-weight", "500")
      .style("fill", "white")
      .style("text-anchor", "middle")
      .style("opacity", 0)
      .text(d => `${d.offerCreators}/${d.activeUsers}`)
      .transition()
      .duration(800)
      .delay((d, i) => i * 100 + 600) // Start after percentage labels
      .ease(d3.easeQuadOut)
      .style("opacity", 0.9);

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".percentage-chart-tooltip").remove();
    };

  }, [data, isClient, isLoading, width, height]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-80 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          <span className="text-slate-600">Loading creator percentage data...</span>
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={`flex items-center justify-center h-80 ${className}`}>
        <div className="text-center">
          <div className="text-slate-400 text-lg mb-2">📈</div>
          <div className="text-slate-600">No creator percentage data available</div>
          <div className="text-slate-500 text-sm">Check database connection</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
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

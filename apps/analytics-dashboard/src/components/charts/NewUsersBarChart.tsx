'use client';

/**
 * New Users Bar Chart Component
 * 
 * D3.js + React integration for displaying new user registration data
 * Implements responsive design with smooth animations and interactive tooltips
 */

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { ChartData } from '@/types/analytics';

interface NewUsersBarChartProps {
  data: ChartData[];
  isLoading?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export default function NewUsersBarChart({ 
  data, 
  isLoading = false,
  width = 800, 
  height = 400,
  className = "" 
}: NewUsersBarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isClient, setIsClient] = useState(false);

  // Client-side rendering guard
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !data || data.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous render
    svg.selectAll("*").remove();

    // Create main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.date))
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count) || 0])
      .nice()
      .range([innerHeight, 0]);

    // Color scale using Tailwind blue theme
    const colorScale = d3.scaleSequential()
      .domain([0, d3.max(data, d => d.count) || 0])
      .interpolator(d3.interpolateBlues);

    // X Axis - Show every 3rd day to prevent overlapping
    const tickValues = data
      .map(d => d.date)
      .filter((_, index) => index % 3 === 0);
    
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickValues(tickValues)
        .tickFormat(d => {
          // Parse date string properly to avoid timezone issues
          const date = new Date(d + 'T12:00:00'); // Add noon time to avoid timezone shift
          return d3.timeFormat("%m/%d")(date);
        })
        .tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#64748b"); // slate-500

    // Y Axis
    g.append("g")
      .call(d3.axisLeft(yScale)
        .tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "12px")
      .style("fill", "#64748b"); // slate-500

    // Tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("text-align", "center")
      .style("padding", "8px")
      .style("font-size", "12px")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("border-radius", "4px")
      .style("pointer-events", "none")
      .style("z-index", "1000");

    // Bars
    const bars = g.selectAll(".bar")
      .data(data)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => xScale(d.date) || 0)
      .attr("width", xScale.bandwidth())
      .attr("y", innerHeight) // Start from bottom for animation
      .attr("height", 0) // Start with height 0 for animation
      .attr("fill", d => colorScale(d.count))
      .style("cursor", "pointer");

    // Animate bars
    bars.transition()
      .duration(1000)
      .ease(d3.easeQuadOut)
      .attr("y", d => yScale(d.count))
      .attr("height", d => innerHeight - yScale(d.count));

    // Hover effects
    bars
      .on("mouseover", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("fill", "#2563eb"); // blue-600

        tooltip.transition()
          .duration(200)
          .style("opacity", .9);
        
        // Fix timezone issue by adding noon time to avoid date shift
        const date = new Date(d.date + 'T12:00:00');
        const formattedDate = d3.timeFormat("%B %d, %Y")(date);
        
        tooltip.html(`
          <strong>${formattedDate}</strong><br/>
          New Users: ${d.count}
        `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("fill", colorScale(d.count));

        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      });

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".tooltip").remove();
    };

  }, [data, width, height, isClient]);

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
          <p className="text-slate-600">No data available</p>
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

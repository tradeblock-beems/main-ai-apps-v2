'use client';

/**
 * Daily Offers Subdivided Bar Chart Component
 * 
 * D3.js stacked bar chart showing daily offer creation with subdivision by isOfferIdea.
 * Orange bars for offer ideas, blue bars for regular offers, with smooth animations.
 */

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { OfferCreationData } from '@/types/analytics';

interface DailyOffersChartProps {
  data: OfferCreationData[];
  isLoading?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

// Color scheme for offer subdivisions
const OFFER_COLORS = {
  offerIdeas: '#F59E0B',    // Orange-500 for offer ideas
  regularOffers: '#3B82F6', // Blue-500 for regular offers
};

export default function DailyOffersChart({ 
  data, 
  isLoading = false,
  width = 800, 
  height = 400,
  className = "" 
}: DailyOffersChartProps) {
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
    const margin = { top: 20, right: 80, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare data for stacked layout
    const stackedData = data.map(d => ({
      date: d.date,
      dateString: new Date(d.date).toISOString().split('T')[0],
      offerIdeas: d.offerIdeas,
      regularOffers: d.regularOffers,
      total: d.totalOffers
    }));

    // Set up scales
    const xScale = d3.scaleBand()
      .domain(stackedData.map(d => d.dateString))
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(stackedData, d => d.total) || 0])
      .range([innerHeight, 0])
      .nice();

    // Create stack generator
    const stack = d3.stack<typeof stackedData[0]>()
      .keys(['regularOffers', 'offerIdeas'])
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const stackedSeries = stack(stackedData);

    // Show every 3rd date on x-axis to prevent overlapping
    const tickValues = stackedData
      .map(d => d.dateString)
      .filter((_, index) => index % 3 === 0);

    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .tickValues(tickValues)
      .tickFormat(d => {
        const date = new Date(d);
        return d3.timeFormat("%m/%d")(date);
      })
      .tickSizeOuter(0);

    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d3.format("d"))
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
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (innerHeight / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#475569") // slate-600
      .text("Number of Offers");

    g.append("text")
      .attr("transform", `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 10})`)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#475569") // slate-600
      .text("Date");

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "chart-tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000");

    // Color mapping for stack layers
    const colorMap = {
      regularOffers: OFFER_COLORS.regularOffers,
      offerIdeas: OFFER_COLORS.offerIdeas
    };

    // Draw stacked bars
    stackedSeries.forEach((series, seriesIndex) => {
      g.selectAll(`.bars-${series.key}`)
        .data(series)
        .enter()
        .append("rect")
        .attr("class", `bars-${series.key}`)
        .attr("x", d => xScale(d.data.dateString)!)
        .attr("width", xScale.bandwidth())
        .attr("y", innerHeight) // Start from bottom for animation
        .attr("height", 0) // Start with 0 height for animation
        .attr("fill", colorMap[series.key as keyof typeof colorMap])
        .style("opacity", 0.9)
        .on("mouseover", function(event, d) {
          const segmentValue = d[1] - d[0];
          const date = new Date(d.data.date);
          const formattedDate = d3.timeFormat("%B %d, %Y")(date);
          const layerName = series.key === 'offerIdeas' ? 'Offer Ideas' : 'Regular Offers';
          
          tooltip.transition()
            .duration(200)
            .style("opacity", 1);
          
          tooltip.html(`
            <div style="font-weight: bold; margin-bottom: 8px;">${formattedDate}</div>
            <div style="margin-bottom: 4px;">
              <span style="color: ${colorMap[series.key as keyof typeof colorMap]};">●</span>
              ${layerName}: <strong>${segmentValue}</strong>
            </div>
            <div style="margin-bottom: 4px;">
              Total Offers: <strong>${d.data.total}</strong>
            </div>
            <div style="font-size: 11px; color: #ccc;">
              ${Math.round((segmentValue / d.data.total) * 100)}% of daily total
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
            .style("opacity", 0.9)
            .style("stroke", "none");
        })
        .transition()
        .duration(750)
        .delay((d, i) => i * 50) // Staggered animation
        .ease(d3.easeQuadOut)
        .attr("y", d => yScale(d[1]))
        .attr("height", d => yScale(d[0]) - yScale(d[1]));
    });

    // Add legend
    const legend = g.append("g")
      .attr("transform", `translate(${innerWidth + 20}, 20)`);

    const legendData = [
      { key: 'offerIdeas', label: 'Offer Ideas', color: OFFER_COLORS.offerIdeas },
      { key: 'regularOffers', label: 'Regular Offers', color: OFFER_COLORS.regularOffers }
    ];

    const legendItems = legend.selectAll(".legend-item")
      .data(legendData)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 25})`);

    legendItems.append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => d.color)
      .style("opacity", 0.9);

    legendItems.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .style("font-size", "12px")
      .style("fill", "#374151") // gray-700
      .text(d => d.label);

    // Cleanup function
    return () => {
      d3.select("body").selectAll(".chart-tooltip").remove();
    };

  }, [data, isClient, isLoading, width, height]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-slate-600">Loading offer data...</span>
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="text-slate-400 text-lg mb-2">📊</div>
          <div className="text-slate-600">No offer data available</div>
          <div className="text-slate-500 text-sm">Try selecting a different date range</div>
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

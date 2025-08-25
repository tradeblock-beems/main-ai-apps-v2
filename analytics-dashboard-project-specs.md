# Analytics Dashboard Project Specifications

## Project Overview
Building a standalone D3.js-powered analytics dashboard. Must be able to run independently while using compatible technologies for potential future integration.

## Core Framework Requirements

### Primary Stack
- **Framework**: Next.js 15.x with App Router
- **Language**: TypeScript 5.x  
- **UI Library**: React 18+
- **Styling**: Tailwind CSS 3.x
- **Visualization**: D3.js 7.x
- **Database**: PostgreSQL (Neon.tech compatible)
- **Deployment Target**: Vercel

### Package Dependencies

#### Core Dependencies
```json
{
  "dependencies": {
    "next": "^15.3.5",
    "react": "^18.x",
    "react-dom": "^18.x",
    "typescript": "^5.x",
    "tailwindcss": "^3.x",
    "@types/node": "^20.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x"
  }
}
```

#### D3.js Visualization Dependencies
```json
{
  "dependencies": {
    "d3": "^7.x",
    "@types/d3": "^7.x",
    "d3-selection": "^3.x",
    "d3-scale": "^4.x",
    "d3-axis": "^3.x",
    "d3-shape": "^3.x",
    "d3-hierarchy": "^3.x",
    "d3-force": "^3.x",
    "d3-zoom": "^3.x",
    "d3-drag": "^3.x",
    "d3-transition": "^3.x"
  }
}
```

##### Database Dependencies (Optional)
```json
{
  "dependencies": {
    "pg": "^8.x",
    "@types/pg": "^8.x",
    "dotenv": "^16.x"
  }
}
```
*Note: Only include if you want database connectivity. Can work with mock data initially.*

## Architecture Patterns

### D3.js + React Integration Pattern
```typescript
// Template for D3 React components
'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface ChartProps {
  data: any[];
  width: number;
  height: number;
  className?: string;
}

export function CustomChart({ data, width, height, className = '' }: ChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (svgRef.current && isClient) {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove(); // Clear previous renders
      
      // D3 visualization logic here
      // Add your data visualization code here
    }
  }, [data, width, height, isClient]);

  if (!isClient) {
    return <div className={`${className} animate-pulse bg-slate-100`} style={{ width, height }} />;
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
}
```

### API Route Pattern (Next.js Standard)
```typescript
// app/api/analytics/[endpoint]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('timeRange') || '7d';
    
    // For now, return mock data - add database later if needed
    const mockData = [
      { date: '2025-01-25', value: 120, category: 'Layer 1' },
      { date: '2025-01-24', value: 95, category: 'Layer 2' },
      { date: '2025-01-23', value: 78, category: 'Layer 3' },
    ];
    
    return NextResponse.json({
      success: true,
      data: mockData,
      meta: { timeRange, recordCount: mockData.length }
    });
    
  } catch (error: any) {
    console.error('[ANALYTICS] API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
```

## Design System Integration

### Color Palette (Blue/Slate Theme)
```typescript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'rgb(239, 246, 255)',   // blue-50
          600: 'rgb(37, 99, 235)',    // blue-600 (primary)
          700: 'rgb(29, 78, 216)',    // blue-700
        },
        secondary: {
          600: 'rgb(147, 51, 234)',   // purple-600
          700: 'rgb(126, 34, 206)',   // purple-700
        },
        slate: {
          50: 'rgb(248, 250, 252)',   // background
          200: 'rgb(226, 232, 240)',  // borders
          600: 'rgb(71, 85, 105)',    // text secondary
          800: 'rgb(30, 41, 59)',     // text primary
        }
      }
    }
  }
}
```

### Component Styling Classes
```css
/* Use these Tailwind class patterns throughout the project */

/* Cards */
.dashboard-card {
  @apply bg-white rounded-xl border border-slate-200 shadow-sm;
}

/* Headers */
.dashboard-header {
  @apply bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-slate-200;
}

/* Buttons */
.btn-primary {
  @apply bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors;
}

/* Layout */
.dashboard-layout {
  @apply min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30;
}
```

## Data Layer (Optional)

### Database Connection (If Needed)
```typescript
// lib/db.ts - Only if you want database connectivity
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export { pool };
```

### Type Definitions
```typescript
// types/analytics.ts
export interface ChartData {
  date: string;
  value: number;
  category?: string;
}

export interface MetricData {
  label: string;
  value: number;
  change?: number;
}

export interface ChartConfig {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  colors: string[];
}
```

## File Structure Requirements

### Recommended Directory Structure
```
analytics-dashboard/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── page.tsx                 # Main dashboard
│   │   │   ├── charts/page.tsx          # Chart gallery
│   │   │   └── metrics/page.tsx         # Key metrics
│   │   ├── api/
│   │   │   └── analytics/
│   │   │       ├── data/route.ts
│   │   │       ├── metrics/route.ts
│   │   │       └── charts/route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── charts/
│   │   │   ├── BarChart.tsx
│   │   │   ├── LineChart.tsx
│   │   │   ├── HeatMap.tsx
│   │   │   ├── PieChart.tsx
│   │   │   └── TimeSeriesChart.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Loading.tsx
│   │   └── layout/
│   │       ├── Navigation.tsx
│   │       ├── Header.tsx
│   │       └── Sidebar.tsx
│   ├── lib/
│   │   ├── db.ts
│   │   ├── analytics.ts
│   │   ├── chartUtils.ts
│   │   └── dateUtils.ts
│   ├── types/
│   │   ├── analytics.ts
│   │   └── charts.ts
│   └── styles/
│       └── globals.css
├── public/
├── .env.local
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── next.config.js
```

## Environment Variables

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_APP_ENV="development"
NEXT_PUBLIC_ANALYTICS_REFRESH_INTERVAL="30000"

# Optional - only if using database
DATABASE_URL="your_database_url"
```

## Next.js Configuration

### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Standard Next.js configuration
}

module.exports = nextConfig
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Key Features to Include

### Core Dashboard Components
- **Interactive Charts**: Bar, line, pie, and time-series visualizations
- **Real-time Data**: Auto-refreshing dashboards with configurable intervals  
- **Responsive Design**: Mobile-friendly layouts using Tailwind CSS
- **Data Export**: CSV/JSON export functionality for charts
- **Filter Controls**: Date ranges, categories, and search functionality

### D3.js Chart Types
- **Bar Charts**: For categorical data comparison
- **Line Charts**: For time-series data trends
- **Heat Maps**: For correlation and density visualization
- **Pie/Donut Charts**: For proportional data representation
- **Network Graphs**: For relationship mapping (if needed)

## Success Criteria

The analytics dashboard should:
1. ✅ **Run completely standalone** - no dependencies on other services
2. ✅ Use Next.js 15.x with TypeScript for compatibility  
3. ✅ Include multiple interactive D3.js chart types
4. ✅ Have a clean, professional UI using Tailwind CSS
5. ✅ Work with mock data initially (database optional)
6. ✅ Be deployable to Vercel independently
7. ✅ Use compatible tech stack for future integration potential

## Prompt Engineering Recommendation

When requesting the project starter pack, include:
- "Build a standalone Next.js 15.x analytics dashboard with TypeScript"
- "Use D3.js 7.x for interactive data visualizations with React integration"
- "Include multiple chart types: bar, line, pie, heat map, time-series"
- "Use Tailwind CSS with blue/slate color scheme for professional UI"
- "Start with mock data - make database connectivity optional"
- "Create reusable chart components with proper TypeScript interfaces"
- "Include data export functionality and responsive design"
- "Must run independently without external service dependencies"

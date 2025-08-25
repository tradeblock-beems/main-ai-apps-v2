# Analytics Dashboard - Architecture Guide

## User Experience → Code Architecture Mapping

### What Users See & Do → How Code Delivers It

**User Journey**: Visit `localhost:3003` → See analytics dashboard with dual charts → Click date range buttons → Watch daily users chart update → Toggle monthly/weekly cohorts → Watch cohort analysis chart update with new data

**Code Journey**: `page.tsx` → `Dashboard.tsx` → Multiple API fetches → PostgreSQL queries → D3.js rendering for both charts

---

## Core User Objectives & Code Delivery

### 1. **View Real-Time New User Data**
**User Expectation**: See a bar chart showing actual user registrations by day  
**Code Implementation**:
- `Dashboard.tsx` fetches `/api/analytics/new-users?days=30`
- `route.ts` queries PostgreSQL `users` table with `created_at >= '2025-03-05'`
- `NewUsersBarChart.tsx` renders D3.js visualization with smooth animations

### 2. **Filter by Date Range**
**User Expectation**: Click 7D/14D/30D/60D/90D buttons to see different time periods  
**Code Implementation**:
- `DateRangeToggle.tsx` triggers `handleRangeChange(days)`
- 300ms debouncing prevents API spam during rapid clicks
- 5-minute cache avoids redundant database queries

### 3. **Analyze Cohort Performance**
**User Expectation**: See cohort analysis showing 72-hour completion rates for key actions  
**Code Implementation**:
- `Dashboard.tsx` fetches `/api/analytics/cohort-analysis?period=monthly&months=12`
- `route.ts` executes `getCohortAnalysis()` with complex SQL JOINs and 72-hour window calculations
- `CohortAnalysisChart.tsx` renders D3.js grouped bar chart with action-based grouping

### 4. **Toggle Cohort Periods**
**User Expectation**: Switch between monthly and weekly cohort views  
**Code Implementation**:
- `CohortPeriodToggle.tsx` triggers `handlePeriodChange(period)`
- 300ms debouncing prevents API spam during rapid toggles
- 15-minute cache avoids redundant database queries for analytical data

### 5. **See Performance Indicators**
**User Expectation**: Green "Real data from database" badges confirm live data  
**Code Implementation**:
- Both APIs connect directly to PostgreSQL with health checks
- UI conditionally shows green indicators when `data.length > 0 && !error`

---

## Critical Architecture Layers

### **Layer 1: User Interface (React + D3.js)**
```
Dashboard.tsx (Dual Chart State Management)
├── DateRangeToggle.tsx (Daily Users Input)
├── NewUsersBarChart.tsx (D3.js Daily Visualization)
├── CohortPeriodToggle.tsx (Cohort Analysis Input)
├── CohortAnalysisChart.tsx (D3.js Grouped Bar Visualization)
└── Loading/Error States (UX Feedback for Both Charts)
```

**Breaking Change Risk**: Changes to React hooks, D3.js integration patterns, or component props  
**User Symptoms**: Charts don't load, buttons don't work, endless loading spinners

### **Layer 2: API Routes (Next.js App Router)**
```
app/api/analytics/new-users/route.ts (Daily Users - Real Data)
app/api/analytics/new-users/mock/route.ts (Daily Users - Fallback)
app/api/analytics/cohort-analysis/route.ts (Cohort Analysis - Real Data Only)
```

**Breaking Change Risk**: URL structure changes, response format changes, parameter validation  
**User Symptoms**: "Failed to load data" errors, blank charts, wrong data

### **Layer 3: Database Integration (PostgreSQL)**
```
src/lib/db.ts (Connection Pool + Query Functions)
├── getNewUsersByDay() - Daily aggregation queries
├── getCohortAnalysis() - Complex cohort calculations with 72-hour windows
└── checkDatabaseConnection() - Health monitoring
src/lib/config.ts (Environment Variables)
```

**Breaking Change Risk**: Database schema changes, connection config, query syntax  
**User Symptoms**: Dashboard completely broken, "Database connection unavailable"

### **Layer 4: Type Safety (TypeScript)**
```
src/types/analytics.ts (Interface Definitions)
├── ChartData, ApiResponse<T> - Daily users interfaces
├── CohortData, CohortAnalysisResponse - Cohort analysis interfaces
└── CohortPeriodType, CohortActionMetrics - Cohort-specific types
```

**Breaking Change Risk**: Interface mismatches between API responses and component expectations  
**User Symptoms**: Build failures, runtime type errors, data not displaying

---

## Data Flow Architecture

### **Daily Users Data Path**
```
User Click → Dashboard.tsx → fetch(/api/analytics/new-users?days=X) 
→ route.ts → getNewUsersByDay() → PostgreSQL → JSON Response → ChartData[] → D3.js
```

### **Cohort Analysis Data Path**
```
User Toggle → Dashboard.tsx → fetch(/api/analytics/cohort-analysis?period=monthly&months=12) 
→ route.ts → getCohortAnalysis() → Complex SQL with JOINs → JSON Response → CohortData[] → D3.js
```

### **Daily Users Fallback Path**
```
Database Error → Dashboard.tsx → fetch(/api/analytics/new-users/mock?days=X) 
→ mock/route.ts → Generated Data → JSON Response → ChartData[] → D3.js
```

### **Caching Strategy**
```
Daily Users: 5-minute cache (real-time feel)
Cohort Analysis: 15-minute cache (analytical data)
Both: Debounced requests (300ms) prevent API spam
```

---

## Critical Dependencies & Integration Points

### **Environment Configuration**
- **File**: `src/lib/config.ts`
- **Critical Dependency**: `DATABASE_URL` from `../../.env`
- **Breaking Change Risk**: Environment variable changes, path changes
- **User Symptom**: "DATABASE_URL environment variable is required" error

### **Database Connection Pool**
- **File**: `src/lib/db.ts`
- **Configuration**: Max 10 connections, 30s timeout
- **Breaking Change Risk**: Pool exhaustion, query timeouts, schema changes
- **User Symptom**: Slow loading, "Database connection unavailable"

### **TypeScript Interfaces**
- **File**: `src/types/analytics.ts`
- **Critical Types**: `ChartData`, `ApiResponse<T>`, `NewUsersQueryParams`
- **Breaking Change Risk**: API response format changes without interface updates
- **User Symptom**: Build errors, data not displaying correctly

### **D3.js + React Integration**
- **File**: `src/components/charts/NewUsersBarChart.tsx`
- **Pattern**: `useRef` for SVG, `useEffect` for D3 rendering, cleanup on unmount
- **Breaking Change Risk**: React lifecycle conflicts, D3 version incompatibility
- **User Symptom**: Charts don't render, animations broken, memory leaks

---

## Server Management Commands

```bash
# Check if server is running
jobs
ps aux | grep "npm run start"

# View logs in real-time (in a new terminal)
tail -f /tmp/analytics-dashboard.log

# Stop the background server when needed
pkill -f "npm run start"

# Restart server in background
nohup npm run start > /tmp/analytics-dashboard.log 2>&1 &
```

---

## Troubleshooting: User Symptoms → Code Issues

### **"Dashboard won't load" (localhost:3003 not accessible)**
1. Check server process: `ps aux | grep "npm run start"`
2. Check port conflicts: `lsof -i:3003`
3. Check build status: `npm run build`
4. Check logs: `tail -f /tmp/analytics-dashboard.log`

### **"Chart shows 'Loading chart data...' forever"**
1. Check API endpoint: `curl "http://localhost:3003/api/analytics/new-users?days=7"`
2. Check database connection: Look for "Database connection unavailable" in API response
3. Check browser network tab: Look for failed fetch requests
4. Check React state: Loading state not clearing due to uncaught errors

### **"Chart is empty or shows error message"**
1. Check API response format: Ensure `ChartData[]` structure matches expectations
2. Check database query: Verify users table has data with `created_at >= '2025-03-05'`
3. Check TypeScript interfaces: API response must match `ApiResponse<ChartData[]>`
4. Check D3.js data binding: Verify data array is not empty

### **"Date range buttons don't work"**
1. Check React state: `selectedDays` state not updating
2. Check debouncing: Timer conflicts preventing API calls
3. Check API parameters: URL parameters not properly formatted
4. Check cache: Stale cache returning same data for different ranges

### **"Real data indicator missing"**
1. Check API endpoint: Real endpoint failing, falling back to mock
2. Check database connection: Connection pool exhausted or timeout
3. Check error handling: Errors not properly caught and handled
4. Check conditional rendering: `chartData.length > 0 && !error` logic

---

## Development Workflow & Safety Protocols

### **Safe Development Practices**
1. **Always test both API endpoints**: Real and mock data paths
2. **Validate TypeScript interfaces**: Ensure API responses match expected types
3. **Test date range transitions**: Verify smooth UX during rapid clicking
4. **Monitor database connections**: Watch for pool exhaustion warnings
5. **Check browser console**: React errors, D3.js warnings, network failures

### **Before Making Changes**
1. **Run existing tests**: `npm run build` (validates TypeScript)
2. **Test current functionality**: All date ranges, both API endpoints
3. **Document interface changes**: Update `analytics.ts` if changing API format
4. **Test performance**: Response times should stay under 400ms

### **Deployment Checklist**
1. **Environment variables**: `DATABASE_URL` configured correctly
2. **Port availability**: 3003 not in use by other services
3. **Database connectivity**: Can connect to PostgreSQL from server
4. **Build success**: `npm run build` completes without errors
5. **Background process**: Server runs with `nohup` for persistence

---

## Technology Stack & Versions

- **Next.js 15.x**: App Router with TypeScript, port 3003
- **D3.js 7.x**: Data visualization with React integration
- **PostgreSQL**: Database with connection pooling (max 10, 30s timeout)
- **Tailwind CSS**: Styling with blue/slate theme
- **TypeScript 5.x**: Strict mode with absolute imports (`@/`)

**Key Performance Targets**:
- API response time: < 400ms (achieved: 362ms fresh, 329ms cached)
- Chart render time: < 1 second with smooth animations
- Cache efficiency: 5-minute expiration prevents redundant queries
- Debounce delay: 300ms optimal for UX without performance loss

# Analytics Dashboard - Architecture Guide

## User Experience → Code Architecture Mapping

### What Users See & Do → How Code Delivers It

**User Journey**: Visit `localhost:3003` → See analytics dashboard with tab navigation → Switch between "New Users" and "Offer Creation" tabs → Each tab displays specialized charts → Interactive controls update data in real-time

**Code Journey**: `page.tsx` → `Dashboard.tsx` → `TabNavigation.tsx` → Tab-specific page components → Multiple API fetches → PostgreSQL queries → D3.js rendering per tab

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

### 5. **Navigate Between Analytics Sections**
**User Expectation**: Click tabs to switch between "New Users" and "Offer Creation" analytics  
**Code Implementation**:
- `TabNavigation.tsx` manages tab state with active styling
- Tab switches trigger different page component renders
- URL routing (optional) maintains tab state across refreshes
- Each tab maintains independent data fetching and caching

### 6. **Analyze Offer Creation Metrics**
**User Expectation**: View daily offer creation with breakdown by source (offer ideas vs regular)  
**Code Implementation**:
- `OfferCreationPage.tsx` renders dual chart layout for offer analytics
- `DailyOffersChart.tsx` displays stacked bars showing `isOfferIdea` subdivision
- API route `/api/analytics/offers/daily` queries offers table with date aggregation
- Color coding: orange (offer ideas) vs blue (regular offers)

### 7. **Track Offer Creator Percentages**
**User Expectation**: See what % of active users are creating offers across different time windows  
**Code Implementation**:
- `OfferCreatorPercentageChart.tsx` displays percentage bars for 24h/72h/7d/30d/90d windows
- Complex API endpoint `/api/analytics/offers/creator-percentage` calculates active users vs offer creators
- Database queries track user activity and offer creation within each time window
- Tooltips show total active users context for each percentage

### 8. **See Performance Indicators**
**User Expectation**: Green "Real data from database" badges confirm live data across all tabs  
**Code Implementation**:
- All APIs connect directly to PostgreSQL with health checks
- Each tab shows independent data status indicators
- UI conditionally shows green indicators when `data.length > 0 && !error`

---

## Critical Architecture Layers

### **Layer 1: User Interface (React + D3.js)**
```
Dashboard.tsx (Multi-Tab State Management)
├── TabNavigation.tsx (Tab Switching Component)
├── NewUsersPage.tsx (New Users Analytics)
│   ├── DateRangeToggle.tsx (Date Range Controls)
│   ├── NewUsersBarChart.tsx (Daily Users D3.js Chart)
│   ├── CohortPeriodToggle.tsx (Cohort Period Controls)
│   └── CohortAnalysisChart.tsx (Cohort D3.js Chart)
├── OfferCreationPage.tsx (Offer Analytics)
│   ├── TimeWindowToggle.tsx (Time Window Controls)
│   ├── DailyOffersChart.tsx (Subdivided Offers D3.js Chart)
│   └── OfferCreatorPercentageChart.tsx (Percentage D3.js Chart)
└── Loading/Error States (UX Feedback Per Tab)
```

**Breaking Change Risk**: Changes to React hooks, D3.js integration patterns, or component props  
**User Symptoms**: Charts don't load, buttons don't work, endless loading spinners

### **Layer 2: API Routes (Next.js App Router)**
```
app/api/analytics/new-users/route.ts (Daily Users - Real Data)
app/api/analytics/new-users/mock/route.ts (Daily Users - Fallback)
app/api/analytics/cohort-analysis/route.ts (Cohort Analysis - Real Data Only)
app/api/analytics/offers/daily/route.ts (Daily Offers - Real Data)
app/api/analytics/offers/daily/mock/route.ts (Daily Offers - Fallback)
app/api/analytics/offers/creator-percentage/route.ts (Offer Creator % - Real Data)
app/api/analytics/offers/creator-percentage/mock/route.ts (Offer Creator % - Fallback)
```

**Breaking Change Risk**: URL structure changes, response format changes, parameter validation  
**User Symptoms**: "Failed to load data" errors, blank charts, wrong data

### **Layer 3: Database Integration (PostgreSQL)**
```
src/lib/db.ts (Connection Pool + Query Functions)
├── getNewUsersByDay() - Daily user aggregation queries
├── getCohortAnalysis() - Complex cohort calculations with 72-hour windows
├── getDailyOffers() - Daily offer aggregation with isOfferIdea subdivision
├── getOfferCreatorPercentages() - Complex user activity tracking across time windows
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
├── CohortPeriodType, CohortActionMetrics - Cohort-specific types
├── OfferCreationData, OfferSubdivisionData - Daily offers interfaces
├── OfferCreatorMetrics, TimeWindowType - Offer creator percentage interfaces
└── OfferAnalyticsResponse, OfferCreatorAnalysisResponse - API response types
```

**Breaking Change Risk**: Interface mismatches between API responses and component expectations  
**User Symptoms**: Build failures, runtime type errors, data not displaying

---

## Data Flow Architecture

### **Tab Navigation Data Flow**
```
User Tab Click → Dashboard.tsx → TabNavigation.tsx → setState(activeTab) 
→ Conditional Component Render → Tab-specific data fetching
```

### **Daily Users Data Path (New Users Tab)**
```
User Click → NewUsersPage.tsx → fetch(/api/analytics/new-users?days=X) 
→ route.ts → getNewUsersByDay() → PostgreSQL → JSON Response → ChartData[] → D3.js
```

### **Cohort Analysis Data Path (New Users Tab)**
```
User Toggle → NewUsersPage.tsx → fetch(/api/analytics/cohort-analysis?period=monthly&months=12) 
→ route.ts → getCohortAnalysis() → Complex SQL with JOINs → JSON Response → CohortData[] → D3.js
```

### **Daily Offers Data Path (Offer Creation Tab)**
```
User Date Range → OfferCreationPage.tsx → fetch(/api/analytics/offers/daily?days=X) 
→ route.ts → getDailyOffers() → PostgreSQL → Subdivision by isOfferIdea → JSON Response → D3.js
```

### **Offer Creator Percentage Data Path (Offer Creation Tab)**
```
User Window Selection → OfferCreationPage.tsx → fetch(/api/analytics/offers/creator-percentage) 
→ route.ts → getOfferCreatorPercentages() → Complex Activity Queries → JSON Response → D3.js
```

### **Fallback Paths**
```
Daily Users: Database Error → fetch(/api/analytics/new-users/mock?days=X) → mock data
Daily Offers: Database Error → fetch(/api/analytics/offers/daily/mock?days=X) → mock data
Offer Creator %: Database Error → fetch(/api/analytics/offers/creator-percentage/mock) → mock data
Cohort Analysis: No fallback (real data only)
```

### **Caching Strategy**
```
Daily Users: 5-minute cache (real-time feel)
Daily Offers: 5-minute cache (real-time feel)
Cohort Analysis: 15-minute cache (analytical data)
Offer Creator %: 10-minute cache (complex calculations)
All: Debounced requests (300ms) prevent API spam
```

---

## 🎯 Common Pitfalls & Prevention

### **Date/Timezone Handling Across D3.js Charts**
**Pattern**: Every chart component has 2-3 places where dates are parsed - data preparation, x-axis tickFormat, and tooltip formatting.

**Pitfall**: `new Date("2025-08-27")` creates midnight UTC, which may display as previous day in local timezone.

**Prevention**:
```javascript
// ✅ CONSISTENT PATTERN across all charts:
// 1. Data preparation
const dateString = new Date(apiData.date).toLocaleDateString('en-CA');
const originalDate = new Date(apiData.date);

// 2. X-axis tickFormat  
.tickFormat(d => {
  const date = new Date(d + 'T12:00:00'); // Add noon to prevent timezone shift
  return d3.timeFormat("%m/%d")(date);
})

// 3. Tooltip formatting
const date = new Date(d.date + 'T12:00:00'); // Same pattern
const formattedDate = d3.timeFormat("%B %d, %Y")(date);
```

### **Development Environment State Management**
**Pattern**: Multiple server processes can run simultaneously (production + development), causing stale code confusion.

**Pitfall**: File changes appear to have no effect because the wrong server is serving the UI.

**Prevention**:
1. **Always check processes**: `ps aux | grep -E "(npm run|next-server)"`
2. **Kill ALL before starting**: `pkill -f "npm run"`
3. **Use development mode for changes**: `npm run dev` enables hot reloading
4. **Add visual test changes**: Confirm file changes are applied with obvious UI modifications

### **Cache vs Refresh Behavior**
**Pattern**: Refresh buttons should clear cache and force fresh API calls with loading indicators.

**Pitfall**: Users can't tell if refresh is working because responses are instant (cached) or slow (fresh).

**Prevention**:
```javascript
const refreshData = () => {
  console.log('DEBUG: Refresh initiated'); // Always add debug logging
  setCache(new Map()); // Clear cache first
  setIsLoading(true);  // Show loading state
  fetchData(params, true); // forceRefresh = true with cache-busting timestamp
};
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

### **Production Mode (Stable Operation)**
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

### **Development Mode (For Debugging & Changes)**
```bash
# Start in development mode (hot reloading for immediate feedback)
npm run dev

# Or run in background with logging
nohup npm run dev > /tmp/analytics-dashboard-dev.log 2>&1 &

# View dev logs
tail -f /tmp/analytics-dashboard-dev.log
```

### **🚨 CRITICAL: Multiple Server Detection**
Running multiple servers simultaneously causes stale code issues. Always check:
```bash
# Detect ALL running instances (multiple versions cause conflicts)
ps aux | grep -E "(npm run start|npm run dev|next-server)"

# Kill ALL instances before starting fresh
pkill -f "npm run start"
pkill -f "npm run dev"
pkill -f "next-server"

# Wait for cleanup, then start fresh
sleep 3 && npm run dev
```

---

## Troubleshooting: User Symptoms → Code Issues

### **🔥 "My code changes aren't appearing in the UI" (CRITICAL)**
**This is the #1 debugging mystery. Follow this protocol systematically:**

1. **Verify File Changes Are Applied**:
   ```javascript
   // Add a visible test change to confirm UI updates
   <h1 className="text-2xl font-bold text-red-600">🔴 DEBUG MODE - [Component Name]</h1>
   ```

2. **Check Multiple Server Detection**:
   ```bash
   ps aux | grep -E "(npm run start|npm run dev|next-server)"
   # Should see only ONE process. If multiple → kill all and restart
   ```

3. **Clear Build Cache & Restart**:
   ```bash
   pkill -f "npm run"
   rm -rf .next  # Clear Next.js build cache
   npm run dev   # Use dev mode for hot reloading
   ```

4. **Browser Cache Issues**:
   - Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - Open private/incognito tab to test

5. **Path Configuration**:
   - Check all imports use absolute paths: `@/components/...`
   - Verify `tsconfig.json` paths are absolute: `/Users/.../main-ai-apps/...`

### **"Chart shows wrong dates (timezone issues)"**
**Date parsing is a common D3.js pitfall. Use these safe patterns:**

```javascript
// ❌ DANGEROUS: Creates timezone conversion issues
const date = new Date("2025-08-27");  // Midnight UTC → may shift to previous day locally

// ✅ SAFE: Add time to prevent timezone shift  
const date = new Date("2025-08-27T12:00:00");  // Noon prevents date shifting

// ✅ SAFE: Use toLocaleDateString for display formatting
const dateString = new Date(apiDate).toLocaleDateString('en-CA'); // YYYY-MM-DD format
```

**Chart-Specific Fixes**:
- **Tooltip dates wrong**: Check mouseover event date parsing
- **X-axis labels wrong**: Check tickFormat date conversion
- **Data appears for wrong day**: Check API date formatting vs chart date parsing

### **"Refresh buttons don't work / Cache confusion"**
**Add debug logging to verify refresh behavior:**

```javascript
const refreshData = () => {
  console.log('DEBUG: Refresh clicked - forcing fresh data');
  setCache(new Map()); // Clear local cache
  fetchData(selectedRange, true); // forceRefresh = true
};

const fetchData = async (range, forceRefresh = false) => {
  console.log(`DEBUG: fetchData called with forceRefresh=${forceRefresh}`);
  
  if (!forceRefresh && cached) {
    console.log('DEBUG: Using cached data');
    return cached.data;
  }
  
  console.log('DEBUG: Fetching fresh from API');
  const url = forceRefresh ? `/api/data?range=${range}&_t=${Date.now()}` : `/api/data?range=${range}`;
  // Add timestamp to bypass browser/proxy cache
};
```

**Expected Debug Flow**:
- Instant refresh → "Using cached data" (cache not cleared)
- 2-10 second refresh → "Fetching fresh from API" (working correctly)

### **"Dashboard won't load" (localhost:3003 not accessible)**
1. Check server process: `ps aux | grep "npm run start"`
2. Check port conflicts: `lsof -i:3003`
3. Check build status: `npm run build`
4. Check logs: `tail -f /tmp/analytics-dashboard.log`

### **"Tabs don't switch properly"**
1. Check TabNavigation component: Tab state not updating correctly
2. Check Dashboard.tsx: activeTab state management issues
3. Check component mounting: Page components not rendering on tab switch
4. Check browser console: React errors during tab transitions

### **"Chart shows 'Loading chart data...' forever"**
1. Check API endpoints: `curl "http://localhost:3003/api/analytics/new-users?days=7"`
2. Check API endpoints: `curl "http://localhost:3003/api/analytics/offers/daily?days=7"`
3. Check database connection: Look for "Database connection unavailable" in API response
4. Check browser network tab: Look for failed fetch requests
5. Check React state: Loading state not clearing due to uncaught errors

### **"Chart is empty or shows error message"**
1. Check API response format: Ensure data structure matches TypeScript interfaces
2. Check database query: Verify tables have data (users, offers) with proper date filtering
3. Check TypeScript interfaces: API response must match expected interface types
4. Check D3.js data binding: Verify data array is not empty and properly formatted

### **"Offer creation charts not working"**
1. Check offers table: Verify `isOfferIdea` boolean field exists and has data
2. Check offer creator percentage queries: Complex user activity tracking may be slow
3. Check time window calculations: 24h/72h/7d/30d/90d logic correctness
4. Check subdivision logic: Orange (offer ideas) vs blue (regular offers) data separation

### **"Date range buttons don't work"**
1. Check React state: Date range state not updating in correct tab
2. Check debouncing: Timer conflicts preventing API calls
3. Check API parameters: URL parameters not properly formatted for offers endpoints
4. Check cache: Stale cache returning same data for different ranges

### **"Real data indicator missing"**
1. Check API endpoints: Real endpoints failing, falling back to mock (where available)
2. Check database connection: Connection pool exhausted or timeout
3. Check error handling: Errors not properly caught and handled per tab
4. Check conditional rendering: Data length and error checking per tab component

---

## Development Workflow & Safety Protocols

### **Safe Development Practices**
1. **Always test both API endpoints**: Real and mock data paths
2. **Validate TypeScript interfaces**: Ensure API responses match expected types
3. **Test date range transitions**: Verify smooth UX during rapid clicking
4. **Monitor database connections**: Watch for pool exhaustion warnings
5. **Check browser console**: React errors, D3.js warnings, network failures
6. **🚨 Use consistent date handling**: Always add time (`T12:00:00`) to prevent timezone shifts
7. **🚨 Use development mode for changes**: `npm run dev` for hot reloading during debugging
8. **🚨 Add debug logging proactively**: Include `console.log` statements for cache/refresh behavior

### **Before Making Changes**
1. **Run existing tests**: `npm run build` (validates TypeScript)
2. **Test current functionality**: All date ranges, both API endpoints
3. **Document interface changes**: Update `analytics.ts` if changing API format
4. **Test performance**: Response times should stay under 400ms

### **🧠 Systematic Debugging Protocol**
**When something breaks, follow this hypothesis-driven approach:**

1. **Form Multiple Hypotheses**:
   ```
   Theory A: Cache not clearing (instant refresh)
   Theory B: Multiple servers running (stale code)  
   Theory C: Date parsing timezone issue (wrong dates)
   Theory D: API endpoint failing (no data)
   ```

2. **Test Each Hypothesis Systematically**:
   ```bash
   # Test A: Check console for debug logs
   # Test B: ps aux | grep "npm run"
   # Test C: Check browser network tab for API responses
   # Test D: curl "localhost:3003/api/analytics/endpoint"
   ```

3. **Add Visibility to Debug**:
   ```javascript
   // Visual change test
   <div className="bg-red-500">🔴 DEBUG: File change visible</div>
   
   // Data flow test  
   console.log('DEBUG: Component render with data:', data);
   console.log('DEBUG: API response:', response);
   ```

4. **Environment Validation**:
   - Only ONE server process running
   - Development mode for immediate feedback
   - Browser hard refresh to clear cache
   - Console shows expected debug messages

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

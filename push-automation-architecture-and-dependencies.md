# Push Automation System - Architecture & Dependencies (v5)

## 🏗️ System Overview

The Push Automation System is a comprehensive automation engine built on top of the existing push-blaster infrastructure. It provides scheduled, script-based push notification campaigns with sophisticated audience generation, testing workflows, and timeline management.

### Core Philosophy
- **Simple & Reliable**: Avoids race conditions and complex state management
- **Timeline-Driven**: 30-minute execution window with distinct phases  
- **Integration-First**: Leverages existing push-blaster and cadence service infrastructure
- **Safety-Focused**: Built-in cancellation windows, test sends, and safeguards

## 📋 Core Components

### 1. AutomationEngine (`src/lib/automationEngine.ts`)
**Primary Role**: Central orchestrator for all automation execution

**Key Responsibilities**:
- Cron-based scheduling using node-cron
- Timeline execution (5 distinct phases)
- Simple automation restoration on startup
- Timing calculation (SEND_TIME - 30min = EXECUTION_TIME)

**Critical Methods**:
- `scheduleAutomation()`: Creates cron jobs for automations
- `executeAutomation()`: Main execution entry point
- `executeTimeline()`: Orchestrates 5-phase execution
- `buildCronExpression()`: Converts UI time to cron (CRITICAL: uses FIXED_LEAD_TIME = 30)

**Dependencies**:
- AutomationStorage (loading automations)
- ScriptExecutor (audience generation)
- AutomationIntegration (push sending)
- node-cron (scheduling)

**Integration Points**:
- Calls `/api/automation/test/[id]` for unified test/live sends
- Called by cron jobs, API routes, and server startup restoration

### 2. AutomationStorage (`src/lib/automationStorage.ts`)
**Primary Role**: JSON-based persistence layer

**Key Responsibilities**:
- Load/save automation configurations
- File-based storage in .automations/ directory
- Migration utilities for legacy scheduled pushes

**Critical Methods**:
- `loadAutomation()`: Single automation retrieval
- `loadAllAutomations()`: Bulk loading for restoration
- `saveAutomation()`: Persistence with validation

### 3. AutomationIntegration (`src/lib/automationIntegration.ts`)
**Primary Role**: Bridge to existing push-blaster infrastructure

**Key Responsibilities**:
- Audience generation (script-based and query-based)
- Push notification sending via existing APIs
- Cadence filtering and tracking

**Critical Methods**:
- `generateAudience()`: Handles both script and query-based audiences
- `sendPush()`: Integrates with /api/send-push
- `filterAudienceWithCadence()`: 72-hour Layer 3 protection

**Dependencies**:
- ScriptExecutor (for script-based audiences)
- Push-blaster /api/send-push endpoint
- Push-cadence-service (cadence filtering)

**Critical API Parameter Mapping** (Fixed):
- `push.title` → `formData.get('title')` ✅ (was 'pushTitle')
- `push.body` → `formData.get('body')` ✅ (was 'pushBody')
- `isDryRun` → `formData.get('dryRun')` ✅ (was 'isDryRun')
- `csvBlob` → `formData.get('file')` ✅ (was 'csvFile')

### 4. ScriptExecutor (`src/lib/scriptExecutor.ts`)
**Primary Role**: Python script execution for audience generation

**Key Responsibilities**:
- Discovers available Python scripts
- Executes scripts with proper environment setup
- Manages CSV output and audience data

**Critical Methods**:
- `executeScript()`: Main script execution
- `discoverAvailableScripts()`: Available script discovery

**Dependencies**:
- debugPythonRunner (robust Python execution)
- File system access for CSV generation

### 5. SequenceExecutor (`src/lib/sequenceExecutor.ts`)
**Primary Role**: Multi-push sequence execution with timing and parallel processing

**Key Responsibilities**:
- Execute complete push sequences with proper delays
- Parallel audience generation for all pushes
- Timeline validation and safeguard monitoring
- Performance metrics and execution tracking

**Critical Methods**:
- `executeSequence()`: Main sequence orchestration
- `generateSequenceAudiences()`: Parallel audience generation
- `executeSequentialPushes()`: Push delivery with timing
- `validateSequence()`: Pre-execution validation

**Dependencies**:
- AutomationIntegration (push sending)
- AutomationLogger (performance tracking)
- SafeguardMonitor (safety limits)
- TimelineCalculator (timing validation)

## 🔄 Execution Flow

### Timeline Phases (30-minute window)

1. **Audience Generation** (T-30 to T-25)
   - Execute Python scripts or query-based audience generation
   - Generate CSV files for each push in sequence
   - Validate audience sizes against safeguards

2. **Test Push Sending** (T-25 to T-22)
   - Send test pushes to configured test users (if enabled)
   - Use TEST audiences to avoid production impact
   - Allow time for manual verification

3. **Cancellation Window** (T-22 to T-0)
   - Monitor for emergency stop requests
   - Countdown logging every 5 minutes
   - Final opportunity to cancel before live execution

4. **Live Execution** (T-0 to T+10)
   - Send pushes to full audiences
   - Apply sequence timing (delays between pushes)
   - Track delivery success/failure

5. **Cleanup** (T+10)
   - Remove test automation files
   - Final logging and performance metrics

### 🚨 CRITICAL TIMING LOGIC (FIXED)
```
USER INPUT: Send Time (from UI) = 17:09 (5:09 PM)
JSON STORAGE: executionTime = "17:09" (stores send time directly)
SYSTEM CALCULATION: Automation Start = executionTime - leadTimeMinutes = 16:39 (4:39 PM)
CRON EXPRESSION: Built from automation start time (eliminates double subtraction)
```

## 🧩 Integration Points

### With Push-Blaster Core
- `/api/send-push`: Primary push delivery endpoint
- `/api/query-audience`: Standard audience generation
- Existing Firebase notification infrastructure
- CSV upload and processing workflows

### With Push-Cadence-Service
- `/api/filter-audience`: Real-time cadence filtering with UUID validation
- `/api/track-notification`: Delivery tracking
- Cadence rule enforcement (72-hour Layer 3 protection)
- User notification history
- **Enhanced Error Handling**: Fail-open behavior on service errors with comprehensive logging

### With Python Scripts
- `generate_layer_3_push_csvs.py`: Layer 3 audience generation script
- `generate_new_user_waterfall.py`: New user waterfall generation script (5 levels)
- Environment variable passing for script parameters (including PYTHONPATH)
- CSV output parsing and validation with proper snake_case formatting
- Integration with `basic_capabilities` module for shared database queries

## 📊 Data Flow

### Automation Configuration
```
JSON File (.automations/{id}.json)
↓
AutomationStorage.loadAutomation()
↓
AutomationEngine.scheduleAutomation()
↓
Cron Job Creation
```

### Execution Pipeline (Unified Architecture)
```
Cron Trigger → AutomationEngine.executeAutomation() → Timeline Phases (1-5) → 
AutomationEngine.executeLiveSending() → Unified Test-Automation API (/api/automation/test/[id]?mode=live-send)
├── Script Execution & CSV Generation → ├── Cadence Filtering (/api/filter-audience) 
├── Variable Processing & Template Substitution → └── Firebase Cloud Messaging Delivery
```

### Audience Generation & CSV Mapping
```
Script Configuration → ScriptExecutor.executeScript() → Python Script Execution → 
CSV Generation (user_id snake_case) → Dynamic File Mapping → Unified Test-Automation API Processing
```

## 🔍 API Endpoints

### Core Automation Management
- `GET/POST /api/automation/recipes`: CRUD operations
- `PUT /api/automation/recipes/[id]`: Update and reschedule
- `DELETE /api/automation/recipes/[id]`: Remove automation

### Testing & Debug (Unified API)
- `GET /api/automation/test/[id]?mode=test-dry-run`: Validation only
- `GET /api/automation/test/[id]?mode=test-live-send`: Send to test audiences
- `GET /api/automation/test/[id]?mode=live-send`: Full production execution with cadence filtering
- `POST /api/automation/debug/reschedule`: Manual rescheduling

### Migration & Utilities
- `POST /api/automation/migrate`: Legacy push migration

## ⚠️ Known Issues & Risk Areas

### Duplicate Push Issue (**FIXED** ✅)
- **Previous Symptom**: Receiving 9 test pushes instead of 3 (3x3 multiplication)
- **Root Cause**: `sendTestPush()` called test API for each push (3 calls) × test API processes full sequence (3 pushes) = 9 total
- **Technical Fix Applied**:
  - Modified `AutomationEngine.executeTestSending()` to call test API only ONCE
  - Created new `sendTestPushSequence()` method for single API call
  - Deprecated old `sendTestPush()` method to prevent regression
  - Result: 1 API call × 3 pushes = 3 total test pushes ✅

### Live Push Failure Issue (**FIXED** ✅)
- **Root Cause**: `AutomationEngine.sendLivePush()` passed empty array instead of user IDs; parameter name mismatch with `/api/send-push`
- **Fix**: Added `loadUserIdsFromCsv()` method; fixed FormData parameter names (`pushTitle`→`title`, `pushBody`→`body`, `isDryRun`→`dryRun`, `csvFile`→`file`)
- **Result**: Live pushes now send to actual users from CSV files with correct API parameters ✅

### Status Field Configuration Issue (**FIXED** ✅)
- **Previous Symptom**: Test scheduled automations created but never executed, appearing in UI but not running
- **Root Cause**: Test automation UI created automations with `status: "scheduled"` but AutomationEngine only executes automations with `status: "active"`
- **Discovery Process**:
  - Test automation showed `"status": "scheduled"` and `"isActive": true`
  - Layer 3 automation showed `"status": "active"` and `"isActive": true` (worked correctly)
  - AutomationEngine.restoreActiveAutomations() filters: `status === 'active' && isActive === true`
- **Technical Analysis**:
  - TypeScript types define: `'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'`
  - Actual code uses: `'active'` and `'inactive'` (inconsistency found)
  - Test automation UI (line 239): hardcoded `status: 'scheduled'`
- **Resolution Strategy**: Identified that `"scheduled"` status serves no functional purpose vs. existing `isActive` boolean
- **Current Status**: Issue documented, fix deferred pending other priorities

### Push-Cadence-Service Error Handling (**FIXED** ✅)
- **Previous Symptom**: Layer 3 automations not applying 72-hour cooldown rules, silent failures in cadence filtering
- **Root Cause**: Cadence service crashed on invalid UUID input, causing "fail open" behavior (no filtering applied)
- **Investigation Findings**:
  - Database connection worked correctly (✅ 3 active cadence rules found)
  - Service failed on invalid UUIDs due to `ANY($1::uuid[])` PostgreSQL query constraint
  - Manual test with `"test-user-123"` → 500 error: `"An internal error occurred, failing open"`
  - Manual test with valid UUIDs → worked correctly
- **Technical Fix Applied**:
  - **UUID Validation**: Added `isValidUUID()` filter before database queries in `filterUsersByCadence()`
  - **Enhanced Logging**: Added comprehensive `[CADENCE]` console logging throughout filtering process
  - **Error Handling**: Improved error handling to gracefully exclude invalid UUIDs rather than crash
  - **Query Safety**: Updated all database queries to use `validUserIds` array instead of raw `userIds`
- **Logging Improvements**:
  - `[CADENCE] Starting cadence filtering for X users, layerId: Y`
  - `[CADENCE] Layer 3 cooldown: excluded X users`
  - `[CADENCE] Combined L2/L3 limit: excluded X users`
  - `[CADENCE] Filtering complete: X eligible, Y excluded`
- **Result**: 72-hour Layer 3 cooldown protection now functions correctly with visible logging ✅

### Unified Test-Automation API Cadence Enhancement (**FIXED** ✅)
- **Previous Symptom**: Cadence filtering happened silently with minimal logging, difficult to verify if rules were applied
- **Enhancement Applied**:
  - **Detailed Status Logging**: Enhanced `executeLiveSend()` with emoji-rich progress indicators
  - **Error Context**: Added specific error details for cadence service failures
  - **Success Confirmation**: Clear confirmation when cadence rules are successfully applied
- **New Logging Output**:
  - `🔍 Applying Layer 3 cadence filtering rules (72-hour cooldown protection)...`
  - `✅ Cadence filtering applied: X users excluded by 72h cooldown, Y users eligible for Layer 3`
  - `⚠️ Cadence service error (500): [details]. Failing open - proceeding with all users`
  - `ℹ️ Test audience (Layer 4) - bypassing cadence filtering (no cooldown rules apply)`
- **Console Logging**: Added parallel console logs with `[AUTOMATION]` prefix for server-side visibility
- **Result**: Cadence filtering status now clearly visible in both automation logs and server console ✅

### New User Waterfall Script Fixes (**FIXED** ✅)
- **Previous Symptom**: `generate_new_user_waterfall.py` failed immediately with `exit code 1`
- **Root Cause Analysis**:
  - **Import Errors**: Script imported `check_users_bio_completion` (wrong name) and missing `compare_and_remove`
  - **Python Path**: Incorrect `sys.path.append` prevented `basic_capabilities` module discovery
  - **Environment Setup**: `ScriptExecutor.ts` explicitly removed `PYTHONPATH` from environment
  - **CSV Format Mismatch**: Script generated `userID` (camelCase) but Node.js expected `user_id` (snake_case)
  - **Test User Data**: Test user ID had no device tokens, causing "No device tokens found" failures
- **Technical Fix Applied**:
  - **Import Corrections**: Fixed function name to `check_users_profile_completion`
  - **Missing Function**: Implemented `compare_and_remove` directly in script (was missing from shared module)
  - **Python Path Fix**: Corrected `sys.path.append` to go up 3 levels (`..`, `..`, `..`) to reach project root
  - **Environment Restoration**: Added `PYTHONPATH: projectRoot` back to `scriptEnv` in `ScriptExecutor.ts`
  - **CSV Format Standardization**: Changed all CSV generation to use `user_id` (snake_case)
  - **Variable Name Consistency**: Updated CSV column from `target_variantID` to `top_target_shoe_variantid`
  - **Test Data Fix**: Updated test user ID to `0e54067c-4c0e-4e4a-8a23-a47661578059` (known user with device tokens)
- **Layer 3 Script Parallel Fix**: Applied similar import fixes to `generate_layer_3_push_csvs.py`
  - Fixed `get_time_window_activity_data` → `get_daily_activity_data`
  - Updated function parameters to match new signature
- **Result**: Both waterfall and Layer 3 scripts now execute successfully with proper CSV generation ✅

### Inactive Automation Execution Bug (**CRITICAL FIX** ✅)
- **Previous Symptom**: Automations set to `"status": "inactive"` and `"isActive": false` continued executing scheduled pushes
- **User Impact**: User received test pushes despite setting automations to inactive, live sends continued running
- **Root Cause Analysis**:
  - **API Logic Gap**: Update endpoints only called `scheduleAutomation()` when automations became active
  - **Missing Unschedule**: No logic to stop/destroy cron jobs when automations became inactive
  - **Persistent Cron Jobs**: Old scheduled jobs remained active even after status changes
  - **Server Restart Required**: Only server restart would clear old cron jobs via `restoreActiveAutomations()`
- **Investigation Process**:
  - Confirmed automations had correct `"status": "inactive"`, `"isActive": false` in JSON files
  - Found actual scheduled execution logs despite inactive status
  - Traced API endpoints and discovered missing unschedule logic
  - Identified that `scheduleAutomation()` handles active state but no equivalent for inactive
- **Technical Fix Applied**:
  - **New AutomationEngine Method**: Added `unscheduleAutomation(automationId)` method
    - Finds and stops existing cron jobs via `cronJob.stop()` and `cronJob.destroy()`
    - Removes from `scheduledJobs` Map to prevent memory leaks
    - Returns success/failure status with descriptive messages
  - **API Endpoint Updates**: Modified both automation update endpoints:
    - `/api/automation/recipes/[id]/route.ts` (lines 98-102)
    - `/api/automation/recipes/route.ts` (lines 222-226)
    - Added `else if` clause to call `unscheduleAutomation()` when status becomes inactive
  - **Console Logging**: Added server-side logging to track unschedule operations
- **Implementation Details**:
  ```typescript
  // New AutomationEngine method
  async unscheduleAutomation(automationId: string): Promise<{ success: boolean; message: string }> {
    const jobInfo = this.scheduledJobs.get(automationId);
    if (!jobInfo) return { success: true, message: 'Automation was not scheduled' };
    
    jobInfo.cronJob.stop();
    jobInfo.cronJob.destroy();
    this.scheduledJobs.delete(automationId);
    
    return { success: true, message: 'Automation unscheduled successfully' };
  }
  
  // API endpoint logic
  if (updatedAutomation.status === 'active' || updatedAutomation.isActive) {
    await automationEngine.scheduleAutomation(updatedAutomation);
  } else if (updatedAutomation.status === 'inactive' || !updatedAutomation.isActive) {
    await automationEngine.unscheduleAutomation(updatedAutomation.id);
  }
  ```
- **Testing Verification**:
  - Manually triggered status updates for both automations via API
  - Confirmed cron jobs properly destroyed and removed from memory
  - Verified server restart respects inactive status (no restoration)
  - Confirmed no future scheduled executions for inactive automations
- **Result**: Inactive automations now properly unschedule and stop all execution ✅

### Multiple AutomationEngine Instance Bug (**CRITICAL FIX** ✅)
- **Previous Symptom**: User received 12 test pushes instead of 3 (correct set + 9 duplicates with different audience data)
- **Investigation Findings**: 42 concurrent automation executions at exactly 14:30:52 UTC with different execution IDs
- **Root Cause Analysis**:
  - **Singleton Architecture**: AutomationEngine is designed as singleton service managing ALL automations
  - **Development Hot Reload**: Next.js hot reload creates new AutomationEngine instances without destroying old cron jobs
  - **Zombie Cron Jobs**: Previous instances' cron jobs survive in memory even after new instances are created
  - **Multiple Server Starts**: Accidentally running `npm run dev` multiple times compounds the issue
- **Architecture Clarification**:
  ```
  CORRECT ARCHITECTURE:
  Server Instance
  └── AutomationEngine (singleton)
      ├── scheduledJobs Map
      │   ├── "layer-3-automation" → Single Cron Job
      │   └── "waterfall-automation" → Single Cron Job
      └── Each automation = 1 cron job = 1 complete timeline execution

  PROBLEM ARCHITECTURE (What Was Happening):
  Server Instance with Multiple AutomationEngine Instances
  ├── AutomationEngine Instance A → Cron Job A for Layer 3
  ├── AutomationEngine Instance B → Cron Job B for Layer 3  
  ├── AutomationEngine Instance C → Cron Job C for Layer 3
  └── ...42 instances = 42 cron jobs = 42 concurrent executions
  ```
- **Technical Fix Applied**:
  - **Instance Tracking**: Added unique instance IDs (`engine-timestamp-random`) to track AutomationEngine instances
  - **Process Exit Cleanup**: Comprehensive cleanup handlers for all exit scenarios:
    ```typescript
    private setupProcessCleanup(): void {
      const cleanup = () => {
        for (const [automationId, jobInfo] of this.scheduledJobs) {
          jobInfo.cronJob.stop();
          jobInfo.cronJob.destroy();
        }
        this.scheduledJobs.clear();
      };
      
      process.on('SIGTERM', cleanup);  // Graceful shutdown
      process.on('SIGINT', cleanup);   // Ctrl+C
      process.on('exit', cleanup);     // Process exit
      process.on('uncaughtException', cleanup); // Crash cleanup
    }
    ```
  - **Enhanced Logging**: All AutomationEngine logs now include instance IDs for tracking
    - `🚀 [engine-1755532947123-abc45] Automation scheduled successfully`
    - `📊 [engine-1755532947123-abc45] Total scheduled jobs: 1`
    - `🧹 [engine-1755532947123-abc45] Process cleanup: Destroying X cron jobs`
- **Prevention Mechanism**:
  - **Automatic Cleanup**: All cron jobs destroyed when server stops for any reason
  - **Memory Safety**: `scheduledJobs.clear()` prevents memory leaks
  - **Exception Resilience**: Cleanup works even during crashes or forced shutdowns
  - **Development Safety**: Handles Next.js hot reload scenarios
- **Result**: Multiple AutomationEngine instances can no longer create zombie cron jobs ✅

### PM2 Autorestart Configuration Issue (**CRITICAL FIX** ✅)
- **Previous Symptom**: Services would automatically restart immediately after being killed, making debugging impossible
- **User Impact**: Could not achieve clean server states; processes respawned faster than agents could manage them
- **Root Cause Analysis**:
  - **PM2 Configuration**: `ecosystem.config.js` had `autorestart: true` for both push-blaster and cadence-service
  - **Debugging Interference**: Every `kill -9` command was immediately countered by PM2's automatic restart
  - **Process Management Chaos**: PM2 restart attempts conflicted with manual server management protocols
- **Discovery Process**:
  - **Initial Confusion**: PM2 showed services as "stopped" but localhost ports remained accessible
  - **Port Investigation**: `lsof -i:3001,3002` revealed active processes despite PM2 status
  - **Process Archaeology**: Found 400+ restart cycles in PM2 logs indicating constant restart battles
- **Technical Fix Applied**:
  - **Configuration Update**: Modified `ecosystem.config.js` to set `autorestart: false` for both services
    ```javascript
    {
      name: 'push-blaster',
      autorestart: false,  // Changed from true
    },
    {
      name: 'push-cadence-service', 
      autorestart: false,  // Changed from true
    }
    ```
  - **Configuration Reload**: Applied changes with `npx pm2 reload ecosystem.config.js`
  - **Protocol Validation**: Verified that `npx pm2 stop all` now properly stops services without restart
- **Benefits Achieved**:
  - **Manual Control Restored**: Agents can now kill processes for debugging without immediate respawn
  - **Clean State Achievement**: Server management protocols can achieve "ports are free" states  
  - **Debugging Capability**: Can investigate issues without PM2 interference
  - **Validation Protocols**: Post-startup validation can verify singleton AutomationEngine instances
- **Result**: Manual server management protocols now function as designed; autorestart eliminated ✅

### Orphaned Process Discovery & Management (**CRITICAL OPERATIONAL KNOWLEDGE** ✅)
- **Discovery**: Found 23-hour-old `next-server` processes (PIDs 93591, 93592) running independently of PM2
- **Impact**: User was accessing fully functional servers that were completely unmanaged by PM2
- **Root Cause Analysis**:
  - **Original PM2 Spawn**: PM2 originally created these processes on Monday Aug 18, 15:32
  - **PM2 Daemon Death**: PM2 management process crashed/restarted at some point, losing track of child processes
  - **Process Orphaning**: Next.js servers continued running with PPID=1 (adopted by init)
  - **Port Conflict**: New PM2 attempts couldn't bind to ports occupied by orphaned processes
  - **Restart Chaos**: PM2's 400+ restart attempts were fighting with orphaned servers
- **Detection Methodology**:
  ```bash
  # Find processes listening on specific ports
  lsof -i:3001,3002
  
  # Get detailed process information
  ps -p <PID> -o pid,ppid,lstart,etime,command
  
  # Check for orphaned processes (PPID = 1)
  ps aux | awk '$3 == 1 && /next-server/'
  
  # Verify process working directory
  lsof -p <PID> | grep cwd
  ```
- **Resolution Process**:
  - **Identification**: Located orphaned processes using netstat and lsof
  - **Verification**: Confirmed 23+ hour runtime and PPID=1 status
  - **Safe Termination**: `kill -9 93591 93592` to end orphaned processes
  - **Clean Restart**: Started fresh PM2 management with corrected configuration
- **Prevention Measures**:
  - **Process Monitoring**: Regular checks for orphaned next-server processes
  - **PM2 Health Monitoring**: Verify PM2 daemon status and process tracking
  - **Startup Validation**: Always verify PM2 is actually managing running processes
- **Operational Knowledge**:
  - **Orphaned processes can run indefinitely** and function perfectly while unmanaged
  - **PM2 status may not reflect actual running processes** when daemon loses tracking
  - **Port conflicts arise when PM2 attempts to spawn new processes** on occupied ports
  - **Manual process archaeology required** when automatic management fails
- **Result**: Established protocols for detecting and resolving orphaned process scenarios ✅

### Nested Directory Structure Issue (**ARCHITECTURAL PROBLEM IDENTIFIED** 🚧)
- **Discovery**: Found problematic nested directory structure causing confusion
- **Structure Identified**:
  - **Parent Directory**: `/main-ai-apps/apps/push-blaster/` (active application)
  - **Nested Duplicate**: `/main-ai-apps/apps/push-blaster/apps/push-blaster/` (contains separate node_modules)
- **Impact Analysis**:
  - **Dependency Confusion**: Two separate node_modules installations with different versions
  - **Development Confusion**: Unclear which directory contains the "real" application
  - **Process Management Complexity**: Multiple potential execution contexts
- **Package.json Comparison**:
  - **Parent**: Complete push-blaster application with full dependencies
  - **Nested**: Contains separate package.json and extensive node_modules
- **Investigation Status**: 
  - **Root Cause**: Unknown - possibly from git operations or development tool confusion
  - **Current State**: Parent directory confirmed as active/working application
  - **Cleanup Required**: Nested directory structure needs safe removal
- **Next Steps Required**:
  - Compare nested vs parent node_modules contents
  - Check for code references to nested structure
  - Plan safe removal of duplicate nested directory
- **Risk Assessment**: Moderate - could cause dependency resolution issues if not properly cleaned up
- **Status**: Issue identified and documented; cleanup deferred pending further investigation 🚧

### Logging Visibility
- **Issue**: AutomationEngine logs go to Next.js console, not log files
- **Impact**: Difficult to track timeline execution in production
- **Log Files**: Only contain script performance data, not execution phases

### Recovery System Constraints
- **Design**: Simple restoration without complex state tracking
- **Trade-off**: No execution recovery if process crashes mid-timeline
- **Rationale**: Avoid race conditions from previous complex implementations

## 🔧 Configuration & Settings

### Critical Files
- `.automations/{id}.json`: Individual automation configurations
- `automationEngine.ts`: FIXED_LEAD_TIME = 30 (immutable)
- `ecosystem.config.js`: **PM2 process management configuration (CRITICAL)**
- Environment variables for script execution

### PM2 Configuration Management
**File**: `apps/push-blaster/ecosystem.config.js`

**Critical Settings**:
```javascript
module.exports = {
  apps: [
    {
      name: 'push-blaster',
      script: 'npm',
      args: 'run dev:push-only',
      cwd: __dirname,
      watch: false,
      autorestart: false,  // ⚠️ CRITICAL: Must be false for development
      env: { FORCE_COLOR: '1' }
    },
    {
      name: 'push-cadence-service',
      script: 'npm', 
      args: 'run dev',
      cwd: '../push-cadence-service',
      watch: false,
      autorestart: false,  // ⚠️ CRITICAL: Must be false for development
      env: { FORCE_COLOR: '1' }
    }
  ]
};
```

**Configuration Guidelines**:
- **Development**: `autorestart: false` (enables manual control for debugging)
- **Production**: `autorestart: true` (enables automatic recovery from crashes)
- **Watch Mode**: `watch: false` (prevents file-change restarts that conflict with hot reload)

**PM2 Management Commands**:
```bash
# Start services with configuration
npx pm2 start ecosystem.config.js

# Stop all services (stays stopped with autorestart: false)
npx pm2 stop all

# Reload configuration after changes
npx pm2 reload ecosystem.config.js

# View service status
npx pm2 list

# View service logs
npx pm2 logs
```

### Timing Configuration
- **Lead Time**: Configurable via `leadTimeMinutes` (default 30 minutes)
- **Timing Semantics**: `executionTime` = send time, automation starts at `executionTime - leadTimeMinutes`
- **Cancellation Window**: Default 25 minutes (configurable)
- **Test Window**: ~3 minutes between test send and cancellation deadline

### Safety Limits & Safeguards
- **Max Audience Size**: 10,000 users (configurable)
- **Layer 3 Cadence**: 72-hour cooldown period
- **Emergency Stop**: Available during cancellation window
- **Execution Frequency Limits**: Managed by SafeguardMonitor (`src/lib/safeguardMonitor.ts`)
- **Timeline Validation**: Handled by TimelineCalculator (`src/lib/timelineCalculator.ts`)
- **Resource Usage Monitoring**: Real-time tracking of system resources

### Performance Monitoring & Logging
- **Performance Metrics**: AutomationLogger (`src/lib/automationLogger.ts`) tracks script execution, audience generation, push delivery rates
- **Log Storage**:
  - Performance data: `.automations/logs/automation_YYYY-MM-DD.log`
  - Execution phases: Next.js server console (not files)
  - Error logs: Combined in server console

## 🛡️ Rescheduling & Update Flow

### CRITICAL: Rescheduling Dependencies
```
UI Schedule Update
├── PUT /api/automation/recipes/[id]
│   ├── automationStorage.saveAutomation() ✅
│   ├── automationEngine.scheduleAutomation() ✅ (FIXED)
│   │   ├── Cancel existing cron job
│   │   ├── Destroy old scheduled task
│   │   └── Create new cron job with updated time
│   └── Return success
└── Result: Single automation running at new time

PREVIOUS BUG (FIXED):
- UI updates saved JSON file but didn't reschedule cron jobs
- Old cron jobs continued running alongside new ones
- Led to duplicate automations at different times
```

### Update API Dependencies
```
ROUTES INVOLVED:
- PUT /api/automation/recipes/[id] (individual updates)
- PUT /api/automation/recipes (bulk updates)

BOTH ROUTES NOW CALL:
- automationEngine.scheduleAutomation() when automation becomes active
- Ensures proper cron job management and prevents duplicates
```

## 📦 File System Structure

### Automation Storage Layout
```
.automations/
├── {automation-id}.json (configuration files)
├── logs/
│   └── automation_YYYY-MM-DD.log (performance metrics only)
├── csvs/
│   └── audience files generated by scripts
└── temp/
    └── temporary execution files
```

### Configuration File Format
```json
{
  "id": "uuid",
  "name": "automation name",
  "status": "active" | "paused" | "completed",
  "isActive": boolean,
  "schedule": {
    "executionTime": "HH:MM", // SEND TIME from UI (when pushes go out)
    "timezone": "America/Chicago",
    "leadTimeMinutes": 30 // Automation start offset (executionTime - leadTimeMinutes)
  },
  "pushSequence": [...], // Array of push configurations
  "audienceCriteria": {...}, // Audience generation rules
  "settings": {...} // Test mode, cancellation windows, etc.
}
```

## 🔧 Environment & External Dependencies

### Required Services
- **Next.js Dev Server** (port 3001): Main application
- **Push-Cadence-Service** (port 3002): Cadence filtering
- **PostgreSQL Database**: User data and notification history
- **Firebase Cloud Messaging**: Push notification delivery
- **Python Environment**: Script execution for audience generation

### Environment Variables
- Database connection strings
- Firebase service account keys
- API endpoint configurations
- Script execution paths

## 🚀 Development Environment Management & Standards

### Development vs Production Modes

**Development Mode (`npm run dev`)**:
- **Purpose**: Local development with hot reload
- **Characteristics**: 
  - File changes trigger automatic recompilation
  - Module hot reloading can create new singleton instances
  - Process.env.NODE_ENV = 'development'
  - More verbose logging and error reporting
- **AutomationEngine Impact**: Process cleanup prevents zombie cron jobs during hot reload
- **Ports**: 3001 (push-blaster), 3002 (cadence-service)

**Production Mode (`npm run build` + `npm start`)**:
- **Purpose**: Optimized builds for deployment
- **Characteristics**:
  - No hot reload, stable singleton instances
  - Process.env.NODE_ENV = 'production'
  - Optimized bundles, minimal logging
- **AutomationEngine Impact**: Stable singleton, no instance multiplication issues
- **Deployment**: Vercel, Docker, or traditional hosting

### 🛡️ Server Management Standards & Safety Protocols

**CRITICAL RULES for Agents:**

#### 1. **Server Startup Protocol**
```bash
# ✅ CORRECT: Always check ports first
lsof -i:3001,3002 || echo "Ports are free"

# ✅ CORRECT: Kill existing processes before starting
lsof -ti:3001,3002 | xargs kill -9 2>/dev/null

# ✅ CORRECT: Start with clean slate
cd /path/to/apps/push-blaster && npm run dev
```

#### 2. **Forbidden Actions**
```bash
# ❌ NEVER: Run multiple dev servers simultaneously
npm run dev &
npm run dev &  # This creates duplicate AutomationEngine instances

# ❌ NEVER: Force kill without cleanup
kill -9 $(ps aux | grep next | awk '{print $2}')  # Bypasses process cleanup

# ❌ NEVER: Start server while ports in use without investigation
npm run dev  # When ports 3001/3002 already occupied
```

#### 3. **Safe Restart Protocol**
```bash
# ✅ Step 1: Graceful shutdown (triggers AutomationEngine cleanup)
kill -SIGTERM $(lsof -ti:3001,3002) 2>/dev/null

# ✅ Step 2: Wait for cleanup
sleep 3

# ✅ Step 3: Verify ports cleared
lsof -i:3001,3002 || echo "Ports cleared successfully"

# ✅ Step 4: Start fresh
npm run dev
```

#### 4. **Development Best Practices**

**When to Restart Server:**
- ✅ **Configuration changes**: Environment variables, package.json dependencies
- ✅ **Major code structure changes**: New API routes, middleware changes
- ✅ **Database connection issues**: Connection string updates
- ✅ **AutomationEngine issues**: When debugging cron job problems

**When NOT to Restart:**
- ❌ **Minor code changes**: Component updates, styling changes (hot reload handles this)
- ❌ **Multiple times per session**: Let hot reload work
- ❌ **Debugging automation logic**: Use API calls and logging instead

#### 5. **AutomationEngine Safety Checks**

**Before Any Server Operation:**
```bash
# Check current automation status
curl -s "http://localhost:3001/api/automation/recipes" | jq '.data[] | "\(.name): \(.status)/\(.isActive)"'

# Expected output for safety:
# Daily Layer 3 Pushes: inactive/false
# Daily Generate New User Waterfall: inactive/false
```

**After Server Restart:**
```bash
# Verify AutomationEngine instance logs
grep -E "Instance ID|Process cleanup|Total scheduled jobs" server_logs

# Expected patterns:
# 🚀 Automation Engine initialized - Instance ID: engine-xxx
# 📊 [engine-xxx] Total scheduled jobs: 0  (should be 0 for inactive automations)
```

#### 6. **Emergency Protocols**

**If Duplicate Pushes Detected:**
1. **Immediate**: Set all automations to inactive
2. **Kill all servers**: `lsof -ti:3001,3002 | xargs kill -9`
3. **Wait**: Allow process cleanup to complete
4. **Verify**: Check no automation processes remain
5. **Restart**: Use safe restart protocol
6. **Validate**: Confirm single AutomationEngine instance with instance ID logging

**If Server Won't Start (Port Conflicts):**
1. **Investigate**: `lsof -i:3001,3002` to see what's using ports
2. **Check for Orphaned Processes**: `ps -p <PID> -o pid,ppid,lstart,etime,command`
3. **Verify PM2 Management**: `npx pm2 list` vs actual running processes
4. **Force kill**: `lsof -ti:3001,3002 | xargs kill -9` (only if necessary)
5. **Wait**: `sleep 5` for cleanup
6. **Retry**: Attempt clean start

**If Orphaned Processes Detected:**
1. **Identify Orphans**: Look for `PPID = 1` and long runtime (hours/days)
2. **Verify Independence**: Confirm processes are not managed by PM2
3. **Safe Termination**: `kill -9 <orphaned-PIDs>`
4. **Clean PM2 Start**: `npx pm2 start ecosystem.config.js`
5. **Validate**: Ensure PM2 is managing the new processes

**If PM2 Shows Stopped but Ports Are Active:**
1. **Process Archaeology**: `lsof -i:3001,3002` to find actual PIDs
2. **Runtime Investigation**: `ps -p <PID> -o lstart,etime` to check age
3. **Parent Process Check**: `ps -p <PID> -o ppid` (PPID=1 indicates orphan)
4. **Working Directory**: `lsof -p <PID> | grep cwd` to confirm location
5. **Orphan Cleanup**: Kill orphaned processes and restart PM2 management

### 🔍 Monitoring & Validation

**Health Check Commands:**
```bash
# Server health
curl -s http://localhost:3001/api/health | jq '.success'

# Automation status
curl -s http://localhost:3001/api/automation/recipes | jq '.data[] | {name, status, isActive}'

# AutomationEngine instance tracking (check server logs)
grep "Instance ID" server_logs | tail -1
```

**Log Monitoring:**
- **AutomationEngine logs**: Server console output
- **Automation execution logs**: `.automations/logs/automation_YYYY-MM-DD.log`
- **Process cleanup logs**: Look for `🧹 Process cleanup` messages during restarts

### Python Script Dependencies
- **generate_layer_3_push_csvs.py**: Layer 3 audience generation (offer creators, closet adders, wishlist adders)
- **generate_new_user_waterfall.py**: New user waterfall generation (5 distinct user levels)
- **basic_capabilities module**: Shared database query functions and utilities
- **PYTHONPATH configuration**: Critical for module imports (added to ScriptExecutor environment)
- **CSV output validation**: Ensures proper snake_case column naming (`user_id` not `userID`)
- **Device token validation**: Test users must have valid device tokens for successful execution

---

---

## 📋 v5 Update Summary (August 2025)

**Critical Operational Discoveries & Fixes in this Release**:
- ✅ **PM2 Autorestart Configuration**: CRITICAL - Fixed `autorestart: true` causing immediate process respawn during debugging
- ✅ **Orphaned Process Management**: CRITICAL - Established protocols for detecting and managing orphaned next-server processes
- ✅ **Process Archaeology Methods**: Comprehensive diagnostic procedures for investigating server state confusion
- ✅ **Enhanced Emergency Protocols**: Advanced troubleshooting procedures for port conflicts and process management issues
- ✅ **PM2 Configuration Documentation**: Complete ecosystem.config.js documentation with development vs production guidelines

**Previous v4 Achievements Maintained**:
- ✅ **Push-Cadence-Service Robustness**: Fixed UUID validation crashes, added comprehensive logging
- ✅ **Unified Code Path Architecture**: Consolidated test/live send pipelines for consistency
- ✅ **Enhanced Cadence Visibility**: Clear logging shows 72-hour cooldown rule application
- ✅ **Layer 0 Support**: Full backend and frontend support for new user waterfall notifications
- ✅ **Python Script Reliability**: Fixed import paths, environment setup, and CSV format consistency
- ✅ **Status Field Clarification**: Documented "scheduled" vs "active" status inconsistency
- ✅ **Inactive Automation Fix**: CRITICAL - Fixed bug where inactive automations continued executing
- ✅ **Multiple Instance Prevention**: CRITICAL - Fixed 42 concurrent automation executions from zombie cron jobs
- ✅ **Development Environment Standards**: Established safe server management protocols for agents
- ✅ **Process Cleanup System**: Automatic cron job cleanup on server shutdown prevents zombie processes
- ✅ **Instance Tracking**: Unique AutomationEngine instance IDs for debugging and monitoring
- ✅ **Comprehensive Error Handling**: Improved fail-safe behavior across all components

**Outstanding Issues Identified**:
- 🚧 **Nested Directory Structure**: `/apps/push-blaster/apps/push-blaster/` cleanup required
- 🚧 **Status Field Inconsistency**: "scheduled" vs "active" status standardization deferred

**System Reliability**: The automation system now provides robust server management with manual control capabilities, comprehensive orphaned process detection and resolution, complete PM2 configuration management, advanced diagnostic procedures for complex server state issues, and maintains all previous automation reliability improvements including 72-hour cadence protection, unified execution pipelines, and singleton AutomationEngine architecture.

---

*This v5 documentation provides complete architectural understanding with dependency mapping, all identified bug fixes, operational procedures for complex server management scenarios, and system interaction flows for safe development and debugging.*

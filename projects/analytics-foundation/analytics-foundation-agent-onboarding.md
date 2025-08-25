# Analytics Foundation Agent Onboarding

Welcome to the Analytics Foundation project! 🚀

## Your Mission

You're part of the team building the foundational architecture for Tradeblock's analytics dashboard system. This project is strategically important as we transform into an AI-first company that makes data-driven decisions at every level.

Your specific role depends on your expertise, but we're all working toward the same goal: **creating a working analytics dashboard on localhost:3003 that displays new user acquisition trends with interactive date range filtering.**

## What We're Building

### The Big Picture
This is **Phase 1** of a larger analytics platform that will eventually provide comprehensive insights into user behavior, trading patterns, and business metrics. We're starting with the foundation - proving our technical architecture and delivering our first working visualization.

### Immediate Deliverable
A standalone Next.js dashboard showing:
- **Bar chart of new users by day** (data from March 5, 2025 onwards)
- **Interactive date range toggle** (last 7/14/30/60/90 days)
- **Professional UI** with Tailwind CSS styling
- **Real-time data** from our PostgreSQL database

### Technical Foundation
- **Framework**: Next.js 15.x with App Router and TypeScript 5.x
- **Visualization**: D3.js 7.x integrated with React components
- **Styling**: Tailwind CSS with blue/slate design system
- **Port**: 3003 (avoiding conflicts with push-blaster on 3001/3002)
- **Operation**: Completely standalone, no dependencies on existing systems

## Your Project Context

### Why This Matters to Tradeblock
As we evolve into an AI-first company, analytics capabilities are essential for:
- Understanding new user onboarding effectiveness
- Identifying patterns that inform AI automation strategies  
- Making data-driven product decisions
- Providing visibility into key business metrics

### Why This Matters to You
This project establishes patterns and architecture that will be reused across many future analytics features. The code you write and the patterns you establish here will become the foundation for Tradeblock's entire analytics ecosystem.

## Key Files to Review

**Essential Reading:**
1. `@analytics-foundation-project-brief.md` - Strategic context and success criteria
2. `@analytics-dashboard-project-specs.md` - Technical specifications and patterns
3. `@query-building-blocks.md` - Database query patterns and optimizations

**Reference Materials:**
- `@generate_new_user_waterfall.py` - Existing patterns for user activity analysis
- Technical standards and deployment protocols as referenced in execution checklist

## Your Squad

**@squad-agent-database-master** 🗃️
- Primary responsibility: Create optimized new user fact table generation script
- Focus: Database performance, query optimization, data quality
- Leverage: Existing query building blocks and user analysis patterns

**@project-agent-dev-hub-dev** 💻  
- Primary responsibility: Next.js application development and D3.js integration
- Focus: Clean code, responsive UI, smooth data visualization
- Deliverable: Working dashboard on localhost:3003

**@squad-agent-architect** 🏗️
- Primary responsibility: System architecture review and performance guidance
- Focus: Scalability, optimization, technical standards
- Role: Advisory and quality assurance throughout development

## Critical Success Factors

### Database Performance
The new user fact table creation will be a significant database operation. We must:
- Use efficient query patterns and batching strategies
- Monitor database performance throughout development
- Implement proper indexing and optimization
- Avoid overwhelming our production database

### Code Quality
This foundation will be extended many times. We must:
- Use TypeScript strict mode throughout
- Implement proper error handling and loading states
- Follow established component patterns
- Create reusable, extensible code architecture

### User Experience
Our analytics dashboard must be professional and intuitive:
- Smooth chart animations and interactions
- Responsive design that works on all screen sizes
- Clear loading states and error messaging
- Professional styling following our design system

## Getting Started

1. **Read the project brief** to understand the strategic context
2. **Review the execution checklist** to see your specific phase assignments  
3. **Study the technical specifications** to understand our architecture patterns
4. **Begin executing** against the phase you're assigned in the checklist

Remember: we're building the foundation for something much larger. The patterns and decisions we make here will impact every future analytics feature we build.

**Now begin executing against the execution checklist.** Let's build something amazing! 🎯

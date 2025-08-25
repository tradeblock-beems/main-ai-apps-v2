Push Notification Automation System — Documentation Outline

I. Overview and Purpose
	•	Objective: Explain the system in a way an LLM (or human engineer) can understand both the technical architecture and the user experience.
	•	Evolution:
        •	Started as a one-time push notification sender with a UI for generating CSVs.
        •	Grew into a scheduling and automation engine with safeguards (cadence rules). THIS is the most important functionality now

⸻

II. Core Components

A. Audience Generation & CSV Creation
	•	Front-end Interface: Lets you run parameterized queries (e.g., users active in last 30/90 days).
	•	Output: CSV file containing relevant user data per notification campaign.
	•	Workflow: Upload CSV → Draft notification → Send.

B. Notification Drafting and Sending
	•	UI for composing push copy.
	•	Draft linked with uploaded CSV.
	•	System formats and dispatches notifications to recipients using firebase messaging
        - This includes a process that... 1) queries for each user's device token based on their userID; 2) breaks the pushes up into batches with shared content; and then 3) sends them out sequentially, with some limiting elements in there to ensure we don't trigger timeouts from Firebase because of too many parallel requests

C. Logging and Push Layer Classification
	•	Each push is logged in a neon.tech db that maintains records of all pushes
    •	Each push is assigned a unique "Push Layer" number that groups the notifications by type and are the crucial piece of applying cadence rules (see next section).

⸻

III. Cadence Service
	•	Purpose: Prevents spammy frequency.
	•	Logic: If a user received the same type of notification (ie. the same "Push Layer") within the last X hours (e.g., 72), they’re excluded from the send.
	•	Benefit: Protects user experience and compliance with engagement best practices.
    •	This process should be attached to the end of EVERY send method, whether immediate one-off send or scheduled automation
    •	The cadence rules live in a table in the neon.tech db as well

⸻

IV. Automation Engine
	•	Core Idea: JSON-based configuration controls automation — see /Users/AstroLab/Desktop/code-projects/main-ai-apps/apps/push-blaster/.automations/d3343732-48d8-4ef8-a688-51caba1c7438.json for an example
    •	How it's supposed to work
        - Set up the automation (enshrined in the json file), including a scheduled "executionTime"
        - At "leadTimeMinutes" before the "executionTime" the automation begins
        - The first thing it does is run the custom script to generate audience CSVs
        - Then it fires off REAL pushes to the TEST audiences created by the script (which contain just one recipient: me)
        - Then the system simply waits for the "executionTime" to arrive. I (the user) have up until that "executionTime" to cancel the automation if I want. Otherwise...
        - At "executionTime" the audience script is run again
	•	Configuration example:
        "id": "d3343732-48d8-4ef8-a688-51caba1c7438",
        "name": "Daily Generate New User Waterfall",
        "description": "Script-based automation using Generate New User Waterfall",
        "type": "script_based",
        "status": "active",
        "isActive": true,
        "schedule": {
            "timezone": "America/Chicago",
            "frequency": "daily",
            "startDate": "2025-08-16",
            "executionTime": "23:30",
            "leadTimeMinutes": 30
  },
  "template": {
    "name": "Script-Based Automation",
    "category": "custom",
    "isSystemTemplate": false,
    "config": {}
  },
  "pushSequence": [this is where the actual push notification content goes]

  "audienceCriteria": [details on the audience — including the ability to just use a "custom script" for csv generation]

  "settings": {
    "testUserIds": [],
    "emergencyStopEnabled": true,
    "dryRunFirst": true,
    "cancellationWindowMinutes": 30,
    "safeguards": {
      "maxAudienceSize": 10000,
      "requireTestFirst": true,
      "emergencyContacts": [],
      "alertThresholds": {
        "audienceSize": 5000,
        "failureRate": 0.1
      }
    }
  },
  "metadata": {
    "createdBy": "api",
    "totalExecutions": 0,
    "successfulExecutions": 0,
    "failedExecutions": 0
  },
  "createdAt": "2025-08-16T06:03:04.083Z",
  "updatedAt": "2025-08-21T01:24:46.769Z"
}

⸻

V. Testing Components
	•	Dry Run: Simulates everything EXCEPT the actual live send, including fetching device tokens from Firebase.
	•	Automation Testing page — has 4 modes:
        - TEST Audience Dry Run
        - TEST Audience Live Send
        - REAL Audience Dry Run
        - Test Scheduled Send (REAL send of the test pushes at the beginning of an automation process, but only a DRY RUN of the live audience sending process)

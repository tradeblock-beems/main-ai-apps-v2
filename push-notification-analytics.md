# Project Summary: Measuring Activity Lift from Push Notifications

## Objective

Quantify the impact (“lift”) of push notifications on user activity by comparing each recipient’s per-24-hour activity in the 48 hours after a push notification to their average per-24-hour activity in the 30 days prior. The analysis will be conducted for several key metrics (sessions, add to closet/wishlist, offer creation, offer accepted/confirmed), and results will be aggregated at the individual push notification level.

---

## Data Sources

1. **Push Notification Records (Neon Tech Database)**
    - Contains: user ID of recipient, timestamp of send, message content, and metadata.
    - Each row represents a single push notification sent to a user.

2. **User Activity Data (PostHog)**
    - Contains: raw event data for all tracked user activities.
    - Key metrics: sessions, add to closet/wishlist, offer creation, offer accepted/confirmed.

---

## High-Level Steps

### 1. Extract Push Notification Records

- Connect to the Neon Tech database.
- Fetch all push notification records within the analysis period, ignoring any that have a "Layer 4" classification (those are test sends)
- For each record, extract:
    - User ID (as used in PostHog or mapped to PostHog’s identifier)
    - Timestamp of notification send
    - Any relevant metadata (e.g., notification type, content)

### 2. Group and Aggregate Push Notifications

- Group notifications as needed (e.g., by shared campaign / content + time of send).
- For each push notification (or group, if aggregating):
    - Maintain a list of all recipient user IDs and the timestamp of send.

### 3. Map User IDs to PostHog Identifiers

- Ensure each user ID from the push records can be mapped to a PostHog `distinct_id` or `person_id`.
- Prepare mapping logic or lookup table as needed.

### 4. Define Analysis Windows

- For each push notification and recipient:
    - **Baseline window:** 30 days prior to the notification timestamp.
    - **Post-push window:** 48 hours after the notification timestamp.

### 5. Query PostHog for User Activity

- For each batch of users and each relevant time window:
    - Query PostHog’s API for the key metrics/events, filtering by:
        - User identifier(s)
        - Event type(s)
        - Time window (baseline and post-push)
    - Batch requests to optimize for API rate limits and efficiency.
    - Retrieve all relevant event data for each user in both windows.

### 6. Process and Aggregate Activity Data

- For each user and push notification:
    - Calculate the total count of each key metric in the baseline window.
    - Calculate the total count of each key metric in the post-push window.
    - Compute the average per-24-hour activity for each metric in both windows:
        - Baseline: total in 30 days / 30
        - Post-push: total in 48 hours / 2
    - Calculate the raw lift: (post-push average) – (baseline average)
    - Calculate the percent lift: (raw lift) / (baseline average) × 100%

### 7. Aggregate Results at Push Notification Level

- For each push notification (or group):
    - Aggregate the individual user lifts to produce overall metrics:
        - Mean and median raw lift for each metric
        - Mean and median percent lift for each metric
        - Distribution (optional: standard deviation, percentiles, etc.)

### 8. Output and Reporting

- For each push notification, generate both:
	•	A Markdown summary with readable insights for internal stakeholders
	•	A JSON file with structured data for downstream usage
	•	Each file includes:
        •	Number of recipients analyzed / in that push notification's set of recipients
        •	Date and time of send (if these will be slightly different, so base it off of the time of the last send in the set)
        •	Baseline and post-push averages per metric
        •	Raw and percent lift (mean and median)
        •	Optional: segmentation or campaign metadata

- Each file (both json and markdown summary) should include:
    - Number of recipients analyzed
    - For each key metric:
        - Baseline average per user
        - Post-push average per user
        - Mean and median raw lift
        - Mean and median percent lift
    - Any additional breakdowns (e.g., by notification type, user segment)


---

## Additional Considerations

- **Data Quality:** Handle missing or unmapped user IDs, and ensure event data completeness.
- **Efficiency:** Batch API requests and parallelize where possible to handle large data volumes.
- **Reproducibility:** Log all queries and transformations for auditability.
- **Scalability:** Design the process to handle new push notification campaigns or larger user sets in the future.

---

**End Result:**  
A dataset and report that, for each push notification (or group), shows the raw and percent-based lift in each key user activity metric, enabling you to quantify and compare the effectiveness of different push notification strategies.
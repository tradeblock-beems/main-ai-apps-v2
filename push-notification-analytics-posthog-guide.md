# PostHog Data Extraction Guide for Push Notification Activity Lift Analysis

This guide explains how to fetch user activity data from PostHog for the purpose of measuring the lift in activity after sending push notifications. It covers the API structure, batching strategy, and practical considerations for large-scale data extraction.

---

## Overview

For each push notification sent to a user, you need to:
- Identify the user(s) who received the notification and the timestamp of the send.
- Query PostHog for specific event data (sessions, add to closet/wishlist, offer creation, offer accepted/confirmed) for those users, within two time windows:
  - **Baseline:** 30 days before the push notification
  - **Post-push:** 48 hours after the push notification

You will use the PostHog Events API to retrieve this data in batches.

---

## Step-by-Step Instructions

### 1. Prepare Inputs

- **User Identifiers:**  
  Collect the list of user IDs (as used in PostHog, typically `distinct_id`) for each push notification recipient.
- **Timestamps:**  
  For each push, note the exact send time. You will use this to define your baseline and post-push windows.

### 2. Define Time Windows

For each user and push notification:
- **Baseline window:**  
  - Start: 30 days before the push timestamp  
  - End: moment the push was sent
- **Post-push window:**  
  - Start: moment the push was sent  
  - End: 48 hours after the push was sent

All times must be in ISO 8601 format (e.g., `2025-08-01T00:00:00Z`).

### 3. Batch User Requests

- PostHog’s API allows filtering by multiple `distinct_id` values in a single request.
- Batch users (e.g., 100–1,000 per request) to avoid rate limits and improve efficiency.

### 4. Construct the API Request

#### **Endpoint**
GET https://us.posthog.com/api/projects/{PROJECT_ID}/events/

#### **Query Parameters**

- `event`: Name of the event (e.g., `Offer Created`)
- `distinct_id`: Add this parameter for each user in your batch
- `after`: Start of the time window (ISO 8601)
- `before`: End of the time window (ISO 8601)
- `limit`: Maximum number of events per page (default 100, max 1000)

#### **Example Request**

```http
GET https://us.posthog.com/api/projects/{PROJECT_ID}/events/
    ?event={EVENT_NAME}
    &distinct_id={USER_ID_1}
    &distinct_id={USER_ID_2}
    &distinct_id={USER_ID_3}
    ...
    &after={START_DATETIME_ISO}
    &before={END_DATETIME_ISO}
    &limit=1000

Replace:
- {PROJECT_ID}: Your PostHog project ID
- {EVENT_NAME}: The event you want to analyze (e.g., Offer Created)
- {USER_ID_1}, {USER_ID_2}, ...: User IDs for this batch
- {START_DATETIME_ISO}: Start of your time window
- {END_DATETIME_ISO}: End of your time window

Example for “Offer Created” events
GET https://us.posthog.com/api/projects/1234/events/
    ?event=Offer%20Created
    &distinct_id=user_abc
    &distinct_id=user_xyz
    &distinct_id=user_123
    &after=2025-08-01T00:00:00Z
    &before=2025-08-31T23:59:59Z
    &limit=1000

### 5. Authentication

Add your API key as an HTTP header:
    Authorization: Bearer {YOUR_API_KEY}

### 6. Pagination

- If the response contains more than 1,000 events, use the `next` URL provided in the API response to fetch subsequent pages.
- Continue fetching until all events are retrieved for the batch and time window.

### 7. Handling User IDs as Properties

- If your user ID is stored as a property (e.g., `user_id`), use the `properties` parameter instead:
    ```http
    &properties={"user_id": ["user_abc", "user_xyz", "user_123"]}
    ```
    *(Remember to URL-encode the JSON.)*

---

## Practical Guidance

- **Batching:** Always batch user IDs to minimize the number of API calls and avoid rate limits.
- **Multiple Events:** Repeat the process for each event type you want to analyze.
- **Multiple Windows:** For each user and push, run two queries (baseline and post-push).
- **Error Handling:** Implement retry logic for failed requests and respect API rate limits.
- **Data Processing:** After fetching, aggregate the data offline to calculate per-user and per-push metrics (raw and percent lift).

---

## Example Workflow

1. For each push notification, collect the recipient user IDs and send timestamp.
2. For each user:
    - Calculate baseline and post-push time windows.
3. For each event type:
    - Batch user IDs and query the PostHog API for each time window.
    - Handle pagination as needed.
4. Aggregate and analyze the results to compute lift metrics.

---

## End Result

You will have, for each push notification (or group), the raw and percent-based lift in each key user activity metric, enabling you to measure and compare the effectiveness of your push notification strategies.

---

**If you need code samples for making these requests in Python or another language, or want help with batching and pagination logic, let me know.**
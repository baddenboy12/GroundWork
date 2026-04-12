/**
 * Centralized configuration constants for GroundWork application.
 * Single source of truth for all magic numbers and tunable values.
 */

export const CONFIG = {
  // Authentication & PWA
  AUTH_CALLBACK_TIMEOUT_MS: 3000,
  PWA_HISTORY_BUFFER_SIZE: 5,

  // Search & Filtering
  SEARCH_DEBOUNCE_MS: 300,
  LOG_LIMIT_DEFAULT: 24,
  LOG_LIMIT_SEARCH: 100,
  FUZZY_MATCH_THRESHOLD: 0.62,

  // Offline Queue & Sync
  OFFLINE_QUEUE_KEY: "groundwork_offline_queue_v1",
  OFFLINE_QUEUE_EVENT: "groundwork_queue_changed",

  // Photo Management
  PHOTO_COMPRESSION_QUALITY: 0.8,
  PHOTO_MAX_WIDTH: 1920,
  PHOTO_MAX_HEIGHT: 1920,

  // Error Handling
  TOAST_DURATION_MS: 4000,
} as const;

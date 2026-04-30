/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _lib_env from "../_lib/env.js";
import type * as _lib_tiers from "../_lib/tiers.js";
import type * as _lib_trial from "../_lib/trial.js";
import type * as _lib_validators from "../_lib/validators.js";
import type * as clientErrors from "../clientErrors.js";
import type * as crons from "../crons.js";
import type * as emails_queries from "../emails/queries.js";
import type * as emails_teamNotifications from "../emails/teamNotifications.js";
import type * as http from "../http.js";
import type * as integrations_apiKeys from "../integrations/apiKeys.js";
import type * as integrations_apiKeysActions from "../integrations/apiKeysActions.js";
import type * as integrations_webhookActions from "../integrations/webhookActions.js";
import type * as integrations_webhooks from "../integrations/webhooks.js";
import type * as licenseKeys from "../licenseKeys.js";
import type * as logs from "../logs.js";
import type * as pushTokens from "../pushTokens.js";
import type * as r2_storageActions from "../r2/storageActions.js";
import type * as rateLimit from "../rateLimit.js";
import type * as siteDeleteVotes from "../siteDeleteVotes.js";
import type * as sites from "../sites.js";
import type * as storage from "../storage.js";
import type * as stripe_actions from "../stripe/actions.js";
import type * as stripe_events from "../stripe/events.js";
import type * as stripe_prices from "../stripe/prices.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_lib/env": typeof _lib_env;
  "_lib/tiers": typeof _lib_tiers;
  "_lib/trial": typeof _lib_trial;
  "_lib/validators": typeof _lib_validators;
  clientErrors: typeof clientErrors;
  crons: typeof crons;
  "emails/queries": typeof emails_queries;
  "emails/teamNotifications": typeof emails_teamNotifications;
  http: typeof http;
  "integrations/apiKeys": typeof integrations_apiKeys;
  "integrations/apiKeysActions": typeof integrations_apiKeysActions;
  "integrations/webhookActions": typeof integrations_webhookActions;
  "integrations/webhooks": typeof integrations_webhooks;
  licenseKeys: typeof licenseKeys;
  logs: typeof logs;
  pushTokens: typeof pushTokens;
  "r2/storageActions": typeof r2_storageActions;
  rateLimit: typeof rateLimit;
  siteDeleteVotes: typeof siteDeleteVotes;
  sites: typeof sites;
  storage: typeof storage;
  "stripe/actions": typeof stripe_actions;
  "stripe/events": typeof stripe_events;
  "stripe/prices": typeof stripe_prices;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

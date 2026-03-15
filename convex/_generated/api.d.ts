/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as http from "../http.js";
import type * as integrations_apiKeys from "../integrations/apiKeys.js";
import type * as integrations_apiKeysActions from "../integrations/apiKeysActions.js";
import type * as integrations_webhookActions from "../integrations/webhookActions.js";
import type * as integrations_webhooks from "../integrations/webhooks.js";
import type * as logs from "../logs.js";
import type * as sites from "../sites.js";
import type * as storage from "../storage.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  http: typeof http;
  "integrations/apiKeys": typeof integrations_apiKeys;
  "integrations/apiKeysActions": typeof integrations_apiKeysActions;
  "integrations/webhookActions": typeof integrations_webhookActions;
  "integrations/webhooks": typeof integrations_webhooks;
  logs: typeof logs;
  sites: typeof sites;
  storage: typeof storage;
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

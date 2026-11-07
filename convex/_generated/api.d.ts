/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as callSummarize from "../callSummarize.js";
import type * as calls from "../calls.js";
import type * as chat from "../chat.js";
import type * as documents from "../documents.js";
import type * as documentsExtract from "../documentsExtract.js";
import type * as http from "../http.js";
import type * as notify from "../notify.js";
import type * as packet from "../packet.js";
import type * as partners from "../partners.js";
import type * as places from "../places.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  callSummarize: typeof callSummarize;
  calls: typeof calls;
  chat: typeof chat;
  documents: typeof documents;
  documentsExtract: typeof documentsExtract;
  http: typeof http;
  notify: typeof notify;
  packet: typeof packet;
  partners: typeof partners;
  places: typeof places;
  seed: typeof seed;
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

/**
 * Push notification payload contract — Phase 7.
 *
 * The backend sends FCM/APNs data-only messages with these well-known
 * categories. The mobile app decides foreground vs background UX and
 * which deep-link route to navigate to on tap.
 *
 * Wire shape (FCM data field; APNs `aps.alert` + custom data):
 *   {
 *     "category": "route_changed" | "dispatch_message" | "sos_acknowledged" | "system",
 *     "title":     "...",     // human-readable title, shown in banner/notification
 *     "body":      "...",     // human-readable body
 *     "route":     "...",     // optional Angular route path (overrides default)
 *     "actionId":  "...",     // optional client-side action id (e.g. for tap analytics)
 *     ...category-specific fields
 *   }
 *
 * Categories:
 *
 * 'route_changed'
 *   Dispatch has reassigned the agent to a different route or added/
 *   removed stops on the current route. The mobile app should refresh
 *   the route data. Default deep link: /map.
 *
 * 'dispatch_message'
 *   Free-text message from dispatch (e.g. "Avoid 3rd Mainland Bridge —
 *   protests reported"). Default deep link: /dashboard.
 *
 * 'sos_acknowledged'
 *   Confirmation that an SOS incident has been received by dispatch.
 *   Closes the loop on the agent's end. Default deep link: /dashboard.
 *
 * 'system'
 *   App-level notifications (forced logout, app update available,
 *   maintenance window). Default deep link: /dashboard.
 */
export type PushCategory =
  | 'route_changed'
  | 'dispatch_message'
  | 'sos_acknowledged'
  | 'system';

export interface PushPayloadBase {
  category: PushCategory;
  title: string;
  body: string;
  /** Optional explicit deep-link route. Overrides the category default. */
  route?: string;
  /** Optional client-side action id (for analytics or in-app dispatch). */
  actionId?: string;
}

export interface RouteChangedPayload extends PushPayloadBase {
  category: 'route_changed';
  /** Route ID that changed — the app can compare against the active route. */
  routeId?: string;
}

export interface DispatchMessagePayload extends PushPayloadBase {
  category: 'dispatch_message';
  /** Sender identifier (operations username or 'dispatch'). */
  sender?: string;
  /** Optional priority hint, default 'normal'. */
  priority?: 'normal' | 'urgent';
}

export interface SosAcknowledgedPayload extends PushPayloadBase {
  category: 'sos_acknowledged';
  /** Local incident id (UUID) the agent submitted; ties ack to a specific report. */
  incidentId?: string;
}

export interface SystemPayload extends PushPayloadBase {
  category: 'system';
  /** Optional action: 'force_logout', 'maintenance', 'update_available'. */
  systemAction?: 'force_logout' | 'maintenance' | 'update_available';
}

export type PushPayload =
  | RouteChangedPayload
  | DispatchMessagePayload
  | SosAcknowledgedPayload
  | SystemPayload;

/** Default deep-link route per category. Overridable via payload.route. */
export const PUSH_DEFAULT_ROUTES: Record<PushCategory, string> = {
  route_changed: '/map',
  dispatch_message: '/dashboard',
  sos_acknowledged: '/dashboard',
  system: '/dashboard',
};

/** UI accent color hint per category — consumed by the in-app banner. */
export const PUSH_CATEGORY_COLORS: Record<PushCategory, 'primary' | 'tertiary' | 'success' | 'warning'> = {
  route_changed: 'primary',
  dispatch_message: 'tertiary',
  sos_acknowledged: 'success',
  system: 'warning',
};

/** Lucide-equivalent ion-icon name per category. */
export const PUSH_CATEGORY_ICONS: Record<PushCategory, string> = {
  route_changed: 'navigate-circle-outline',
  dispatch_message: 'chatbubble-ellipses-outline',
  sos_acknowledged: 'shield-checkmark-outline',
  system: 'information-circle-outline',
};

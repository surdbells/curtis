/**
 * Incident types surfaced on the Incident page.
 *
 * Legacy CurtisTracker (Android) only offered three: Broken Seal, Seal
 * Mismatch, Other. For Phase 6 we expand to a fuller field-ops list that
 * covers the real scenarios a CIT agent encounters, while keeping the
 * legacy values so backend reporting stays compatible.
 *
 * `id` is sent in DevicePostDto.incidentytype. `label` is the user-facing
 * string. The list is ordered by typical severity / urgency.
 */
export interface IncidentType {
  id: string;
  label: string;
  /** Default severity associated with the type — pre-selected for the agent. */
  defaultSeverity: IncidentSeverity;
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export const INCIDENT_TYPES: readonly IncidentType[] = [
  { id: 'robbery',       label: 'Robbery / Attack',  defaultSeverity: 'critical' },
  { id: 'medical',       label: 'Medical emergency', defaultSeverity: 'critical' },
  { id: 'accident',      label: 'Vehicle accident',  defaultSeverity: 'high' },
  { id: 'mechanical',    label: 'Mechanical issue',  defaultSeverity: 'medium' },
  { id: 'police_stop',   label: 'Police stop',       defaultSeverity: 'medium' },
  { id: 'route_diverted', label: 'Route diverted',   defaultSeverity: 'medium' },
  { id: 'broken_seal',   label: 'Broken seal',       defaultSeverity: 'high' }, // legacy
  { id: 'seal_mismatch', label: 'Seal mismatch',     defaultSeverity: 'high' }, // legacy
  { id: 'other',         label: 'Other',             defaultSeverity: 'low' },  // legacy
] as const;

export const INCIDENT_SEVERITIES: readonly { id: IncidentSeverity; label: string; color: string }[] = [
  { id: 'low',      label: 'Low',      color: 'medium' },
  { id: 'medium',   label: 'Medium',   color: 'warning' },
  { id: 'high',     label: 'High',     color: 'danger' },
  { id: 'critical', label: 'Critical', color: 'danger' },
] as const;

/** The SOS button pre-fills this combination — the fastest distress signal. */
export const SOS_INCIDENT: { type: string; severity: IncidentSeverity; note: string } = {
  type: 'robbery',
  severity: 'critical',
  note: 'SOS — agent requested immediate assistance',
};

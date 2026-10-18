// A model request and every lease protecting it must share the same deadline.
// Connection probes stay short; cloud creation can outlive the phone session.
export const MODEL_REQUEST_TIMEOUT_MS=300000;
export const CONNECTION_REQUEST_TIMEOUT_MS=60000;
export const CHECKPOINT_LEASE_MS=MODEL_REQUEST_TIMEOUT_MS+30000;
export const JOB_LEASE_MS=CHECKPOINT_LEASE_MS+5000;
export const STALE_CALL_MS=JOB_LEASE_MS+10000;
export const SHUTDOWN_GRACE_MS=CHECKPOINT_LEASE_MS+10000;

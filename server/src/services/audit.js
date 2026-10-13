import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

// Fire-and-forget: a logging problem must never break an order. Keep `meta` free of secrets/personal data.
export function audit(actor, action, entityType, entityId, meta, ip) {
  AuditLog.create({
    actor: actor?.id || actor?._id, actorRole: actor?.role || 'system',
    action, entityType, entityId: entityId ? String(entityId) : undefined, meta, ip,
  }).catch((err) => logger.error('audit write failed', { action, error: err.message }));
}

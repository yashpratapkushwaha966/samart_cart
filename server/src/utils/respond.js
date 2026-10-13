// Every success response looks like { success: true, data }.
export const ok = (res, data = {}, status = 200) => res.status(status).json({ success: true, data });
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

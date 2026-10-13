import { Setting } from '../models/Setting.js';

export const getSettings = () =>
  Setting.findOneAndUpdate({ key: 'business' }, { $setOnInsert: { key: 'business' } }, { upsert: true, new: true, lean: true });

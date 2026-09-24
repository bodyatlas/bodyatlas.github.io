/* Plan gating: what the current license allows. */
import { PLANS, planFeatures } from './license.js';

export const FEATURE_LABELS = {
  maxTemplates: 'Unlimited templates', computed: 'Computed fields and calculations', intake: 'Client intake forms',
  vault: 'Workspace encryption', packs: 'Template packs for teams',
};

export class Plan {
  constructor() { this.plan = 'free'; this.payload = null; this.error = null; }
  set(plan, payload = null, error = null) { this.plan = PLANS[plan] ? plan : 'free'; this.payload = payload; this.error = error; }
  get features() { return planFeatures(this.plan); }
  get isPaid() { return this.plan !== 'free'; }
  can(feature) { const v = this.features[feature]; return v === true || v === Infinity; }
  canAddTemplate(count) { return count < this.features.maxTemplates; }
  get name() { return this.features.name; }
}

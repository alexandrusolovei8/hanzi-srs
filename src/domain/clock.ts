/** Source of the current time (epoch ms). Injected everywhere so domain logic stays deterministic. */
export interface Clock {
  now(): number;
}

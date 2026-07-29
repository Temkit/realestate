declare module "opening_hours" {
  /** Minimal typings for the fields we use from the opening_hours library. */
  export default class OpeningHours {
    constructor(value: string, nominatim_object?: unknown, optional_conf?: unknown);
    getState(date?: Date): boolean;
    getNextChange(date?: Date): Date | undefined;
    getOpenIntervals(from: Date, to: Date): Array<[Date, Date, boolean, string | undefined]>;
  }
}

export interface OptionsProvider<T> {
  configure (options: Partial<T>, replace: boolean): void
}

/**
 * Represents a data structure for storing options with dual-layer override support.
 */
export class OptionsStore<T> implements OptionsProvider<T> {

  /**
   * Initializes a new OptionsStore.
   * @param fallbackOptions The set of options used by all instances by default (layer 1)
   * @param defaultOptions A set of options to use by default for this instance (layer 2)
   */
  public constructor (protected readonly fallbackOptions: T, protected defaultOptions: Partial<T> = {}) {}

  /**
   * Overrides the default options of this instance (layer 2).
   * Options not specified in the options argument will retain their values by default.
   * @param options Options you want to override
   * @param replace If true, the default options will be completely replaced instead of partially overwritten
   */
  public configure (options: Partial<T>, replace: boolean = false): void {
    if (replace) {
      this.defaultOptions = options
      return
    }
    Object.assign(this.defaultOptions, options)
  }

  /**
   * Returns a set of options according to this instance's default options and the given overrides (layer 3).
   * @param overrides Options you want to override
   */
  public get (overrides?: Partial<T>): T {
    return Object.assign(this.fallbackOptions, this.defaultOptions, overrides)
  }

}

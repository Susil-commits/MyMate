/**
 * Configuration helper for platform business settings.
 * Allows runtime/dynamic tuning via environment variables or database settings.
 */

/**
 * Returns the fraction of the booking total that is credited to the driver.
 * Defaults to 0.9 (90% to driver, 10% platform commission fee).
 * Configurable via DRIVER_WALLET_SPLIT_PERCENTAGE environment variable (range: 0.0 - 1.0).
 */
export const getDriverWalletSplitPercentage = (): number => {
  const envVal = process.env.DRIVER_WALLET_SPLIT_PERCENTAGE;
  if (envVal !== undefined) {
    const parsed = parseFloat(envVal);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }
  return 0.9;
};

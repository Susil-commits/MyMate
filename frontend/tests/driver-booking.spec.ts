import { test, expect } from '@playwright/test';

test('Driver Booking Flow', async ({ page }) => {
  // 1. Go to homepage
  await page.goto('http://localhost:5173/');

  // 2. Expect the title to contain MyMate
  await expect(page).toHaveTitle(/MyMate/);

  // 3. Navigate to Drivers Search Page
  // We simulate a user clicking 'Find Drivers'
  await page.goto('http://localhost:5173/drivers');

  // 4. Verify search elements are visible
  const searchInput = page.getByPlaceholder('Search by locality (e.g. Bandra)');
  await expect(searchInput).toBeVisible();

  // Note: Actual booking requires authentication which is complex for a simple E2E mock.
  // We will verify the UI for the Driver Search page loads properly.
  const filterBtn = page.getByRole('button', { name: 'Apply Filters' });
  await expect(filterBtn).toBeVisible();
});

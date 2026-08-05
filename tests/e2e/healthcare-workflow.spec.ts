/**
 * E2E Tests - Healthcare Platform Workflow
 * 
 * Verifies the clinical twin pipeline, interactive odontogram, journeys, 
 * and AI-powered CDSS safety checks.
 */

import { test, expect } from '@playwright/test';

test.describe('Bella Healthcare Platform E2E Workflow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the healthcare dashboard page
    // In e2e test, we assume a pre-authenticated session or direct access in test environment
    await page.goto('/dashboard/healthcare');
  });

  test('Should render dashboard and 3-panel digital twin layout', async ({ page }) => {
    // 1. Check main header is visible
    await expect(page.locator('h1:has-text("Bác sĩ lâm sàng")')).toBeVisible();

    // 2. Verify Panel 1: Clinical Pipeline is present
    await expect(page.locator('text=Hàng đợi khám & Tiếp đón')).toBeVisible();

    // 3. Verify Panel 2: Odontogram is present
    await expect(page.locator('text=Lược đồ răng Nha khoa')).toBeVisible();

    // 4. Verify Panel 3: AI Clinical Panel is present
    await expect(page.locator('text=Trợ lý AI SOAP Note')).toBeVisible();
  });

  test('Should interact with Odontogram SVG and update tooth status', async ({ page }) => {
    // 1. Verify default selected patient is "Nguyễn Văn Hùng"
    await expect(page.locator('text=Nguyễn Văn Hùng')).first().toBeVisible();

    // 2. Select Tooth #17
    await page.click('text=#17');

    // 3. Click "Sâu răng" status button
    await page.click('button:has-text("Sâu răng")');

    // 4. Verify toast notification and status text changed
    await expect(page.locator('text=Cập nhật răng #17')).toBeVisible();
    await expect(page.locator('text=Trạng thái hiện tại: DECAYED')).toBeVisible();

    // 5. Change to "Implant"
    await page.click('button:has-text("Implant")');
    await expect(page.locator('text=Trạng thái hiện tại: IMPLANTED')).toBeVisible();
  });

  test('Should execute AI SOAP Note generation and clinical CDSS check', async ({ page }) => {
    // 1. Select the first waiting patient in the pipeline
    await page.click('text=Nguyễn Văn Hùng');

    // 2. Try clinical CDSS safety check by selecting Amoxicillin
    // Nguyễn Văn Hùng has Penicillin allergy seeded in db
    await page.click('text=Amoxicillin 500mg');
    await page.click('button:has-text("CDSS")');

    // 3. Verify prescribing safety alert is triggered and BLOCKED
    await expect(page.locator('text=Khóa kê đơn')).toBeVisible();
    await expect(page.locator('text=dị ứng với kháng sinh nhóm Penicillin')).toBeVisible();

    // 4. Input raw clinician notes for SOAP note generation
    await page.fill('textarea[placeholder*="ghi chú thô"]', 'bệnh nhân bị buốt răng 36 khi uống nước lạnh tối qua, sâu ngà sâu');
    await page.click('button:has-text("SOAP Note")');

    // 5. Verify structured SOAP result is generated
    await expect(page.locator('text=Kết quả SOAP Note')).toBeVisible();
    await expect(page.locator('text=Subjective')).toBeVisible();
    await expect(page.locator('text=Objective')).toBeVisible();
  });

  test('Should navigate to patients profile registry and view entries', async ({ page }) => {
    // 1. Navigate to patients page
    await page.goto('/dashboard/healthcare/patients');

    // 2. Verify patient list headers and search bar
    await expect(page.locator('h1:has-text("Hồ sơ Bệnh nhân")')).toBeVisible();
    await expect(page.locator('input[placeholder*="Tìm kiếm bệnh nhân"]')).toBeVisible();

    // 3. Check seeded patient Nguyễn Văn Hùng details
    await expect(page.locator('text=Nguyễn Văn Hùng')).toBeVisible();
    await expect(page.locator('text=GD4797921800124')).toBeVisible(); // BHYT
  });

  test('Should navigate to journeys tracker and interact with milestones', async ({ page }) => {
    // 1. Navigate to care journeys page
    await page.goto('/dashboard/healthcare/journeys');

    // 2. Verify active treatment journeys
    await expect(page.locator('h1:has-text("Hành trình điều trị")')).toBeVisible();
    await expect(page.locator('text=Cấy ghép Implant răng #36')).toBeVisible();

    // 3. Mark milestone as completed
    await page.click('button:has-text("Đánh dấu xong")');
    await expect(page.locator('text=Cập nhật tiến trình')).toBeVisible();
  });
});

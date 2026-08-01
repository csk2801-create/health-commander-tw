import { expect, test } from "@playwright/test";

test("core health record flow works", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今天的健康紀錄" })).toBeVisible();
  await page.getByLabel("早上體重 kg").fill("84.2");
  await page.getByLabel("晚上體重 kg").fill("83.9");
  await page.getByLabel("腰圍 cm").fill("91");
  await page.getByLabel("飲水 ml").fill("2200");
  await page.getByLabel("備註").fill("跑步 30 分鐘，膝蓋正常");
  await page.getByRole("button", { name: "儲存" }).first().click();
  await expect(page.getByText("已儲存")).toBeVisible();
  await expect(page.getByText("Health Commander V1")).toBeVisible();
  await expect(page.getByText("Apple Health 自動同步已預留")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("早上體重 kg")).toHaveValue("84.2");
});

test("camera and gallery inputs are configured for mobile photo capture", async ({ page }) => {
  await page.goto("/");
  const cameraInput = page.locator('input[type="file"][capture="environment"]').first();
  const galleryInput = page.locator('input[type="file"][multiple]').first();
  await expect(cameraInput).toHaveAttribute("accept", "image/*");
  await expect(galleryInput).toHaveAttribute("accept", "image/*");
});

test("cloud mode auto uploads text records after save", async ({ page }) => {
  const requests = [];
  await page.route("/api/sync/**", async (route) => {
    requests.push(route.request().method());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("自己設定，電腦和手機輸入同一組").fill("test-cloud-code");
  await page.getByRole("button", { name: "開啟雲端" }).click();
  await expect(page.getByText("雲端已開啟")).toBeVisible();

  await page.getByLabel("早上體重 kg").fill("82.8");
  await page.getByRole("button", { name: "儲存" }).first().click();

  await expect.poll(() => requests.filter((method) => method === "PUT").length).toBeGreaterThanOrEqual(2);
});

import os

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:3000").rstrip("/")


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.set_default_navigation_timeout(60000)
        page.goto(f"{BASE_URL}/admin", wait_until="commit")
        page.wait_for_selector(".admin-shell")

        page.get_by_role("button", name="Products / SKU").click()
        rows = page.locator(".catalog-listing-row")
        if rows.count() == 0:
            raise AssertionError("Expected catalog listing rows on the admin page")

        page.locator(".catalog-code").first.evaluate(
            "(node) => { node.textContent = 'PARTY_ESSENTIALS_PARTY_PREMIUMBRUSH_ALMOND'; }"
        )
        for index in range(rows.count()):
            row = rows.nth(index)
            sku_cell = row.locator(".catalog-detail-cell").first
            brand_cell = row.locator(".catalog-detail-cell").nth(1)
            sku_box = sku_cell.bounding_box()
            brand_box = brand_cell.bounding_box()
            if not sku_box or not brand_box:
                raise AssertionError(f"Missing catalog cell geometry for row {index}")
            if sku_box["x"] + sku_box["width"] > brand_box["x"] + 1:
                raise AssertionError(f"SKU cell overlaps brand cell in row {index}")

        page.screenshot(path="tests/catalog-listing-layout-check.png", full_page=True)
        print(f"Catalog listing layout check passed for {rows.count()} rows")
        browser.close()


if __name__ == "__main__":
    main()

from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto("http://127.0.0.1:3000", wait_until="networkidle")

        assert page.locator("h1").inner_text().startswith("Belanja nail supply")
        assert page.locator(".product-card").count() == 6

        page.get_by_role("button", name="Color gel", exact=True).click()
        assert page.locator(".product-card").count() == 3
        page.get_by_role("button", name="Semua", exact=True).click()

        page.locator(".product-card").first.get_by_role("button").click()
        assert page.get_by_role("button", name="Buka keranjang, 1 item").is_visible()
        page.get_by_role("button", name="Buka keranjang, 1 item").click()
        assert "PH Bond" in page.locator(".cart-drawer").inner_text()
        page.get_by_role("button", name="Tutup keranjang").click()

        page.get_by_role("button", name="Masuk B2B").click()
        assert page.get_by_role("dialog").is_visible()
        page.get_by_role("button", name="Tutup").click()

        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        mobile.goto("http://127.0.0.1:3000", wait_until="networkidle")
        mobile.get_by_role("button", name="Buka menu").click()
        assert mobile.locator(".main-nav.mobile-open").is_visible()
        mobile.close()

        screenshot = Path("tests") / "next-storefront-check.png"
        page.screenshot(path=str(screenshot), full_page=True)
        print(f"Next browser check passed; screenshot: {screenshot}")
        browser.close()


if __name__ == "__main__":
    main()

from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.set_default_timeout(8000)
        page.set_default_navigation_timeout(20000)
        page.goto("http://127.0.0.1:3000", wait_until="commit")
        page.wait_for_selector("h1")
        print("home loaded", flush=True)

        assert page.locator("h1").inner_text().startswith("Belanja nail supply")
        assert page.get_by_text("SKU hanya untuk katalog digital").is_visible()
        if page.locator(".product-card").count() > 0:
            page.get_by_role("button", name="Color gel", exact=True).click()
            print("catalog filter clicked", flush=True)
            page.get_by_role("button", name="Semua", exact=True).click()

        page.get_by_role("link", name="Explore packages").click()
        page.wait_for_url("**/packages")
        page.wait_for_selector("h1")
        assert page.url.endswith("/packages")
        assert page.locator("h1").inner_text().startswith("Brands, selected")
        package_count = page.locator(".brand-package-card").count()
        if package_count:
            page.locator(".brand-package-card").first.click()
            page.wait_for_selector(".package-detail-page")
            assert page.locator(".package-detail-page").is_visible()
            assert page.get_by_text("Lanjut ke checkout").is_visible()
        else:
            assert page.locator(".brand-empty").is_visible()

        page.goto("http://127.0.0.1:3000", wait_until="commit")
        page.wait_for_selector("h1")
        page.get_by_role("button", name="Daftar akun B2B").click()
        assert page.get_by_role("dialog").is_visible()
        page.get_by_role("button", name="Tutup").click()

        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        mobile.goto("http://127.0.0.1:3000", wait_until="commit")
        mobile.wait_for_selector("h1")
        mobile.get_by_role("button", name="Buka menu").click()
        assert mobile.locator(".main-nav.mobile-open").is_visible()
        mobile.close()

        screenshot = Path("tests") / "next-storefront-check.png"
        page.screenshot(path=str(screenshot), full_page=True)
        print(f"Next browser check passed; screenshot: {screenshot}")
        browser.close()


if __name__ == "__main__":
    main()

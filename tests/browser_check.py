from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto((Path("index.html").resolve()).as_uri(), wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")

        assert page.locator("h1").inner_text().startswith("Belanja nail supply")
        assert page.locator("[data-product-grid] .product-card").count() == 6

        page.locator("[data-filter='gel']").click()
        assert page.locator("[data-product-grid] .product-card").count() == 3

        page.locator("[data-filter='all']").click()
        page.locator("[data-add='ph-bond']").click()
        assert page.locator("[data-cart-count]").inner_text() == "1"
        page.locator("[data-open-cart]").click()
        assert page.locator("[data-cart-drawer]").get_attribute("aria-hidden") == "false"
        assert "PH Bond" in page.locator("[data-cart-items]").inner_text()

        page.locator("[data-close-cart]").click()
        page.locator("[data-open-login]").first.click()
        assert page.locator("[data-login-modal]").get_attribute("aria-hidden") == "false"
        page.locator("[data-close-login]").last.click()
        assert page.locator("[data-login-modal]").get_attribute("aria-hidden") == "true"
        page.wait_for_timeout(300)

        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        mobile.goto((Path("index.html").resolve()).as_uri(), wait_until="domcontentloaded")
        mobile.locator("[data-mobile-menu]").click()
        assert mobile.locator(".main-nav.mobile-open").is_visible()
        assert mobile.locator("h1").is_visible()
        mobile.close()

        screenshot = Path("tests") / "storefront-check.png"
        page.screenshot(path=str(screenshot), full_page=True)
        print(f"browser check passed; screenshot: {screenshot}")
        browser.close()


if __name__ == "__main__":
    main()

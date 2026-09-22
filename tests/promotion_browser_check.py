from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1100})
        page.goto("http://127.0.0.1:3000/admin", wait_until="domcontentloaded")
        page.get_by_role("button", name="Promosi", exact=True).click()
        assert page.get_by_role("heading", name="Promo yang terukur.").is_visible()
        for label in [
            "New user promo",
            "Recurring repeat promo",
            "Bundling package",
            "Seasonal promo",
            "Custom special voucher",
        ]:
            assert page.locator(".promotion-type", has_text=label).is_visible()
        page.screenshot(path="tests/promotion-check.png", full_page=True)
        browser.close()
        print("promotion browser check passed")


if __name__ == "__main__":
    main()

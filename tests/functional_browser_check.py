import os

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:3210").rstrip("/")


def assert_no_horizontal_overflow(page):
    dimensions = page.evaluate(
        "({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth })"
    )
    assert dimensions["document"] <= dimensions["viewport"], dimensions
    assert dimensions["body"] <= dimensions["viewport"], dimensions


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.set_default_timeout(10000)
    page.set_default_navigation_timeout(30000)

    console_errors = []
    page.on("pageerror", lambda error: console_errors.append(str(error)))

    response = page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    assert response is not None and response.status == 200
    assert page.get_by_role("heading", name="Belanja nail supply, dengan ritme salon kamu.").is_visible()
    assert_no_horizontal_overflow(page)

    if page.get_by_role("button", name="Color gel", exact=True).count():
        page.get_by_role("button", name="Color gel", exact=True).click()
        page.get_by_role("button", name="Semua", exact=True).click()

    page.get_by_role("link", name="Explore packages").click()
    page.wait_for_url("**/packages*")
    page.wait_for_load_state("networkidle")
    assert page.locator("h1").inner_text().startswith("Packages built")
    assert_no_horizontal_overflow(page)

    package_count = page.locator(".brand-package-card").count()
    if package_count:
        page.locator(".brand-package-card").first.click()
        page.wait_for_selector(".package-detail-page")
        assert page.get_by_text("Lanjut ke checkout").is_visible()

    page.goto(f"{BASE_URL}/auth", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    assert page.locator("h1").inner_text().startswith("Masuk ke ruang")
    assert_no_horizontal_overflow(page)

    page.goto(f"{BASE_URL}/admin", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    if "/auth" not in page.url:
        assert page.get_by_role("heading", name="Admin workspace").is_visible()
        if page.get_by_role("button", name="Products / SKU").count():
            page.get_by_role("button", name="Products / SKU").click()
            page.get_by_role("heading", name="Products & SKU.").wait_for()
            assert page.get_by_text("Daftar produk terstruktur", exact=True).is_visible()
            page.get_by_placeholder("Contoh: A01 atau Party").fill("Starter")
            assert page.get_by_text("Showing 1 to 1 of 1 entries", exact=True).is_visible()
        else:
            assert page.get_by_text("Akses admin belum diberikan.", exact=True).is_visible()
    else:
        assert page.locator("h1").inner_text().startswith("Masuk ke ruang")
    assert_no_horizontal_overflow(page)

    assert not console_errors, console_errors
    print(f"functional browser check passed: {BASE_URL}")
    browser.close()

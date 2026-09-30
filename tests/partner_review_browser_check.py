import os
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:3210").rstrip("/") + "/"


def audit(page, path):
    console_errors = []
    page_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    response = page.goto(urljoin(BASE_URL, path), wait_until="networkidle")
    assert response is not None and response.status == 200, (path, response.status if response else None)
    dimensions = page.evaluate("({ document: document.documentElement.scrollWidth, body: document.body.scrollWidth, viewport: document.documentElement.clientWidth })")
    assert dimensions["document"] <= dimensions["viewport"] + 1, (path, dimensions)
    assert dimensions["body"] <= dimensions["viewport"] + 1, (path, dimensions)
    assert not console_errors, (path, console_errors)
    assert not page_errors, (path, page_errors)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})

    audit(page, "/")
    assert page.get_by_role("link", name="Buka keranjang, 0 item").is_visible()
    assert page.get_by_role("heading", name="Dipercaya oleh working studios.").is_visible()

    audit(page, "/brands")
    brands_heading = page.locator(".brand-stage h1").inner_text()
    assert "Brands" in brands_heading

    audit(page, "/packages")
    packages_heading = page.locator(".brand-stage h1").inner_text()
    assert "Packages" in packages_heading
    assert packages_heading != brands_heading

    audit(page, "/cart")
    assert page.get_by_role("heading", name="Keranjang order kamu.").is_visible()
    assert page.get_by_text("Belum ada package.", exact=True).is_visible()

    browser.close()

print(f"partner review browser check passed: {BASE_URL}")

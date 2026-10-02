import os
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:3210").rstrip("/") + "/"


def audit_page(page, path):
    console_errors = []
    page_errors = []
    failed_requests = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.url}: {request.failure}"))
    page.goto(urljoin(BASE_URL, path), wait_until="domcontentloaded")
    page.wait_for_timeout(500)
    overflow = page.evaluate("""() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth
    })""")
    assert overflow["documentWidth"] <= overflow["viewportWidth"] + 1, f"horizontal overflow on {path}: {overflow}"
    assert not console_errors, f"console errors on {path}: {console_errors}; failed requests: {failed_requests}"
    assert not page_errors, f"page errors on {path}: {page_errors}"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    audit_page(page, "/")
    assert page.get_by_role("link", name="Explore packages").is_visible()
    audit_page(page, "/packages")
    assert page.locator("body").inner_text().strip()
    audit_page(page, "/admin")
    assert page.url.endswith("/admin") or "/auth" in page.url
    browser.close()

print(f"pre-UAT browser audit passed: {BASE_URL}")

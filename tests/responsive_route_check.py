import os

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:3000").rstrip("/")


def check_route(page, path, width, height=844):
    page.set_viewport_size({"width": width, "height": height})
    response = page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
    assert response is not None and response.status < 500, f"{path} returned {response.status if response else 'no response'}"
    metrics = page.evaluate("""() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
    })""")
    assert metrics["documentWidth"] <= metrics["viewportWidth"] + 1, f"horizontal overflow on {path}: {metrics}"


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        check_route(page, "/about", 390)
        check_route(page, "/education", 390)
        page.goto(f"{BASE_URL}/account/addresses", wait_until="domcontentloaded")
        assert page.url.endswith("/auth?next=/account/addresses"), page.url
        browser.close()
    print(f"responsive route check passed: {BASE_URL}")


if __name__ == "__main__":
    main()

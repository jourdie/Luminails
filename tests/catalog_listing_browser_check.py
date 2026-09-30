from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto("http://127.0.0.1:3210/admin", wait_until="domcontentloaded")
    page.screenshot(path="tests/catalog-listing-admin.png", full_page=True)
    assert page.get_by_text("Products / SKU", exact=True).count() == 1
    page.get_by_role("button", name="Products / SKU").click()
    page.get_by_role("heading", name="Products & SKU.", exact=True).wait_for()
    assert page.get_by_text("Daftar produk terstruktur", exact=True).count() == 1
    assert page.get_by_text("Showing 1 to 3 of 3 entries", exact=True).count() == 1
    page.get_by_placeholder("Contoh: A01 atau Party").fill("Starter")
    assert page.get_by_text("Showing 1 to 1 of 1 entries", exact=True).count() == 1
    page.get_by_text("Edit", exact=True).click()
    assert page.get_by_role("button", name="Simpan perubahan", exact=True).count() == 1
    print("catalog listing browser check passed")
    browser.close()

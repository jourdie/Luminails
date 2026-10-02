import os

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:3000").rstrip("/")


def assert_admin_layout(page, label):
    metrics = page.evaluate("""() => {
      const root = document.documentElement;
      const content = document.querySelector('.admin-content');
      const contentRect = content?.getBoundingClientRect();
      const controls = [...document.querySelectorAll('.admin-content input, .admin-content select, .admin-content textarea, .admin-content button')];
      return {
        documentWidth: root.scrollWidth,
        viewportWidth: root.clientWidth,
        contentWidth: content?.scrollWidth ?? 0,
        contentClientWidth: content?.clientWidth ?? 0,
        outsideControls: controls.filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && contentRect && (rect.left < contentRect.left - 1 || rect.right > contentRect.right + 1);
        }).map((element) => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 40), rect: element.getBoundingClientRect().toJSON() })),
      };
    }""")
    assert metrics["documentWidth"] <= metrics["viewportWidth"] + 1, f"document overflow on {label}: {metrics}"
    assert metrics["contentWidth"] <= metrics["contentClientWidth"] + 1, f"admin content overflow on {label}: {metrics}"
    assert not metrics["outsideControls"], f"admin control outside row on {label}: {metrics}"


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})

        print("auth", flush=True)
        page.goto(f"{BASE_URL}/auth", wait_until="domcontentloaded")
        assert page.locator("h1").inner_text().startswith("Masuk ke ruang")
        page.get_by_label("Email kerja atau email studio").fill("demo@studio.test")
        page.get_by_role("button", name="Kirim link login").click()
        assert "Supabase belum dikonfigurasi" in page.locator("[role='status']").inner_text()

        print("admin", flush=True)
        page.goto(f"{BASE_URL}/admin", wait_until="domcontentloaded")
        page.wait_for_selector("h1", timeout=20000)
        page.wait_for_timeout(1000)
        assert page.get_by_role("heading", name="Admin workspace").is_visible()
        assert page.get_by_text("Preview mode").is_visible()
        page.set_default_timeout(10000)
        print("nav", page.locator(".admin-nav-item").all_inner_texts(), flush=True)
        for index in range(page.locator(".admin-nav-item").count()):
            item = page.locator(".admin-nav-item").nth(index)
            label = item.inner_text().splitlines()[0]
            item.click()
            page.wait_for_timeout(100)
            assert_admin_layout(page, label)

        print("brand and sku workflow", flush=True)
        page.get_by_role("button", name="Brand register").click()
        page.get_by_role("heading", name="Brand register.").wait_for(state="visible")
        assert page.get_by_role("heading", name="Brand register.").is_visible()
        assert page.get_by_text("Brand adalah master resmi").is_visible()

        page.get_by_role("button", name="Products / SKU").click()
        page.get_by_role("heading", name="Products & SKU.").wait_for(state="visible")
        assert page.get_by_role("heading", name="Products & SKU.").is_visible()
        assert page.get_by_role("table", name="Product and SKU listing").is_visible()
        assert page.get_by_placeholder("Contoh: A01 atau Party").is_visible()
        assert page.get_by_label("Series", exact=True).first.is_visible()
        assert page.get_by_label("Color / shade").first.is_visible()

        print("packages", flush=True)
        page.get_by_role("button", name="Packages").click()
        page.get_by_role("heading", name="Packages").wait_for(state="visible")
        assert page.get_by_role("heading", name="Packages").is_visible()
        if page.get_by_role("button", name="Buka detail").count():
            page.get_by_role("button", name="Buka detail").first.click()
            assert page.locator(".package-summary-table").first.is_visible()
        assert page.get_by_text("Cari package / SKU").is_visible()

        print("orders", flush=True)
        page.get_by_role("button", name="Transaksi").click()
        page.get_by_role("heading", name="Transaksi masuk.").wait_for(state="visible")
        assert page.get_by_role("heading", name="Transaksi masuk.").is_visible()
        assert page.get_by_text("Notifikasi masuk").is_visible()

        print("pricing", flush=True)
        page.get_by_role("button", name="Customers & loyalty").click()
        page.get_by_role("button", name="Customer tiers", exact=True).click()
        assert page.get_by_text("Earning points dihitung dari transaksi paid").is_visible()

        print("customers and loyalty", flush=True)
        page.get_by_role("button", name="Customers & loyalty").click()
        page.get_by_role("heading", name="Customer & loyalty.").wait_for(state="visible")
        assert page.get_by_role("heading", name="Customer & loyalty.").is_visible()
        assert page.get_by_role("button", name="Reward catalog", exact=True).is_visible()

        page.get_by_role("button", name="Recommendation Page").click()
        assert page.get_by_role("heading", name="You Might Also Like..").is_visible()
        assert page.get_by_text("Recommendation home tampil di storefront").is_visible()
        assert_admin_layout(page, "Recommendation Page")

        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(f"{BASE_URL}/admin", wait_until="domcontentloaded")
        page.wait_for_selector(".admin-nav-item", timeout=20000)
        for index in range(page.locator(".admin-nav-item").count()):
            item = page.locator(".admin-nav-item").nth(index)
            label = item.inner_text().splitlines()[0]
            item.click()
            page.wait_for_timeout(100)
            assert_admin_layout(page, f"mobile {label}")

        print("auth/admin browser check passed")
        browser.close()


if __name__ == "__main__":
    main()

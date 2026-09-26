from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})

        print("auth", flush=True)
        page.goto("http://127.0.0.1:3000/auth", wait_until="domcontentloaded")
        assert page.locator("h1").inner_text().startswith("Masuk ke ruang")
        page.get_by_label("Email kerja atau email studio").fill("demo@studio.test")
        page.get_by_role("button", name="Kirim link login").click()
        assert "Supabase belum dikonfigurasi" in page.locator("[role='status']").inner_text()

        print("admin", flush=True)
        page.goto("http://127.0.0.1:3000/admin", wait_until="domcontentloaded")
        page.wait_for_selector("h1", timeout=20000)
        page.wait_for_timeout(1000)
        assert page.get_by_role("heading", name="Admin workspace").is_visible()
        assert page.get_by_text("Preview mode").is_visible()
        page.set_default_timeout(3000)
        print("nav", page.locator(".admin-nav-item").all_inner_texts(), flush=True)

        print("brand and sku workflow", flush=True)
        page.get_by_role("button", name="Brand register").click()
        page.get_by_role("heading", name="Brand register.").wait_for(state="visible")
        assert page.get_by_role("heading", name="Brand register.").is_visible()
        assert page.get_by_text("Brand adalah master resmi").is_visible()

        page.get_by_role("button", name="SKU list").click()
        page.get_by_role("heading", name="SKU list.").wait_for(state="visible")
        assert page.get_by_role("heading", name="SKU list.").is_visible()
        assert page.get_by_role("table", name="Daftar SKU").is_visible()
        assert page.get_by_placeholder("Nama / code / series / color").is_visible()
        assert page.get_by_label("Series", exact=True).first.is_visible()
        assert page.get_by_label("Color reference").first.is_visible()

        print("packages", flush=True)
        page.get_by_role("button", name="Packages").click()
        page.get_by_role("heading", name="Packages").wait_for(state="visible")
        assert page.get_by_role("heading", name="Packages").is_visible()
        assert page.get_by_text("Brand Register → SKU list → Package").is_visible()

        print("orders", flush=True)
        page.get_by_role("button", name="Transaksi").click()
        page.get_by_role("heading", name="Transaksi masuk.").wait_for(state="visible")
        assert page.get_by_role("heading", name="Transaksi masuk.").is_visible()
        assert page.get_by_text("Notifikasi masuk").is_visible()

        print("pricing", flush=True)
        page.get_by_role("button", name="B2B Tier").click()
        page.get_by_role("heading", name="B2B Tier.").wait_for(state="visible")
        assert page.get_by_role("heading", name="B2B Tier.").is_visible()
        assert page.get_by_text("Flagging customer otomatis").is_visible()

        print("customers and loyalty", flush=True)
        page.get_by_role("button", name="Customers & loyalty").click()
        page.get_by_role("heading", name="Customer & loyalty.").wait_for(state="visible")
        assert page.get_by_role("heading", name="Customer & loyalty.").is_visible()
        assert page.get_by_role("button", name="Reward catalog", exact=True).is_visible()

        page.screenshot(path="tests/admin-check.png", full_page=True)

        print("auth/admin browser check passed")
        browser.close()


if __name__ == "__main__":
    main()

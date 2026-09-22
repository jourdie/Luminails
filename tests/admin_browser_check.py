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
        assert page.get_by_role("heading", name="Admin workspace").is_visible()
        assert page.get_by_text("Mode preview aktif").is_visible()

        print("products", flush=True)
        page.get_by_role("button", name="Produk", exact=True).click()
        assert page.get_by_role("heading", name="Update barang.").is_visible()
        assert page.locator("input[name='name']").first.input_value() == "PH Bond — nail prep"

        print("orders", flush=True)
        page.get_by_role("button", name="Transaksi").click()
        assert page.get_by_role("heading", name="Transaksi masuk.").is_visible()
        assert page.get_by_text("Notifikasi masuk").is_visible()

        print("pricing", flush=True)
        page.get_by_role("button", name="Pricing B2B", exact=True).click()
        assert page.get_by_role("heading", name="Harga yang bertumbuh.").is_visible()
        assert page.get_by_text("B2B_PREMIUM").is_visible()

        page.screenshot(path="tests/admin-check.png", full_page=True)

        print("auth/admin browser check passed")
        browser.close()


if __name__ == "__main__":
    main()

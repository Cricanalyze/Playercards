BASE = "https://cricket-playercards--0zgnkd25.preview.emergentagent.com"
async def login(page, email):
    await page.goto(BASE + "/sign-in")
    await page.wait_for_selector("input[name=identifier]", timeout=15000)
    await page.fill("input[name=identifier]", email)
    await page.click(".cl-formButtonPrimary")
    await page.wait_for_selector("input[name=password]", timeout=15000)
    await page.fill("input[name=password]", "Rival-QA-2026!")
    await page.click(".cl-formButtonPrimary")
    await page.wait_for_timeout(4000)
    if "client-trust" in page.url or "factor" in page.url or "verify" in page.url:
        otp = page.locator("input[autocomplete='one-time-code'], input[name=code]").first
        await otp.click()
        await page.keyboard.type("424242", delay=80)
        await page.wait_for_timeout(5000)
    print("logged in url:", page.url)

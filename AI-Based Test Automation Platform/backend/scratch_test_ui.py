import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        errors = []
        page.on("console", lambda msg: print(f"CONSOLE {msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        
        try:
            await page.goto("http://localhost:5173", timeout=10000)
            await page.wait_for_timeout(3000)
        except Exception as e:
            print(f"Failed to load: {e}")
            
        for e in errors:
            print(f"PAGE ERROR: {e}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())

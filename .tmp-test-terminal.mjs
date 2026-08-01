import { chromium } from 'playwright-core'

const shotDir = '/tmp/claude-1000/-home-bitx-Desktop-project-myself--github-Linux-Webapp/9ff522c0-ed55-442c-9892-2af93cea60a9/scratchpad'
const errors = []
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })

// Boot screen -> lock screen
await page.waitForSelector('text=Click or press Enter to log in', { timeout: 15000 })
await page.keyboard.press('Enter') // reveals the password field
const pwInput = page.locator('input[type="password"]')
await pwInput.waitFor({ timeout: 5000 })
await pwInput.fill('x')
await pwInput.press('Enter')
await page.waitForSelector('.dock-blur', { timeout: 15000 })
await page.waitForTimeout(500)

const dockButtons = page.locator('.dock-blur button')
console.log('dock buttons:', await dockButtons.count())
await dockButtons.nth(2).click() // Files, App Center, Terminal
await page.waitForTimeout(1000)

await page.screenshot({ path: `${shotDir}/01-after-open.png` })

const input = page.locator('input.terminal-font')
const hasInput = await input.count()
console.log('terminal input found:', hasInput)

if (hasInput) {
  const commands = [
    'pwd',
    'mkdir -p test/a/b',
    'tree',
    'ls -la',
    'cd test && pwd',
    'echo hello > f.txt && cat f.txt',
    'ln -s f.txt link.txt && ls -l',
  ]
  for (const cmd of commands) {
    await input.first().fill(cmd)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${shotDir}/02-after-commands.png` })

  const terminalText = await page
    .locator('.terminal-font')
    .first()
    .locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")]')
    .innerText()
  console.log('=== TERMINAL TEXT ===')
  console.log(terminalText)
} else {
  console.log(await page.locator('body').innerText())
}

console.log('=== CONSOLE ERRORS ===')
console.log(errors.join('\n') || '(none)')

await browser.close()

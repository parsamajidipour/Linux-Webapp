import { chromium } from 'playwright-core'

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
await page.waitForTimeout(3500) // boot animation + kernel boot

// Skip lock screen if present: click anywhere then try Enter
const body = page.locator('body')
await body.click({ position: { x: 700, y: 450 } }).catch(() => {})
await page.waitForTimeout(500)
await page.keyboard.press('Enter').catch(() => {})
await page.waitForTimeout(800)

// Try opening terminal via dock icon (title/aria containing Terminal), else double-click a desktop icon
const dockTerminal = page.locator('[title="Terminal" i], [aria-label="Terminal" i]').first()
if (await dockTerminal.count()) {
  await dockTerminal.click()
} else {
  console.log('No dock terminal icon found by title/aria-label; dumping visible text for debugging')
  console.log(await page.locator('body').innerText())
}
await page.waitForTimeout(1000)

await page.screenshot({ path: '/tmp/claude-1000/-home-bitx-Desktop-project-myself--github-Linux-Webapp/9ff522c0-ed55-442c-9892-2af93cea60a9/scratchpad/01-after-open.png' })

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
  await page.screenshot({ path: '/tmp/claude-1000/-home-bitx-Desktop-project-myself--github-Linux-Webapp/9ff522c0-ed55-442c-9892-2af93cea60a9/scratchpad/02-after-commands.png' })

  const terminalText = await page.locator('.terminal-font').first().locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")]').innerText()
  console.log('=== TERMINAL TEXT ===')
  console.log(terminalText)
}

console.log('=== CONSOLE ERRORS ===')
console.log(errors.join('\n') || '(none)')

await browser.close()

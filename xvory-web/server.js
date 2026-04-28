const express = require('express')
const cors = require('cors')
const { execSync } = require('child_process')
const fs = require('fs')
const app = express()

app.use(cors())
app.use(express.json())

// Valid keys (move to env vars in production)
const VALID_KEYS = ['XVORY-1234', 'XVORY-ELITE', 'XVORY-DEV']

// In-memory store: key → latest Lua script
const scriptStore = {}

// POST /execute — UI calls this when Execute is clicked
app.post('/execute', (req, res) => {
  const { key, code } = req.body

  if (!VALID_KEYS.includes(key))
    return res.status(403).json({ error: 'Invalid key' })

  if (!code || !code.includes('"Cloud-Web"'))
    return res.status(400).json({ error: 'Not a Cloud-Web config' })

  // Store the script so the executor can fetch it
  scriptStore[key] = code

  // Optional: actually run it server-side with lua5.4
  try {
    const tmpFile = `/tmp/xvory_${Date.now()}.lua`
    fs.writeFileSync(tmpFile, code)
    const output = execSync(`lua5.4 ${tmpFile}`, { timeout: 5000 }).toString()
    fs.unlinkSync(tmpFile)
    return res.json({ success: true, output })
  } catch (err) {
    // If lua not installed, still store it for executor polling
    return res.json({ success: true, stored: true, note: 'Script stored for executor polling' })
  }
})

// GET /script/:key — executor calls this to fetch latest script
app.get('/script/:key', (req, res) => {
  const { key } = req.params
  if (!VALID_KEYS.includes(key))
    return res.status(403).send('-- Invalid key')

  const script = scriptStore[key]
  if (!script)
    return res.status(404).send('-- No script stored for this key')

  res.type('text/plain').send(script)
})

// Health check
app.get('/', (req, res) => res.json({ status: 'Xvory backend running' }))

app.listen(process.env.PORT || 3000)
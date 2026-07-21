import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const html = readFileSync('F:/orders/tflow-landing-concept.html', 'utf8')
mkdirSync('F:/orders/public/loader', { recursive: true })

const patterns = [
  { name: 'mark', regex: /--mark-url:\s*url\("data:image\/png;base64,([A-Za-z0-9+/=]+)"\)/ },
  { name: 'word', regex: /--word-url:\s*url\("data:image\/png;base64,([A-Za-z0-9+/=]+)"\)/ },
  { name: 'tag',  regex: /--tag-url:\s*url\("data:image\/png;base64,([A-Za-z0-9+/=]+)"\)/ },
]

for (const { name, regex } of patterns) {
  const m = html.match(regex)
  if (m) {
    writeFileSync(`F:/orders/public/loader/${name}.png`, Buffer.from(m[1], 'base64'))
    console.log(`${name}.png written (${m[1].length} base64 chars)`)
  } else {
    console.error(`${name}.png NOT FOUND`)
  }
}

const autocannon = require('autocannon')

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'
const phone = process.env.PHONE
const password = process.env.PASSWORD
const connections = Number(process.env.CONNECTIONS || 10)
const duration = Number(process.env.DURATION || 20)
const amount = process.env.AMOUNT ? Number(process.env.AMOUNT) : undefined
const page = Number(process.env.PAGE || 1)
const pageSize = Number(process.env.PAGE_SIZE || 10)
const startDate = process.env.START_DATE || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const endDate = process.env.END_DATE || new Date().toISOString()

function ensureEnv() {
  if (!phone || !password) {
    throw new Error('Missing PHONE or PASSWORD environment variables')
  }
}

async function login() {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  })

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  if (!data.token) {
    throw new Error('Login response missing token')
  }

  return data.token
}

function printResult(title, result) {
  const p95 = result.latency?.p95 ?? 0
  const p99 = result.latency?.p99 ?? 0
  const avg = result.latency?.average ?? 0
  const errors = (result.errors || 0) + (result.non2xx || 0) + (result.timeouts || 0)

  console.log(`\n[${title}]`)
  console.log(`requests: ${result.requests.average.toFixed(2)}/s avg, ${result.requests.max}/s max`)
  console.log(`latency: avg ${avg.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, p99 ${p99.toFixed(2)} ms`)
  console.log(`throughput: ${(result.throughput.average / 1024).toFixed(2)} KB/s avg`)
  console.log(`errors: ${errors} (errors=${result.errors || 0}, non2xx=${result.non2xx || 0}, timeouts=${result.timeouts || 0})`)
}

async function runScenario(title, requests, token) {
  console.log(`\nRunning ${title}...`)
  const result = await autocannon({
    url: `${baseUrl}${requests[0].path}`,
    connections,
    duration,
    amount,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    requests: requests.map((request) => ({
      method: 'GET',
      path: request.path,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })),
  })

  printResult(title, result)
}

async function main() {
  ensureEnv()
  const token = await login()

  await runScenario('core-list', [
    { path: `/customers?page=${page}&pageSize=${pageSize}` },
    { path: `/legal/cases?page=${page}&pageSize=${pageSize}` },
    { path: `/second-sales/orders?page=${page}&pageSize=${pageSize}` },
    { path: `/third-sales/orders?page=${page}&pageSize=${pageSize}` },
  ], token)

  await runScenario('reports', [
    { path: `/reports/summary?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}` },
    { path: `/reports/first-sales/details?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&page=${page}&pageSize=${pageSize}` },
    { path: `/reports/second-sales/details?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&page=${page}&pageSize=${pageSize}` },
    { path: `/reports/third-sales/details?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&page=${page}&pageSize=${pageSize}` },
  ], token)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

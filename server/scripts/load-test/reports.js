import http from 'k6/http'
import { check, fail, group, sleep } from 'k6'

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || '5m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
}

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000'
const phone = __ENV.PHONE
const password = __ENV.PASSWORD
const startDate = __ENV.START_DATE || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const endDate = __ENV.END_DATE || new Date().toISOString()
const page = Number(__ENV.PAGE || 1)
const pageSize = Number(__ENV.PAGE_SIZE || 10)

function login() {
  if (!phone || !password) {
    fail('Missing PHONE or PASSWORD environment variables')
  }

  const response = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({ phone, password }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  check(response, {
    'login status is 201 or 200': (res) => res.status === 201 || res.status === 200,
    'login returns token': (res) => Boolean(res.json('token')),
  }) || fail(`Login failed: ${response.status} ${response.body}`)

  return response.json('token')
}

function query(path) {
  return `${baseUrl}${path}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&page=${page}&pageSize=${pageSize}`
}

export default function () {
  const token = login()
  const params = {
    headers: { Authorization: `Bearer ${token}` },
  }

  group('reports summary', () => {
    const res = http.get(`${baseUrl}/reports/summary?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`, params)
    check(res, { 'summary status is 200': (r) => r.status === 200 })
  })

  group('first sales details', () => {
    const res = http.get(query('/reports/first-sales/details'), params)
    check(res, { 'first sales details status is 200': (r) => r.status === 200 })
  })

  group('second sales details', () => {
    const res = http.get(query('/reports/second-sales/details'), params)
    check(res, { 'second sales details status is 200': (r) => r.status === 200 })
  })

  group('third sales details', () => {
    const res = http.get(query('/reports/third-sales/details'), params)
    check(res, { 'third sales details status is 200': (r) => r.status === 200 })
  })

  sleep(1)
}

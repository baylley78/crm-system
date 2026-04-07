import http from 'k6/http'
import { check, fail, group, sleep } from 'k6'

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || '5m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
}

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000'
const phone = __ENV.PHONE
const password = __ENV.PASSWORD
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

export default function () {
  const token = login()
  const params = {
    headers: { Authorization: `Bearer ${token}` },
  }

  group('customers list', () => {
    const res = http.get(`${baseUrl}/customers?page=${page}&pageSize=${pageSize}`, params)
    check(res, { 'customers status is 200': (r) => r.status === 200 })
  })

  group('legal list', () => {
    const res = http.get(`${baseUrl}/legal/cases?page=${page}&pageSize=${pageSize}`, params)
    check(res, { 'legal status is 200': (r) => r.status === 200 })
  })

  group('second sales orders', () => {
    const res = http.get(`${baseUrl}/second-sales/orders?page=${page}&pageSize=${pageSize}`, params)
    check(res, { 'second sales status is 200': (r) => r.status === 200 })
  })

  group('third sales orders', () => {
    const res = http.get(`${baseUrl}/third-sales/orders?page=${page}&pageSize=${pageSize}`, params)
    check(res, { 'third sales status is 200': (r) => r.status === 200 })
  })

  sleep(1)
}

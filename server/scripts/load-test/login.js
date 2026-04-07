import http from 'k6/http'
import { check, fail, sleep } from 'k6'

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '3m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
}

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000'
const phone = __ENV.PHONE
const password = __ENV.PASSWORD

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
  sleep(1)

  const meResponse = http.get(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  check(meResponse, {
    'me status is 200': (res) => res.status === 200,
  })

  sleep(1)
}

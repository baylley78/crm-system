import axios from 'axios'
import { authStorage } from '../auth'

const resolveApiBaseURL = () => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) {
    return configured
  }
  return import.meta.env.DEV ? '/api' : '/api'
}

const apiBaseURL = resolveApiBaseURL()

export const request = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
})

request.interceptors.request.use((config) => {
  const token = authStorage.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  timeout: 10000,
})

export const setupApiInterceptors = (store) => {
  apiClient.interceptors.request.use((config) => {
    const token = store.getState().auth.accessToken

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  })

  apiClient.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(error),
  )
}

export default apiClient

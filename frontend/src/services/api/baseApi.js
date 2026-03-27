import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth.accessToken

      if (token) {
        headers.set('authorization', `Bearer ${token}`)
      }

      return headers
    },
  }),
  tagTypes: ['Auth', 'Notifications'],
  endpoints: (builder) => ({
    getBackendHealth: builder.query({
      query: () => '/health',
    }),
  }),
})

export const { useGetBackendHealthQuery } = baseApi

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import apiClient from '../../services/api/client'

const AUTH_STORAGE_KEY = 'wa_saas_auth'

const getPersistedAuth = () => {
  const persisted = localStorage.getItem(AUTH_STORAGE_KEY)

  if (!persisted) {
    return { user: null, accessToken: null }
  }

  try {
    return JSON.parse(persisted)
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return { user: null, accessToken: null }
  }
}

const persistAuth = (authState) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState))
}

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/auth/login', credentials)
      return response.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to login. Please try again.',
      )
    }
  },
)

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/auth/me')
      return response.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Could not fetch user session.',
      )
    }
  },
)

const persistedAuth = getPersistedAuth()

const initialState = {
  user: persistedAuth.user,
  accessToken: persistedAuth.accessToken,
  status: 'idle',
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null
      state.accessToken = null
      state.status = 'idle'
      state.error = null
      localStorage.removeItem(AUTH_STORAGE_KEY)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'authenticated'
        state.user = action.payload.user
        state.accessToken = action.payload.accessToken
        state.error = null
        persistAuth({
          user: action.payload.user,
          accessToken: action.payload.accessToken,
        })
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.payload || 'Failed to login.'
      })
      .addCase(fetchCurrentUser.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.status = 'authenticated'
        state.user = action.payload.user
        state.error = null
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.payload || 'Session expired.'
      })
  },
})

export const { logout } = authSlice.actions

export default authSlice.reducer

import { createSlice, nanoid } from '@reduxjs/toolkit'

const initialState = {
  items: [],
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: {
      reducer: (state, action) => {
        state.items.unshift(action.payload)
      },
      prepare: ({ type = 'info', title, message }) => ({
        payload: {
          id: nanoid(),
          type,
          title,
          message,
          createdAt: new Date().toISOString(),
        },
      }),
    },
    removeNotification: (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.payload)
    },
    clearNotifications: (state) => {
      state.items = []
    },
  },
})

export const { addNotification, removeNotification, clearNotifications } =
  notificationsSlice.actions

export default notificationsSlice.reducer

import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit'
import toast from 'react-hot-toast'
import authReducer from '../features/auth/authSlice'
import notificationsReducer, {
  addNotification,
} from '../features/notifications/notificationsSlice'
import uiReducer from '../features/ui/uiSlice'
import { baseApi } from '../services/api/baseApi'
import { setupApiInterceptors } from '../services/api/client'

const notificationListener = createListenerMiddleware()

notificationListener.startListening({
  actionCreator: addNotification,
  effect: async (action) => {
    const { type, title, message } = action.payload
    const content = `${title}: ${message}`

    if (type === 'error') {
      toast.error(content)
      return
    }

    if (type === 'success') {
      toast.success(content)
      return
    }

    toast(content)
  },
})

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    notifications: notificationsReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      baseApi.middleware,
      notificationListener.middleware,
    ),
})

setupApiInterceptors(store)

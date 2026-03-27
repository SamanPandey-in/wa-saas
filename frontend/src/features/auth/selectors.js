export const selectAuth = (state) => state.auth
export const selectCurrentUser = (state) => state.auth.user
export const selectIsAuthenticated = (state) => Boolean(state.auth.accessToken)
export const selectAuthStatus = (state) => state.auth.status
export const selectAuthError = (state) => state.auth.error

status: in_progress
phase: 1
feature: Add automatic JWT token refresh in frontend
approach: Intercept 401 in api(), auto-refresh with stored refresh token, retry request, dedup concurrent refreshes
complexity: simple (2 files)

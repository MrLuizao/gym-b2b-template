export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, session } = useAuth();
  if (to.path === '/login') {
    return isAuthenticated.value
      ? navigateTo(homeFor(session.value?.role))
      : undefined;
  }
  if (!isAuthenticated.value) {
    return navigateTo('/login');
  }
  if (!canAccess(session.value?.role, to.path)) {
    return navigateTo(homeFor(session.value?.role));
  }
});

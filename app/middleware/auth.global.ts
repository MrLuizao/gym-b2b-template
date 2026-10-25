export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/api/')) {
    return;
  }
  const { isAuthenticated, session } = useAuth();
  if (to.path === '/login') {
    return isAuthenticated.value
      ? navigateTo(homeFor(session.value?.role))
      : undefined;
  }
  if (!isAuthenticated.value) {
    /// Públicas: documentos legales y la compra self-serve de publicidad.
    if (to.path.startsWith('/legal') || to.path.startsWith('/anuncia')) {
      return;
    }
    return navigateTo('/login');
  }
  if (!canAccess(session.value?.role, to.path)) {
    return navigateTo(homeFor(session.value?.role));
  }
});

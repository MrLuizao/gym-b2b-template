/// Inicializa el app de Firebase al arrancar para que $api encuentre la
/// sesión restaurada (getAuth requiere el app ya creado), y ata la cookie
/// de sesión al doc staff/{uid} en tiempo real.
export default defineNuxtPlugin(() => {
  useFirebase();
  useAuth().bindSessionToFirebase();
});

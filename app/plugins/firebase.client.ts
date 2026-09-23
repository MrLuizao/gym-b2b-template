/// Inicializa el app de Firebase al arrancar para que $api encuentre la
/// sesión restaurada (getAuth requiere el app ya creado).
export default defineNuxtPlugin(() => {
  useFirebase();
});

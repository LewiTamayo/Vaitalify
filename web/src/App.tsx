import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router';
import { Entrar } from './paginas/Entrar';
import { Hoy } from './paginas/Hoy';
import { Progreso } from './paginas/Progreso';
import { ProveedorSesion, useSesion } from './sesion/Sesion';

function Privado() {
  const { usuario, salir } = useSesion();
  if (!usuario) return <Navigate to="/entrar" replace />;
  return (
    <>
      <header className="cabecera">
        <div className="cabecera__interior">
          <span className="marca">Vitalify</span>
          <nav className="nav" aria-label="Principal">
            <NavLink to="/hoy">Hoy</NavLink>
            <NavLink to="/progreso">Progreso</NavLink>
          </nav>
          <button className="boton boton--texto" type="button" onClick={() => void salir()}>
            Salir
          </button>
        </div>
      </header>
      <main className="contenedor">
        <Outlet />
      </main>
    </>
  );
}

function Publico() {
  const { usuario } = useSesion();
  return usuario ? <Navigate to="/hoy" replace /> : <Entrar />;
}

export function App() {
  return (
    <ProveedorSesion>
      <Routes>
        <Route path="/entrar" element={<Publico />} />
        <Route element={<Privado />}>
          <Route path="/hoy" element={<Hoy />} />
          <Route path="/progreso" element={<Progreso />} />
        </Route>
        <Route path="*" element={<Navigate to="/hoy" replace />} />
      </Routes>
    </ProveedorSesion>
  );
}

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { guardarSesion, tokenAcceso, usuarioGuardado } from '../api/tokens';
import { json, llamada, llamadasA, mockRutas, problema, sesionDePrueba, vacio } from '../test/http';
import { renderApp } from '../test/render';

const hoyVacio = { 'GET /micro-pausas/hoy': json(200, []) };

describe('Entrar', () => {
  it('sin sesión, una ruta privada lleva a Entrar', async () => {
    renderApp('/progreso');
    expect(await screen.findByRole('heading', { name: 'Vitalify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('un login correcto guarda la sesión y lleva a Hoy', async () => {
    const fetchMock = mockRutas({
      'POST /auth/login': json(200, sesionDePrueba(1)),
      ...hoyVacio,
    });
    const { usuario } = renderApp('/entrar');
    await usuario.type(screen.getByLabelText('Correo'), 'ana@x.co');
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(llamada(fetchMock, 0).init.body).toBe('{"correo":"ana@x.co","contrasena":"secreta123"}');
    expect(tokenAcceso()).toBe('acceso-1');
    expect(usuarioGuardado()?.nombre).toBe('Ana');
  });

  it('credenciales inválidas muestran el mensaje de la API', async () => {
    mockRutas({ 'POST /auth/login': problema(401, { detail: 'Credenciales inválidas' }) });
    const { usuario } = renderApp('/entrar');
    await usuario.type(screen.getByLabelText('Correo'), 'ana@x.co');
    await usuario.type(screen.getByLabelText('Contraseña'), 'mala');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
    expect(tokenAcceso()).toBeNull();
  });

  it('el registro sin aceptar el tratamiento de datos no se envía', async () => {
    const fetchMock = mockRutas({});
    const { usuario } = renderApp('/entrar');
    await usuario.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Ana');
    await usuario.type(screen.getByLabelText('Correo'), 'ana@x.co');
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Debes autorizar el tratamiento de tus datos',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('los errores por campo del registro se muestran junto al campo', async () => {
    mockRutas({
      'POST /auth/registro': problema(400, {
        title: 'Datos inválidos',
        errors: [
          { campo: 'contrasena', mensaje: 'La contraseña debe tener al menos 8 caracteres' },
        ],
      }),
    });
    const { usuario } = renderApp('/entrar');
    await usuario.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Ana');
    await usuario.type(screen.getByLabelText('Correo'), 'ana@x.co');
    await usuario.type(screen.getByLabelText('Contraseña'), 'corta');
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText('La contraseña debe tener al menos 8 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true');
  });

  it('un registro correcto envía aceptaDatos y entra', async () => {
    const fetchMock = mockRutas({
      'POST /auth/registro': json(201, sesionDePrueba(1)),
      ...hoyVacio,
    });
    const { usuario } = renderApp('/entrar');
    await usuario.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Ana');
    await usuario.type(screen.getByLabelText('Correo'), 'ana@x.co');
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(JSON.parse(llamada(fetchMock, 0).init.body as string)).toEqual({
      nombre: 'Ana',
      correo: 'ana@x.co',
      contrasena: 'secreta123',
      aceptaDatos: true,
    });
  });

  it('Salir revoca el refresh token, limpia la sesión y vuelve a Entrar', async () => {
    guardarSesion(sesionDePrueba(1));
    const fetchMock = mockRutas({ ...hoyVacio, 'POST /auth/logout': vacio() });
    const { usuario } = renderApp('/hoy');
    await usuario.click(await screen.findByRole('button', { name: 'Salir' }));

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    const [logout] = llamadasA(fetchMock, 'POST', '/auth/logout');
    expect(logout?.[1]?.body).toBe('{"refreshToken":"refresh-1"}');
    expect(tokenAcceso()).toBeNull();
    expect(usuarioGuardado()).toBeNull();
  });

  it('Salir tras recargar la página renueva primero y revoca el refresh token vigente', async () => {
    // Tras recargar solo queda lo de sessionStorage: el token de acceso vivía en memoria.
    const { usuario: datos } = sesionDePrueba(1);
    sessionStorage.setItem(
      'vitalify.sesion',
      JSON.stringify({ usuario: datos, refreshToken: 'refresh-1' }),
    );
    const fetchMock = mockRutas({
      ...hoyVacio,
      'POST /auth/refresh': json(200, sesionDePrueba(2)),
      'POST /auth/logout': vacio(),
    });
    const { usuario } = renderApp('/hoy');
    await usuario.click(await screen.findByRole('button', { name: 'Salir' }));

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    const [logout] = llamadasA(fetchMock, 'POST', '/auth/logout');
    expect(logout?.[1]?.body).toBe('{"refreshToken":"refresh-2"}');
  });
});

<p align="center">
  <img src="logo.png" alt="TrainerExpert" width="250" />
</p>

# TrainerExpert

Simulador de entrevistas técnicas orales con IA. Web + PWA. Dictado por voz en el Simulador Oral.

## Uso en PC

```powershell
.\start.ps1
```

Abre `http://localhost:8080` (el micrófono en el PC funciona en localhost).

## Micrófono en el móvil (importante)

Chrome **bloquea el micrófono** en `http://192.168.x.x` (HTTP a una IP). No es un fallo de permisos de Android: hace falta **HTTPS**.

### Pasos

1. En el PC (solo la primera vez):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-certs.ps1
```

(`start.ps1` también lo genera solo si falta.)

2. Arranca el servidor (`.\start.ps1` o `node server.js`). Debe escuchar:
   - `http://localhost:8080`
   - `https://0.0.0.0:8443`

3. En el móvil (misma Wi‑Fi), abre:

```text
https://192.168.1.130:8443
```

(sustituye por tu IP; en el PC: `ipconfig`)

4. Chrome mostrará aviso de certificado. Pulsa **Avanzado** → **Continuar / Acceder al sitio** (es normal: certificado local).

5. Cuando Chrome pida el micrófono → **Permitir**.

6. Opcional: menú → Añadir a pantalla de inicio (PWA).

Si sigues en `http://192.168.1.130:8080`, el micrófono **no** funcionará aunque actives todos los permisos del sistema.

## Firewall Windows

Si `https://IP:8443` no carga desde el móvil, permite Node en el firewall (puertos 8080 y 8443) o crea una regla de entrada TCP.

## Apagar

**Apagar Aplicación** detiene el servidor Node (HTTP/HTTPS/proxy) e intenta cerrar **solo esta pestaña**. Ya no mata el navegador entero.

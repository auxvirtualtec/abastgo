---
description: "Cómo iniciar la aplicación AbastGo"
---
Para iniciar la aplicación y probar los cambios, tienes dos opciones principales:

### Opción 1: Modo Desarrollo (Recomendado)
Este modo es más rápido y te permite ver logs detallados.

1. Asegúrate de tener la base de datos corriendo.
2. Inicia el servidor de desarrollo:
```bash
npm run dev
```
3. Abre tu navegador en [http://localhost:3000](http://localhost:3000)

### Opción 2: Docker (Producción)
Si prefieres levantar todo el entorno con contenedores:

```bash
docker-compose up --build
```

### Verificación de Funcionalidades
Una vez la aplicación esté corriendo, sigue los pasos detallados en el archivo `walkthrough.md` para probar:
1.  **Dispensación con Copago:** Ve a `/dispensacion` y realiza una entrega seleccionando "Cuota Moderadora" o "Copago".
2.  **Reporte de Caja:** Ve a `/reportes` y genera el "Arqueo de Caja".

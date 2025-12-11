# Guía de Despliegue - AbastGo

Esta guía describe cómo desplegar AbastGo en un servidor Linux (Ubuntu/Debian) usando Docker (recomendado) o Node.js directo.

## Requisitos Previos

- Servidor Ubuntu 20.04+ o similar
- Dominio configurado (opcional pero recomendado)
- Docker y Docker Compose instalados OR Node.js 18+ y PostgreSQL instalados

## Opción 1: Despliegue con Docker (Recomendado)

Esta opción es la más sencilla ya que encapsula todo (App + Base de datos) en contenedores.

1. **Preparar el servidor**:
   Instala Docker y Docker Compose:
   ```bash
   sudo apt update
   sudo apt install docker.io docker-compose -y
   sudo usermod -aG docker $USER
   # (Cierra sesión y vuelve a entrar para aplicar cambios de grupo)
   ```

2. **Copiar archivos**:
   Copia los siguientes archivos al servidor (puedes usar scp o git clone):
   - `docker-compose.yml`
   - `Dockerfile`
   - `package.json`
   - `package-lock.json`
   - `prisma/` (carpeta completa)
   - `src/` (carpeta completa)
   - `public/` (carpeta completa)
   - `next.config.mjs`
   - `postcss.config.mjs`
   - `tailwind.config.ts`
   - `tsconfig.json`
   - `.env.production` (creado basado en .env.example)

3. **Configurar variables de entorno**:
   Crea un archivo `.env` en el servidor con tus credenciales de producción:
   ```env
   DATABASE_URL="postgresql://postgres:password@db:5432/abastgo?schema=public"
   NEXTAUTH_URL="http://tu-dominio.com"
   NEXTAUTH_SECRET="tu-secreto-super-seguro"
   # ... otras variables de integraciones
   ```

4. **Iniciar servicios**:
   ```bash
   docker-compose up -d --build
   ```

5. **Ejecutar migraciones**:
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

## Opción 2: Despliegue Manual (Node.js + PM2 + Nginx)

1. **Instalar dependencias**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs nginx postgresql postgresql-contrib
   sudo npm install -g pm2
   ```

2. **Configurar Base de Datos**:
   ```bash
   sudo -u postgres psql
   CREATE DATABASE abastgo;
   CREATE USER admin WITH ENCRYPTED PASSWORD 'tu_password';
   GRANT ALL PRIVILEGES ON DATABASE abastgo TO admin;
   \q
   ```

3. **Instalar y Construir App**:
   ```bash
   git clone <tu-repo> abastgo
   cd abastgo
   npm install
   
   # Configura .env con tus datos reales
   cp .env.example .env
   nano .env
   
   # Generar cliente prisma y migraciones
   npx prisma generate
   npx prisma migrate deploy
   
   # Construir
   npm run build
   ```

4. **Iniciar con PM2**:
   ```bash
   pm2 start npm --name "abastgo" -- start
   pm2 save
   pm2 startup
   ```

5. **Configurar Nginx (Reverse Proxy)**:
   Edita `/etc/nginx/sites-available/default`:
   ```nginx
   server {
       listen 80;
       server_name tu-dominio.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   Reinicia Nginx: `sudo systemctl restart nginx`

## Notas Importantes

- **Seguridad**: Asegúrate de tener `NEXTAUTH_SECRET` configurado con una cadena larga y aleatoria.
- **SSL**: Usa Certbot para HTTPS gratuito: `sudo apt install certbot python3-certbot-nginx` y luego `sudo certbot --nginx`.
- **Backups**: Configura backups periódicos de tu base de datos PostgreSQL.

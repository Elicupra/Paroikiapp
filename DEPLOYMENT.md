# Despliegue en Homelab - Guía Completa

Esta guía explica cómo desplegar Paroikiapp en un homelab local con Docker Compose, Nginx con SSL, y monitoreo de seguridad.

## Requisitos Previos

- Docker y Docker Compose instalados
- Dominio local o IP estática
- Certificado SSL (auto-firmado o Let's Encrypt)
- 4GB RAM mínimo, 10GB almacenamiento

## 1. Preparar el Servidor

### 1.1 Actualizar el sistema
```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y curl wget git nano
```

### 1.2 Instalar Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 1.3 Instalar Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 2. Clonar y Configurar el Proyecto

### 2.1 Clonar repositorio
```bash
cd /opt
sudo git clone <repo-url> paroikiapp
sudo chown -R $USER:$USER paroikiapp
cd paroikiapp
```

### 2.2 Crear archivos .env

#### backend/.env
```env
# Base de datos
DATABASE_URL=postgresql://camposter:camposter123@postgres:5432/campregister

# Auth - CAMBIAR ESTOS VALORES
JWT_SECRET=<generar-64-caracteres-aleatorios>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Email - Configurar con tu proveedor SMTP
SMTP_HOST=smtp.brevo.com
SMTP_PORT=587
SMTP_USER=tu_email@brevo.com
SMTP_PASS=<contraseña_app>
NOTIFY_FROM="Paroikiapp <noreply@tudominio.com>"

# Storage
UPLOADS_PATH=/data/uploads
MAX_FILE_SIZE=5242880

# App
NODE_ENV=production
FRONTEND_URL=https://tudominio.com
API_PORT=3001
```

### 2.3 Generar JWT_SECRET seguro
```bash
openssl rand -base64 48
```

## 3. Certificados SSL

### 3.1 Usando Let's Encrypt (Recomendado)
```bash
sudo apt-get install -y certbot python3-certbot-nginx

sudo certbot certonly --standalone -d tudominio.com -d www.tudominio.com
```

Los certificados se guardarán en `/etc/letsencrypt/live/tudominio.com/`

### 3.2 Crear certificados auto-firmados (Dev/Testing)
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /opt/paroikiapp/nginx/certs/private.key \
  -out /opt/paroikiapp/nginx/certs/certificate.crt \
  -subj "/C=ES/ST=Estado/L=Ciudad/O=Org/CN=tudominio.com"
```

### 3.3 Configurar Nginx con SSL
Editar `nginx/nginx.conf` y descomentar la sección HTTPS:

```nginx
# Redirigir HTTP a HTTPS
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;
    return 301 https://$host$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name tudominio.com www.tudominio.com;

    ssl_certificate /etc/nginx/certs/certificate.crt;
    ssl_certificate_key /etc/nginx/certs/private.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... resto de configuración
}
```

## 4. Despliegue

### 4.1 Iniciar servicios
```bash
cd /opt/paroikiapp
docker-compose build
docker-compose up -d
```

### 4.2 Ejecutar migraciones
```bash
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed  # Opcional: datos de prueba
```

### 4.3 Verificar estado
```bash
docker-compose ps
curl https://tudominio.com/health
```

## 5. Seguridad Adicional

### 5.1 Instalar Fail2Ban
```bash
sudo apt-get install -y fail2ban

# Copiar configuración de Nginx
sudo cp /opt/paroikiapp/fail2ban/jail.local /etc/fail2ban/jail.d/
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 5.2 Configurar Firewall
```bash
sudo apt-get install -y ufw

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable
```

### 5.3 Limpia periodica de logs
```bash
# Crear script de rotación
sudo nano /etc/logrotate.d/paroikiapp-docker

# Contenido:
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  missingok
  delaycompress
  copytruncate
}
```

## 6. Monitoreo y Mantenimiento

### 6.1 Logs
```bash
# Últimas 100 líneas
docker-compose logs --tail=100 backend

# En vivo
docker-compose logs -f
```

### 6.2 Backup automático de BD
```bash
#!/bin/bash
# backup-db.sh
BACKUP_DIR="/opt/paroikiapp/backups"
mkdir -p $BACKUP_DIR

docker-compose exec -T postgres pg_dump -U camposter campregister | \
  gzip > $BACKUP_DIR/campregister-$(date +%Y%m%d-%H%M%S).sql.gz

# Mantener solo los últimos 7 backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
```

Agregar a crontab:
```bash
crontab -e
# Ejecutar backup a las 2:00 AM diariamente
0 2 * * * /opt/paroikiapp/scripts/backup-db.sh
```

### 6.3 Monitoreo de recursos
```bash
docker stats
```

### 6.4 Actualizar certificado SSL (Let's Encrypt)
```bash
sudo certbot renew --nginx

# O automáticamente (ya incluido en sistemd timer)
sudo systemctl status certbot.timer
```

## 7. Resolución de Problemas

### Error 502 Bad Gateway
```bash
docker-compose logs backend
docker-compose restart backend
```

### Base de datos no responde
```bash
docker-compose exec postgres psql -U camposter -d campregister -c "SELECT 1"
docker-compose restart postgres
```

### Certificado SSL vencido
```bash
sudo certbot renew --force-renewal
docker-compose restart nginx
```

### Limpiar espacio en disco
```bash
docker system prune -a --volumes
```

## 8. Escalabilidad

### Aumentar recursos
En `docker-compose.yml`, agregar:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 512M
```

### Réplicas del backend
```yaml
version: '3.8'
services:
  backend:
    deploy:
      replicas: 3
```

Actualizar Nginx upstream:
```nginx
upstream backend {
    server backend:3001;
    server backend_2:3001;
    server backend_3:3001;
}
```

## 9. Checklist Final

- [ ] Certificados SSL configurados
- [ ] Variables de entorno configuradas (.env)
- [ ] Base de datos migrada y con datos iniciales
- [ ] Firewall habilitado
- [ ] Fail2Ban activo
- [ ] Backup automático configurado
- [ ] Nginx escuchando en puerto 80 y 443
- [ ] Health check pasando en `/health`
- [ ] Emails de notificación funcionando
- [ ] Rate limiting activo
- [ ] Logs monitoreados

## Referencias

- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Nginx SSL Config](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
- [Let's Encrypt](https://letsencrypt.org/)
- [Fail2Ban](https://www.fail2ban.org/)

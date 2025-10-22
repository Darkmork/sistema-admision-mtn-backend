# Configuración SMTP para Notification Service en Railway

## Variables de Entorno Requeridas

Para que el notification-service envíe emails correctamente, necesitas configurar estas variables en Railway:

### 1. Modo de Operación

```bash
EMAIL_MOCK_MODE=false
```
- `true`: Solo logea los emails sin enviarlos (para desarrollo/testing)
- `false`: Envía emails reales vía SMTP (para producción)

### 2. Configuración SMTP

#### Opción A: Gmail (Recomendado para testing)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
```

**IMPORTANTE para Gmail:**
- NO uses tu contraseña normal de Gmail
- Debes generar un "App Password":
  1. Ve a tu cuenta de Google → Seguridad
  2. Activa "Verificación en 2 pasos" (si no la tienes)
  3. Ve a "Contraseñas de aplicaciones"
  4. Genera una contraseña para "Correo"
  5. Usa esa contraseña de 16 caracteres en `SMTP_PASSWORD`

#### Opción B: SendGrid (Recomendado para producción)

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=tu-sendgrid-api-key
```

#### Opción C: AWS SES

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-ses-access-key
SMTP_PASSWORD=tu-ses-secret-key
```

#### Opción D: Mailgun

```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@tu-dominio.mailgun.org
SMTP_PASSWORD=tu-mailgun-password
```

## Cómo Configurar en Railway

### Método 1: Railway Dashboard (Recomendado)

1. Ve a tu proyecto en Railway
2. Selecciona el servicio `notification-service`
3. Ve a la pestaña "Variables"
4. Agrega cada variable con su valor:
   - Click en "New Variable"
   - Nombre: `EMAIL_MOCK_MODE`
   - Valor: `false`
   - Repeat para cada variable

### Método 2: Railway CLI

```bash
# Login a Railway
railway login

# Link al proyecto
railway link

# Agregar variables (ejemplo con Gmail)
railway variables set EMAIL_MOCK_MODE=false
railway variables set SMTP_HOST=smtp.gmail.com
railway variables set SMTP_PORT=587
railway variables set SMTP_SECURE=false
railway variables set SMTP_USER=tu-email@gmail.com
railway variables set SMTP_PASSWORD=tu-app-password
```

## Verificación

Después de configurar las variables:

1. Railway redesplegará automáticamente el servicio
2. Verifica los logs del servicio:
   ```bash
   railway logs
   ```
3. Deberías ver uno de estos mensajes:
   - ✅ `Email transport configured successfully` (SMTP configurado correctamente)
   - ❌ `Email transport verification failed` (credenciales incorrectas)
   - ℹ️ `Email transport configured in MOCK mode` (modo mock activado)

## Testing

Para probar el envío de emails:

1. Desde el frontend, intenta enviar un código de verificación
2. Revisa los logs del notification-service en Railway:
   ```bash
   railway logs -s notification-service
   ```
3. Busca líneas como:
   - `Verification code sent to <email>` (éxito)
   - `Error sending verification email:` (error)

## Troubleshooting

### Error: "Invalid login: 535 Authentication failed"
- **Gmail**: Verifica que usas un App Password, no tu contraseña normal
- **Otros**: Verifica usuario y contraseña

### Error: "ETIMEDOUT" o "Connection timeout"
- Verifica que `SMTP_HOST` y `SMTP_PORT` son correctos
- Railway puede tener bloqueados algunos puertos (prueba 587 o 465)

### Error: "self signed certificate"
- Cambia `SMTP_SECURE=true` a `SMTP_SECURE=false`
- O usa puerto 587 en vez de 465

### Los emails no llegan
- Revisa la carpeta de spam/correo no deseado
- Verifica que el email del remitente esté verificado (SendGrid, AWS SES requieren esto)
- Revisa los logs para confirmar que se envió sin errores

## Configuración de Desarrollo Local

Para desarrollo local, crea un archivo `.env` en `notification-service/`:

```bash
# .env (notification-service)
EMAIL_MOCK_MODE=true  # o false para testing real
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
```

**Nota**: El archivo `.env` está en `.gitignore` - nunca lo commitees al repositorio.

## Recomendaciones de Seguridad

1. ✅ Usa App Passwords en vez de contraseñas reales
2. ✅ Rota las credenciales SMTP cada 3-6 meses
3. ✅ Usa servicios SMTP profesionales (SendGrid, Mailgun) en producción
4. ✅ No commitees credenciales al repositorio
5. ✅ Configura SPF, DKIM, DMARC en tu dominio para evitar que los emails vayan a spam

## Estado Actual

- ✅ Endpoint `/api/email/send-verification` funciona
- ✅ CORS configurado correctamente
- ⚠️ SMTP no configurado en Railway (emails no se envían)
- 📝 Acción requerida: Configurar variables SMTP en Railway

## Próximos Pasos

1. Decide qué servicio SMTP usar (Gmail para testing, SendGrid para producción)
2. Obtén las credenciales SMTP
3. Configura las variables en Railway
4. Verifica los logs después del redespliegue
5. Prueba enviando un código de verificación desde el frontend

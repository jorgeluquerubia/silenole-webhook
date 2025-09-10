# SileNole WhatsApp Bot - Webhook

WhatsApp bot con integración completa a Supabase para el proyecto SileNole.

## Funcionalidades

✅ **Comandos del bot:**
- `@silenole ayuda` - Muestra ayuda
- `@silenole abrir sobre` - Abre un sobre de 5 cromos (cooldown 24h)
- `@silenole ver album` - Genera magic link para ver la colección

✅ **Sistema completo:**
- Creación automática de usuarios por número de teléfono
- Sistema de rareza con distribución: 70% común, 20% raro, 8% épico, 2% legendario
- Actualización de inventario en base de datos
- Cooldown de 24 horas entre sobres
- Magic links para acceso temporal a la web
- Manejo robusto de errores

## Variables de entorno requeridas

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
WA_TOKEN=your_whatsapp_business_token
```

## Deploy

1. Crear proyecto en Deno Deploy
2. Conectar con este repositorio
3. Configurar las variables de entorno
4. Actualizar webhook URL en Meta Business

## Webhook URL

Una vez deployado, usar la URL para configurar el webhook en Meta:
`https://your-project.deno.dev`

Verify token: `silenole_verify_token_2025`

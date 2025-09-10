// WhatsApp Bot con integración real a Supabase - SileNole
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuración
const SUPABASE_URL = 'https://vwkoqdyrirgvtcyyxmxy.supabase.co';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const WA_TOKEN = Deno.env.get('WA_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = '836611039527020';

// Validar variables de entorno
if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}
if (!WA_TOKEN) {
  console.error('❌ Missing WA_TOKEN environment variable');
  throw new Error('Missing WA_TOKEN environment variable');
}

console.log('✅ Environment variables loaded successfully');
console.log('📊 Service Role Key length:', SERVICE_ROLE_KEY?.length);
console.log('📊 WA Token length:', WA_TOKEN?.length);

// Inicializar Supabase con Service Role Key para saltarse RLS
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // Verificación del webhook (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    console.log('🔍 Webhook verification attempt:', { mode, token, challenge });
    
    if (mode === 'subscribe' && token === 'silenole_verify_token_2025') {
      console.log('✅ Webhook verified successfully!');
      return new Response(challenge, { status: 200 });
    }
    console.log('❌ Webhook verification failed!');
    return new Response('Forbidden', { status: 403 });
  }
  
  // Mensajes (POST)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('📨 Received webhook:', JSON.stringify(body, null, 2));
      
      // Verificar que es WhatsApp
      if (body.object !== 'whatsapp_business_account') {
        console.log('⚠️ Not a WhatsApp webhook, ignoring');
        return new Response('OK', { status: 200 });
      }
      
      const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
      if (!messages) {
        console.log('⚠️ No messages found in webhook');
        return new Response('OK', { status: 200 });
      }
      
      // Procesar cada mensaje
      for (const message of messages) {
        await processMessage(message);
      }
      
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      return new Response('Error', { status: 500 });
    }
  }
  
  return new Response('Method not allowed', { status: 405 });
});

async function processMessage(message) {
  const fromNumber = message.from;
  const messageText = message.text?.body?.toLowerCase().trim();
  
  // Solo procesar mensajes de bot
  if (!messageText?.includes('@silenole')) {
    console.log('⚠️ Message does not contain @silenole, ignoring');
    return;
  }
  
  console.log(`🤖 Processing: "${messageText}" from ${fromNumber}`);
  
  try {
    // Obtener o crear usuario
    const user = await getOrCreateUser(fromNumber);
    console.log(`👤 User: ${user.username} (ID: ${user.id})`);
    
    // Procesar comandos
    if (messageText.includes('ayuda')) {
      await handleHelp(fromNumber);
    } else if (messageText.includes('abrir sobre')) {
      await handleOpenPack(user, fromNumber);
    } else if (messageText.includes('ver album')) {
      await handleViewAlbum(user, fromNumber);
    } else {
      await sendWhatsAppMessage(fromNumber, '🤖 Comando no reconocido. Escribe "@silenole ayuda" para ver los comandos disponibles.');
    }
  } catch (error) {
    console.error('❌ Error processing message:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      fromNumber,
      messageText
    });
    await sendWhatsAppMessage(fromNumber, '❌ Hubo un error procesando tu mensaje. Inténtalo más tarde.');
  }
}

async function getOrCreateUser(phoneNumber) {
  console.log(`👤 Getting or creating user for: ${phoneNumber}`);
  
  try {
    // Usar upsert para crear o obtener usuario existente
    const username = `Usuario${phoneNumber.slice(-4)}`;
    
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          phone_number: phoneNumber,
          username: username,
          user_type: 'whatsapp'
        },
        {
          onConflict: 'phone_number',
          ignoreDuplicates: false
        }
      )
      .select()
      .single();
      
    if (error) {
      console.error('❌ Error in upsert user:', error);
      throw new Error(`Failed to upsert user: ${error.message}`);
    }
    
    if (data) {
      console.log(`✅ Got/created user: ${data.username} (ID: ${data.id})`);
      return data;
    }
    
    throw new Error('No data returned from upsert');
    
  } catch (error) {
    console.error('❌ Error in getOrCreateUser:', error);
    throw error;
  }
}

async function handleHelp(phoneNumber) {
  const helpMessage = `🤖 *SileNole Bot - Comandos disponibles:*

📦 *@silenole abrir sobre* - Abre un sobre de cromos (1 por día)
📖 *@silenole ver album* - Ve tu colección completa  
❓ *@silenole ayuda* - Muestra esta ayuda

🎯 ¡Colecciona todos los cromos de La Liga 2024-25!`;
  
  console.log('📤 Sending help message');
  await sendWhatsAppMessage(phoneNumber, helpMessage);
}

async function handleOpenPack(user, phoneNumber) {
  try {
    console.log(`📦 Opening pack for user ${user.username}`);
    
    // Verificar cooldown de 24 horas
    if (user.last_pack_opened_at) {
      const lastOpened = new Date(user.last_pack_opened_at);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastOpened.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        const hoursRemaining = Math.ceil(24 - hoursDiff);
        console.log(`⏰ User in cooldown: ${hoursRemaining} hours remaining`);
        await sendWhatsAppMessage(phoneNumber, `⏰ Debes esperar ${hoursRemaining} horas antes de abrir otro sobre. ¡La espera vale la pena! 📦✨`);
        return;
      }
    }
    
    // Obtener todos los cromos disponibles
    const { data: allStickers, error: stickersError } = await supabase
      .from('stickers')
      .select('id, rarity');
      
    if (stickersError) {
      console.error('❌ Error fetching stickers:', stickersError);
      throw new Error(`Failed to fetch stickers: ${stickersError.message}`);
    }
      
    if (!allStickers || allStickers.length === 0) {
      console.log('❌ No stickers available');
      await sendWhatsAppMessage(phoneNumber, '❌ No hay cromos disponibles en este momento.');
      return;
    }
    
    console.log(`🃏 Found ${allStickers.length} stickers available`);
    
    // Generar 5 cromos aleatorios con rareza
    const packStickers = [];
    for (let i = 0; i < 5; i++) {
      const randomSticker = getRandomStickerByRarity(allStickers);
      packStickers.push(randomSticker);
    }
    
    console.log(`🎲 Generated pack: ${packStickers.join(', ')}`);
    
    // Actualizar inventario del usuario
    for (const stickerId of packStickers) {
      const { data: existingSticker, error: selectError } = await supabase
        .from('user_stickers')
        .select('quantity')
        .eq('user_id', user.id)
        .eq('sticker_id', stickerId)
        .single();
        
      if (selectError && selectError.code !== 'PGRST116') {
        console.error('❌ Error checking existing sticker:', selectError);
        throw new Error(`Database error: ${selectError.message}`);
      }
        
      if (existingSticker) {
        const { error: updateError } = await supabase
          .from('user_stickers')
          .update({ quantity: existingSticker.quantity + 1 })
          .eq('user_id', user.id)
          .eq('sticker_id', stickerId);
          
        if (updateError) {
          console.error('❌ Error updating sticker quantity:', updateError);
          throw new Error(`Failed to update sticker: ${updateError.message}`);
        }
        console.log(`➕ Updated sticker ${stickerId} to quantity ${existingSticker.quantity + 1}`);
      } else {
        const { error: insertError } = await supabase
          .from('user_stickers')
          .insert({
            user_id: user.id,
            sticker_id: stickerId,
            quantity: 1
          });
          
        if (insertError) {
          console.error('❌ Error inserting new sticker:', insertError);
          throw new Error(`Failed to insert sticker: ${insertError.message}`);
        }
        console.log(`🆕 Added new sticker ${stickerId}`);
      }
    }
    
    // Actualizar último sobre abierto
    const { error: updateUserError } = await supabase
      .from('profiles')
      .update({ last_pack_opened_at: new Date().toISOString() })
      .eq('id', user.id);
      
    if (updateUserError) {
      console.error('❌ Error updating last_pack_opened_at:', updateUserError);
      throw new Error(`Failed to update user: ${updateUserError.message}`);
    }
      
    console.log(`📅 Updated last_pack_opened_at for user ${user.id}`);
      
    // Obtener información de los cromos obtenidos
    const { data: obtainedStickers, error: detailsError } = await supabase
      .from('stickers')
      .select('player_name, team, rarity')
      .in('id', packStickers);
      
    if (detailsError) {
      console.error('❌ Error fetching sticker details:', detailsError);
      throw new Error(`Failed to fetch sticker details: ${detailsError.message}`);
    }
      
    console.log(`🃏 Got sticker details:`, obtainedStickers);
      
    // Crear mensaje de respuesta
    let message = `🎉 ¡${user.username} ha abierto un sobre!

📦 *Cromos obtenidos:*
`;
    
    obtainedStickers?.forEach((sticker) => {
      const rarityEmoji = {
        'common': '⚪',
        'rare': '🟡',
        'epic': '🟣',
        'legendary': '🟠'
      };
      message += `${rarityEmoji[sticker.rarity] || '⚪'} ${sticker.player_name} (${sticker.team})
`;
    });
    
    message += `
✨ ¡Próximo sobre disponible en 24 horas!`;
    
    console.log('📤 Sending pack results to user');
    await sendWhatsAppMessage(phoneNumber, message);
    
  } catch (error) {
    console.error('❌ Error opening pack:', error);
    await sendWhatsAppMessage(phoneNumber, '❌ Error al abrir el sobre. Inténtalo más tarde.');
  }
}

async function handleViewAlbum(user, phoneNumber) {
  try {
    console.log(`📖 Generating album link for user ${user.username}`);
    
    // Generar magic link
    const magicToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    
    const { error } = await supabase
      .from('magic_links')
      .insert({
        token: magicToken,
        user_id: user.id,
        expires_at: expiresAt.toISOString()
      });
      
    if (error) {
      console.error('❌ Error creating magic link:', error);
      throw new Error(`Failed to create magic link: ${error.message}`);
    }
    
    const magicUrl = `https://silenole.vercel.app/auth/token?token=${magicToken}`;
    console.log(`🔗 Generated magic link: ${magicUrl}`);
    
    const message = `📖 *Tu álbum personalizado*

🔗 Haz clic aquí para ver tu colección:
${magicUrl}

⚠️ Este enlace expira en 10 minutos y solo puede usarse una vez.`;
    
    await sendWhatsAppMessage(phoneNumber, message);
  } catch (error) {
    console.error('❌ Error generating album link:', error);
    await sendWhatsAppMessage(phoneNumber, '❌ Error al generar el enlace del álbum.');
  }
}

function getRandomStickerByRarity(stickers) {
  const rarityWeights = {
    'common': 70,
    'rare': 20,
    'epic': 8,
    'legendary': 2
  };
  
  // Crear array con pesos
  const weightedStickers = [];
  for (const sticker of stickers) {
    const weight = rarityWeights[sticker.rarity] || rarityWeights.common;
    for (let i = 0; i < weight; i++) {
      weightedStickers.push(sticker.id);
    }
  }
  
  // Seleccionar aleatoriamente
  const randomIndex = Math.floor(Math.random() * weightedStickers.length);
  return weightedStickers[randomIndex];
}

async function sendWhatsAppMessage(toNumber, message) {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  console.log(`📤 Sending WhatsApp message to ${toNumber}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'text',
        text: { body: message }
      })
    });
    
    const result = await response.text();
    
    if (response.ok) {
      console.log(`✅ Message sent successfully to ${toNumber}`);
    } else {
      console.error(`❌ WhatsApp API error: ${response.status} - ${result}`);
    }
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
  }
}

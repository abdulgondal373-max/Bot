const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const express = require('express');

// --- SERVEUR WEB (Pour Render) ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('AKH Surveillance + Anti-Spam Actif'));
app.listen(port, () => console.log(`Serveur Web sur le port ${port}`));

// --- CONFIGURATION ---
const MON_ID = "744871541715632138"; 
const LIEN_TELEGRAM = "https://t.me/+utGMq_cWFRplMTI0";
const LIEN_SITE = "https://akhtv.online";

let blacklist = new Set();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMessages
    ],
    partials: [Partials.Channel]
});

// --- ÉTAT DU BOT ---
client.once('ready', () => {
    client.user.setActivity('DM pour le lien', { type: ActivityType.Watching });
    console.log(`✅ CONNECTÉ : ${client.user.tag} est prêt !`);
});

// --- GESTION DES MESSAGES ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- COMMANDES ADMINISTRATEUR (TOI UNIQUEMENT) ---
    if (message.author.id === MON_ID) {
        
        // Bloquer un utilisateur
        if (message.content.startsWith('!bloquer')) {
            const idCible = message.content.split(' ')[1];
            if (idCible) {
                blacklist.add(idCible);
                await message.reply(`🚫 L'utilisateur \`${idCible}\` est blacklisté.`);
            }
            return;
        }

        // Débloquer un utilisateur
        if (message.content.startsWith('!debloquer')) {
            const idCible = message.content.split(' ')[1];
            if (idCible) {
                blacklist.delete(idCible);
                await message.reply(`✅ L'utilisateur \`${idCible}\` est débloqué.`);
            }
            return;
        }

        // Commande !dire (Envoi ou Réponse)
        if (message.content.startsWith('!dire')) {
            const args = message.content.split(' ');
            const cibleId = args[1];
            const secondArg = args[2];
            const attachments = message.attachments.map(a => a.url);

            try {
                // On cherche si c'est un salon ou un utilisateur
                const cible = await client.channels.fetch(cibleId).catch(() => client.users.fetch(cibleId));
                
                // Si le 2ème argument est un ID de message, on répond à ce message
                if (secondArg && /^\d{17,20}$/.test(secondArg)) {
                    const texte = args.slice(3).join(' ');
                    const msgCible = await cible.messages.fetch(secondArg);
                    await msgCible.reply({ content: texte || null, files: attachments });
                    await message.reply("✅ Réponse envoyée");
                } else {
                    // Sinon, on envoie un message simple
                    const texte = args.slice(2).join(' ');
                    await cible.send({ content: texte || null, files: attachments });
                    await message.reply("✅ Message envoyé");
                }
            } catch (e) { 
                await message.reply("❌ Erreur : ID invalide ou DM fermés."); 
            }
            return;
        }
    }

    // --- GESTION DES DMs CLIENTS ---
    if (!message.guild) {
        // 1. Forward du message vers tes DMs pour surveillance
        try {
            const moi = await client.users.fetch(MON_ID);
            await moi.send(`📩 **Message de ${message.author.tag}** (\`${message.author.id}\`) :\n> ${message.content}`);
        } catch (e) { console.log("Erreur de transfert vers l'admin"); }

        // 2. Vérification Anti-Spam (Blacklist)
        if (blacklist.has(message.author.id)) {
            console.log(`Spam bloqué pour : ${message.author.tag}`);
            return;
        }

        // 3. Envoi de la réponse automatique avec les liens (CORRIGÉ)
        try {
            const messageAffiche = `**AKH TV — TON STREAMING ICI** ⚡

🌐 **Site Officiel :** https://akhtv.online

📢 **Rejoindre la communauté :**
* **Telegram (Secours) :** https://t.me/+utGMq_cWFRplMTI0
* **Twitter (News) :** https://x.com/abdul_37300?s=21

🏁 *Ne rate aucun match !*`;

// Exemple pour l'envoyer dans un salon :
message.channel.send(messageAffiche);

        } catch (e) {
            console.log(`Impossible de répondre à ${message.author.tag} (DMs fermés)`);
        }
    }
});

// --- LANCEMENT ---
client.login(process.env.TOKEN).catch(err => {
    console.error("❌ Erreur de connexion Discord :", err.message);
});

const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const express = require('express');

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('AKH Surveillance + Anti-Spam'));
app.listen(port);

const MON_ID = "744871541715632138"; 
const LIEN_TELEGRAM = "https://t.me/+utGMq_cWFRplMTI0";

// Liste des IDs bloqués (elle se vide si le bot redémarre)
let blacklist = new Set();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages
    ],
    partials: [Partials.Channel]
});

client.once('ready', () => {
    client.user.setActivity('DM pour le lien', { type: ActivityType.Watching });
    console.log("Bot AKH prêt avec système anti-spam !");
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- COMMANDES ADMINISTRATEUR (TOI) ---
    if (message.author.id === MON_ID) {
        
        // Commande pour BLOQUER le lien auto
        if (message.content.startsWith('!bloquer')) {
            const idCible = message.content.split(' ')[1];
            if (idCible) {
                blacklist.add(idCible);
                await message.reply(`🚫 L'utilisateur \`${idCible}\` ne recevra plus le lien automatique.`);
            }
            return;
        }

        // Commande pour DÉBLOQUER
        if (message.content.startsWith('!debloquer')) {
            const idCible = message.content.split(' ')[1];
            if (idCible) {
                blacklist.delete(idCible);
                await message.reply(`✅ L'utilisateur \`${idCible}\` peut de nouveau recevoir le lien.`);
            }
            return;
        }

        // Commande !dire (Toujours fonctionnelle même si bloqué)
        if (message.content.startsWith('!dire')) {
            const args = message.content.split(' ');
            const cibleId = args[1];
            const secondArg = args[2];
            const attachments = message.attachments.map(a => a.url);

            try {
                const cible = await client.channels.fetch(cibleId).catch(() => client.users.fetch(cibleId));
                if (secondArg && /^\d{17,19}$/.test(secondArg)) {
                    const texte = args.slice(3).join(' ');
                    const msgCible = await cible.messages.fetch(secondArg);
                    await msgCible.reply({ content: texte || null, files: attachments });
                    await message.reply("✅ Réponse envoyée");
                } else {
                    const texte = args.slice(2).join(' ');
                    await cible.send({ content: texte || null, files: attachments });
                    await message.reply("✅ Message envoyé");
                }
            } catch (e) { await message.reply("❌ Erreur ID."); }
            return;
        }
    }

    // --- GESTION DES DMs CLIENTS ---
    if (!message.guild) {
        // 1. Tu reçois toujours le message pour voir ce qu'il dit
        try {
            const moi = await client.users.fetch(MON_ID);
            await moi.send(`📩 **Message de ${message.author.tag}** (\`${message.author.id}\`) :\n> ${message.content}`);
        } catch (e) { console.log("Erreur transfert"); }

        // 2. On vérifie s'il est dans la blacklist avant d'envoyer le lien
        if (blacklist.has(message.author.id)) {
            console.log(`Spam évité pour : ${message.author.tag}`);
            return; // On s'arrête là, le lien n'est pas envoyé
        }

        // 3. Envoi du lien automatique (si pas bloqué)
        await message.author.send(`Salut, tiens le lien pour les matchs ➡️ ${LIEN_TELEGRAM}`);
    }
});

client.login(process.env.TOKEN);

const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActivityType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField 
} = require('discord.js');
const express = require('express');

// --- SERVEUR WEB (Pour Render / Koyeb) ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('AKH Surveillance + Tickets Actifs'));
app.listen(port, () => console.log(`Serveur Web sur le port ${port}`));

// --- CONFIGURATION ---
const MON_ID = "744871541715632138"; // Ton ID
const ID_SALON_CONFIG = "1486834918054035646"; // Salon où tu écris le message auto

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
    client.user.setActivity('DM pour le lien | Tickets', { type: ActivityType.Watching });
    console.log(`✅ CONNECTÉ : ${client.user.tag} est prêt !`);
});

// --- GESTION DES MESSAGES (Commandes et DMs) ---
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
                const cible = await client.channels.fetch(cibleId).catch(() => client.users.fetch(cibleId));
                
                if (secondArg && /^\d{17,20}$/.test(secondArg)) {
                    const texte = args.slice(3).join(' ');
                    const msgCible = await cible.messages.fetch(secondArg);
                    await msgCible.reply({ content: texte || null, files: attachments });
                    await message.reply("✅ Réponse envoyée");
                } else {
                    const texte = args.slice(2).join(' ');
                    await cible.send({ content: texte || null, files: attachments });
                    await message.reply("✅ Message envoyé");
                }
            } catch (e) { 
                await message.reply("❌ Erreur : ID invalide ou DM fermés."); 
            }
            return;
        }

        // --- NOUVEAU : COMMANDE CRÉATION DE PANEL TICKET ---
        // Exemple : !setup-ticket 123456789012345678 Clique ici pour acheter
        if (message.content.startsWith('!setup-ticket')) {
            const args = message.content.split(' ');
            const categoryId = args[1];
            const textePanel = args.slice(2).join(' ') || "📩 **Besoin d'aide ?**\nClique sur le bouton ci-dessous pour ouvrir un ticket.";

            if (!categoryId || isNaN(categoryId)) {
                return message.reply("❌ Précise l'ID de la catégorie. Exemple : `!setup-ticket 1234567890 Ton texte ici`");
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        // On cache l'ID de la catégorie directement dans le bouton !
                        .setCustomId(`create_ticket_${categoryId}`)
                        .setLabel('📩 Créer un ticket')
                        .setStyle(ButtonStyle.Success)
                );

            await message.channel.send({ content: textePanel, components: [row] });
            await message.delete(); // Supprime ta commande pour faire propre
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

        // 3. Envoi de la réponse automatique (DYNAMIQUE)
        try {
            const configChannel = await client.channels.fetch(ID_SALON_CONFIG);
            const messages = await configChannel.messages.fetch({ limit: 1 });
            const dernierMessage = messages.first();

            if (dernierMessage && dernierMessage.content) {
                await message.author.send(dernierMessage.content);
            } else {
                await message.author.send("Bienvenue ! Le service est en cours de mise à jour. Merci de patienter.");
            }
        } catch (e) {
            console.log(`Impossible de répondre à ${message.author.tag} (DMs fermés)`);
        }
    }
});

// --- ÉCOUTE DES BOUTONS (POUR LES TICKETS) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // 1. Si on clique sur "Créer un ticket"
    if (interaction.customId.startsWith('create_ticket_')) {
        const categoryId = interaction.customId.split('_')[2];

        await interaction.reply({ content: "⏳ Création de ton ticket en cours...", ephemeral: true });

        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id, // Bloque la vue pour tout le monde
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: interaction.user.id, // Autorise uniquement le viewer
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: client.user.id, // Autorise le bot
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    }
                ],
            });

            const closeRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Fermer le ticket')
                        .setStyle(ButtonStyle.Danger)
                );

            await ticketChannel.send({
                content: `Bienvenue dans ton ticket <@${interaction.user.id}> ! Explique-nous ta demande en détail, un admin va te répondre très vite.`,
                components: [closeRow]
            });

            await interaction.editReply(`✅ Ton ticket a été créé avec succès : <#${ticketChannel.id}>`);
        } catch (e) {
            console.error(e);
            await interaction.editReply("❌ Erreur. Vérifie que l'ID de la catégorie est bon et que j'ai les permissions d'administrateur.");
        }
    }

    // 2. Si on clique sur "Fermer le ticket"
    if (interaction.customId === 'close_ticket') {
        // Seuls les admins ou le créateur du ticket devraient pouvoir fermer (là tout le monde peut s'ils ont accès au salon)
        await interaction.reply("🔒 Le ticket va être fermé et supprimé dans 5 secondes...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

// --- LANCEMENT ---
client.login(process.env.TOKEN).catch(err => {
    console.error("❌ Erreur de connexion Discord :", err.message);
});

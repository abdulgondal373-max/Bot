const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActivityType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField,
    EmbedBuilder,
    SlashCommandBuilder, 
    REST,                
    Routes
} = require('discord.js');
const express = require('express');

// --- SERVEUR WEB (Pour Render / Koyeb) ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('AKH Surveillance + Tickets + Slash Commands Actifs'));
app.listen(port, () => console.log(`Serveur Web sur le port ${port}`));

// --- CONFIGURATION ---
const MON_ID = "744871541715632138"; // Ton ID
const ID_ROLE_ADMIN = "1491543740211400906"; // Le rôle de tes modérateurs
const ID_SALON_CONFIG = "1486834918054035646"; // Salon du message auto
const ID_SALON_LOG_TICKET = "1491546290520195072"; // 🔴 TON SALON DE LOGS TICKETS

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

// --- DÉCLARATION DES SLASH COMMANDES (/) ---
const commands = [
    new SlashCommandBuilder()
        .setName('bloquer')
        .setDescription('🚫 Bloque un utilisateur pour l\'anti-spam')
        .addStringOption(opt => opt.setName('id').setDescription('ID de l\'utilisateur à bloquer').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('debloquer')
        .setDescription('✅ Débloque un utilisateur')
        .addStringOption(opt => opt.setName('id').setDescription('ID de l\'utilisateur à débloquer').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('dire')
        .setDescription('🗣️ Envoie un message avec le bot')
        .addStringOption(opt => opt.setName('cible').setDescription('ID du salon ou de l\'utilisateur').setRequired(true))
        .addStringOption(opt => opt.setName('texte').setDescription('Le message à envoyer').setRequired(false))
        .addStringOption(opt => opt.setName('message_id').setDescription('ID du message pour répondre (optionnel)').setRequired(false))
        .addAttachmentOption(opt => opt.setName('fichier').setDescription('Joindre une image/fichier').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('📩 Crée le bouton d\'ouverture de ticket')
        .addStringOption(opt => opt.setName('categorie_id').setDescription('ID de la catégorie des tickets').setRequired(true))
        .addStringOption(opt => opt.setName('texte').setDescription('Texte au-dessus du bouton').setRequired(false))
].map(cmd => cmd.toJSON());

// --- ÉTAT DU BOT ET CHARGEMENT DES COMMANDES ---
client.once('ready', async () => {
    client.user.setActivity('DM pour le lien | Tickets', { type: ActivityType.Watching });
    console.log(`✅ CONNECTÉ : ${client.user.tag} est prêt !`);

    // Envoi des commandes Slash à Discord
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        console.log('🔄 Enregistrement des commandes (/) en cours...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Commandes (/) enregistrées avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement des commandes :', error);
    }
});

// --- GESTION DES COMMANDES (/) ---
client.on('interactionCreate', async interaction => {
    
    // Si c'est une commande Slash
    if (interaction.isChatInputCommand()) {
        
        // VÉRIFICATION DES PERMISSIONS (Toi ou Rôle Admin)
        const isBoss = interaction.user.id === MON_ID || (interaction.member && interaction.member.roles.cache.has(ID_ROLE_ADMIN));
        
        if (!isBoss) {
            return interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande, chef.", ephemeral: true });
        }

        // COMMANDE : /bloquer
        if (interaction.commandName === 'bloquer') {
            const idCible = interaction.options.getString('id');
            blacklist.add(idCible);
            return interaction.reply({ content: `🚫 L'utilisateur \`${idCible}\` est maintenant blacklisté.`, ephemeral: true });
        }

        // COMMANDE : /debloquer
        if (interaction.commandName === 'debloquer') {
            const idCible = interaction.options.getString('id');
            blacklist.delete(idCible);
            return interaction.reply({ content: `✅ L'utilisateur \`${idCible}\` a été débloqué.`, ephemeral: true });
        }

        // COMMANDE : /dire
        if (interaction.commandName === 'dire') {
            const cibleId = interaction.options.getString('cible');
            const texte = interaction.options.getString('texte');
            const msgId = interaction.options.getString('message_id');
            const fichier = interaction.options.getAttachment('fichier');

            if (!texte && !fichier) {
                return interaction.reply({ content: "❌ Faut au moins mettre un texte ou un fichier boss !", ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true }); // Fait patienter Discord le temps d'envoyer

            try {
                const cible = await client.channels.fetch(cibleId).catch(() => client.users.fetch(cibleId));
                const messageOptions = {};
                if (texte) messageOptions.content = texte;
                if (fichier) messageOptions.files = [fichier.url];

                if (msgId && /^\d{17,20}$/.test(msgId)) {
                    const msgCible = await cible.messages.fetch(msgId);
                    await msgCible.reply(messageOptions);
                } else {
                    await cible.send(messageOptions);
                }
                return interaction.editReply({ content: "✅ Message envoyé avec succès !" });
            } catch (e) {
                return interaction.editReply({ content: "❌ Erreur : ID invalide ou DMs fermés." });
            }
        }

        // COMMANDE : /setup-ticket
        if (interaction.commandName === 'setup-ticket') {
            const categoryId = interaction.options.getString('categorie_id');
            const textePanel = interaction.options.getString('texte') || "📩 **Besoin d'aide ?**\nClique sur le bouton ci-dessous pour ouvrir un ticket.";

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`create_ticket_${categoryId}`)
                        .setLabel('📩 Créer un ticket')
                        .setStyle(ButtonStyle.Success)
                );

            await interaction.channel.send({ content: textePanel, components: [row] });
            return interaction.reply({ content: "✅ Panel de ticket créé avec succès ! (Ce message n'est visible que par toi)", ephemeral: true });
        }
    }

    // --- ÉCOUTE DES BOUTONS (POUR LES TICKETS) ---
    if (interaction.isButton()) {
        // 1. Création d'un ticket
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
                            id: interaction.guild.id, 
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: interaction.user.id, 
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        },
                        {
                            id: client.user.id, 
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        },
                        {
                            id: ID_ROLE_ADMIN, // Donne aussi l'accès aux admins dans le salon
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
                    content: `Bienvenue dans ton ticket <@${interaction.user.id}> ! Un admin (<@&${ID_ROLE_ADMIN}>) va te répondre très vite.`,
                    components: [closeRow]
                });

                // LOGS TYPE DRAFTBOT
                try {
                    const logChannel = await interaction.guild.channels.fetch(ID_SALON_LOG_TICKET);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                            .setDescription(`**${interaction.user.username}** vient d'ouvrir un ticket.`)
                            .setColor('#F47B5A'); 

                        const linkRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setLabel('Accéder au ticket')
                                    .setURL(`https://discord.com/channels/${interaction.guild.id}/${ticketChannel.id}`) 
                                    .setStyle(ButtonStyle.Link) 
                            );

                        await logChannel.send({ embeds: [logEmbed], components: [linkRow] });
                    }
                } catch (err) {
                    console.log("Impossible d'envoyer le log.");
                }

                await interaction.editReply(`✅ Ton ticket a été créé avec succès : <#${ticketChannel.id}>`);
            } catch (e) {
                console.error(e);
                await interaction.editReply("❌ Erreur. Vérifie que l'ID de la catégorie est bon et que j'ai les permissions.");
            }
        }

        // 2. Fermeture d'un ticket
        if (interaction.customId === 'close_ticket') {
            const isBoss = interaction.user.id === MON_ID || (interaction.member && interaction.member.roles.cache.has(ID_ROLE_ADMIN));
            await interaction.reply("🔒 Le ticket va être fermé et supprimé dans 5 secondes...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }
});

// --- GESTION DES DMs CLIENTS (Toujours actif pour le message auto) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (!message.guild) {
        try {
            const moi = await client.users.fetch(MON_ID);
            await moi.send(`📩 **Message de ${message.author.tag}** (\`${message.author.id}\`) :\n> ${message.content}`);
        } catch (e) { console.log("Erreur de transfert vers l'admin"); }

        if (blacklist.has(message.author.id)) {
            console.log(`Spam bloqué pour : ${message.author.tag}`);
            return;
        }

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

// --- LANCEMENT ---
client.login(process.env.TOKEN).catch(err => {
    console.error("❌ Erreur de connexion Discord :", err.message);
});

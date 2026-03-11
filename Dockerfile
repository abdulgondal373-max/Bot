FROM node:20

# Création du dossier de travail
WORKDIR /usr/src/app

# Copie des fichiers de configuration
COPY package*.json ./

# Installation des dépendances (même sans lockfile)
RUN npm install

# Copie du reste du code
COPY . .

# Lancement du bot
CMD [ "node", "index.js" ]

# --- ÉTAPE 1 : Build du Frontend ---
FROM node:20-alpine AS build-frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- ÉTAPE 2 : Runtime Backend ---
FROM node:20-alpine
WORKDIR /app

# Installation des outils de compilation pour better-sqlite3
RUN apk add --no-cache python3 make g++

# Installation des dépendances de prod uniquement
COPY package*.json ./
RUN npm install --omit=dev

# Copie du code serveur et du build frontend
COPY server/ ./server/
COPY --from=build-frontend /app/dist ./dist

# CRUCIAL : Création du dossier et gestion des droits pour SQLite
RUN mkdir -p /app/server && chown -R node:node /app/server

# Sécurité : On utilise l'utilisateur 'node' au lieu de root
USER node

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/server.js"]
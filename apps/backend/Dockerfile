FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/backend ./apps/backend
CMD ["node", "apps/backend/dist/main.js"]

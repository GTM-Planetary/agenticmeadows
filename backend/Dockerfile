FROM node:20-alpine
WORKDIR /app

# OpenSSL required by Prisma on Alpine
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client (detects correct binary target automatically)
RUN npx prisma generate --schema=src/prisma/schema.prisma

# Build TypeScript
RUN npm run build

EXPOSE 4000

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy --schema=src/prisma/schema.prisma && node dist/index.js"]

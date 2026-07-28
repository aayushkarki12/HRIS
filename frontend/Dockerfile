FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npx vite build

FROM node:20-alpine

WORKDIR /app

RUN npm install --global serve

COPY --from=build /app/dist ./dist

EXPOSE 4002

CMD ["npx", "serve", "-s", "dist", "-l", "4002"]

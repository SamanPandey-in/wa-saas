FROM node:22-alpine

WORKDIR /app

COPY client/package*.json ./
RUN npm install

COPY client/src ./src
COPY client/index.html ./
COPY client/vite.config.js ./
COPY client/tailwind.config.js ./
COPY client/postcss.config.js ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
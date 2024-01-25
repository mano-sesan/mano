FROM node:20

WORKDIR /usr/src/app
COPY package*.json ./
# todo remove --legacy-peer-deps
RUN npm install --legacy-peer-deps
COPY . .

ENV NODE_ENV=production
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]

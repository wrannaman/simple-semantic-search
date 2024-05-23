FROM node:18-alpine 
RUN mkdir -p /usr/src/api
WORKDIR /usr/src/api
COPY package.json /usr/src/api/package.json 
RUN npm install -f --omit=dev
COPY . /usr/src/api
RUN mkdir -p /usr/src/api/tmp
ENV ENV=production
ENV PORT 3001
EXPOSE 3001
CMD [ "npm", "run", "prod" ]
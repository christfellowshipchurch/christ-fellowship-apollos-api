FROM node:12-alpine
RUN apk add python
COPY . /usr/src/
WORKDIR /usr/src
RUN yarn
WORKDIR ./packages/apollos-church-api
EXPOSE 4000
CMD [ "yarn", "start:prod" ]

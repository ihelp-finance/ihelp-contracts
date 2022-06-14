FROM node:16

ENV NODE_ENV=production

WORKDIR /worker

ADD artifacts/contracts/ihelp/iHelpToken.sol/iHelpToken.json worker

COPY ./docker/donations-listener/package.json . 
COPY ./artifacts/contracts/ihelp/iHelpToken.sol/iHelpToken.json .

RUN npm install --omit=dev

ADD scripts .

ENV IHELP_ABI_PATH=/worker/iHelpToken.json

ENTRYPOINT [ "node", "donationLogsListener.js"]
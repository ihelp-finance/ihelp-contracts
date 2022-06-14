#!/bin/bash

docker run -d   -e NODE_URL=http://host.docker.internal:7545 \
                -e IHELP_ADDRESS=0x2EE4611Ad6b1015E0b2B18a3e28ABc782BB4C9c6 \
                donations-listener \
                --add-host=host.docker.internal:host-gateway 
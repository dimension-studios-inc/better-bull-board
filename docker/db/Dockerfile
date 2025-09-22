FROM postgres:17

RUN apt-get update && \ 
    apt-get upgrade -y && \
    apt-get install -y curl build-essential git postgresql-server-dev-all libpq-dev

# pg_uuidv7 - build from source
RUN cd "$(mktemp -d)" && \
    git clone https://github.com/fboulnois/pg_uuidv7.git && \
    cd pg_uuidv7 && \
    make && \
    make install


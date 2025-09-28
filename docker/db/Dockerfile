FROM postgres:17

# Install PostGIS, pgvector, build deps, and pg_uuidv7 build deps
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y \
      postgis \
      curl \
      git \
      build-essential \
      libpq-dev \
      postgresql-17-pgvector \
      postgresql-server-dev-17 && \
    rm -rf /var/lib/apt/lists/*

# Build and install pg_uuidv7 from source
RUN cd "$(mktemp -d)" && \
    git clone https://github.com/fboulnois/pg_uuidv7.git && \
    cd pg_uuidv7 && \
    make && \
    make install

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html

COPY index.html ./
COPY three.min.js OrbitControls.js STLLoader.js ./
COPY Musik ./Musik
COPY docs ./docs
COPY scripts ./scripts

EXPOSE 80

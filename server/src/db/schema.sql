CREATE DATABASE wa_saas;
CREATE USER wa_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE wa_saas TO wa_user;
\c wa_saas
GRANT ALL ON SCHEMA public TO wa_user;
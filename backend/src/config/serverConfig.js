module.exports = {
    port: process.env.PORT || 5002, // Define a porta para 5002 por padrão
    sessionSecret: process.env.SESSION_SECRET || 'default-secret'
};

module.exports = (err, req, res, next) => {
    console.error('Erro:', err.message);
    res.status(err.status || 500).json({
        error: err.message || 'Erro interno do servidor.'
    });
};

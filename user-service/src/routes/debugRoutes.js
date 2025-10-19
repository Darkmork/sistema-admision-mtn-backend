const express = require('express');
const router = express.Router();

// GET /internal/db-check
// Realiza una consulta simple a la base de datos para comprobar conectividad
router.get('/db-check', async (req, res) => {
  if (!req.dbPool) {
    return res.status(500).json({ success: false, message: 'No database pool attached to request' });
  }

  let client;
  try {
    client = await req.dbPool.connect();
    const result = await client.query('SELECT 1 as ok');
    res.json({ success: true, db: { rows: result.rows } });
  } catch (err) {
    console.error('DB check failed:', err && err.message);
    res.status(500).json({ success: false, error: err && err.message });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;


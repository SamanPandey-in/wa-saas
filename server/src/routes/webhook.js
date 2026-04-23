import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'webhook route' });
});

export default router;
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';
import { getWorkerInstance, setWorkerInstance } from '../engine/workerRegistry';

const router = Router();

export { setWorkerInstance };

router.use(authMiddleware, adminMiddleware);

router.get('/status', (_req, res) => {
  const workerRef = getWorkerInstance();
  if (!workerRef) {
    return res.status(503).json({ success: false, message: 'Worker no inicializado' });
  }
  res.json({ success: true, data: (workerRef as any).getStatus() });
});

router.post('/pause', (_req, res) => {
  const workerRef = getWorkerInstance();
  if (!workerRef) {
    return res.status(503).json({ success: false, message: 'Worker no inicializado' });
  }
  (workerRef as any).stop();
  res.json({ success: true, message: 'Worker pausado' });
});

router.post('/resume', (_req, res) => {
  const workerRef = getWorkerInstance();
  if (!workerRef) {
    return res.status(503).json({ success: false, message: 'Worker no inicializado' });
  }
  (workerRef as any).start();
  res.json({ success: true, message: 'Worker reanudado' });
});

router.post('/pause-strategy/:id', async (req, res) => {
  const workerRef = getWorkerInstance();
  if (!workerRef) {
    return res.status(503).json({ success: false, message: 'Worker no inicializado' });
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: 'ID inválido' });
  }
  await (workerRef as any).pauseStrategy(id);
  res.json({ success: true, message: `Estrategia ${id} pausada` });
});

export default router;

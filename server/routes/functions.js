import { Router } from 'express';
import { authMiddleware } from './auth.js';
import transcribeAudio from '../functions/transcribeAudio.js';
import getAnalytics from '../functions/getAnalytics.js';
import indexKnowledgeBase from '../functions/indexKnowledgeBase.js';
import agentChat from '../functions/agentChat.js';
import invokeLLM from '../functions/invokeLLM.js';

const router = Router();

const handlers = {
  transcribeAudio,
  getAnalytics,
  indexKnowledgeBase,
  agentChat,
  invokeLLM,
};

router.post('/:name', authMiddleware, (req, res) => {
  const fn = handlers[req.params.name];
  if (!fn) return res.status(404).json({ error: `Function "${req.params.name}" not found` });
  fn(req, res).catch(err => {
    console.error(`Function ${req.params.name} error:`, err);
    res.status(500).json({ error: err.message });
  });
});

export default router;

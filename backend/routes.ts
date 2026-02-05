import { Router } from 'express';
import { registerOrg, login, createBoard, createTask, getBoard, getBoards, moveTask, updateTask, deleteTask, updateBoard, deleteBoard, deleteOrganization } from './controllers';

export const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

router.post('/orgs/register', registerOrg);
router.post('/auth/login', login);
router.post('/boards', createBoard);
router.get('/boards/:id', getBoard);
router.put('/boards/:id', updateBoard);
router.delete('/boards/:id', deleteBoard);
router.delete('/orgs/:id', deleteOrganization);
router.get('/orgs/:orgId/boards', getBoards);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);
router.post('/tasks/move', moveTask);

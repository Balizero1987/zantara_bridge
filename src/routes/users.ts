import { Request, Response, Router } from 'express';
import crypto from 'crypto';

const router = Router();

interface User {
  id: string;
  username: string;
  email?: string;
  apiKey: string;
  created: Date;
  lastAccess: Date;
  chatCount: number;
  documentsUploaded: number;
}

const users: Map<string, User> = new Map();

// POST /api/users/register
router.post('/register', (req: Request, res: Response) => {
  const { username, email } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }
  
  // Check if username already exists
  const existingUser = Array.from(users.values()).find(u => u.username === username);
  if (existingUser) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  
  const userId = crypto.randomUUID();
  const userApiKey = crypto.randomBytes(32).toString('hex');
  
  const newUser: User = {
    id: userId,
    username,
    email,
    apiKey: userApiKey,
    created: new Date(),
    lastAccess: new Date(),
    chatCount: 0,
    documentsUploaded: 0
  };
  
  users.set(userId, newUser);
  
  res.json({
    userId,
    apiKey: userApiKey,
    username,
    message: 'User created successfully'
  });
});

// GET /api/users/:id
router.get('/:id', (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Don't expose API key in response
  const { apiKey, ...userInfo } = user;
  res.json(userInfo);
});

// GET /api/users
router.get('/', (req: Request, res: Response) => {
  const userList = Array.from(users.values()).map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    created: u.created,
    lastAccess: u.lastAccess,
    chatCount: u.chatCount,
    documentsUploaded: u.documentsUploaded
  }));
  
  res.json({
    users: userList,
    total: userList.length
  });
});

// PUT /api/users/:id
router.put('/:id', (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { username, email } = req.body;
  
  if (username) user.username = username;
  if (email !== undefined) user.email = email;
  user.lastAccess = new Date();
  
  users.set(req.params.id, user);
  
  const { apiKey, ...userInfo } = user;
  res.json({ ...userInfo, message: 'User updated successfully' });
});

// DELETE /api/users/:id
router.delete('/:id', (req: Request, res: Response) => {
  const deleted = users.delete(req.params.id);
  
  if (!deleted) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ message: 'User deleted successfully' });
});

// Function to update user stats
export function updateUserStats(userId: string, chatIncrement: number = 0, docIncrement: number = 0) {
  const user = users.get(userId);
  if (user) {
    user.chatCount += chatIncrement;
    user.documentsUploaded += docIncrement;
    user.lastAccess = new Date();
    users.set(userId, user);
  }
}

export { router as usersRouter, users };
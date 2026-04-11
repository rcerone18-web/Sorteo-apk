import { Router } from 'express';
import { ventasRoutes } from './ventasRoutes';
import { authRoutes } from './authRoutes';
import { configRoutes } from './configRoutes';
import { participacionesRoutes } from './participacionesRoutes';
import { adminRoutes } from './adminRoutes';
import { sorteosRoutes } from './sorteosRoutes';
import { bonosRoutes } from './bonosRoutes';

export const apiRoutes = Router();

apiRoutes.use('/api/auth', authRoutes);
apiRoutes.use('/api/ventas', ventasRoutes);
apiRoutes.use('/api/config', configRoutes);
apiRoutes.use('/api/participaciones', participacionesRoutes);
apiRoutes.use('/api/admin', adminRoutes);
apiRoutes.use('/api/sorteos', sorteosRoutes);
apiRoutes.use('/api/bonos', bonosRoutes);


import { createContext } from '@/lib/context'

import { startTablesFactoryWorker } from './core'

startTablesFactoryWorker(createContext())

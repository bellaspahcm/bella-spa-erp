import type { Database } from './src/types/database.types';

type LogisticsSchema = Database['logistics'];
type LogisticsTables = LogisticsSchema['Tables'];

export type Probe = LogisticsTables;

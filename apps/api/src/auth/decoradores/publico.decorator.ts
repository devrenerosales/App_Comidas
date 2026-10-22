import { SetMetadata } from '@nestjs/common';
import { ES_PUBLICO } from '../auth.constants';

/** Marca un controlador o ruta como pública: el `JwtAuthGuard` global no exige token. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);

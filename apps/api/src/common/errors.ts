import { NotFoundException } from '@nestjs/common';

export function notFound(): never {
  throw new NotFoundException('Not found');
}

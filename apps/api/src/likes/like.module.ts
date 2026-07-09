import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LikeController } from './like.controller';
import { LikeService } from './like.service';

@Module({
  controllers: [LikeController],
  exports: [LikeService],
  imports: [AuthModule, PrismaModule],
  providers: [LikeService],
})
export class LikeModule {}

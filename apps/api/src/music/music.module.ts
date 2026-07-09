import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { MusicController } from './music.controller';
import { MusicService } from './music.service';

@Module({
  controllers: [MusicController],
  imports: [AuthModule, OperationLogModule],
  providers: [MusicService],
})
export class MusicModule {}
